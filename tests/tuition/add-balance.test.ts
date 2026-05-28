// =============================================================================
// ADD TUITION BALANCE TESTS — lib/tuition/add-balance.ts
// tests/tuition/add-balance.test.ts
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock state — hoisted so vi.mock can reference it.
// ---------------------------------------------------------------------------
const state = vi.hoisted(() => ({
  enrollmentSelectResult: null as { sessions_remaining: number | null } | null,
  enrollmentSelectError: null as { message: string } | null,
  enrollmentUpdateCalls: [] as Array<{ patch: Record<string, unknown>; eqId: string }>,
  enrollmentUpdateError: null as { message: string } | null,
  ledgerInsertCalls: [] as Array<Record<string, unknown>>,
  ledgerInsertResult: { id: 'ledger-row-id' } as { id: string } | null,
  ledgerInsertError: null as { message: string } | null,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'enrollments') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: state.enrollmentSelectResult,
                  error: state.enrollmentSelectError,
                }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              state.enrollmentUpdateCalls.push({ patch, eqId: id });
              return Promise.resolve({ data: null, error: state.enrollmentUpdateError });
            },
          }),
        };
      }
      if (table === 'tuition_session_ledger') {
        return {
          insert: (row: Record<string, unknown>) => {
            state.ledgerInsertCalls.push(row);
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: state.ledgerInsertResult,
                    error: state.ledgerInsertError,
                  }),
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  })),
}));

import { addTuitionBalance } from '@/lib/tuition/add-balance';

const ENROLLMENT_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  state.enrollmentSelectResult = { sessions_remaining: 5 };
  state.enrollmentSelectError = null;
  state.enrollmentUpdateCalls = [];
  state.enrollmentUpdateError = null;
  state.ledgerInsertCalls = [];
  state.ledgerInsertResult = { id: 'ledger-row-id' };
  state.ledgerInsertError = null;
});

describe('addTuitionBalance', () => {
  it('positive changeAmount: ledger row + sessions_remaining update + CLEARS renewal + low-balance fields', async () => {
    state.enrollmentSelectResult = { sessions_remaining: 2 };

    const result = await addTuitionBalance({
      enrollmentId: ENROLLMENT_ID,
      changeAmount: 12,
      reason: 'renewal',
      createdBy: 'webhook',
      paymentId: 'pay-abc',
      notes: 'Payment of ₹5999 — 12 sessions credited',
    });

    expect(result).toEqual({
      enrollmentId: ENROLLMENT_ID,
      previousBalance: 2,
      newBalance: 14,
      ledgerRowId: 'ledger-row-id',
    });

    // enrollment update happened with both sessions_remaining AND clearing block
    expect(state.enrollmentUpdateCalls).toHaveLength(1);
    expect(state.enrollmentUpdateCalls[0].patch).toMatchObject({
      sessions_remaining: 14,
      parent_renewal_check_sent_at: null,
      parent_renewal_decision: null,
      parent_renewal_decision_at: null,
      last_low_balance_nudge_at: null,
      low_balance_nudges_sent: 0,
    });

    // ledger row preserves existing shape
    expect(state.ledgerInsertCalls[0]).toEqual({
      enrollment_id: ENROLLMENT_ID,
      change_amount: 12,
      balance_after: 14,
      reason: 'renewal',
      created_by: 'webhook',
      payment_id: 'pay-abc',
      notes: 'Payment of ₹5999 — 12 sessions credited',
    });
  });

  it('negative changeAmount (deduct): no clearing of renewal or low-balance fields; reason+createdBy pass-through to ledger', async () => {
    state.enrollmentSelectResult = { sessions_remaining: 5 };

    await addTuitionBalance({
      enrollmentId: ENROLLMENT_ID,
      changeAmount: -1,
      reason: 'session_completed',
      createdBy: 'system',
    });

    expect(state.enrollmentUpdateCalls[0].patch).toMatchObject({ sessions_remaining: 4 });
    expect(state.enrollmentUpdateCalls[0].patch).not.toHaveProperty('parent_renewal_check_sent_at');
    expect(state.enrollmentUpdateCalls[0].patch).not.toHaveProperty('low_balance_nudges_sent');

    // Pass-through round-trip into ledger
    expect(state.ledgerInsertCalls[0]).toMatchObject({
      change_amount: -1,
      balance_after: 4,
      reason: 'session_completed',
      created_by: 'system',
      payment_id: null,
      notes: null,
    });
  });

  it('zero changeAmount: ledger row inserted, enrollment UPDATE skipped entirely (defensive)', async () => {
    state.enrollmentSelectResult = { sessions_remaining: 7 };

    const result = await addTuitionBalance({
      enrollmentId: ENROLLMENT_ID,
      changeAmount: 0,
      reason: 'no_op',
      createdBy: 'admin',
    });

    expect(result.previousBalance).toBe(7);
    expect(result.newBalance).toBe(7);
    expect(state.enrollmentUpdateCalls).toHaveLength(0); // defensive — no enrollment UPDATE on zero change
    expect(state.ledgerInsertCalls).toHaveLength(1);
    expect(state.ledgerInsertCalls[0]).toMatchObject({
      change_amount: 0,
      balance_after: 7,
      reason: 'no_op',
      created_by: 'admin',
    });
  });

  it('ledger insert error: throws with informative message; enrollment update did still happen', async () => {
    state.enrollmentSelectResult = { sessions_remaining: 3 };
    state.ledgerInsertError = { message: 'fk violation' };
    state.ledgerInsertResult = null;

    await expect(
      addTuitionBalance({
        enrollmentId: ENROLLMENT_ID,
        changeAmount: 5,
        reason: 'top_up',
        createdBy: 'webhook',
      }),
    ).rejects.toThrow(/ledger insert failed: fk violation/);

    // enrollment update happened before the ledger insert
    expect(state.enrollmentUpdateCalls).toHaveLength(1);
  });

  it('previousBalance + newBalance reflect actual DB read', async () => {
    state.enrollmentSelectResult = { sessions_remaining: 11 };

    const result = await addTuitionBalance({
      enrollmentId: ENROLLMENT_ID,
      changeAmount: -1,
      reason: 'session_completed',
      createdBy: 'system',
    });

    expect(result.previousBalance).toBe(11);
    expect(result.newBalance).toBe(10);
  });
});
