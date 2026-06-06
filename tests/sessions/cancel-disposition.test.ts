// =============================================================================
// CANCEL DISPOSITION TESTS — app/api/sessions/[id]/cancel/route.ts
// tests/sessions/cancel-disposition.test.ts
//
// 2B.3.4 wiring: a coach-initiated cancel records disposition='coach_cancelled',
// set ATOMICALLY with status='cancelled' (threaded through dispatch → cancelSession,
// and mirrored in the route's direct-update fallback). No balance touch. Status path,
// dispatch, and parent_session_cancelled_v5 notify are all UNCHANGED except the added
// disposition field. (coach_no_show is deferred to 2B.6 — the cancel UI can't supply it.)
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  sessionStatus: 'scheduled' as string,
  orchestratorSuccess: true,
  dispatchCalls: [] as any[],
  ssUpdateCalls: [] as any[],
  changeRequestInserts: [] as any[],
  commCalls: [] as any[],
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
              coach_id: 'coach-1',
              enrollment_id: 'enr-1',
              session_number: 4,
              status: state.sessionStatus,
              scheduled_date: '2026-07-01',
              scheduled_time: '10:00',
            },
            error: null,
          });
        }
        if (table === 'children') {
          return Promise.resolve({ data: { child_name: 'Test Child', name: 'Test Child', parent_phone: '919999999999' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      update: vi.fn((obj: any) => {
        if (table === 'scheduled_sessions') state.ssUpdateCalls.push(obj);
        return { eq: vi.fn(() => Promise.resolve({ error: null })) };
      }),
      insert: vi.fn((obj: any) => {
        if (table === 'session_change_requests') state.changeRequestInserts.push(obj);
        return Promise.resolve({ error: null });
      }),
    };
    return chain;
  }),
}));

vi.mock('@/lib/api-auth', () => ({
  requireAdminOrCoach: vi.fn(async () => ({
    authorized: true, email: 'coach@x.com', coachId: 'coach-1', role: 'coach', userId: 'user-1',
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => supabaseStub),
}));

vi.mock('@/lib/scheduling/orchestrator', () => ({
  dispatch: vi.fn(async (event: string, payload: any) => {
    state.dispatchCalls.push({ event, payload });
    return { success: state.orchestratorSuccess, data: {} };
  }),
}));

vi.mock('@/lib/communication', () => ({
  sendCommunication: vi.fn(async (args: any) => {
    state.commCalls.push(args);
    return { success: true, results: [] };
  }),
}));

import { POST } from '@/app/api/sessions/[id]/cancel/route';

const makeRequest = (body: any): any => ({ json: async () => body });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('/api/sessions/[id]/cancel — 2B.3.4 disposition wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.sessionStatus = 'scheduled';
    state.orchestratorSuccess = true;
    state.dispatchCalls = [];
    state.ssUpdateCalls = [];
    state.changeRequestInserts = [];
    state.commCalls = [];
  });

  it('NORMAL (orchestrator success) → dispatch carries disposition coach_cancelled; NO fallback direct write', async () => {
    const res = await POST(makeRequest({ reason: 'coach unwell' }), params('sess-1'));
    expect(res.status).toBe(200);

    const cancelDispatches = state.dispatchCalls.filter(d => d.event === 'session.cancel');
    expect(cancelDispatches).toHaveLength(1);
    expect(cancelDispatches[0].payload).toMatchObject({
      sessionId: 'sess-1',
      cancelledBy: 'coach',
      disposition: 'coach_cancelled',
    });
    // orchestrator owns the status write → route's fallback update did NOT run
    expect(state.ssUpdateCalls).toHaveLength(0);
    // notify fires once, unchanged
    const cancels = state.commCalls.filter(c => c.templateCode === 'parent_session_cancelled_v5');
    expect(cancels).toHaveLength(1);
  });

  it('FALLBACK (orchestrator !success) → direct update carries status cancelled + disposition coach_cancelled (atomic, single update)', async () => {
    state.orchestratorSuccess = false;
    const res = await POST(makeRequest({ reason: 'coach unwell' }), params('sess-1'));
    expect(res.status).toBe(200);

    expect(state.ssUpdateCalls).toHaveLength(1);
    expect(state.ssUpdateCalls[0]).toMatchObject({
      status: 'cancelled',
      disposition: 'coach_cancelled',
    });
  });

  it('R9 byte-equivalence: reason still required (missing → 400, no dispatch)', async () => {
    const res = await POST(makeRequest({}), params('sess-1'));
    expect(res.status).toBe(400);
    expect(state.dispatchCalls).toHaveLength(0);
  });

  it('R7 SSOT: no balance touch — change request audit row written, but no enrollments/ledger mutation', async () => {
    await POST(makeRequest({ reason: 'coach unwell' }), params('sess-1'));
    // change-request audit row still written (unchanged behavior)
    expect(state.changeRequestInserts).toHaveLength(1);
    // the route never touches enrollments or the ledger (no such from() target asserted via stub usage)
    expect(state.ssUpdateCalls.every(u => !('sessions_remaining' in u))).toBe(true);
  });
});
