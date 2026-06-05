// =============================================================================
// OFFLINE-REPORT COMPLETION TESTS — app/api/coach/sessions/[id]/offline-report/route.ts
// tests/coach/offline-report-completion.test.ts
//
// Thin regression net for the Phase 2A routing through closeTuitionSession()
// (REAL helper; only its boundary deps are mocked). Asserts CURRENT behavior:
//   - tuition offline → ONE combined scheduled_sessions update (status +
//     companion_panel_completed + report fields), deduct called with route
//     requestId, NO coach_payouts row, summary dispatched on the qstash gate
//   - NON-tuition offline STILL dispatches summary (gate is qstash-only, not
//     tuition-gated) — guards against accidental tuition-gating of the summary
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  enrollmentType: 'tuition' as 'tuition' | 'coaching',
  callOrder: [] as string[],
  deductArgs: [] as any[][],
  publishCalls: [] as any[],
  updateCalls: [] as Array<{ table: string; obj: any }>,
  insertCalls: [] as Array<{ table: string; obj: any }>,
}));

vi.mock('@/lib/api-auth', () => ({
  requireAdminOrCoach: vi.fn(async () => ({ authorized: true, coachId: 'coach-1', email: 'coach@x.com', role: 'coach' })),
  getServiceSupabase: vi.fn(() => makeSupabase()),
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

vi.mock('@/lib/rai/learning-events', () => ({
  insertLearningEvent: vi.fn(async () => ({ id: 'le-1' })),
  insertLearningEventsBatch: vi.fn(async () => 0),
}));

vi.mock('@/lib/gemini/audio-analysis', () => ({
  transcribeVoiceNote: vi.fn(async () => 'transcript text'),
  analyzeChildReading: vi.fn(async () => null),
}));

vi.mock('@/lib/tuition/balance-tracker', () => ({
  deductTuitionBalance: vi.fn(async (...args: any[]) => {
    harness.callOrder.push('deduct');
    harness.deductArgs.push(args);
    return { deducted: true, newBalance: 4, alertSent: 'none' };
  }),
}));

vi.mock('@/lib/config/payout-config', () => ({
  loadCoachGroup: vi.fn(async () => ({ name: 'rising' })),
  loadPayoutConfig: vi.fn(async () => ({ payout_day_of_month: 7 })),
  calculateEnrollmentBreakdown: vi.fn(() => ({ coach_cost_amount: 0, tds_amount: 0, net_to_coaching_coach: 0 })),
}));

function sessionRow() {
  return {
    id: 'sess-1',
    child_id: 'child-1',
    coach_id: 'coach-1',
    enrollment_id: 'enr-1',
    session_number: 3,
    session_template_id: null, // null → adherence block skipped → only the helper's update hits scheduled_sessions
    session_mode: 'offline',
    offline_request_status: 'approved',
    coach_voice_note_path: 'path/voice.mp3',
    child_reading_clip_path: null,
    report_deadline: null,
    status: 'scheduled',
  };
}

function makeSupabase(): any {
  return {
    from: vi.fn((table: string) => {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        filter: vi.fn(() => chain),
        single: vi.fn(() => {
          if (table === 'scheduled_sessions') return Promise.resolve({ data: sessionRow(), error: null });
          if (table === 'enrollments') return Promise.resolve({ data: { enrollment_type: harness.enrollmentType }, error: null });
          if (table === 'coaches') return Promise.resolve({ data: { completed_sessions_with_logs: 5 }, error: null });
          return Promise.resolve({ data: null, error: null });
        }),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        update: vi.fn((obj: any) => {
          if (table === 'scheduled_sessions') harness.callOrder.push('status');
          harness.updateCalls.push({ table, obj });
          return { eq: vi.fn(() => Promise.resolve({ error: null })) };
        }),
        insert: vi.fn((obj: any) => {
          harness.insertCalls.push({ table, obj });
          return Promise.resolve({ error: null });
        }),
        then: (res: (v: any) => any) => res({ data: null, error: null }),
      };
      return chain;
    }),
  };
}

import { POST } from '@/app/api/coach/sessions/[id]/offline-report/route';

function makeRequest(body: any): any {
  return { json: async () => body };
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const validBody = {
  actual_start_time: '2026-06-05T10:00:00Z',
  actual_end_time: '2026-06-05T10:45:00Z',
  activities: [{ activity_index: 0, activity_name: 'Blending', status: 'completed' }],
  sessions_delivered: 1,
};

describe('/api/coach/sessions/[id]/offline-report — tuition completion via closeTuitionSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.enrollmentType = 'tuition';
    harness.callOrder = [];
    harness.deductArgs = [];
    harness.publishCalls = [];
    harness.updateCalls = [];
    harness.insertCalls = [];
  });

  it('tuition offline → ONE combined scheduled_sessions update (status + companion_panel_completed + report fields)', async () => {
    const res = await POST(makeRequest(validBody), params('sess-1'));
    expect(res.status).toBe(200);

    const ssUpdates = harness.updateCalls.filter(u => u.table === 'scheduled_sessions');
    expect(ssUpdates).toHaveLength(1); // single atomic update (adherence skipped via null template)
    const obj = ssUpdates[0].obj;
    expect(obj.status).toBe('completed');
    expect(obj.companion_panel_completed).toBe(true);
    expect(typeof obj.completed_at).toBe('string');
    expect(typeof obj.report_submitted_at).toBe('string');
    expect(obj.report_late).toBe(false);
    expect(obj.transcript_status).toBe('none');
    expect(obj.voice_note_transcript).toBe('transcript text');
  });

  it('tuition offline → deduct called with route requestId + actor; NO coach_payouts row', async () => {
    await POST(makeRequest(validBody), params('sess-1'));

    expect(harness.deductArgs).toHaveLength(1);
    const [enrollmentId, sessionId, sessionsDelivered, actor, reqId] = harness.deductArgs[0];
    expect(enrollmentId).toBe('enr-1');
    expect(sessionId).toBe('sess-1');
    expect(sessionsDelivered).toBe(1);
    expect(actor).toBe('coach@x.com');
    expect(typeof reqId).toBe('string');
    // deduct's requestId is the ROUTE requestId — the same one carried into the summary body
    expect(reqId).toBe(harness.publishCalls[0].body.requestId);

    expect(harness.insertCalls.filter(i => i.table === 'coach_payouts')).toHaveLength(0);
  });

  it('tuition offline → summary dispatched with offlineContext in body', async () => {
    await POST(makeRequest(validBody), params('sess-1'));
    expect(harness.publishCalls).toHaveLength(1);
    const call = harness.publishCalls[0];
    expect(call.url).toContain('/api/coach/sessions/sess-1/parent-summary');
    expect(call.body.offlineContext).toMatchObject({ session_mode: 'offline' });
  });

  it('NON-tuition offline → summary STILL dispatched (gate is qstash-only); deduct NOT called', async () => {
    harness.enrollmentType = 'coaching';
    const res = await POST(makeRequest(validBody), params('sess-1'));
    expect(res.status).toBe(200);

    expect(harness.deductArgs).toHaveLength(0);           // deduct is tuition-gated
    expect(harness.publishCalls).toHaveLength(1);          // summary is NOT tuition-gated
    expect(harness.insertCalls.filter(i => i.table === 'coach_payouts')).toHaveLength(0);
  });
});
