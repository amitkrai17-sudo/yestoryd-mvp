// ============================================================================
// SESSION ENGINE
// lib/scheduling/session-engine.ts
// ============================================================================
//
// Consolidated insert path for scheduled_sessions rows.
// Mirrors how lib/communication/notify.ts consolidated WhatsApp sends.
//
// Wraps the existing wiring from lib/scheduling/operations/create-session.ts:
//   - createAdminClient() insert
//   - executeWithCompensation transaction
//   - withCircuitBreaker('google-calendar') around scheduleCalendarEvent
//   - retry-queue enqueue on transient failure
//   - optional Recall bot scheduling on calendar success
//
// Two public functions:
//   - createScheduledSession()        — single row + sync
//   - createScheduledSessionsBatch()  — N rows, optional shared calendar event
//
// No call sites are migrated by this module. Shipping the engine first;
// per-writer migration happens in a follow-up PR.
// ============================================================================

import { scheduleCalendarEvent, cancelEvent } from '@/lib/calendar';
import { createRecallBot, cancelRecallBot } from '@/lib/recall-auto-bot';
import { createAdminClient } from '@/lib/supabase/admin';
import { withCircuitBreaker } from './circuit-breaker';
import { executeWithCompensation, type TransactionStep } from './transaction-manager';
import { enqueue as retryEnqueue } from './retry-queue';
import { notify } from './notification-manager';
import { createLogger } from './logger';
import { logAudit } from './operations/helpers';
import { formatDateShort, formatTime12 } from '@/lib/utils/date-format';

const logger = createLogger('session-engine');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Parameters for creating one scheduled_sessions row.
 * Field set mirrors the union of what the 5 existing insert sites write.
 */
export interface CreateSessionParams {
  enrollmentId: string;
  childId: string;
  coachId: string;
  sessionType: string;
  sessionNumber?: number;
  sessionTitle?: string;
  weekNumber?: number;
  scheduledDate: string;           // YYYY-MM-DD (IST wall-clock)
  scheduledTime: string;           // HH:MM or HH:MM:SS (IST wall-clock)
  durationMinutes: number;
  status?: string;                 // defaults 'scheduled'

  /**
   * Drives calendar-event grouping. When multiple params share a batch_id,
   * createScheduledSessionsBatch() collapses them into ONE calendar event +
   * meet link + (later) one reminder send per slot. NULL → own event per row.
   * Source of truth: scheduled_sessions.batch_id (tuition_onboarding.batch_id).
   */
  batchId?: string | null;

  // Optional per-site fields
  sessionTemplateId?: string | null;
  focusArea?: string;
  coachNotes?: string | null;
  isDiagnostic?: boolean;
  remedialTriggerSource?: string;
  googleMeetLink?: string | null;  // pre-populated batch classroom link
  slotMatchType?: string;          // from smart-slot-finder: 'exact_match'|'manual_required'|...
  sessionMode?: string;            // 'offline' | 'online' (tuition)
}

/**
 * Result of a single session creation attempt.
 * success=true always implies the row was inserted. Calendar / Recall
 * failures surface in `warnings` — caller can observe but the row lives.
 *
 * Note on `success`: `success: true` means the DB row was inserted.
 * Calendar/Recall/notification failures are surfaced as warnings; callers
 * requiring full success should check `warnings.length === 0`.
 */
export interface CreateSessionResult {
  success: boolean;
  sessionId?: string;
  googleEventId?: string;
  meetLink?: string;
  recallBotId?: string;
  warnings: string[];
  error?: string;
}

/**
 * Options that apply to all rows in a batch.
 * skipCalendar is the ONLY legitimate bypass — used by Skill Booster
 * placeholders where calendar creation is deferred until parent books.
 */
export interface BatchOptions {
  /**
   * When true, create ONE Google Calendar event and point every inserted
   * row at the same google_event_id + meet_link. Intended for tuition
   * batch classrooms where multiple children share one meeting URL.
   */
  sharedCalendarEvent?: boolean;

  /**
   * Hook fired AFTER rows are inserted but BEFORE calendar sync runs.
   * Used by enrollment-scheduler sites for template autoassign and
   * enrollment.schedule_confirmed flipping. Receives every inserted row id.
   * Site #4 (scheduleSession) passes undefined.
   */
  onInsertComplete?: (sessionIds: string[]) => Promise<void>;

  /**
   * Skip the calendar sync step entirely. Insert only.
   * ONLY legitimate caller: Skill Booster placeholder insert where
   * status='pending_booking' and scheduled_date/time are placeholders
   * replaced when the parent books.
   */
  skipCalendar?: boolean;

  /**
   * Skip Recall.ai bot scheduling. Cron-reconciled backfills, test
   * fixtures, and non-recorded session types may pass this.
   */
  skipRecall?: boolean;

  /**
   * Skip the notification-manager session.scheduled emit.
   */
  skipNotifications?: boolean;

  /**
   * Optional trace ID for log correlation.
   */
  requestId?: string;
}

// Per-session options are a subset; exposed so single-session callers
// can skip calendar/recall without going through the batch API.
export type SingleSessionOptions = Pick<
  BatchOptions,
  'skipCalendar' | 'skipRecall' | 'skipNotifications' | 'requestId'
> & {
  /**
   * Activity-log action string for the audit entry. Defaults to
   * 'session_created_by_engine'. Wrappers can override (e.g.
   * scheduleSession passes 'session_scheduled' for observer stability).
   */
  auditAction?: string;
};

interface ChildRow {
  name: string | null;
  child_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  parent_name: string | null;
}

interface CoachRow {
  name: string | null;
  email: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildInsertRow(params: CreateSessionParams): Record<string, unknown> {
  const row: Record<string, unknown> = {
    enrollment_id: params.enrollmentId,
    child_id: params.childId,
    coach_id: params.coachId,
    session_type: params.sessionType,
    session_number: params.sessionNumber ?? 1,
    scheduled_date: params.scheduledDate,
    scheduled_time: params.scheduledTime,
    duration_minutes: params.durationMinutes,
    status: params.status ?? 'scheduled',
  };
  if (params.sessionTitle) row.session_title = params.sessionTitle;
  if (params.weekNumber !== undefined) row.week_number = params.weekNumber;
  if (params.sessionTemplateId) row.session_template_id = params.sessionTemplateId;
  if (params.focusArea) row.focus_area = params.focusArea;
  if (params.coachNotes !== undefined) row.coach_notes = params.coachNotes;
  if (params.isDiagnostic) row.is_diagnostic = params.isDiagnostic;
  if (params.remedialTriggerSource) row.remedial_trigger_source = params.remedialTriggerSource;
  if (params.googleMeetLink) row.google_meet_link = params.googleMeetLink;
  if (params.batchId !== undefined) row.batch_id = params.batchId;
  if (params.slotMatchType) row.slot_match_type = params.slotMatchType;
  if (params.sessionMode) row.session_mode = params.sessionMode;
  return row;
}

async function fetchChildAndCoach(
  supabase: ReturnType<typeof createAdminClient>,
  childId: string,
  coachId: string,
): Promise<{ child: ChildRow | null; coach: CoachRow | null }> {
  const [{ data: child }, { data: coach }] = await Promise.all([
    supabase
      .from('children')
      .select('name, child_name, parent_email, parent_phone, parent_name')
      .eq('id', childId)
      .single(),
    supabase
      .from('coaches')
      .select('name, email')
      .eq('id', coachId)
      .single(),
  ]);
  return { child: child as ChildRow | null, coach: coach as CoachRow | null };
}

function buildStartEnd(
  scheduledDate: string,
  scheduledTime: string,
  durationMinutes: number,
): { startTime: Date; endTime: Date } {
  // Explicit IST offset guarantees correct wall-clock regardless of
  // the process's local timezone. See scripts/archive/fix-batch-calendar-recurring.ts
  // for prior-art on this pattern.
  const timeWithSeconds = scheduledTime.length === 5
    ? `${scheduledTime}:00`
    : scheduledTime;
  const startTime = new Date(`${scheduledDate}T${timeWithSeconds}+05:30`);
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);
  return { startTime, endTime };
}

function eventTitle(sessionType: string, childName: string, sessionNumber?: number): string {
  const num = sessionNumber ? ` (Session ${sessionNumber})` : '';
  return `Yestoryd ${sessionType} - ${childName}${num}`;
}

function eventDescription(sessionType: string, childName: string): string {
  return `Reading ${sessionType} session for ${childName}`;
}

// ============================================================================
// PUBLIC: createScheduledSession (single row)
// ============================================================================

/**
 * Create one scheduled_sessions row with calendar + recall wiring.
 *
 * Flow:
 *   1. Fetch child + coach for event attendees.
 *   2. executeWithCompensation transaction:
 *      - upsert_session (insert)
 *      - create_calendar_event (unless skipCalendar) — under circuit breaker
 *      - schedule_recall_bot   (unless skipRecall, and only if calendar succeeded)
 *   3. Non-fatal notification emit.
 *   4. On transaction failure after insert, enqueue retry via retry-queue.
 *
 * Errors inside the calendar/recall steps are caught and surfaced as
 * `warnings`; they do NOT roll back the insert. Only an insert failure
 * returns success=false.
 */
export async function createScheduledSession(
  params: CreateSessionParams,
  options: SingleSessionOptions = {},
): Promise<CreateSessionResult> {
  const supabase = createAdminClient();
  const requestId = options.requestId;
  const warnings: string[] = [];

  try {
    const { child, coach } = await fetchChildAndCoach(supabase, params.childId, params.coachId);
    const childName = child?.child_name || child?.name || 'Student';
    const coachEmail = coach?.email || '';
    const parentEmail = child?.parent_email || '';

    const { startTime, endTime } = buildStartEnd(
      params.scheduledDate,
      params.scheduledTime,
      params.durationMinutes,
    );

    const attendees: string[] = [];
    if (parentEmail) attendees.push(parentEmail);
    if (coachEmail) attendees.push(coachEmail);

    let sessionId: string | undefined;
    let calendarEventId: string | null = null;
    let meetLink: string | null = params.googleMeetLink ?? null;
    let recallBotId: string | null = null;

    const steps: TransactionStep[] = [
      {
        name: 'insert_session',
        execute: async () => {
          const { data, error } = await supabase
            .from('scheduled_sessions')
            .insert(buildInsertRow(params) as never)
            .select('id')
            .single();
          if (error || !data) throw new Error(`DB insert failed: ${error?.message ?? 'no data'}`);
          sessionId = (data as { id: string }).id;
          return { id: sessionId };
        },
        compensate: async (result) => {
          if (result?.id) {
            await supabase.from('scheduled_sessions').delete().eq('id', result.id);
            logger.info('compensated_session_delete', { requestId, sessionId: result.id });
          }
        },
      },
    ];

    if (!options.skipCalendar) {
      steps.push({
        name: 'create_calendar_event',
        execute: async () => {
          try {
            const calResult = await withCircuitBreaker('google-calendar', () =>
              scheduleCalendarEvent({
                title: eventTitle(params.sessionType, childName, params.sessionNumber),
                description: eventDescription(params.sessionType, childName),
                startTime,
                endTime,
                attendees,
                sessionType: params.sessionType === 'parent_checkin' ? 'parent_checkin' : 'coaching',
              }),
            );
            calendarEventId = calResult.eventId;
            meetLink = calResult.meetLink || meetLink;
            if (sessionId) {
              await supabase
                .from('scheduled_sessions')
                .update({ google_event_id: calendarEventId, google_meet_link: meetLink })
                .eq('id', sessionId);
            }
            logger.info('calendar_created', { requestId, sessionId, eventId: calendarEventId });
            return { eventId: calendarEventId, meetLink };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'calendar failed';
            warnings.push(`calendar_failed: ${msg}`);
            logger.error('calendar_creation_failed', { requestId, sessionId, error: msg });
            return { eventId: null, meetLink: null };
          }
        },
        compensate: async (result) => {
          if (result?.eventId) {
            try { await cancelEvent(result.eventId, true); } catch { /* best effort */ }
          }
        },
      });
    }

    if (!options.skipRecall) {
      steps.push({
        name: 'schedule_recall_bot',
        execute: async () => {
          if (!meetLink || !calendarEventId) return { botId: null };
          try {
            const botResult = await withCircuitBreaker('recall-ai', () =>
              createRecallBot({
                sessionId: sessionId!,
                meetingUrl: meetLink!,
                scheduledTime: startTime,
                childId: params.childId,
                childName,
                coachId: params.coachId,
                sessionType: (params.sessionType === 'parent_checkin' ? 'parent_checkin' : 'coaching') as 'coaching' | 'parent_checkin',
              }),
            );
            recallBotId = botResult?.botId ?? null;
            logger.info('recall_bot_created', { requestId, sessionId, botId: recallBotId });
            return { botId: recallBotId };
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'recall failed';
            warnings.push(`recall_failed: ${msg}`);
            logger.error('recall_bot_failed', { requestId, sessionId, error: msg });
            return { botId: null };
          }
        },
        compensate: async (result) => {
          if (result?.botId) {
            try { await cancelRecallBot(result.botId); } catch { /* best effort */ }
          }
        },
      });
    }

    const txResult = await executeWithCompensation(steps, requestId);
    if (!txResult.success) {
      const errMsg = txResult.error ?? `Transaction failed at ${txResult.failedAt}`;
      if (sessionId) {
        try { await retryEnqueue(sessionId, errMsg); } catch { /* best effort */ }
      }
      return { success: false, warnings, error: errMsg };
    }

    await logAudit(supabase, options.auditAction ?? 'session_created_by_engine', {
      sessionId,
      enrollmentId: params.enrollmentId,
      childId: params.childId,
      coachId: params.coachId,
      sessionType: params.sessionType,
      calendarEventId,
      recallBotId,
      warnings,
    });

    if (!options.skipNotifications) {
      try {
        await notify('session.scheduled', {
          sessionId,
          enrollmentId: params.enrollmentId,
          childId: params.childId,
          childName,
          coachName: coach?.name ?? 'Coach',
          parentPhone: child?.parent_phone ?? undefined,
          parentEmail,
          parentName: child?.parent_name ?? undefined,
          sessionDate: formatDateShort(params.scheduledDate),
          sessionTime: formatTime12(params.scheduledTime),
          sessionType: params.sessionType,
          meetLink,
        });
      } catch { /* non-fatal */ }
    }

    return {
      success: true,
      sessionId,
      googleEventId: calendarEventId ?? undefined,
      meetLink: meetLink ?? undefined,
      recallBotId: recallBotId ?? undefined,
      warnings,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    logger.error('session_engine_error', { requestId, error: msg });
    return { success: false, warnings, error: msg };
  }
}

// ============================================================================
// PUBLIC: createScheduledSessionsBatch (N rows)
// ============================================================================

/**
 * Create N scheduled_sessions rows in one multi-row insert, then sync
 * calendar events.
 *
 * Two batch modes:
 *   - sharedCalendarEvent=true  → one calendar event, every row references
 *     the same google_event_id + meet_link. Intended for tuition batch
 *     classrooms where siblings share a meeting.
 *   - sharedCalendarEvent=false → one event per row, created in parallel.
 *     Each row gets its own event_id + meet_link.
 *
 * onInsertComplete runs AFTER rows land in the DB and BEFORE calendar
 * sync. That ordering lets enrollment-scheduler callers do template
 * autoassign and enrollment updates against the freshly-inserted ids
 * while preserving the calendar step's ability to observe those columns.
 *
 * Returns one CreateSessionResult per input param, in order. A batch
 * insert failure returns N `{success: false}` results with the same
 * error on each.
 */
export async function createScheduledSessionsBatch(
  paramsArray: CreateSessionParams[],
  options: BatchOptions = {},
): Promise<CreateSessionResult[]> {
  if (paramsArray.length === 0) return [];
  const supabase = createAdminClient();
  const requestId = options.requestId;

  // Step 1: insert all rows in a single statement.
  const insertRows = paramsArray.map(buildInsertRow);
  const { data: insertedRows, error: insertError } = await supabase
    .from('scheduled_sessions')
    .insert(insertRows as never)
    .select('id');

  if (insertError || !insertedRows) {
    const msg = insertError?.message ?? 'batch insert failed';
    logger.error('batch_insert_failed', { requestId, error: msg, count: paramsArray.length });
    return paramsArray.map(() => ({ success: false, warnings: [], error: msg }));
  }

  const sessionIds = (insertedRows as { id: string }[]).map((r) => r.id);

  // Step 2: onInsertComplete hook — sites #1/#2/#3 use this for
  // template autoassign + enrollment update.
  if (options.onInsertComplete) {
    try {
      await options.onInsertComplete(sessionIds);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'onInsertComplete failed';
      logger.warn('on_insert_complete_failed', { requestId, error: msg });
      // Non-fatal; keep going. Caller's hook is responsible for its own durability.
    }
  }

  // Step 3: calendar sync.
  if (options.skipCalendar) {
    return sessionIds.map((id) => ({ success: true, sessionId: id, warnings: [] }));
  }

  // sharedCalendarEvent=true is an explicit override: collapse ALL rows into
  // one calendar event regardless of batch_id. Used when the caller knows
  // every row shares a slot (tuition batch classroom creation path).
  if (options.sharedCalendarEvent) {
    return await syncSharedCalendarEvent(supabase, sessionIds, paramsArray, options);
  }

  // Default: group by batch_id.
  //   batch_id !== null → one shared calendar event per group
  //   batch_id === null → one event per row (existing per-row path)
  const groupedByBatch = new Map<string, { ids: string[]; params: CreateSessionParams[] }>();
  const ungroupedIds: string[] = [];
  const ungroupedParams: CreateSessionParams[] = [];

  for (let i = 0; i < sessionIds.length; i++) {
    const id = sessionIds[i];
    const p = paramsArray[i];
    if (p.batchId) {
      const g = groupedByBatch.get(p.batchId) ?? { ids: [], params: [] };
      g.ids.push(id);
      g.params.push(p);
      groupedByBatch.set(p.batchId, g);
    } else {
      ungroupedIds.push(id);
      ungroupedParams.push(p);
    }
  }

  const resultMap = new Map<string, CreateSessionResult>();

  // Run grouped syncs sequentially (respect Calendar rate limits).
  // Array.from for tsc-target compatibility — Map iterator requires ES2015+.
  for (const group of Array.from(groupedByBatch.values())) {
    const groupResults = await syncSharedCalendarEvent(supabase, group.ids, group.params, options);
    for (const r of groupResults) {
      if (r.sessionId) resultMap.set(r.sessionId, r);
    }
  }

  if (ungroupedIds.length > 0) {
    const ungroupedResults = await syncPerRowCalendarEvents(supabase, ungroupedIds, ungroupedParams, options);
    for (const r of ungroupedResults) {
      if (r.sessionId) resultMap.set(r.sessionId, r);
    }
  }

  // Reassemble in original input order.
  return sessionIds.map(
    (id) => resultMap.get(id) ?? { success: false, sessionId: id, warnings: [], error: 'result missing' },
  );
}

// ============================================================================
// INTERNAL: shared-event batch sync
// ============================================================================

async function syncSharedCalendarEvent(
  supabase: ReturnType<typeof createAdminClient>,
  sessionIds: string[],
  paramsArray: CreateSessionParams[],
  options: BatchOptions,
): Promise<CreateSessionResult[]> {
  const requestId = options.requestId;
  const first = paramsArray[0];

  // Use first row as the calendar event's title/time anchor. All rows
  // in a shared-event batch are assumed to share date + time + duration.
  const { startTime, endTime } = buildStartEnd(
    first.scheduledDate,
    first.scheduledTime,
    first.durationMinutes,
  );

  // Fetch all children for attendee list; coach is assumed shared.
  const { data: children } = await supabase
    .from('children')
    .select('id, name, child_name, parent_email')
    .in('id', paramsArray.map((p) => p.childId));
  const { data: coach } = await supabase
    .from('coaches')
    .select('name, email')
    .eq('id', first.coachId)
    .single();

  const attendees: string[] = [];
  if (coach?.email) attendees.push(coach.email);
  for (const c of (children ?? []) as Array<{ parent_email: string | null }>) {
    if (c.parent_email) attendees.push(c.parent_email);
  }

  const batchTitle = `Yestoryd ${first.sessionType} - Batch (${paramsArray.length} ${paramsArray.length === 1 ? 'child' : 'children'})`;

  try {
    const calResult = await withCircuitBreaker('google-calendar', () =>
      scheduleCalendarEvent({
        title: batchTitle,
        description: `Shared ${first.sessionType} session for ${paramsArray.length} children`,
        startTime,
        endTime,
        attendees,
        sessionType: first.sessionType === 'parent_checkin' ? 'parent_checkin' : 'coaching',
      }),
    );

    await supabase
      .from('scheduled_sessions')
      .update({
        google_event_id: calResult.eventId,
        google_meet_link: calResult.meetLink,
      })
      .in('id', sessionIds);

    logger.info('batch_shared_calendar_created', {
      requestId,
      eventId: calResult.eventId,
      rowCount: sessionIds.length,
    });

    return sessionIds.map((id) => ({
      success: true,
      sessionId: id,
      googleEventId: calResult.eventId,
      meetLink: calResult.meetLink,
      warnings: [],
    }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'shared calendar failed';
    logger.error('batch_shared_calendar_failed', { requestId, error: msg });
    // Enqueue retry for every row; return partial success (insert held).
    for (const id of sessionIds) {
      try { await retryEnqueue(id, msg); } catch { /* best effort */ }
    }
    return sessionIds.map((id) => ({
      success: true,
      sessionId: id,
      warnings: [`calendar_failed: ${msg}`],
    }));
  }
}

// ============================================================================
// INTERNAL: per-row batch sync
// ============================================================================

async function syncPerRowCalendarEvents(
  supabase: ReturnType<typeof createAdminClient>,
  sessionIds: string[],
  paramsArray: CreateSessionParams[],
  options: BatchOptions,
): Promise<CreateSessionResult[]> {
  const requestId = options.requestId;

  // Run per-row syncs sequentially to respect Calendar API rate limits.
  // Could be parallelized later; keep simple for v1.
  const results: CreateSessionResult[] = [];
  for (let i = 0; i < sessionIds.length; i++) {
    const id = sessionIds[i];
    const params = paramsArray[i];
    const warnings: string[] = [];

    const { child, coach } = await fetchChildAndCoach(supabase, params.childId, params.coachId);
    const childName = child?.child_name || child?.name || 'Student';
    const attendees: string[] = [];
    if (child?.parent_email) attendees.push(child.parent_email);
    if (coach?.email) attendees.push(coach.email);

    const { startTime, endTime } = buildStartEnd(
      params.scheduledDate,
      params.scheduledTime,
      params.durationMinutes,
    );

    try {
      const calResult = await withCircuitBreaker('google-calendar', () =>
        scheduleCalendarEvent({
          title: eventTitle(params.sessionType, childName, params.sessionNumber),
          description: eventDescription(params.sessionType, childName),
          startTime,
          endTime,
          attendees,
          sessionType: params.sessionType === 'parent_checkin' ? 'parent_checkin' : 'coaching',
        }),
      );
      await supabase
        .from('scheduled_sessions')
        .update({ google_event_id: calResult.eventId, google_meet_link: calResult.meetLink })
        .eq('id', id);

      let recallBotId: string | null = null;
      if (!options.skipRecall && calResult.meetLink) {
        try {
          const botResult = await withCircuitBreaker('recall-ai', () =>
            createRecallBot({
              sessionId: id,
              meetingUrl: calResult.meetLink,
              scheduledTime: startTime,
              childId: params.childId,
              childName,
              coachId: params.coachId,
              sessionType: (params.sessionType === 'parent_checkin' ? 'parent_checkin' : 'coaching') as 'coaching' | 'parent_checkin',
            }),
          );
          recallBotId = botResult?.botId ?? null;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'recall failed';
          warnings.push(`recall_failed: ${msg}`);
        }
      }

      results.push({
        success: true,
        sessionId: id,
        googleEventId: calResult.eventId,
        meetLink: calResult.meetLink,
        recallBotId: recallBotId ?? undefined,
        warnings,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'calendar failed';
      logger.error('batch_per_row_calendar_failed', { requestId, sessionId: id, error: msg });
      try { await retryEnqueue(id, msg); } catch { /* best effort */ }
      results.push({
        success: true,
        sessionId: id,
        warnings: [`calendar_failed: ${msg}`],
      });
    }
  }

  return results;
}
