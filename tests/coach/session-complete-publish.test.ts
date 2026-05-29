// =============================================================================
// SESSION-COMPLETE PUBLISH TESTS — app/api/coach/sessions/[id]/complete/route.ts
// tests/coach/session-complete-publish.test.ts
//
// TUITION-SESSION-SUMMARY-GAP coverage for the new QStash publish:
//   - tuition session (enrollment_type='tuition') → qstash.publishJSON called
//     with parent-summary URL + {sessionId, childId, requestId} body
//   - coaching session (enrollment_type='coaching') → qstash.publishJSON NOT called
//
// Heavy mocks: the /complete route is 540 lines with many side-effects. We mock
// each downstream so the route runs to the publish block deterministically.
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  enrollmentType: 'tuition' as 'tuition' | 'coaching',
  publishCalls: [] as Array<{ url: string; body: any; retries?: number; delay?: number }>,
}));

const supabaseStub = vi.hoisted(() => {
  const makeChain = (table: string) => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq:     vi.fn(() => chain),
      in:     vi.fn(() => chain),
      is:     vi.fn(() => chain),
      not:    vi.fn(() => chain),
      neq:    vi.fn(() => chain),
      gte:    vi.fn(() => chain),
      lte:    vi.fn(() => chain),
      order:  vi.fn(() => chain),
      limit:  vi.fn(() => chain),
      single: vi.fn(() => {
        if (table === 'scheduled_sessions') {
          return Promise.resolve({
            data: {
              id: 'sess-T-1',
              child_id: 'child-T-1',
              coach_id: 'coach-T-1',
              session_number: 3,
              status: 'scheduled',
              enrollment_id: 'enr-T-1',
              session_mode: 'online',
              session_type: 'tuition',
              google_meet_link: null,
              children: { child_name: 'Test Child' },
            },
            error: null,
          });
        }
        if (table === 'enrollments') {
          return Promise.resolve({
            data: { enrollment_type: state.enrollmentType },
            error: null,
          });
        }
        if (table === 'child_intelligence_profiles') {
          return Promise.resolve({ data: { id: 'cip-T-1' }, error: null });
        }
        if (table === 'coaches' || table === 'parents' || table === 'children') {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: 'inserted' }, error: null })) })),
      })),
      then: (resolve: (v: any) => any) => resolve({ data: null, error: null, count: 0 }),
    };
    return chain;
  };
  return {
    from: vi.fn((table: string) => makeChain(table)),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: supabaseStub,
}));

vi.mock('@/lib/db-utils', () => ({
  timedQuery: vi.fn(async (fn: any) => {
    const result = await fn();
    return { ...result, durationMs: 0 };
  }),
}));

vi.mock('@/lib/qstash', () => ({
  queueProgressPulse: vi.fn(async () => ({ success: true, messageId: 'pp-mock' })),
  qstash: {
    publishJSON: vi.fn(async (args: any) => {
      state.publishCalls.push(args);
      return { messageId: 'qstash-mock-msg' };
    }),
  },
}));

vi.mock('@/lib/scheduling/orchestrator', () => ({
  dispatch: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/tasks/generate-daily-tasks', () => ({
  generateAndInsertDailyTasks: vi.fn(async () => undefined),
}));

vi.mock('@/lib/config/skill-categories', () => ({
  getCategoryBySlug: vi.fn(async () => ({ id: 'cat-1', slug: 'reading' })),
}));

vi.mock('@/lib/tuition/balance-tracker', () => ({
  deductTuitionBalance: vi.fn(async () => ({ deducted: true, newBalance: 5, alertSent: 'none' })),
}));

vi.mock('@/lib/intelligence/embedding-builder', () => ({
  buildUnifiedEmbeddingContent: vi.fn(() => 'embedding-content'),
}));

vi.mock('@/lib/config/payout-config', () => ({
  loadPayoutConfig: vi.fn(async () => ({ payout_day_of_month: 7 })),
  loadCoachGroup: vi.fn(async () => ({})),
  calculateEnrollmentBreakdown: vi.fn(() => ({ coach_cost_amount: 0, tds_amount: 0, net_to_coaching_coach: 0 })),
  getTuitionCoachPercent: vi.fn(() => 50),
}));

vi.mock('@/lib/homework/generate-reading-test', () => ({
  createReadingTestTask: vi.fn(async () => undefined),
}));

vi.mock('@/lib/communication', () => ({
  sendCommunication: vi.fn(async () => ({ success: true, results: [] })),
}));

import { POST } from '@/app/api/coach/sessions/[id]/complete/route';

function makeRequest(body: any): any {
  return {
    json: async () => body,
  };
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('/api/coach/sessions/[id]/complete — tuition parent-summary publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.publishCalls = [];
  });

  it('tuition enrollment → qstash.publishJSON called with parent-summary URL', async () => {
    state.enrollmentType = 'tuition';
    const response = await POST(
      makeRequest({ captureId: 'capture-T-1', primaryFocus: 'phonics' }),
      params('sess-T-1'),
    );
    expect(response.status).toBe(200);

    const tuitionPublishes = state.publishCalls.filter(
      c => typeof c.url === 'string' && c.url.includes('/api/coach/sessions/sess-T-1/parent-summary'),
    );
    expect(tuitionPublishes).toHaveLength(1);
    const publish = tuitionPublishes[0];
    expect(publish.body).toMatchObject({
      sessionId: 'sess-T-1',
      childId: 'child-T-1',
    });
    expect(typeof publish.body.requestId).toBe('string');
    expect(publish.retries).toBe(3);
    expect(publish.delay).toBe(5);
  });

  it('coaching enrollment → no parent-summary qstash publish', async () => {
    state.enrollmentType = 'coaching';
    const response = await POST(
      makeRequest({ captureId: 'capture-C-1', primaryFocus: 'fluency' }),
      params('sess-T-1'),
    );
    expect(response.status).toBe(200);

    const tuitionPublishes = state.publishCalls.filter(
      c => typeof c.url === 'string' && c.url.includes('/parent-summary'),
    );
    expect(tuitionPublishes).toHaveLength(0);
  });
});
