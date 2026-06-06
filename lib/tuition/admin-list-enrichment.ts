// ============================================================
// FILE: lib/tuition/admin-list-enrichment.ts
// PURPOSE: Read-only enrichment helpers for the admin English Classes list.
//
// UI-1.1b: the PRODUCTION aggregation now runs in SQL — the STABLE RPC
// get_admin_tuition_enrichments (migration 20260606_get_admin_tuition_enrichments.sql),
// called once from app/api/admin/tuition/route.ts. It normalizes phones in SQL so
// malformed stored formats ('91+919920828303') match, which the old JS candidate
// pre-filter dropped.
//
// `last10Digits` is STILL the live helper — the route uses it to key students
// (match_last10) onto the RPC result.
//
// `sumLifetimeCredited` + `computeLastWaByPhoneKey` are the CONTRACT REFERENCE:
// the JS twin/positive logic the SQL RPC must reproduce, pinned by the unit tests
// in tests/tuition/admin-list-enrichment.test.ts. They are no longer on the request
// path (the SQL is), but kept as the executable spec since the RPC can't be unit-
// tested against a live DB here.
// ============================================================

// ---- A. lifetime_credited (balance denominator "Y") ----

export interface LedgerDelta {
  enrollment_id: string | null;
  change_amount: number | null;
}

/**
 * SUM(change_amount) FILTER (WHERE change_amount > 0) GROUP BY enrollment_id.
 * Filters positives defensively even if handed mixed rows — the SSOT-correct
 * lifetime credited total per enrollment (always >= sessions_remaining).
 */
export function sumLifetimeCredited(rows: LedgerDelta[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (!r.enrollment_id) continue;
    const amt = r.change_amount ?? 0;
    if (amt > 0) map[r.enrollment_id] = (map[r.enrollment_id] || 0) + amt;
  }
  return map;
}

// ---- B. last_wa (twin-deduped last outbound WhatsApp send) ----

export interface CommLogRow {
  template_code: string;
  recipient_phone: string | null;
  wa_sent: boolean | null;
  error_message: string | null;
  channel: string | null;
  sent_at: string | null;
  created_at: string | null;
}

export interface LastWa {
  template_code: string;
  sent_at: string | null;
  wa_sent: boolean;
  error_message: string | null;
  channel: string | null;
}

/** Normalize a phone to its bare last-10 digits (strips +, 91 country code, spaces, 0-prefix). */
export function last10Digits(phone: string | null | undefined): string {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

/**
 * Most-recent outbound WhatsApp send per phone-key, with the known twin-row pattern
 * (same template_code within a few seconds, differing wa_sent + phone format) collapsed.
 *
 * Status = BOOL_OR(wa_sent) over the group — a naive latest-row pick would grab the
 * failed twin and falsely show "failed". Ordering/bucketing is on created_at because
 * sent_at is null on failed sends. idempotency_key is deliberately NOT used as the key
 * (it is null on failures, so it can never merge a {false,true} pair).
 *
 * @param rows      raw communication_logs rows (any order)
 * @param phoneKeys the set of last-10 keys we care about (the page's students)
 * @param twinWindowMs cluster window for collapsing twins (default 10s)
 */
export function computeLastWaByPhoneKey(
  rows: CommLogRow[],
  phoneKeys: Set<string>,
  twinWindowMs = 10_000,
): Record<string, LastWa> {
  // Bucket rows by phone-key (only keys we care about).
  // wa_sent IS NOT NULL is the WhatsApp discriminant: email-only rows leave wa_sent
  // null and must NOT enter a group (else an email send falsely shows the WA chip as
  // failed/empty). channel can't isolate email — prod email rows sit in channel=null.
  const byKey: Record<string, CommLogRow[]> = {};
  for (const row of rows) {
    if (row.wa_sent === null || row.wa_sent === undefined) continue;
    const k = last10Digits(row.recipient_phone);
    if (!phoneKeys.has(k)) continue;
    (byKey[k] ||= []).push(row);
  }

  const out: Record<string, LastWa> = {};
  for (const [k, list] of Object.entries(byKey)) {
    // Newest first (created_at desc; ISO strings sort chronologically).
    list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const newest = list[0];
    const anchorMs = Date.parse(newest.created_at || '') || 0;

    // The latest GROUP: same template_code, within twinWindowMs of the newest row.
    const group = list.filter(r => {
      if (r.template_code !== newest.template_code) return false;
      const ms = Date.parse(r.created_at || '') || 0;
      return anchorMs - ms <= twinWindowMs;
    });

    const waSent = group.some(r => r.wa_sent === true); // BOOL_OR
    const sentAt = group
      .map(r => r.sent_at)
      .filter((s): s is string => !!s)
      .sort()
      .pop() ?? null; // latest real send time, null if never sent
    const channel = group.map(r => r.channel).find((c): c is string => !!c) ?? null;

    out[k] = {
      template_code: newest.template_code,
      sent_at: sentAt,
      wa_sent: waSent,
      // A successful group shows no error even if a failed twin existed; an all-failed
      // group surfaces the newest row's error_message.
      error_message: waSent ? null : (newest.error_message ?? null),
      channel,
    };
  }
  return out;
}
