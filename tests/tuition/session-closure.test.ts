// =============================================================================
// SESSION-CLOSURE HELPER TESTS — lib/tuition/session-closure.ts
// tests/tuition/session-closure.test.ts
//
// Regression net for the Phase 2A SSOT extraction. Asserts CURRENT behavior
// (zero behavior change): per-option-flag gating, single-atomic-update,
// arg passthrough, payout idempotency, summary-body merge, and op order.
//
// Boundary mocks: deductTuitionBalance, qstash, payout-config. supabase is
// passed in via opts, so it is a per-test stub (not a module mock).
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  callOrder: [] as string[],
  deductArgs: [] as any[][],
  publishCalls: [] as any[],
  tuitionRows: [] as any[],
  existingPayout: [] as any[],
  updateCalls: [] as Array<{ table: string; obj: any }>,
  insertCalls: [] as Array<{ table: string; obj: any }>,
  updateError: null as any,
}));

vi.mock('@/lib/tuition/balance-tracker', () => ({
  deductTuitionBalance: vi.fn(async (...args: any[]) => {
    harness.callOrder.push('deduct');
    harness.deductArgs.push(args);
    return { deducted: true, newBalance: 5, alertSent: 'none' };
  }),
}));

vi.mock('@/lib/config/payout-config', () => ({
  loadCoachGroup: vi.fn(async () => ({ name: 'rising' })),
  loadPayoutConfig: vi.fn(async () => ({ payout_day_of_month: 7 })),
  calculateEnrollmentBreakdown: vi.fn(() => ({
    coach_cost_amount: 100,
    tds_amount: 0,
    net_to_coaching_coach: 100,
  })),
}));

vi.mock('@/lib/qstash', () => ({
  qstash: {
    publishJSON: vi.fn(async (args: any) => {
      harness.callOrder.push('summary');
      harness.publishCalls.push(args);
      return { messageId: 'qstash-mock-msg' };
    }),
  },
}));

import { closeTuitionSession } from '@/lib/tuition/session-closure';

// Chainable supabase stub. Terminal ops (.limit / .update→.eq / .insert) resolve;
// .update + coach_payouts.insert push to callOrder so op-order can be asserted.
function makeSupabase(): any {
  return {
    from: vi.fn((table: string) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        limit: vi.fn(() => {
          if (table === 'tuition_onboarding') return Promise.resolve({ data: harness.tuitionRows });
          if (table === 'coach_payouts') return Promise.resolve({ data: harness.existingPayout });
          return Promise.resolve({ data: [] });
        }),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn((obj: any) => {
          harness.callOrder.push('status');
          harness.updateCalls.push({ table, obj });
          return { eq: vi.fn(() => Promise.resolve({ error: harness.updateError })) };
        }),
        insert: vi.fn((obj: any) => {
          if (table === 'coach_payouts') {
            harness.callOrder.push('payout');
            harness.insertCalls.push({ table, obj });
          }
          return Promise.resolve({ error: null });
        }),
      };
      return chain;
    }),
  };
}

const baseSession = {
  enrollment_id: 'enr-1',
  child_id: 'child-1',
  coach_id: 'coach-1',
  session_type: 'tuition',
};

function baseOpts(overrides: Record<string, any> = {}) {
  return {
    supabase: makeSupabase(),
    sessionId: 'sess-1',
    session: { ...baseSession },
    requestId: 'req-1',
    appUrl: 'https://app.test',
    ...overrides,
  } as any;
}

describe('closeTuitionSession() — option-flag matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.callOrder = [];
    harness.deductArgs = [];
    harness.publishCalls = [];
    harness.tuitionRows = [{ session_rate: 50000, session_duration_minutes: 60, child_name: 'Test Child' }];
    harness.existingPayout = [];
    harness.updateCalls = [];
    harness.insertCalls = [];
    harness.updateError = null;
  });

  // ── setStatus gating ──
  it('setStatus:false → NO scheduled_sessions status update; deduct/payout/summary still run', async () => {
    await closeTuitionSession(baseOpts({
      setStatus: false,
      deductBalance: true,
      insertPayout: true,
      dispatchSummary: true,
    }));
    const ssUpdates = harness.updateCalls.filter(u => u.table === 'scheduled_sessions');
    expect(ssUpdates).toHaveLength(0);
    expect(harness.deductArgs).toHaveLength(1);
    expect(harness.insertCalls.filter(i => i.table === 'coach_payouts')).toHaveLength(1);
    expect(harness.publishCalls).toHaveLength(1);
  });

  it('setStatus:true → ONE combined update containing status + completed_at + extraSessionFields (atomicity)', async () => {
    await closeTuitionSession(baseOpts({
      setStatus: true,
      extraSessionFields: { companion_panel_completed: true, coach_notes: 'note', report_late: false },
    }));
    const ssUpdates = harness.updateCalls.filter(u => u.table === 'scheduled_sessions');
    expect(ssUpdates).toHaveLength(1); // single atomic update, not two
    const obj = ssUpdates[0].obj;
    expect(obj.status).toBe('completed');
    expect(typeof obj.completed_at).toBe('string');
    expect(obj.companion_panel_completed).toBe(true);
    expect(obj.coach_notes).toBe('note');
    expect(obj.report_late).toBe(false);
  });

  it('setCompletedAt:false → update omits completed_at but still writes status', async () => {
    await closeTuitionSession(baseOpts({ setStatus: true, setCompletedAt: false }));
    const obj = harness.updateCalls.filter(u => u.table === 'scheduled_sessions')[0].obj;
    expect(obj.status).toBe('completed');
    expect('completed_at' in obj).toBe(false);
  });

  // ── deductBalance gating + arg passthrough ──
  it('deductBalance:false → deductTuitionBalance NOT called', async () => {
    await closeTuitionSession(baseOpts({ setStatus: false, deductBalance: false }));
    expect(harness.deductArgs).toHaveLength(0);
  });

  it('deductBalance:true → deductTuitionBalance called with args verbatim (actor, requestId, count)', async () => {
    await closeTuitionSession(baseOpts({
      setStatus: false,
      deductBalance: true,
      sessionsDelivered: 2,
      deductActor: 'coach@x.com',
      deductRequestId: 'fresh-uuid-xyz',
    }));
    expect(harness.deductArgs).toHaveLength(1);
    // signature: (enrollmentId, sessionId, sessionsDelivered, coachEmail, requestId)
    expect(harness.deductArgs[0]).toEqual(['enr-1', 'sess-1', 2, 'coach@x.com', 'fresh-uuid-xyz']);
  });

  it('deductRequestId defaults to opts.requestId when omitted', async () => {
    await closeTuitionSession(baseOpts({ setStatus: false, deductBalance: true }));
    expect(harness.deductArgs[0][4]).toBe('req-1');
  });

  // ── insertPayout gating + idempotency ──
  it('insertPayout:false → NO coach_payouts insert', async () => {
    await closeTuitionSession(baseOpts({ setStatus: false, insertPayout: false }));
    expect(harness.insertCalls.filter(i => i.table === 'coach_payouts')).toHaveLength(0);
  });

  it('insertPayout:true + no existing payout → coach_payouts insert (session_id + product_type)', async () => {
    harness.existingPayout = [];
    await closeTuitionSession(baseOpts({ setStatus: false, insertPayout: true }));
    const payouts = harness.insertCalls.filter(i => i.table === 'coach_payouts');
    expect(payouts).toHaveLength(1);
    expect(payouts[0].obj).toMatchObject({ session_id: 'sess-1', product_type: 'tuition', coach_id: 'coach-1' });
  });

  it('insertPayout:true + existing payout present → idempotent, NO duplicate insert', async () => {
    harness.existingPayout = [{ id: 'existing-payout-1' }];
    await closeTuitionSession(baseOpts({ setStatus: false, insertPayout: true }));
    expect(harness.insertCalls.filter(i => i.table === 'coach_payouts')).toHaveLength(0);
  });

  // ── dispatchSummary gating + body merge ──
  it('dispatchSummary:false → qstash.publishJSON NOT called', async () => {
    await closeTuitionSession(baseOpts({ setStatus: false, dispatchSummary: false }));
    expect(harness.publishCalls).toHaveLength(0);
  });

  it('dispatchSummary:true → publishJSON with parent-summary URL + base body, summaryExtraBody merged', async () => {
    await closeTuitionSession(baseOpts({
      setStatus: false,
      dispatchSummary: true,
      summaryExtraBody: { offlineContext: { session_mode: 'offline' } },
    }));
    expect(harness.publishCalls).toHaveLength(1);
    const call = harness.publishCalls[0];
    expect(call.url).toContain('/api/coach/sessions/sess-1/parent-summary');
    expect(call.body).toMatchObject({
      sessionId: 'sess-1',
      childId: 'child-1',
      requestId: 'req-1',
      offlineContext: { session_mode: 'offline' },
    });
    expect(call.retries).toBe(3);
    expect(call.delay).toBe(5);
  });

  // ── op order ──
  it('OP ORDER: status → deduct → payout → summary', async () => {
    await closeTuitionSession(baseOpts({
      setStatus: true,
      deductBalance: true,
      insertPayout: true,
      dispatchSummary: true,
    }));
    expect(harness.callOrder).toEqual(['status', 'deduct', 'payout', 'summary']);
  });

  it('returns deductResult + completed flag reflecting the status write', async () => {
    const res = await closeTuitionSession(baseOpts({ setStatus: true, deductBalance: true }));
    expect(res.completed).toBe(true);
    expect(res.sessionUpdateError).toBeNull();
    expect(res.deductResult).toMatchObject({ newBalance: 5, alertSent: 'none' });
  });
});
