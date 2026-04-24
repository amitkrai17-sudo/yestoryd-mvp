// ============================================================================
// RESCHEDULE-SESSION TESTS
// __tests__/scheduling/reschedule-session.test.ts
// ============================================================================
//
// Covers rescheduleExistingSession (the retry-queue-initiated finalize flow
// extracted from the former scheduleSession UPDATE branch):
//
//   S10 — happy path: update row + calendar event + recall bot + audit + notify
//   S11 — DB update failure: function returns success:false with the error;
//         calendar is never called
// ============================================================================

jest.mock('@/lib/scheduling/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@/lib/scheduling/circuit-breaker', () => ({
  withCircuitBreaker: (_service: string, op: () => Promise<unknown>) => op(),
}));

const mockScheduleCalendarEvent = jest.fn();
const mockCancelEvent = jest.fn();
const mockRescheduleEvent = jest.fn();
jest.mock('@/lib/calendar', () => ({
  scheduleCalendarEvent: (...args: unknown[]) => mockScheduleCalendarEvent(...args),
  cancelEvent: (...args: unknown[]) => mockCancelEvent(...args),
  rescheduleEvent: (...args: unknown[]) => mockRescheduleEvent(...args),
}));

const mockCreateRecallBot = jest.fn();
const mockCancelRecallBot = jest.fn();
jest.mock('@/lib/recall-auto-bot', () => ({
  createRecallBot: (...args: unknown[]) => mockCreateRecallBot(...args),
  cancelRecallBot: (...args: unknown[]) => mockCancelRecallBot(...args),
}));

const mockNotify = jest.fn();
jest.mock('@/lib/scheduling/notification-manager', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));

const mockGetSessionWithRelations = jest.fn();
const mockLogAudit = jest.fn();

type PendingResult = { data: unknown; error: unknown };
let nextResults: PendingResult[] = [];
const calls: { table: string; op: string; payload?: unknown; filters?: Record<string, unknown> }[] = [];

function queueResult(data: unknown, error: unknown = null) {
  nextResults.push({ data, error });
}
function shiftResult(): PendingResult {
  return nextResults.shift() ?? { data: null, error: null };
}

function makeChain(table: string) {
  const ctx: { op?: string; payload?: unknown; filters: Record<string, unknown> } = { filters: {} };
  const chain: Record<string, unknown> = {
    select: (_cols?: string) => { ctx.op = ctx.op ?? 'select'; return chain; },
    insert: (payload: unknown) => { ctx.op = 'insert'; ctx.payload = payload; return chain; },
    update: (payload: unknown) => { ctx.op = 'update'; ctx.payload = payload; return chain; },
    delete: () => { ctx.op = 'delete'; return chain; },
    eq: (col: string, val: unknown) => { ctx.filters[col] = val; return chain; },
    in: (col: string, vals: unknown) => { ctx.filters[col] = vals; return chain; },
    single: () => {
      calls.push({ table, op: ctx.op ?? 'select', payload: ctx.payload, filters: { ...ctx.filters } });
      return Promise.resolve(shiftResult());
    },
    then: (resolve: (v: PendingResult) => unknown) => {
      calls.push({ table, op: ctx.op ?? 'select', payload: ctx.payload, filters: { ...ctx.filters } });
      return Promise.resolve(shiftResult()).then(resolve);
    },
  };
  return chain;
}

const mockSupabase = { from: (table: string) => makeChain(table) };

jest.mock('@/lib/scheduling/operations/helpers', () => ({
  getSupabase: () => mockSupabase,
  getSessionWithRelations: (...args: unknown[]) => mockGetSessionWithRelations(...args),
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

import { rescheduleExistingSession } from '@/lib/scheduling/operations/reschedule-session';

beforeEach(() => {
  jest.clearAllMocks();
  nextResults = [];
  calls.length = 0;
});

const fakeSession = {
  id: 'sess-retry-1',
  enrollment_id: 'e1',
  child_id: 'c1',
  coach_id: 'co1',
  session_type: 'coaching',
  session_number: 3,
  session_title: 'Coaching 3: Reading Practice',
  week_number: 3,
  scheduled_date: '2026-05-08',
  scheduled_time: '17:30:00',
  duration_minutes: 45,
  status: 'pending_scheduling',
  google_event_id: null,
  google_meet_link: null,
  recall_bot_id: null,
  coach_notes: null,
  children: {
    id: 'c1',
    name: 'Harshi',
    child_name: 'Harshi',
    parent_name: 'Parent',
    parent_email: 'parent@example.com',
    parent_phone: '+919000000000',
  },
  coaches: { id: 'co1', name: 'Rucha', email: 'rucha@yestoryd.com' },
};

describe('rescheduleExistingSession', () => {
  // S10 ──────────────────────────────────────────────────────────────────
  it('S10: happy path — update + calendar + recall + audit + notify', async () => {
    mockGetSessionWithRelations.mockResolvedValueOnce({ session: fakeSession, error: null });

    // Order of Supabase chain calls AFTER getSessionWithRelations:
    //   1. scheduled_sessions.update.eq  → update_session step
    //   2. scheduled_sessions.update.eq  → calendar step writes back google_event_id
    queueResult(null);  // step 1 update result (no error)
    queueResult(null);  // step 2 calendar write-back result

    mockScheduleCalendarEvent.mockResolvedValueOnce({ eventId: 'evt-r1', meetLink: 'https://meet.google.com/r1' });
    mockCreateRecallBot.mockResolvedValueOnce({ botId: 'bot-r1' });

    const res = await rescheduleExistingSession('sess-retry-1', '2026-05-08', '17:30:00', 45);

    expect(res.success).toBe(true);
    expect(res.sessionId).toBe('sess-retry-1');
    expect(res.calendarEventId).toBe('evt-r1');
    expect(res.meetLink).toBe('https://meet.google.com/r1');
    expect(res.recallBotId).toBe('bot-r1');

    // DB update on the session row was the first step.
    const updateCall = calls.find((c) => c.table === 'scheduled_sessions' && c.op === 'update');
    expect(updateCall?.filters?.id).toBe('sess-retry-1');
    expect(updateCall?.payload).toMatchObject({
      scheduled_date: '2026-05-08',
      scheduled_time: '17:30:00',
      duration_minutes: 45,
      status: 'scheduled',
      failure_reason: null,
      next_retry_at: null,
    });

    // Calendar event was created with explicit IST offset → 17:30 IST = 12:00 UTC.
    expect(mockScheduleCalendarEvent).toHaveBeenCalledTimes(1);
    const calArg = mockScheduleCalendarEvent.mock.calls[0][0];
    expect(calArg.title).toBe('Yestoryd coaching - Harshi (Session 3)');
    expect(calArg.attendees).toEqual(['parent@example.com', 'rucha@yestoryd.com']);

    // Recall bot was scheduled against the new meet link.
    expect(mockCreateRecallBot).toHaveBeenCalledTimes(1);
    expect(mockCreateRecallBot.mock.calls[0][0].meetingUrl).toBe('https://meet.google.com/r1');

    // Audit fired with the default action for this flow.
    expect(mockLogAudit).toHaveBeenCalledTimes(1);
    expect(mockLogAudit.mock.calls[0][1]).toBe('session_rescheduled');

    // Notification emitted (same event name the insert flow uses).
    expect(mockNotify).toHaveBeenCalledWith('session.scheduled', expect.objectContaining({
      sessionId: 'sess-retry-1',
      meetLink: 'https://meet.google.com/r1',
    }));
  });

  // S11 ──────────────────────────────────────────────────────────────────
  it('S11: DB update failure → success:false, no calendar call, no audit', async () => {
    mockGetSessionWithRelations.mockResolvedValueOnce({ session: fakeSession, error: null });

    // First (and only) chain call: scheduled_sessions.update fails.
    queueResult(null, { message: 'row locked' });

    const res = await rescheduleExistingSession('sess-retry-1', '2026-05-08', '17:30:00', 45);

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/DB update failed/);
    expect(mockScheduleCalendarEvent).not.toHaveBeenCalled();
    expect(mockCreateRecallBot).not.toHaveBeenCalled();
    expect(mockLogAudit).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
