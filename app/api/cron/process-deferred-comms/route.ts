// ============================================================
// FILE: app/api/cron/process-deferred-comms/route.ts
// PURPOSE: Drain-2C — drain stale communication_queue rows through notify.ts
// SCHEDULE: Daily 08:00 IST via dispatcher (matches queue's quiet-end pattern;
//           queue's typical scheduled_for is 02:30 UTC = 08:00 IST)
//
// CONTRACT: Drains rows where processed_at IS NULL AND scheduled_for <= NOW().
// Routes each row through sendNotification() which re-applies all spine guards
// (template lookup, daily cap, quiet hours, idempotency, channel resolution).
// Single-shot per tick — soft failures leave processed_at NULL for next-day
// retry. Permanent failures (template_not_found for retired templates) will
// retry daily until the row is closed manually or the template is created.
//
// COLUMN WRITE CONTRACT (locked at Gate 1.1):
//   processed_at      Yes — on success / re-deferred only   The dedup primitive
//   log_id            Yes — on success only                  FK back to communication_logs
//   error_message     Yes — on failure                       Diagnostic
//   last_attempt_at   Yes — on every attempt                 Free observability
//   max_attempts      Read but don't write                   Schema's stated cap; ignored single-shot
//   next_attempt_at   Don't read, don't write                Future-hardening only
//   status            Don't write                            Always 'pending' from notify.ts
//
// VARIABLES UNWRAPPING: Drain-2B writes variables as
//   { template_vars: {...}, _meta: { triggered_by_user_id } }
// This drainer unwraps template_vars to sendNotification's namedParams arg
// and lifts _meta.triggered_by_user_id into NotifyMeta.triggeredByUserId.
//
// See docs/CURRENT-STATE.md Architecture Decisions 2026-05-04 for the
// deferred-message contract. Drain-2A added schema; Drain-2B switched
// notify.ts deferral target; Drain-2C (this file) drains the queue.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/communication/notify';
import type { TemplateButtons } from '@/lib/communication/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const BATCH_SIZE = 50;

// 2a: blanket staleness backstop. now()-scheduled_for beyond this drops the row
// (ANY template) — see the per-row check for the 36h justification.
const STALE_BACKSTOP_MS = 36 * 60 * 60 * 1000;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
/** Today's date in IST as 'YYYY-MM-DD' via the +05:30 offset + getUTC* (NOT
 *  toISOString, which rolls to the next UTC day during late-evening IST). */
function istTodayYmd(): string {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// NotifyMeta.triggeredBy is a strict union; queue.created_by is text.
// Validate before passing to sendNotification via a type guard so no cast
// is needed at the call site.
type TriggeredBy = 'system' | 'coach' | 'admin' | 'cron';
function isTriggeredBy(value: string): value is TriggeredBy {
  return value === 'system' || value === 'coach' || value === 'admin' || value === 'cron';
}

interface QueueRow {
  id: string;
  template_code: string;
  recipient_id: string | null;
  recipient_phone: string | null;
  variables: {
    template_vars?: Record<string, unknown>;
    _meta?: {
      triggered_by_user_id?: string | null;
      // DRAIN-2C-FIX A+: optional envelope fields preserved across defer→drain.
      // Read null-safe; precedence in the unwrap below is _meta → row column →
      // literal fallback so historical rows (and the 15 stuck on 2026-05-13)
      // behave identically to today.
      templateButtons?: TemplateButtons | null;
      contextType?: string | null;
      contextId?: string | null;
    };
  } | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_by: string | null;
  scheduled_for: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // ── Selection: oldest-first, due now, not yet processed ──
  const { data: rows, error: selErr } = await supabase
    .from('communication_queue')
    .select('id, template_code, recipient_id, recipient_phone, variables, related_entity_type, related_entity_id, created_by, scheduled_for')
    .is('processed_at', null)
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_SIZE)
    .returns<QueueRow[]>();

  if (selErr) {
    console.error(JSON.stringify({
      event: 'drain_2c_select_error',
      error: selErr.message,
    }));
    return NextResponse.json({ success: false, error: 'select_failed' }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    console.log(JSON.stringify({
      event: 'drain_2c_summary',
      claimed: 0, drained: 0, failed: 0, reDeferred: 0, skippedStale: 0, staleSkipped: 0,
      durationMs: Date.now() - startTime,
    }));
    return NextResponse.json({
      success: true, claimed: 0, drained: 0, failed: 0, reDeferred: 0, skippedStale: 0, staleSkipped: 0,
    });
  }

  let drained = 0;
  let failed = 0;
  let reDeferred = 0;
  let skippedStale = 0;
  let staleSkipped = 0;

  for (const row of rows) {
    const nowIso = new Date().toISOString();

    // 2a: blanket staleness backstop (generalization of 1b to ALL templates).
    // Placed BEFORE the recipient/contextId resolution and the 1b session lookup
    // — cheapest short-circuit. The drainer runs once daily at 08:00 IST, so a
    // direct-insert (scheduled_for=now()) row waits up to ~24h for its first
    // drain; 36h guarantees ≥1 attempt before drop and catches genuine staleness
    // by the 2nd cycle. Lateness is elapsed-ms from scheduled_for (intended send),
    // NOT created_at. 1b still runs after this for the precise same-day case.
    if (Date.now() - new Date(row.scheduled_for).getTime() > STALE_BACKSTOP_MS) {
      await supabase
        .from('communication_queue')
        .update({
          processed_at: nowIso,
          error_message: 'stale: >36h past scheduled_for (missed drain cycle)',
          last_attempt_at: nowIso,
        })
        .eq('id', row.id);
      staleSkipped++;
      console.log(JSON.stringify({
        event: 'drain_2c_row',
        queueId: row.id,
        templateCode: row.template_code,
        result: 'stale_backstop',
        scheduledFor: row.scheduled_for,
      }));
      continue;
    }

    // Recipient: prefer UUID, fall back to phone (matches Drain-2A CHECK constraint)
    const recipient = row.recipient_id ?? row.recipient_phone;
    if (!recipient) {
      // CHECK constraint should have prevented this, but be defensive
      await markFailedAttempt(supabase, row.id, 'no_recipient', nowIso);
      failed++;
      console.log(JSON.stringify({
        event: 'drain_2c_row',
        queueId: row.id,
        templateCode: row.template_code,
        result: 'failed',
        errorMessage: 'no_recipient',
      }));
      continue;
    }

    // Unwrap Drain-2B's variables.{template_vars, _meta} envelope.
    // DRAIN-2C-FIX A+: _meta may now also carry templateButtons + context.
    const v = row.variables ?? {};
    const templateVarsRaw = (v.template_vars ?? {}) as Record<string, unknown>;
    const metaWrapped = v._meta ?? {};

    // notify.ts namedParams is Record<string, string>; coerce defensively
    const templateVars: Record<string, string> = {};
    for (const [k, val] of Object.entries(templateVarsRaw)) {
      templateVars[k] = String(val ?? '');
    }

    // Validate created_by against NotifyMeta.triggeredBy union; fall back to 'cron'
    const createdBy = row.created_by ?? '';
    const triggeredBy: TriggeredBy = isTriggeredBy(createdBy) ? createdBy : 'cron';

    // DRAIN-2C-FIX A+: precedence for context — _meta envelope (original
    // caller's intent) > queue's native columns > cron literal fallback.
    // Drops back to today's behaviour when _meta is the pre-A+ shape.
    const resolvedContextType =
      metaWrapped.contextType ?? row.related_entity_type ?? 'cron:process-deferred-comms';
    const resolvedContextId =
      metaWrapped.contextId ?? row.related_entity_id ?? null;

    // 1b: never drain a stale session-reminder. The 1a sent-flag latch stops the
    // re-enqueue at source; this guards rows queued before 1a shipped (Web
    // neutralized 214; this catches stragglers). Convention check: every
    // session-reminder code contains 'session_reminder' (the 5 current codes +
    // any future _online_/window variant); non-reminder session templates
    // (session_summary, session_cancelled) lack it and still send for past sessions.
    if (row.template_code.includes('session_reminder')) {
      const staleReason = await reminderStaleReason(supabase, resolvedContextId);
      if (staleReason) {
        await supabase
          .from('communication_queue')
          .update({
            processed_at: nowIso,
            error_message: `stale: ${staleReason}`,
            last_attempt_at: nowIso,
          })
          .eq('id', row.id);
        skippedStale++;
        console.log(JSON.stringify({
          event: 'drain_2c_row',
          queueId: row.id,
          templateCode: row.template_code,
          result: 'skipped_stale',
          reason: staleReason,
        }));
        continue;
      }
    }

    try {
      const result = await sendNotification(
        row.template_code,
        recipient,
        templateVars,
        {
          triggeredBy,
          triggeredByUserId: metaWrapped.triggered_by_user_id ?? null,
          // A+ envelope value wins; falls back to today's behaviour when absent.
          templateButtons: metaWrapped.templateButtons ?? undefined,
          contextType: resolvedContextType,
          contextId: resolvedContextId,
          contextData: {
            drained_from_queue_id: row.id,
            scheduled_for: row.scheduled_for,
            original_created_by: createdBy,
          },
        },
      );

      if (result.success) {
        await supabase
          .from('communication_queue')
          .update({
            processed_at: nowIso,
            sent_at: nowIso,
            log_id: result.logId ?? null,
            error_message: null,
            last_attempt_at: nowIso,
          })
          .eq('id', row.id);
        drained++;
        console.log(JSON.stringify({
          event: 'drain_2c_row',
          queueId: row.id,
          templateCode: row.template_code,
          result: 'drained',
          logId: result.logId,
        }));
      } else if (result.deferred) {
        // Re-deferred (notify.ts inserted a fresh queue row). Close THIS row.
        // Should not happen at 08:00 IST since quiet ends at 07:00 — defensive.
        await supabase
          .from('communication_queue')
          .update({
            processed_at: nowIso,
            error_message: `re-deferred to ${result.queueId ?? 'unknown'}`,
            last_attempt_at: nowIso,
          })
          .eq('id', row.id);
        reDeferred++;
        console.log(JSON.stringify({
          event: 'drain_2c_row',
          queueId: row.id,
          templateCode: row.template_code,
          result: 're_deferred',
          newQueueId: result.queueId,
        }));
      } else {
        // Soft failure — leave processed_at NULL for next-day retry
        await markFailedAttempt(supabase, row.id, result.reason ?? 'send_failed', nowIso);
        failed++;
        console.log(JSON.stringify({
          event: 'drain_2c_row',
          queueId: row.id,
          templateCode: row.template_code,
          result: 'failed',
          errorMessage: result.reason,
        }));
      }
    } catch (e) {
      const msg = (e instanceof Error ? e.message : 'unknown_exception').slice(0, 500);
      await markFailedAttempt(supabase, row.id, `exception: ${msg}`, nowIso);
      failed++;
      console.log(JSON.stringify({
        event: 'drain_2c_row',
        queueId: row.id,
        templateCode: row.template_code,
        result: 'failed',
        errorMessage: `exception: ${msg}`,
      }));
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(JSON.stringify({
    event: 'drain_2c_summary',
    claimed: rows.length,
    drained,
    failed,
    reDeferred,
    skippedStale,
    staleSkipped,
    durationMs,
  }));

  return NextResponse.json({
    success: true,
    claimed: rows.length,
    drained,
    failed,
    reDeferred,
    skippedStale,
    staleSkipped,
  });
}

// ── Helpers ────────────────────────────────────────────────────

// Soft failure: leave processed_at NULL, log error_message + last_attempt_at.
// Next day's cron retries.
async function markFailedAttempt(
  supabase: ReturnType<typeof createAdminClient>,
  queueId: string,
  errorMessage: string,
  nowIso: string,
): Promise<void> {
  await supabase
    .from('communication_queue')
    .update({
      error_message: errorMessage,
      last_attempt_at: nowIso,
    })
    .eq('id', queueId);
}

// 1b: returns a stale-reason string when a queued session-reminder must NOT be
// sent, or null when the session is still a today-or-future 'scheduled' row.
async function reminderStaleReason(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string | null,
): Promise<string | null> {
  if (!sessionId) return 'no_session_context';
  const { data: session } = await supabase
    .from('scheduled_sessions')
    .select('id, status, scheduled_date')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return 'session_not_found';
  if (session.status !== 'scheduled') return `status_${session.status}`;
  // scheduled_date is a 'YYYY-MM-DD' date column; lexical compare vs IST-today
  // is exact and DST-safe (both sides are pure calendar dates).
  if (session.scheduled_date && session.scheduled_date < istTodayYmd()) return 'past_date';
  return null;
}
