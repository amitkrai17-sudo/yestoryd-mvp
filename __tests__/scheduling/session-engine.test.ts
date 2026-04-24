// ============================================================================
// SESSION ENGINE TESTS
// __tests__/scheduling/session-engine.test.ts
// ============================================================================
//
// Covers:
//   S1 — single session happy path (insert + calendar + recall)
//   S2 — single session with skipCalendar (insert only, no calendar call)
//   S3 — single session, calendar fails → row preserved + retry enqueued
//   S4 — batch with sharedCalendarEvent=true (one event, N rows updated)
//   S5 — batch per-row (one event per row)
//   S6 — onInsertComplete runs AFTER insert, BEFORE calendar sync
//   S7 — batch skipCalendar=true short-circuits everything
//   S8 — mixed batch_id: 2 rows batchId='A' + 2 nulls → 3 calendar calls
//   S9 — all rows share batchId='B' → 1 calendar call, all rows share eventId
// ============================================================================

jest.mock('@/lib/scheduling/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// Mock circuit breaker as pass-through (tested separately).
jest.mock('@/lib/scheduling/circuit-breaker', () => ({
  withCircuitBreaker: (_service: string, op: () => Promise<unknown>) => op(),
}));

// Mock external services.
const mockScheduleCalendarEvent = jest.fn();
const mockCancelEvent = jest.fn();
jest.mock('@/lib/calendar', () => ({
  scheduleCalendarEvent: (...args: unknown[]) => mockScheduleCalendarEvent(...args),
  cancelEvent: (...args: unknown[]) => mockCancelEvent(...args),
}));

const mockCreateRecallBot = jest.fn();
const mockCancelRecallBot = jest.fn();
jest.mock('@/lib/recall-auto-bot', () => ({
  createRecallBot: (...args: unknown[]) => mockCreateRecallBot(...args),
  cancelRecallBot: (...args: unknown[]) => mockCancelRecallBot(...args),
}));

const mockRetryEnqueue = jest.fn();
jest.mock('@/lib/scheduling/retry-queue', () => ({
  enqueue: (...args: unknown[]) => mockRetryEnqueue(...args),
}));

const mockNotify = jest.fn();
jest.mock('@/lib/scheduling/notification-manager', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));

const mockLogAudit = jest.fn();
jest.mock('@/lib/scheduling/operations/helpers', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
  getSupabase: jest.fn(),
  getSessionWithRelations: jest.fn(),
}));

// Mock Supabase admin client with a fluent-chain recorder.
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

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => makeChain(table),
  }),
}));

import {
  createScheduledSession,
  createScheduledSessionsBatch,
  type CreateSessionParams,
} from '@/lib/scheduling/session-engine';

beforeEach(() => {
  jest.clearAllMocks();
  nextResults = [];
  calls.length = 0;
});

const baseParams: CreateSessionParams = {
  enrollmentId: 'e1',
  childId: 'c1',
  coachId: 'co1',
  sessionType: 'coaching',
  sessionNumber: 1,
  scheduledDate: '2026-05-01',
  scheduledTime: '17:30',
  durationMinutes: 45,
};

describe('session-engine', () => {
  // S1 ──────────────────────────────────────────────────────────────────
  it('S1: single session happy path — insert + calendar + recall', async () => {
    // Order of Supabase calls:
    //   1. children.select.eq.single  → child row
    //   2. coaches.select.eq.single   → coach row
    //   3. scheduled_sessions.insert.select.single  → {id: 'sess-1'}
    //   4. scheduled_sessions.update.eq             → ok
    //   5. activity_log.insert (from logAudit)      → ok
    queueResult({ name: 'Harshi', child_name: 'Harshi', parent_email: 'p@example.com', parent_phone: '+919000000000', parent_name: 'Parent' });
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult({ id: 'sess-1' });
    queueResult(null);  // update event_id
    queueResult(null);  // activity_log

    mockScheduleCalendarEvent.mockResolvedValue({ eventId: 'evt-1', meetLink: 'https://meet.google.com/abc' });
    mockCreateRecallBot.mockResolvedValue({ botId: 'bot-1' });

    const res = await createScheduledSession(baseParams);

    expect(res.success).toBe(true);
    expect(res.sessionId).toBe('sess-1');
    expect(res.googleEventId).toBe('evt-1');
    expect(res.meetLink).toBe('https://meet.google.com/abc');
    expect(res.recallBotId).toBe('bot-1');
    expect(res.warnings).toEqual([]);
    expect(mockRetryEnqueue).not.toHaveBeenCalled();
    expect(mockScheduleCalendarEvent).toHaveBeenCalledTimes(1);
    expect(mockCreateRecallBot).toHaveBeenCalledTimes(1);

    // Verify startTime was built with +05:30 offset (IST wall-clock preserved).
    const calArg = mockScheduleCalendarEvent.mock.calls[0][0];
    expect(calArg.startTime.toISOString()).toBe('2026-05-01T12:00:00.000Z'); // 17:30 IST = 12:00 UTC
    expect(calArg.endTime.toISOString()).toBe('2026-05-01T12:45:00.000Z');
  });

  // S2 ──────────────────────────────────────────────────────────────────
  it('S2: skipCalendar → insert only, no calendar/recall calls, no warnings', async () => {
    queueResult({ name: 'Harshi', child_name: 'Harshi', parent_email: 'p@example.com', parent_phone: null, parent_name: 'Parent' });
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult({ id: 'sess-2' });
    queueResult(null);  // activity_log

    const res = await createScheduledSession(baseParams, { skipCalendar: true, skipRecall: true, skipNotifications: true });

    expect(res.success).toBe(true);
    expect(res.sessionId).toBe('sess-2');
    expect(res.googleEventId).toBeUndefined();
    expect(res.meetLink).toBeUndefined();
    expect(mockScheduleCalendarEvent).not.toHaveBeenCalled();
    expect(mockCreateRecallBot).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockRetryEnqueue).not.toHaveBeenCalled();
  });

  // S3 ──────────────────────────────────────────────────────────────────
  it('S3: calendar fails → row preserved, warning surfaced, retry NOT enqueued (step caught, tx succeeded)', async () => {
    // Calendar step catches its own error and returns {eventId: null}.
    // The transaction therefore completes "successfully"; retryEnqueue
    // is ONLY called if the transaction itself aborts. So the insert is
    // preserved, warnings has 'calendar_failed', no retry enqueued.
    queueResult({ name: 'Harshi', child_name: 'Harshi', parent_email: 'p@example.com', parent_phone: null, parent_name: 'Parent' });
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult({ id: 'sess-3' });
    queueResult(null);  // activity_log

    mockScheduleCalendarEvent.mockRejectedValue(new Error('Google API 500'));

    const res = await createScheduledSession(baseParams, { skipRecall: true, skipNotifications: true });

    expect(res.success).toBe(true);  // insert succeeded
    expect(res.sessionId).toBe('sess-3');
    expect(res.googleEventId).toBeUndefined();
    expect(res.warnings).toEqual([expect.stringMatching(/^calendar_failed:/)]);
    expect(mockRetryEnqueue).not.toHaveBeenCalled();  // tx didn't abort
  });

  // S4 ──────────────────────────────────────────────────────────────────
  it('S4: batch with sharedCalendarEvent=true → one event, all rows updated', async () => {
    // Calls in order:
    //   1. scheduled_sessions.insert.select → [{id:'s1'},{id:'s2'}]
    //   2. children.select.in                → 2 child rows
    //   3. coaches.select.eq.single          → coach row
    //   4. scheduled_sessions.update.in      → ok
    queueResult([{ id: 's1' }, { id: 's2' }]);
    queueResult([
      { id: 'c1', name: 'Shivaay', child_name: 'Shivaay', parent_email: 'p1@example.com' },
      { id: 'c2', name: 'Shloka', child_name: 'Shloka', parent_email: 'p2@example.com' },
    ]);
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult(null);  // batch update

    mockScheduleCalendarEvent.mockResolvedValue({ eventId: 'evt-shared', meetLink: 'https://meet.google.com/shared' });

    const params: CreateSessionParams[] = [
      { ...baseParams, childId: 'c1' },
      { ...baseParams, childId: 'c2' },
    ];
    const results = await createScheduledSessionsBatch(params, { sharedCalendarEvent: true, skipRecall: true });

    expect(mockScheduleCalendarEvent).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
    expect(results[0].googleEventId).toBe('evt-shared');
    expect(results[1].googleEventId).toBe('evt-shared');
    expect(results[0].meetLink).toBe('https://meet.google.com/shared');
    expect(results[1].meetLink).toBe('https://meet.google.com/shared');

    // Verify the batch update used .in('id', sessionIds)
    const updateCall = calls.find((c) => c.table === 'scheduled_sessions' && c.op === 'update');
    expect(updateCall?.filters?.id).toEqual(['s1', 's2']);
  });

  // S5 ──────────────────────────────────────────────────────────────────
  it('S5: batch per-row → one calendar event per row', async () => {
    // Calls:
    //   1. scheduled_sessions.insert.select → [{id:'s1'},{id:'s2'}]
    //   2..n (per row): children.select.eq.single, coaches.select.eq.single,
    //                   scheduled_sessions.update.eq
    queueResult([{ id: 's1' }, { id: 's2' }]);
    // Row 1
    queueResult({ name: 'Shivaay', child_name: 'Shivaay', parent_email: 'p1@example.com' });
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult(null);  // update row 1
    // Row 2
    queueResult({ name: 'Shloka', child_name: 'Shloka', parent_email: 'p2@example.com' });
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult(null);  // update row 2

    mockScheduleCalendarEvent
      .mockResolvedValueOnce({ eventId: 'evt-1', meetLink: 'https://meet.google.com/1' })
      .mockResolvedValueOnce({ eventId: 'evt-2', meetLink: 'https://meet.google.com/2' });

    const params: CreateSessionParams[] = [
      { ...baseParams, childId: 'c1' },
      { ...baseParams, childId: 'c2' },
    ];
    const results = await createScheduledSessionsBatch(params, { skipRecall: true });

    expect(mockScheduleCalendarEvent).toHaveBeenCalledTimes(2);
    expect(results[0].googleEventId).toBe('evt-1');
    expect(results[1].googleEventId).toBe('evt-2');
    expect(results[0].meetLink).toBe('https://meet.google.com/1');
    expect(results[1].meetLink).toBe('https://meet.google.com/2');
  });

  // S6 ──────────────────────────────────────────────────────────────────
  it('S6: onInsertComplete runs AFTER insert, BEFORE calendar sync', async () => {
    // Capture call order across: insert, hook, calendar call.
    const callOrder: string[] = [];

    queueResult([{ id: 's-a' }, { id: 's-b' }]);  // insert
    // Per-row mode path: children, coaches, update (row 1), children, coaches, update (row 2)
    queueResult({ name: 'A', child_name: 'A', parent_email: 'a@example.com' });
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult(null);
    queueResult({ name: 'B', child_name: 'B', parent_email: 'b@example.com' });
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult(null);

    mockScheduleCalendarEvent.mockImplementation(async () => {
      callOrder.push('calendar');
      return { eventId: 'evt-x', meetLink: 'https://meet.google.com/x' };
    });

    const hook = jest.fn(async (ids: string[]) => {
      callOrder.push(`hook:${ids.join(',')}`);
    });

    const params: CreateSessionParams[] = [
      { ...baseParams, childId: 'c-a' },
      { ...baseParams, childId: 'c-b' },
    ];
    await createScheduledSessionsBatch(params, { onInsertComplete: hook, skipRecall: true });

    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(['s-a', 's-b']);

    // Hook must run before ANY calendar call.
    const hookIndex = callOrder.findIndex((s) => s.startsWith('hook:'));
    const firstCalendarIndex = callOrder.indexOf('calendar');
    expect(hookIndex).toBeGreaterThanOrEqual(0);
    expect(firstCalendarIndex).toBeGreaterThan(hookIndex);
  });

  // S7 ──────────────────────────────────────────────────────────────────
  // skipCalendar at batch level short-circuits everything
  it('S7: batch skipCalendar=true → inserts + hook only, no calendar, no retry', async () => {
    queueResult([{ id: 's-p1' }, { id: 's-p2' }]);

    const hook = jest.fn();
    const params: CreateSessionParams[] = [
      { ...baseParams, childId: 'c-p1', status: 'pending_booking' },
      { ...baseParams, childId: 'c-p2', status: 'pending_booking' },
    ];
    const results = await createScheduledSessionsBatch(params, { skipCalendar: true, onInsertComplete: hook });

    expect(hook).toHaveBeenCalledWith(['s-p1', 's-p2']);
    expect(mockScheduleCalendarEvent).not.toHaveBeenCalled();
    expect(mockRetryEnqueue).not.toHaveBeenCalled();
    expect(results.every((r) => r.success && !r.googleEventId && r.warnings.length === 0)).toBe(true);
  });

  // S8 ──────────────────────────────────────────────────────────────────
  it('S8: mixed batch_id (2 rows batchId=A, 2 nulls) → 3 calendar calls', async () => {
    // Input order: [batchA-0, null-0, batchA-1, null-1]
    // After grouping:
    //   group 'A' → [s1, s3]  (input indices 0, 2)
    //   ungrouped → [s2, s4]  (input indices 1, 3)
    // Execution sequence:
    //   1. scheduled_sessions.insert.select → [s1,s2,s3,s4]
    //   2. Group 'A' sync:
    //        children.in → [childA0, childA1]
    //        coaches.eq.single → coach
    //        scheduled_sessions.update.in(['s1','s3'])
    //   3. Ungrouped per-row s2: children.eq.single, coaches.eq.single, update.eq
    //   4. Ungrouped per-row s4: children.eq.single, coaches.eq.single, update.eq
    queueResult([{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }]);  // insert
    queueResult([
      { id: 'cA0', name: 'A0', child_name: 'A0', parent_email: 'pA0@example.com' },
      { id: 'cA1', name: 'A1', child_name: 'A1', parent_email: 'pA1@example.com' },
    ]);
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult(null);  // batch update.in for group A
    queueResult({ name: 'N0', child_name: 'N0', parent_email: 'pN0@example.com' });
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult(null);  // update.eq s2
    queueResult({ name: 'N1', child_name: 'N1', parent_email: 'pN1@example.com' });
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult(null);  // update.eq s4

    mockScheduleCalendarEvent
      .mockResolvedValueOnce({ eventId: 'evt-A', meetLink: 'https://meet.google.com/A' })
      .mockResolvedValueOnce({ eventId: 'evt-n0', meetLink: 'https://meet.google.com/n0' })
      .mockResolvedValueOnce({ eventId: 'evt-n1', meetLink: 'https://meet.google.com/n1' });

    const params: CreateSessionParams[] = [
      { ...baseParams, childId: 'cA0', batchId: 'A' },
      { ...baseParams, childId: 'cN0' },
      { ...baseParams, childId: 'cA1', batchId: 'A' },
      { ...baseParams, childId: 'cN1' },
    ];
    const results = await createScheduledSessionsBatch(params, { skipRecall: true });

    expect(mockScheduleCalendarEvent).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(4);

    // Results come back in input order, grouped rows share the group eventId.
    expect(results[0].sessionId).toBe('s1');
    expect(results[0].googleEventId).toBe('evt-A');
    expect(results[1].sessionId).toBe('s2');
    expect(results[1].googleEventId).toBe('evt-n0');
    expect(results[2].sessionId).toBe('s3');
    expect(results[2].googleEventId).toBe('evt-A');
    expect(results[3].sessionId).toBe('s4');
    expect(results[3].googleEventId).toBe('evt-n1');

    // Verify the group update filter used .in('id', ['s1','s3'])
    const groupUpdate = calls.find(
      (c) => c.table === 'scheduled_sessions' && c.op === 'update' && Array.isArray((c.filters?.id as unknown[]) ?? undefined),
    );
    expect(groupUpdate?.filters?.id).toEqual(['s1', 's3']);
  });

  // S9 ──────────────────────────────────────────────────────────────────
  it('S9: all rows share batchId=B → 1 calendar call, all rows share eventId', async () => {
    // Execution sequence:
    //   1. scheduled_sessions.insert.select → [s1,s2,s3]
    //   2. Group 'B' sync:
    //        children.in → 3 rows
    //        coaches.eq.single → coach
    //        scheduled_sessions.update.in(['s1','s2','s3'])
    queueResult([{ id: 's1' }, { id: 's2' }, { id: 's3' }]);  // insert
    queueResult([
      { id: 'c1', name: 'B0', child_name: 'B0', parent_email: 'pB0@example.com' },
      { id: 'c2', name: 'B1', child_name: 'B1', parent_email: 'pB1@example.com' },
      { id: 'c3', name: 'B2', child_name: 'B2', parent_email: 'pB2@example.com' },
    ]);
    queueResult({ name: 'Rucha', email: 'rucha@yestoryd.com' });
    queueResult(null);  // batch update.in

    mockScheduleCalendarEvent.mockResolvedValue({ eventId: 'evt-B', meetLink: 'https://meet.google.com/B' });

    const params: CreateSessionParams[] = [
      { ...baseParams, childId: 'c1', batchId: 'B' },
      { ...baseParams, childId: 'c2', batchId: 'B' },
      { ...baseParams, childId: 'c3', batchId: 'B' },
    ];
    const results = await createScheduledSessionsBatch(params, { skipRecall: true });

    expect(mockScheduleCalendarEvent).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.googleEventId === 'evt-B')).toBe(true);
    expect(results.every((r) => r.meetLink === 'https://meet.google.com/B')).toBe(true);

    // No per-row update paths should have run.
    const updateCalls = calls.filter((c) => c.table === 'scheduled_sessions' && c.op === 'update');
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.filters?.id).toEqual(['s1', 's2', 's3']);
  });
});
