// =============================================================================
// PARENT-REMINDERS-24h CRON TESTS — app/api/cron/parent-reminders-24h/route.ts
// tests/cron/parent-reminders-24h.test.ts
//
// WA-WIRE-REMINDERS coverage:
//   T1 — tuition session found at tomorrow's IST date → sendNotification called
//        with parent_session_reminder_24h_v3 + correct namedParams, and the
//        scheduled_sessions.parent_reminder_24h_sent flag is set to true.
//   T2 — no sessions found (already-reminded fleet) → no sends, no UPDATEs.
//   T3 — batch fan-out: two siblings in one batched group → two sendNotification
//        calls, both UPDATEd.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  queueRows: [] as any[],
  sendCalls: [] as Array<{ templateCode: string; recipient: string; vars: any; meta: any }>,
  updates: [] as Array<{ payload: any; eqId: string }>,
  sendResult: { success: true, logId: 'log-fixture' } as any,
}));

const supabaseStub = vi.hoisted(() => {
  const makeChain = (table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq:     vi.fn(() => chain),
      in:     vi.fn(() => chain),
      is:     vi.fn(() => chain),
      neq:    vi.fn(() => chain),
      gte:    vi.fn(() => chain),
      lte:    vi.fn(() => chain),
      or:     vi.fn(() => chain),
      order:  vi.fn(() => chain),
      limit:  vi.fn(() => chain),
      update: vi.fn((payload: any) => ({
        eq: vi.fn((_col: string, id: string) => {
          state.updates.push({ payload, eqId: id });
          return Promise.resolve({ data: null, error: null });
        }),
      })),
      then: (resolve: (v: any) => any) => {
        if (table === 'scheduled_sessions') {
          return resolve({ data: state.queueRows, error: null });
        }
        return resolve({ data: null, error: null });
      },
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

vi.mock('@/lib/api/verify-cron', () => ({
  verifyCronRequest: vi.fn(async () => ({ isValid: true })),
}));

vi.mock('@/lib/communication/notify', () => ({
  sendNotification: vi.fn(async (
    templateCode: string,
    recipient: string,
    vars: any,
    meta: any,
  ) => {
    state.sendCalls.push({ templateCode, recipient, vars, meta });
    return state.sendResult;
  }),
}));

import { GET } from '@/app/api/cron/parent-reminders-24h/route';

const fakeRequest = () => ({} as any);

function tuitionSessionRow(overrides: Partial<{
  id: string;
  batch_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
  session_mode: string;
  child: { id: string; name: string | null; child_name: string | null; parent_phone: string | null };
  coach: { id: string; name: string };
}> = {}): any {
  const child = overrides.child ?? {
    id: 'child-1', name: null, child_name: 'Aarav Sharma', parent_phone: '919000000001',
  };
  const coach = overrides.coach ?? { id: 'coach-1', name: 'Rita Singh' };
  return {
    id: overrides.id ?? 'sess-T-1',
    batch_id: overrides.batch_id ?? null,
    scheduled_date: overrides.scheduled_date ?? '2026-05-30',
    scheduled_time: overrides.scheduled_time ?? '16:00:00',
    session_mode: overrides.session_mode ?? 'offline',
    coach_id: coach.id,
    child_id: child.id,
    enrollment_id: 'enr-T-1',
    parent_reminder_24h_sent: false,
    children: child,
    coaches: coach,
    enrollments: { enrollment_type: 'tuition' },
  };
}

describe('cron /api/cron/parent-reminders-24h', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.queueRows = [];
    state.sendCalls = [];
    state.updates = [];
    state.sendResult = { success: true, logId: 'log-fixture' };
  });

  it('T1: tuition session for tomorrow → sendNotification + sent flag set', async () => {
    state.queueRows = [tuitionSessionRow({ id: 'sess-T-1', scheduled_time: '14:30:00' })];

    const response = await GET(fakeRequest());
    expect(response.status).toBe(200);

    expect(state.sendCalls).toHaveLength(1);
    const call = state.sendCalls[0];
    expect(call.templateCode).toBe('parent_session_reminder_24h_v3');
    expect(call.recipient).toBe('919000000001');
    expect(call.vars).toEqual({
      child_name: 'Aarav Sharma',
      time: expect.stringMatching(/^\d{1,2}:\d{2}\s*(AM|PM)$/i),
      coach_name: 'Rita Singh',
    });
    expect(call.meta).toMatchObject({
      triggeredBy: 'cron',
      contextType: 'scheduled_session',
      contextId: 'sess-T-1',
    });

    const sentUpdate = state.updates.find(u => u.eqId === 'sess-T-1');
    expect(sentUpdate).toBeDefined();
    expect(sentUpdate!.payload.parent_reminder_24h_sent).toBe(true);
    expect(sentUpdate!.payload.parent_reminder_24h_sent_at).toBeDefined();
  });

  it('T2: no sessions found → no sends, no updates', async () => {
    state.queueRows = [];

    const response = await GET(fakeRequest());
    expect(response.status).toBe(200);

    expect(state.sendCalls).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });

  it('T3: batched siblings → fan-out, both UPDATEd', async () => {
    state.queueRows = [
      tuitionSessionRow({
        id: 'sess-A',
        batch_id: 'batch-1',
        scheduled_date: '2026-05-30',
        scheduled_time: '16:00:00',
        child: { id: 'child-A', name: null, child_name: 'Ananya', parent_phone: '919000000010' },
      }),
      tuitionSessionRow({
        id: 'sess-B',
        batch_id: 'batch-1',
        scheduled_date: '2026-05-30',
        scheduled_time: '16:00:00',
        child: { id: 'child-B', name: null, child_name: 'Bharath', parent_phone: '919000000020' },
      }),
    ];

    const response = await GET(fakeRequest());
    expect(response.status).toBe(200);

    expect(state.sendCalls).toHaveLength(2);
    const recipients = state.sendCalls.map(c => c.recipient).sort();
    expect(recipients).toEqual(['919000000010', '919000000020']);

    const sessionIdsUpdated = state.updates.map(u => u.eqId).sort();
    expect(sessionIdsUpdated).toEqual(['sess-A', 'sess-B']);
  });
});
