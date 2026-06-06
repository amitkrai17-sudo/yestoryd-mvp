// =============================================================================
// ADMIN LIST ENRICHMENT TESTS — lib/tuition/admin-list-enrichment.ts
// tests/tuition/admin-list-enrichment.test.ts
//
// UI-1.1b CONTRACT REFERENCE: production aggregation now runs in the SQL RPC
// get_admin_tuition_enrichments. These pure helpers encode the exact contract that
// the SQL must reproduce (positive-only lifetime sum; twin-deduped last WA send with
// BOOL_OR(wa_sent); last-10 phone normalization both sides; created_at ordering since
// sent_at is null on failures). Kept as the executable spec since the RPC can't be
// unit-tested against a live DB here.
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  sumLifetimeCredited,
  computeLastWaByPhoneKey,
  last10Digits,
  type LedgerDelta,
  type CommLogRow,
} from '@/lib/tuition/admin-list-enrichment';

describe('sumLifetimeCredited', () => {
  it('sums ONLY positive ledger rows, grouped per enrollment', () => {
    const rows: LedgerDelta[] = [
      { enrollment_id: 'A', change_amount: 8 },   // initial_purchase
      { enrollment_id: 'A', change_amount: -1 },  // session_completed (excluded)
      { enrollment_id: 'A', change_amount: 4 },   // top_up
      { enrollment_id: 'A', change_amount: 0 },   // enrollment_created (excluded)
      { enrollment_id: 'B', change_amount: 10 },
      { enrollment_id: 'B', change_amount: -3 },  // excluded
    ];
    const map = sumLifetimeCredited(rows);
    expect(map.A).toBe(12); // 8 + 4, the -1 and 0 excluded
    expect(map.B).toBe(10);
  });

  it('skips null enrollment_id and null amounts', () => {
    const rows: LedgerDelta[] = [
      { enrollment_id: null, change_amount: 5 },
      { enrollment_id: 'C', change_amount: null },
      { enrollment_id: 'C', change_amount: 6 },
    ];
    const map = sumLifetimeCredited(rows);
    expect(map.C).toBe(6);
    expect('null' in map).toBe(false);
  });
});

describe('last10Digits', () => {
  it('normalizes +91 / 91 / bare / 0-prefix to the same 10-digit key', () => {
    expect(last10Digits('+919687606177')).toBe('9687606177');
    expect(last10Digits('919687606177')).toBe('9687606177');
    expect(last10Digits('9687606177')).toBe('9687606177');
    expect(last10Digits('09687606177')).toBe('9687606177');
    expect(last10Digits(null)).toBe('');
  });

  it('UI-1.1b: malformed double-prefix 91+91... normalizes to the bare 10-digit (the bug this RPC fixes)', () => {
    // prod row recipient_phone='91+919920828303' — the old .in() candidate set
    // {k,91k,+91k,0k} never produced this string, so the row was dropped before
    // matching. SQL right(regexp_replace('91+919920828303','\D','','g'),10) and this
    // helper both yield '9920828303' === last10Digits('9920828303').
    expect(last10Digits('91+919920828303')).toBe('9920828303');
    expect(last10Digits('9920828303')).toBe('9920828303');
    expect(last10Digits('91+919920828303')).toBe(last10Digits('9920828303'));
  });
});

describe('computeLastWaByPhoneKey', () => {
  const KEY = '9687606177';
  const keys = new Set([KEY]);

  it('twin {false,true} (differing wa_sent + phone format, same template ~same time) → wa_sent=true, no error', () => {
    const rows: CommLogRow[] = [
      // failed twin: +91 format, wa_sent false, has error, no sent_at
      { template_code: 'parent_renewal_intent_v1', recipient_phone: '+919687606177', wa_sent: false,
        error_message: 'provider timeout', channel: null, sent_at: null, created_at: '2026-06-06T10:00:01.000Z' },
      // success twin: 91 format, wa_sent true, sent_at set, channel aisensy
      { template_code: 'parent_renewal_intent_v1', recipient_phone: '919687606177', wa_sent: true,
        error_message: null, channel: 'aisensy', sent_at: '2026-06-06T10:00:02.000Z', created_at: '2026-06-06T10:00:02.000Z' },
    ];
    const out = computeLastWaByPhoneKey(rows, keys);
    expect(out[KEY].wa_sent).toBe(true);            // BOOL_OR over the group
    expect(out[KEY].error_message).toBeNull();      // success group → no error
    expect(out[KEY].template_code).toBe('parent_renewal_intent_v1');
    expect(out[KEY].sent_at).toBe('2026-06-06T10:00:02.000Z');
    expect(out[KEY].channel).toBe('aisensy');
  });

  it('phone-format variance still matches the student key (+91 vs 91 vs bare)', () => {
    const rows: CommLogRow[] = [
      { template_code: 't', recipient_phone: '+91 9687606177', wa_sent: true,
        error_message: null, channel: 'leadbot', sent_at: '2026-06-06T09:00:00.000Z', created_at: '2026-06-06T09:00:00.000Z' },
    ];
    const out = computeLastWaByPhoneKey(rows, keys);
    expect(out[KEY]?.wa_sent).toBe(true);
  });

  it('parent with no logs → key absent (→ null at merge)', () => {
    const out = computeLastWaByPhoneKey([], keys);
    expect(out[KEY]).toBeUndefined();
  });

  it('all-failed group → wa_sent=false and surfaces the newest error_message', () => {
    const rows: CommLogRow[] = [
      { template_code: 't', recipient_phone: '919687606177', wa_sent: false,
        error_message: 'older error', channel: null, sent_at: null, created_at: '2026-06-06T08:00:00.000Z' },
      { template_code: 't', recipient_phone: '+919687606177', wa_sent: false,
        error_message: 'newest error', channel: null, sent_at: null, created_at: '2026-06-06T08:00:03.000Z' },
    ];
    const out = computeLastWaByPhoneKey(rows, keys);
    expect(out[KEY].wa_sent).toBe(false);
    expect(out[KEY].error_message).toBe('newest error');
  });

  it('only the MOST-RECENT group is returned (older different-template send ignored)', () => {
    const rows: CommLogRow[] = [
      { template_code: 'old_template', recipient_phone: '919687606177', wa_sent: true,
        error_message: null, channel: 'aisensy', sent_at: '2026-06-01T10:00:00.000Z', created_at: '2026-06-01T10:00:00.000Z' },
      { template_code: 'new_template', recipient_phone: '919687606177', wa_sent: true,
        error_message: null, channel: 'aisensy', sent_at: '2026-06-06T10:00:00.000Z', created_at: '2026-06-06T10:00:00.000Z' },
    ];
    const out = computeLastWaByPhoneKey(rows, keys);
    expect(out[KEY].template_code).toBe('new_template');
  });

  it('UI-1.1b-fix: email-only send (wa_sent NULL) is EXCLUDED → no false WA "failed"', () => {
    const rows: CommLogRow[] = [
      // email-only row: wa_sent null, channel null (prod email sits in channel=null) — NOT a WA send
      { template_code: 'parent_report_email', recipient_phone: '919687606177', wa_sent: null,
        error_message: null, channel: null, sent_at: '2026-06-06T11:00:00.000Z', created_at: '2026-06-06T11:00:00.000Z' },
    ];
    const out = computeLastWaByPhoneKey(rows, keys);
    expect(out[KEY]).toBeUndefined(); // parent whose only send was email → last_wa = null
  });

  it('UI-1.1b-fix: a real WA row still wins even when a NEWER email-only row exists', () => {
    const rows: CommLogRow[] = [
      // newer email-only row (excluded)
      { template_code: 'parent_report_email', recipient_phone: '919687606177', wa_sent: null,
        error_message: null, channel: null, sent_at: '2026-06-06T12:00:00.000Z', created_at: '2026-06-06T12:00:00.000Z' },
      // older real WA send (should anchor last_wa)
      { template_code: 'parent_renewal_intent_v1', recipient_phone: '919687606177', wa_sent: true,
        error_message: null, channel: 'aisensy', sent_at: '2026-06-06T11:00:00.000Z', created_at: '2026-06-06T11:00:00.000Z' },
    ];
    const out = computeLastWaByPhoneKey(rows, keys);
    expect(out[KEY]?.template_code).toBe('parent_renewal_intent_v1');
    expect(out[KEY]?.wa_sent).toBe(true);
  });

  it('rows for phones NOT in the key set are ignored', () => {
    const rows: CommLogRow[] = [
      { template_code: 't', recipient_phone: '910000000000', wa_sent: true,
        error_message: null, channel: 'aisensy', sent_at: '2026-06-06T10:00:00.000Z', created_at: '2026-06-06T10:00:00.000Z' },
    ];
    const out = computeLastWaByPhoneKey(rows, keys);
    expect(Object.keys(out)).toHaveLength(0);
  });
});
