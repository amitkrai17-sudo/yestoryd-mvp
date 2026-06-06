// =============================================================================
// MARK-AS-MISSED DISPOSITION TESTS — app/api/sessions/[id]/missed/route.ts
// tests/sessions/missed-disposition.test.ts
//
// 2B.3.3 wiring: for TUITION, marking missed = parent_no_show — the close is routed
// through closeTuitionSession (deduct 1 + pay coach + NO summary), and the helper OWNS
// the status write (so the route's direct status='missed' update is NOT run → status
// written exactly once). Coaching path is byte-identical to before (direct status write,
// no deduct/pay/disposition). The no-show dispatch + parent notify fire exactly once on
// both paths.
//
// closeTuitionSession is mocked at the boundary — these tests assert the ROUTE wires the
// right opts and avoids double-writes, not the helper internals (covered in
// session-closure.test.ts).
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  enrollmentType: 'tuition' as 'tuition' | 'coaching',
  sessionStatus: 'scheduled' as string,
  closeCalls: [] as any[],
  ssUpdateCalls: [] as any[],
  dispatchCalls: [] as any[],
  notifyCalls: [] as any[],
  learningEventCalls: [] as any[],
}));

const supabaseStub = vi.hoisted(() => ({
  from: vi.fn((table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      single: vi.fn(() => {
        if (table === 'scheduled_sessions') {
          return Promise.resolve({
            data: {
              id: 'sess-1',
              child_id: 'child-1',
              session_number: 4,
              status: state.sessionStatus,
              coach_id: 'coach-1',
              enrollment_id: 'enr-1',
              scheduled_date: '2020-01-01', // past → passes the future-guard
              coaches: { name: 'Coach Rucha' },
              children: { child_name: 'Test Child', name: 'Test Child', parent_phone: '919999999999' },
            },
            error: null,
          });
        }
        if (table === 'enrollments') {
          return Promise.resolve({ data: { enrollment_type: state.enrollmentType }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      update: vi.fn((obj: any) => {
        if (table === 'scheduled_sessions') state.ssUpdateCalls.push(obj);
        return { eq: vi.fn(() => Promise.resolve({ error: null })) };
      }),
    };
    return chain;
  }),
}));

vi.mock('@/lib/api-auth', () => ({
  requireAdminOrCoach: vi.fn(async () => ({
    authorized: true,
    email: 'coach@x.com',
    coachId: 'coach-1',
    role: 'coach',
    userId: 'user-1',
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => supabaseStub),
}));

vi.mock('@/lib/tuition/session-closure', () => ({
  closeTuitionSession: vi.fn(async (opts: any) => {
    state.closeCalls.push(opts);
    return { completed: true, sessionUpdateError: null };
  }),
}));

vi.mock('@/lib/scheduling/orchestrator', () => ({
  dispatch: vi.fn(async (event: string, payload: any) => {
    state.dispatchCalls.push({ event, payload });
    return { success: true, data: {} };
  }),
}));

vi.mock('@/lib/communication/notify', () => ({
  sendNotification: vi.fn(async (template: string, phone: string, vars: any, ctx: any) => {
    state.notifyCalls.push({ template, phone, vars, ctx });
    return { success: true };
  }),
}));

vi.mock('@/lib/rai/learning-events', () => ({
  insertLearningEvent: vi.fn(async (args: any) => {
    state.learningEventCalls.push(args);
    return undefined;
  }),
}));

import { POST } from '@/app/api/sessions/[id]/missed/route';

const makeRequest = (body: any): any => ({ json: async () => body });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('/api/sessions/[id]/missed — 2B.3.3 disposition wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.enrollmentType = 'tuition';
    state.sessionStatus = 'scheduled';
    state.closeCalls = [];
    state.ssUpdateCalls = [];
    state.dispatchCalls = [];
    state.notifyCalls = [];
    state.learningEventCalls = [];
  });

  it('TUITION missed → routed through closeTuitionSession as parent_no_show; NO direct status write (status once)', async () => {
    const res = await POST(makeRequest({ reason: 'parent absent' }), params('sess-1'));
    expect(res.status).toBe(200);

    // helper called exactly once with the parent_no_show matrix opts
    expect(state.closeCalls).toHaveLength(1);
    expect(state.closeCalls[0]).toMatchObject({
      sessionId: 'sess-1',
      setStatus: true,
      status: 'missed',
      disposition: 'parent_no_show',
      deductBalance: true,
      insertPayout: true,
      dispatchSummary: false,
      sessionsDelivered: 1,
      deductActor: 'coach@x.com',
    });
    // helper OWNS status → route did NOT also write status directly (no double-write)
    expect(state.ssUpdateCalls).toHaveLength(0);
  });

  it('TUITION missed → no-show dispatch fires EXACTLY once; noshow_v3 notify fires once', async () => {
    await POST(makeRequest({ reason: 'parent absent' }), params('sess-1'));

    const noShowDispatches = state.dispatchCalls.filter(d => d.event === 'session.no_show');
    expect(noShowDispatches).toHaveLength(1);

    const noshowNotifies = state.notifyCalls.filter(n => n.template === 'parent_session_noshow_v3');
    expect(noshowNotifies).toHaveLength(1);

    // learning_event session_missed still written once
    expect(state.learningEventCalls).toHaveLength(1);
    expect(state.learningEventCalls[0].eventType).toBe('session_missed');
  });

  it('COACHING missed → byte-identical to before: direct status write, NO helper, NO deduct/pay/disposition', async () => {
    state.enrollmentType = 'coaching';
    const res = await POST(makeRequest({ reason: 'parent absent' }), params('sess-1'));
    expect(res.status).toBe(200);

    // helper NOT called for coaching
    expect(state.closeCalls).toHaveLength(0);
    // route wrote status directly, exactly once, status='missed', no disposition key
    expect(state.ssUpdateCalls).toHaveLength(1);
    expect(state.ssUpdateCalls[0].status).toBe('missed');
    expect('disposition' in state.ssUpdateCalls[0]).toBe(false);
    // dispatch + notify unchanged
    expect(state.dispatchCalls.filter(d => d.event === 'session.no_show')).toHaveLength(1);
    expect(state.notifyCalls.filter(n => n.template === 'parent_session_noshow_v3')).toHaveLength(1);
  });

  it('RE-POST (already missed) → blocked by prior-status guard (400); helper NOT called, no deduct', async () => {
    state.sessionStatus = 'missed'; // not in VALID_PREVIOUS_STATUSES
    const res = await POST(makeRequest({ reason: 'parent absent' }), params('sess-1'));
    expect(res.status).toBe(400);
    expect(state.closeCalls).toHaveLength(0);
    expect(state.ssUpdateCalls).toHaveLength(0);
  });
});
