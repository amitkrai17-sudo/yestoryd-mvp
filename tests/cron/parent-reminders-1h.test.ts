// =============================================================================
// PARENT-REMINDERS-1h CRON TESTS — app/api/cron/parent-reminders-1h/route.ts
// tests/cron/parent-reminders-1h.test.ts
//
// WA-WIRE-REMINDERS coverage:
//   T1 — tuition OFFLINE session → sendNotification 'parent_session_reminder_1h_v3'
//        with no templateButtons + sent flag set.
//   T2 — tuition ONLINE session with ONLINE_1H_TEMPLATE_LIVE=false → SKIP
//        (no send, no flag update; skippedOnline counter incremented).
//   T3 (skipped placeholder) — when _online_v1 is Active, online sessions should
//        send 'parent_session_reminder_1h_online_v1' with
//        templateButtons={category:'utility_cta', url:`j/<sessionId>`}.
//        Currently .skip — flip when ONLINE_1H_TEMPLATE_LIVE is true.
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

import { GET } from '@/app/api/cron/parent-reminders-1h/route';
import { ONLINE_1H_TEMPLATE_LIVE } from '@/app/api/cron/parent-reminders-1h/_config';

const fakeRequest = () => ({} as any);

function tuitionSessionRow(sessionMode: 'online' | 'offline', overrides: Partial<{
  id: string;
  batch_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
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
    session_mode: sessionMode,
    coach_id: coach.id,
    child_id: child.id,
    enrollment_id: 'enr-T-1',
    parent_reminder_1h_sent: false,
    children: child,
    coaches: coach,
    enrollments: { enrollment_type: 'tuition' },
  };
}

describe('cron /api/cron/parent-reminders-1h', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.queueRows = [];
    state.sendCalls = [];
    state.updates = [];
    state.sendResult = { success: true, logId: 'log-fixture' };
  });

  it('T1: OFFLINE tuition session → parent_session_reminder_1h_v3 (no buttons) + sent flag', async () => {
    state.queueRows = [tuitionSessionRow('offline', { id: 'sess-off-1' })];

    const response = await GET(fakeRequest());
    expect(response.status).toBe(200);

    expect(state.sendCalls).toHaveLength(1);
    const call = state.sendCalls[0];
    expect(call.templateCode).toBe('parent_session_reminder_1h_v3');
    expect(call.recipient).toBe('919000000001');
    expect(call.vars).toEqual({
      child_name: 'Aarav Sharma',
      coach_name: 'Rita Singh',
    });
    expect(call.meta.templateButtons).toBeUndefined();

    const sentUpdate = state.updates.find(u => u.eqId === 'sess-off-1');
    expect(sentUpdate).toBeDefined();
    expect(sentUpdate!.payload.parent_reminder_1h_sent).toBe(true);
  });

  it('T2: ONLINE tuition session with flag=false → SKIPPED (no send, no flag update)', async () => {
    // Sanity: the gate flag should currently be false (template under review).
    expect(ONLINE_1H_TEMPLATE_LIVE).toBe(false);

    state.queueRows = [tuitionSessionRow('online', { id: 'sess-on-1' })];

    const response = await GET(fakeRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results.skippedOnline).toBe(1);

    expect(state.sendCalls).toHaveLength(0);
    expect(state.updates.find(u => u.eqId === 'sess-on-1')).toBeUndefined();
  });

  it.skip('T3 (UNSKIP when ONLINE_1H_TEMPLATE_LIVE=true): online → _online_v1 + templateButtons.url=j/<id>', async () => {
    state.queueRows = [tuitionSessionRow('online', { id: 'sess-on-active' })];

    const response = await GET(fakeRequest());
    expect(response.status).toBe(200);

    expect(state.sendCalls).toHaveLength(1);
    const call = state.sendCalls[0];
    expect(call.templateCode).toBe('parent_session_reminder_1h_online_v1');
    expect(call.meta.templateButtons).toEqual({
      category: 'utility_cta',
      url: 'j/sess-on-active',
    });
  });
});
