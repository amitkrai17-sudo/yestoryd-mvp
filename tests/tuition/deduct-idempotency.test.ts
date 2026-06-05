// =============================================================================
// DEDUCT IDEMPOTENCY TESTS — lib/tuition/balance-tracker.ts (deductTuitionBalance)
// tests/tuition/deduct-idempotency.test.ts
//
// Phase 2B.1: INSERT-FIRST idempotency guard. A repeated deduct for the same
// session_id collides on the partial unique index uniq_tuition_ledger_deduct_session
// → PG 23505 → the helper SKIPS the decrement and returns idempotentSkip:true.
//
// Asserts NEW behavior: double-call (same session, DIFFERENT requestId) →
//   (a) balance decremented exactly ONCE, (b) exactly ONE committed ledger row
//   (2nd insert rejected with 23505), (c) 2nd call returns idempotentSkip:true and
//   does NOT throw, (d) differing requestId does NOT defeat dedupe (key = session_id).
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  enrollment: null as any,
  // Per-attempt ledger insert errors: [1st, 2nd]. 1st clean, 2nd 23505.
  ledgerErrors: [] as Array<{ code?: string; message: string } | null>,
  ledgerInsertCalls: [] as Array<Record<string, unknown>>,
  enrollmentUpdateCalls: [] as Array<{ patch: Record<string, unknown> }>,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'enrollments') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.enrollment, error: null }) }) }),
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, _id: string) => {
              state.enrollmentUpdateCalls.push({ patch });
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }
      if (table === 'tuition_session_ledger') {
        return {
          insert: (row: Record<string, unknown>) => {
            state.ledgerInsertCalls.push(row);
            const err = state.ledgerErrors[state.ledgerInsertCalls.length - 1] ?? null;
            return Promise.resolve({ data: null, error: err });
          },
        };
      }
      if (table === 'children') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { child_name: 'Test Child', parent_phone: '919999999999' }, error: null }) }) }) };
      }
      if (table === 'parents') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  })),
}));

// No alert branch fires at newBalance=4 (>2), but mock notify defensively so the
// module import chain never reaches a real send.
vi.mock('@/lib/communication/notify', () => ({
  sendNotification: vi.fn(async () => ({ success: true })),
}));

import { deductTuitionBalance } from '@/lib/tuition/balance-tracker';

const ENR = 'enr-1';
const SESSION = 'sess-1';

describe('deductTuitionBalance — INSERT-FIRST idempotency (2B.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.enrollment = {
      id: ENR,
      sessions_remaining: 5,
      child_id: 'child-1',
      parent_id: null,
      coach_id: 'coach-1',
      session_rate: 50000,
      enrollment_type: 'tuition',
      status: 'active',
      is_paused: false,
      renewal_intent: 'pending',
      renewal_intent_set_at: null,
      low_balance_nudges_sent: 0,
      last_low_balance_nudge_at: null,
      parent_renewal_check_sent_at: null,
    };
    state.ledgerErrors = [null, { code: '23505', message: 'duplicate key value violates unique constraint' }];
    state.ledgerInsertCalls = [];
    state.enrollmentUpdateCalls = [];
  });

  it('first deduct → clean ledger insert + ONE decrement (5→4), no alert', async () => {
    const r1 = await deductTuitionBalance(ENR, SESSION, 1, 'coach@x.com', 'req-1');

    expect(r1.deducted).toBe(true);
    expect(r1.idempotentSkip).toBeFalsy();
    expect(r1.newBalance).toBe(4);
    expect(r1.alertSent).toBe('none');

    // exactly one ledger insert, carrying session_id + reason
    expect(state.ledgerInsertCalls).toHaveLength(1);
    expect(state.ledgerInsertCalls[0]).toMatchObject({
      session_id: SESSION,
      reason: 'session_completed',
      change_amount: -1,
      balance_after: 4,
    });
    // exactly one decrement
    const decrements = state.enrollmentUpdateCalls.filter(u => 'sessions_remaining' in u.patch);
    expect(decrements).toHaveLength(1);
    expect(decrements[0].patch.sessions_remaining).toBe(4);
  });

  it('double-call same session (different requestId) → single decrement, 2nd idempotentSkip, no throw', async () => {
    const r1 = await deductTuitionBalance(ENR, SESSION, 1, 'coach@x.com', 'req-1');
    const r2 = await deductTuitionBalance(ENR, SESSION, 1, 'coach@x.com', 'req-2'); // different requestId

    // (c) 2nd call: idempotentSkip, did NOT throw, returns current balance
    expect(r2.idempotentSkip).toBe(true);
    expect(r2.deducted).toBe(false);
    expect(r2.newBalance).toBe(5); // previousBalance (decrement skipped)
    expect(r2.alertSent).toBe('none');

    // first call decremented normally
    expect(r1.deducted).toBe(true);
    expect(r1.newBalance).toBe(4);

    // (a) balance decremented exactly ONCE across both calls
    const decrements = state.enrollmentUpdateCalls.filter(u => 'sessions_remaining' in u.patch);
    expect(decrements).toHaveLength(1);

    // (b) exactly ONE committed ledger row: insert attempted twice, 2nd rejected 23505
    expect(state.ledgerInsertCalls).toHaveLength(2);
    const committed = state.ledgerInsertCalls.filter(
      (_, i) => (state.ledgerErrors[i] ?? null) === null,
    );
    expect(committed).toHaveLength(1);

    // (d) dedupe held despite differing requestId — key is session_id, not requestId
    expect(state.ledgerInsertCalls[0].session_id).toBe(SESSION);
    expect(state.ledgerInsertCalls[1].session_id).toBe(SESSION);
  });

  it('non-23505 ledger insert error → no decrement, returns error, no throw (failure-flip)', async () => {
    state.ledgerErrors = [{ code: '23502', message: 'not-null violation' }];
    const r = await deductTuitionBalance(ENR, SESSION, 1, 'coach@x.com', 'req-1');

    expect(r.deducted).toBe(false);
    expect(r.idempotentSkip).toBeFalsy();
    expect(r.error).toContain('not-null');
    // insert-first is the gate → no decrement ran
    const decrements = state.enrollmentUpdateCalls.filter(u => 'sessions_remaining' in u.patch);
    expect(decrements).toHaveLength(0);
  });
});
