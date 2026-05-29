// =============================================================================
// PARENT-SUMMARY EMPTY-LOGS TESTS — app/api/coach/sessions/[id]/parent-summary/route.ts
// tests/coach/parent-summary-empty-logs.test.ts
//
// TUITION-SESSION-SUMMARY-GAP coverage:
//   - With empty session_activity_log (the tuition case), the route PROCEEDS
//     instead of returning early with skipped:true.
//   - When the Gemini call fails (forced via mock throw) and activityLogs is
//     empty, the fallback summary string uses session.focus_area (NOT the old
//     "0 activities" phrasing).
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  capturedLearningEvents: [] as any[],
  capturedCommunications: [] as any[],
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
      order:  vi.fn(() => chain),
      limit:  vi.fn(() => chain),
      single: vi.fn(() => {
        if (table === 'scheduled_sessions') {
          return Promise.resolve({
            data: {
              id: 'sess-T-1',
              child_id: 'child-T-1',
              session_number: 3,
              session_type: 'tuition',
              session_mode: 'online',
              coach_notes: 'Worked on blends and digraphs.',
              session_timer_seconds: 2700,
              session_template_id: null,        // no template → practice block skips
              homework_assigned: false,
              homework_topic: null,
              homework_description: null,
              enrollment_id: 'enr-T-1',
              focus_area: 'phonics-blends',     // ← the fallback line reads this
              coach_id: 'coach-T-1',
              children: {
                id: 'child-T-1',
                child_name: 'Aarav Sharma',
                age: 7,
                parent_name: 'Priya Sharma',
                parent_phone: '919000000001',
                parent_email: 'priya@example.com',
                parent_id: 'parent-T-1',
              },
            },
            error: null,
          });
        }
        if (table === 'child_intelligence_profiles') {
          return Promise.resolve({ data: { narrative_profile: { summary: '' } }, error: null });
        }
        if (table === 'coaches') {
          return Promise.resolve({ data: { name: 'Coach Rita' }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      // session_activity_log SELECT is awaited (no .single) — terminal `then`
      then: (resolve: (v: any) => any) => {
        if (table === 'session_activity_log') {
          return resolve({ data: [], error: null });    // empty array — the tuition case
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

vi.mock('@/lib/api-auth', () => ({
  getServiceSupabase: () => supabaseStub,
}));

vi.mock('@/lib/config/pricing-config', () => ({
  getPricingConfig: vi.fn(async () => ({ tiers: [], ageBands: [] })),
}));

vi.mock('@/lib/communication', () => ({
  sendCommunication: vi.fn(async (args: any) => {
    state.capturedCommunications.push(args);
    return { success: true, results: [{ channel: 'whatsapp', success: true }] };
  }),
}));

vi.mock('@/lib/rai/learning-events', () => ({
  insertLearningEvent: vi.fn(async (args: any) => {
    state.capturedLearningEvents.push(args);
    return { id: 'le-mock' };
  }),
}));

vi.mock('@/lib/utils/text', () => ({
  extractLastSentence: vi.fn(() => null),
}));

vi.mock('@/lib/gemini/session-prompts', () => ({
  generateParentWhatsAppSummary: vi.fn(async () => {
    throw new Error('forced gemini failure → use fallback path');
  }),
  generateLearningProfileSynthesis: vi.fn(async () => null),
}));

import { POST } from '@/app/api/coach/sessions/[id]/parent-summary/route';

function makeRequest(body: any = {}): any {
  return {
    json: async () => body,
  };
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('/api/coach/sessions/[id]/parent-summary — empty activity_logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.capturedLearningEvents = [];
    state.capturedCommunications = [];
  });

  it('empty session_activity_log → does NOT return skipped (proceeds with fallbacks)', async () => {
    const response = await POST(makeRequest(), params('sess-T-1'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.skipped).not.toBe(true);
  });

  it('empty session_activity_log → fallback summary uses session.focus_area', async () => {
    await POST(makeRequest(), params('sess-T-1'));
    expect(state.capturedCommunications).toHaveLength(1);
    const sentVars = state.capturedCommunications[0].variables;
    // Summary is embedded as the message body; the focus var is passed separately
    expect(sentVars.focus).toBeDefined();
    // Surface the focus_area through the learning_events path too
    const summaryEvent = state.capturedLearningEvents.find(
      (e: any) => e.eventType === 'parent_session_summary',
    );
    expect(summaryEvent).toBeDefined();
    expect(summaryEvent.aiSummary).toContain('phonics-blends');
    expect(summaryEvent.aiSummary).not.toMatch(/0 activities/);
  });
});
