// =============================================================================
// SESSIONS-MISSED TESTS — app/api/sessions/[id]/missed/route.ts
// tests/coach/sessions-missed.test.ts
//
// WA-WIRE-NOSHOW coverage:
//   T1 — coach marks a session missed → sendNotification called with
//        'parent_session_noshow_v3' and canonical {child_name, coach_name}
//        params. The notifyParent flag is GONE; send fires unconditionally.
//   T2 — coach NOT owner of the session (session.coach_id !== auth.coachId)
//        → 403, no template send.
//   T3 — orchestrator.dispatch('session.no_show', ...) is still invoked (the
//        cascade that updates enrollments.consecutive_no_shows is preserved).
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authCoachId: 'coach-A' as string | null,
  sessionCoachId: 'coach-A',
  sessionStatus: 'scheduled',
  scheduledDate: '2026-05-28',  // past date so the route accepts marking missed
  childRow: {
    child_name: 'Aarav Sharma',
    name: null as string | null,
    parent_phone: '919000000001',
  },
  coachRow: { name: 'Rita Singh' },
  sendCalls: [] as Array<{ templateCode: string; recipient: string; vars: any; meta: any }>,
  dispatchCalls: [] as Array<{ event: string; payload: any }>,
  learningEventInserts: [] as any[],
}));

const supabaseStub = vi.hoisted(() => {
  const makeChain = (table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq:     vi.fn(() => chain),
      single: vi.fn(() => {
        if (table === 'scheduled_sessions') {
          return Promise.resolve({
            data: {
              id: 'sess-1',
              child_id: 'child-1',
              session_number: 4,
              status: state.sessionStatus,
              coach_id: state.sessionCoachId,
              scheduled_date: state.scheduledDate,
              coaches: state.coachRow,
              children: state.childRow,
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      then: (resolve: (v: any) => any) => resolve({ data: null, error: null }),
    };
    return chain;
  };
  return {
    from: vi.fn((table: string) => makeChain(table)),
  };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => supabaseStub),
}));

vi.mock('@/lib/api-auth', () => ({
  requireAdminOrCoach: vi.fn(async () => ({
    authorized: true,
    coachId: state.authCoachId,
    email: 'coach@example.com',
  })),
}));

vi.mock('@/lib/scheduling/orchestrator', () => ({
  dispatch: vi.fn(async (event: string, payload: any) => {
    state.dispatchCalls.push({ event, payload });
    return { success: true };
  }),
}));

vi.mock('@/lib/rai/learning-events', () => ({
  insertLearningEvent: vi.fn(async (args: any) => {
    state.learningEventInserts.push(args);
    return { id: 'le-mock' };
  }),
}));

vi.mock('@/lib/communication/notify', () => ({
  sendNotification: vi.fn(async (
    templateCode: string,
    recipient: string,
    vars: any,
    meta: any,
  ) => {
    state.sendCalls.push({ templateCode, recipient, vars, meta });
    return { success: true, logId: 'log-mock' };
  }),
}));

import { POST } from '@/app/api/sessions/[id]/missed/route';

function makeRequest(body: any): any {
  return { json: async () => body };
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('/api/sessions/[id]/missed — WA-WIRE-NOSHOW', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authCoachId = 'coach-A';
    state.sessionCoachId = 'coach-A';
    state.sessionStatus = 'scheduled';
    state.scheduledDate = '2026-05-28';
    state.childRow = {
      child_name: 'Aarav Sharma',
      name: null,
      parent_phone: '919000000001',
    };
    state.coachRow = { name: 'Rita Singh' };
    state.sendCalls = [];
    state.dispatchCalls = [];
    state.learningEventInserts = [];
  });

  it('T1: coach marks missed → sendNotification parent_session_noshow_v3 with canonical {child_name, coach_name}', async () => {
    const response = await POST(makeRequest({ reason: 'no-show' }), params('sess-1'));
    expect(response.status).toBe(200);

    expect(state.sendCalls).toHaveLength(1);
    const call = state.sendCalls[0];
    expect(call.templateCode).toBe('parent_session_noshow_v3');
    expect(call.recipient).toBe('919000000001');
    expect(call.vars).toEqual({
      child_name: 'Aarav Sharma',
      coach_name: 'Rita Singh',
    });
    expect(call.meta).toMatchObject({
      triggeredBy: 'coach',
      triggeredByUserId: 'coach-A',
      contextType: 'scheduled_session',
      contextId: 'sess-1',
    });
  });

  it('T2: coach NOT owner → 403, no template send', async () => {
    state.sessionCoachId = 'coach-OTHER';

    const response = await POST(makeRequest({ reason: 'no-show' }), params('sess-1'));
    expect(response.status).toBe(403);

    expect(state.sendCalls).toHaveLength(0);
    expect(state.dispatchCalls).toHaveLength(0);
  });

  it('T3: orchestrator session.no_show cascade still dispatched', async () => {
    await POST(makeRequest({ reason: 'no-show' }), params('sess-1'));

    expect(state.dispatchCalls).toHaveLength(1);
    expect(state.dispatchCalls[0].event).toBe('session.no_show');
    expect(state.dispatchCalls[0].payload).toMatchObject({ sessionId: 'sess-1' });

    // And the session_missed learning_event is still written
    const missedEvent = state.learningEventInserts.find(
      e => e.eventType === 'session_missed',
    );
    expect(missedEvent).toBeDefined();
  });
});
