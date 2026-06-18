/**
 * Reschedule operations.
 *
 *   - rescheduleSession()         — parent-initiated slot change on an already-
 *                                   scheduled session. PATCHes the existing
 *                                   Google Calendar event (rescheduleEvent),
 *                                   cancels the old Recall bot, notifies
 *                                   'session.rescheduled'.
 *
 *   - rescheduleExistingSession() — retry-queue-initiated finalize. The row
 *                                   already exists with status !='scheduled'
 *                                   and NO calendar event yet; this call
 *                                   UPDATEs the row, creates a NEW calendar
 *                                   event + Recall bot, notifies
 *                                   'session.scheduled'. Extracted from the
 *                                   former UPDATE branch of scheduleSession().
 */

import { rescheduleEvent, scheduleCalendarEvent, cancelEvent } from '@/lib/calendar';
import { cancelRecallBot, createRecallBot } from '@/lib/recall-auto-bot';
import { notify } from '../notification-manager';
import { withCircuitBreaker } from '../circuit-breaker';
import { createLogger } from '../logger';
import { executeWithCompensation, type TransactionStep } from '../transaction-manager';
import { getSupabase, logAudit, getSessionWithRelations } from './helpers';
import { attachCalendarLink } from '../calendar-link';
import type { SessionResult } from './types';
import { formatDateShort, formatTime12 } from '@/lib/utils/date-format';

const logger = createLogger('session-manager');

export async function rescheduleSession(
  sessionId: string,
  newSlot: { date: string; time: string },
  reason: string
): Promise<SessionResult> {
  const supabase = getSupabase();

  try {
    const { session, error: fetchError } = await getSessionWithRelations(supabase, sessionId);
    if (fetchError || !session) {
      return { success: false, error: 'Session not found' };
    }

    if (['completed', 'cancelled'].includes(session.status)) {
      return { success: false, error: `Cannot reschedule ${session.status} session` };
    }

    const child = session.children;
    const coach = session.coaches;
    const duration = session.duration_minutes || 45;
    const newStart = new Date(`${newSlot.date}T${newSlot.time}`);

    let calendarUpdated = false;
    let newMeetLink = session.google_meet_link;

    const eventId = session.google_event_id;
    if (eventId) {
      // C3 LANDMINE GUARD: is this Google event SHARED by other LIVE sessions?
      // Tuition recurring / multi-child cohorts reuse ONE event id across many rows;
      // PATCHing it in place would move the event for every sibling. Count live siblings.
      const { count: siblingCount } = await supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('google_event_id', eventId)
        .neq('id', sessionId)
        .not('status', 'in', '(cancelled,completed,missed)');
      const isShared = (siblingCount ?? 0) > 0;

      if (isShared) {
        // DETACH (decision a): give THIS row its own new event at the new time; leave the
        // shared event + all siblings untouched. Do NOT PATCH the shared event.
        try {
          const childName = child?.child_name || child?.name || 'Student';
          const coachEmail = coach?.email || '';
          const parentEmail = child?.parent_email || '';
          const endTime = new Date(newStart);
          endTime.setMinutes(endTime.getMinutes() + duration);
          const attendees: string[] = [];
          if (parentEmail) attendees.push(parentEmail);
          if (coachEmail) attendees.push(coachEmail);
          const num = session.session_number ? ` (Session ${session.session_number})` : '';

          const calResult = await withCircuitBreaker('google-calendar', () =>
            scheduleCalendarEvent({
              title: `Yestoryd ${session.session_type} - ${childName}${num}`,
              description: `Reading ${session.session_type} session for ${childName}`,
              startTime: newStart,
              endTime,
              attendees,
              sessionType: session.session_type === 'parent_checkin' ? 'parent_checkin' : 'coaching',
            }),
          );
          if (calResult.meetLink) newMeetLink = calResult.meetLink;
          // attachCalendarLink is the SOLE column-writer — point ONLY this row at the new event.
          await attachCalendarLink(supabase, sessionId, calResult.eventId, newMeetLink);
          calendarUpdated = true;
          logger.info('calendar_detached_from_shared', {
            sessionId, oldEventId: eventId, newEventId: calResult.eventId, siblingCount: siblingCount ?? 0,
          });
        } catch (calError: any) {
          logger.error('calendar_detach_failed', { sessionId, error: calError.message });
        }
      } else {
        // TRUE 1:1 (no live siblings) — retain today's behavior: PATCH the event in place.
        try {
          const result = await withCircuitBreaker('google-calendar', () =>
            rescheduleEvent(eventId, newStart, duration)
          );
          if (result.success) {
            calendarUpdated = true;
            if (result.meetLink) newMeetLink = result.meetLink;
          }
          // attachCalendarLink is the SOLE calendar-column writer: persist the link through it.
          // eventId is unchanged (PATCH kept the same event) — re-stamp it so google_event_id is
          // written to its own current value, never nulled.
          await attachCalendarLink(supabase, sessionId, eventId, result.meetLink ?? session.google_meet_link);
        } catch (calError: any) {
          logger.error('calendar_reschedule_failed', { sessionId, error: calError.message });
        }
      }
    }

    const botId = session.recall_bot_id;
    if (botId) {
      try { await cancelRecallBot(botId); } catch {}
    }

    // SSOT-ALLOWLIST: reschedule owner (Policy F) — service delegates here
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        scheduled_date: newSlot.date,
        scheduled_time: newSlot.time,
        // calendar columns (google_event_id / google_meet_link) are written ONLY by
        // attachCalendarLink above — the row update touches neither.
        status: 'scheduled',
        // WA-WIRE-REMINDERS: a reschedule moves the session to a new time —
        // the prior reminder is stale, reset so the cron sends a fresh one.
        coach_reminder_1h_sent: false,
        coach_reminder_1h_sent_at: null,
        parent_reminder_24h_sent: false,
        parent_reminder_24h_sent_at: null,
        parent_reminder_1h_sent: false,
        parent_reminder_1h_sent_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      return { success: false, error: `DB update failed: ${updateError.message}` };
    }

    await logAudit(supabase, 'session_rescheduled', {
      sessionId,
      oldDate: session.scheduled_date,
      oldTime: session.scheduled_time,
      newDate: newSlot.date,
      newTime: newSlot.time,
      reason,
      calendarUpdated,
    });

    await notify('session.rescheduled', {
      sessionId,
      childId: session.child_id,
      childName: child?.child_name || child?.name || undefined,
      coachName: coach?.name || undefined,
      parentPhone: child?.parent_phone || undefined,
      parentEmail: child?.parent_email || undefined,
      parentName: child?.parent_name || undefined,
      oldDate: session.scheduled_date,
      oldTime: session.scheduled_time,
      newDate: newSlot.date,
      newTime: newSlot.time,
      reason,
    });

    return {
      success: true,
      sessionId,
      meetLink: newMeetLink || undefined,
    };
  } catch (error: any) {
    console.error('[SessionManager] rescheduleSession error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// rescheduleExistingSession — finalize a not-yet-scheduled row.
//
// Extracted from the former UPDATE branch of scheduleSession (create-session.ts
// lines 72-121 pre-2.3). Used by retry-queue to complete scheduling of a row
// that was previously inserted with status='pending_scheduling'.
//
// Transaction shape (executeWithCompensation):
//   1. update_session       — flip the row to status='scheduled' + clear
//                             failure_reason/next_retry_at. Compensation
//                             reverts status to 'pending_scheduling' and
//                             stamps failure_reason='Rolled back'.
//   2. create_calendar_event (unless skipCalendar) — brand-new event, under
//                             circuit breaker. Compensation cancels the event.
//   3. schedule_recall_bot  (unless skipRecall, and only if calendar succeeded)
// ============================================================================

export interface RescheduleExistingOptions {
  skipCalendar?: boolean;
  skipRecall?: boolean;
  skipNotifications?: boolean;
  /** Activity-log action string. Defaults to 'session_rescheduled'. */
  auditAction?: string;
  requestId?: string;
}

export async function rescheduleExistingSession(
  sessionId: string,
  scheduledDate: string,
  scheduledTime: string,
  durationMinutes: number,
  options: RescheduleExistingOptions = {},
): Promise<SessionResult> {
  const supabase = getSupabase();
  const requestId = options.requestId;

  try {
    if (!scheduledDate || !scheduledTime) {
      return { success: false, error: 'scheduledDate and scheduledTime required' };
    }

    const { session, error: fetchError } = await getSessionWithRelations(supabase, sessionId);
    if (fetchError || !session) {
      return { success: false, error: 'Session not found' };
    }

    const child = session.children;
    const coach = session.coaches;
    const childName = child?.child_name || child?.name || 'Student';
    const coachName = coach?.name || 'Coach';
    const coachEmail = coach?.email || '';
    const parentEmail = child?.parent_email || '';

    const startTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + durationMinutes);

    const attendees: string[] = [];
    if (parentEmail) attendees.push(parentEmail);
    if (coachEmail) attendees.push(coachEmail);

    let calendarEventId: string | null = null;
    let meetLink: string | null = null;
    let recallBotId: string | null = null;

    const steps: TransactionStep[] = [
      {
        name: 'update_session',
        execute: async () => {
          const { error: updateError } = await supabase
            .from('scheduled_sessions')
            .update({
              scheduled_date: scheduledDate,
              scheduled_time: scheduledTime,
              duration_minutes: durationMinutes,
              status: 'scheduled',
              failure_reason: null,
              next_retry_at: null,
              // WA-WIRE-REMINDERS: reset reminder dedup flags so a retry-queue
              // finalize triggers fresh reminders at the new slot.
              coach_reminder_1h_sent: false,
              coach_reminder_1h_sent_at: null,
              parent_reminder_24h_sent: false,
              parent_reminder_24h_sent_at: null,
              parent_reminder_1h_sent: false,
              parent_reminder_1h_sent_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessionId);
          if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
          return { id: sessionId };
        },
        compensate: async (result) => {
          if (result?.id) {
            await supabase
              .from('scheduled_sessions')
              .update({
                status: 'pending_scheduling',
                failure_reason: 'Rolled back',
                updated_at: new Date().toISOString(),
              })
              .eq('id', result.id);
            logger.info('compensated_session_revert', { requestId, sessionId: result.id });
          }
        },
      },
    ];

    if (!options.skipCalendar) {
      steps.push({
        name: 'create_calendar_event',
        execute: async () => {
          try {
            const sessionNumber = session.session_number ?? undefined;
            const num = sessionNumber ? ` (Session ${sessionNumber})` : '';
            const calResult = await withCircuitBreaker('google-calendar', () =>
              scheduleCalendarEvent({
                title: `Yestoryd ${session.session_type} - ${childName}${num}`,
                description: `Reading ${session.session_type} session for ${childName}`,
                startTime,
                endTime,
                attendees,
                sessionType: session.session_type === 'parent_checkin' ? 'parent_checkin' : 'coaching',
              }),
            );
            calendarEventId = calResult.eventId;
            meetLink = calResult.meetLink;
            await attachCalendarLink(supabase, sessionId, calendarEventId, meetLink);
            logger.info('calendar_created', { requestId, sessionId, eventId: calendarEventId });
            return { eventId: calendarEventId, meetLink };
          } catch (calError: any) {
            logger.error('calendar_creation_failed', { requestId, sessionId, error: calError.message });
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
                sessionId,
                meetingUrl: meetLink!,
                scheduledTime: startTime,
                childId: session.child_id,
                childName,
                coachId: session.coach_id,
                sessionType: (session.session_type === 'parent_checkin' ? 'parent_checkin' : 'coaching') as 'coaching' | 'parent_checkin',
              }),
            );
            recallBotId = botResult?.botId ?? null;
            logger.info('recall_bot_created', { requestId, sessionId, botId: recallBotId });
            return { botId: recallBotId };
          } catch (recallError: any) {
            logger.error('recall_bot_creation_failed', { requestId, sessionId, error: recallError.message });
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
      const errorMsg = txResult.error ?? `Transaction failed at ${txResult.failedAt}`;
      return { success: false, error: errorMsg };
    }

    await logAudit(supabase, options.auditAction ?? 'session_rescheduled', {
      sessionId,
      enrollmentId: session.enrollment_id,
      childId: session.child_id,
      coachId: session.coach_id,
      sessionType: session.session_type,
      date: scheduledDate,
      time: scheduledTime,
      calendarEventId,
      recallBotId,
    });

    if (!options.skipNotifications) {
      try {
        await notify('session.scheduled', {
          sessionId,
          enrollmentId: session.enrollment_id,
          childId: session.child_id,
          childName,
          coachName,
          parentPhone: child?.parent_phone ?? undefined,
          parentEmail,
          parentName: child?.parent_name ?? undefined,
          sessionDate: formatDateShort(scheduledDate),
          sessionTime: formatTime12(scheduledTime),
          sessionType: session.session_type,
          meetLink,
        });
      } catch {
        // Non-fatal
      }
    }

    return {
      success: true,
      sessionId,
      calendarEventId: calendarEventId ?? undefined,
      meetLink: meetLink ?? undefined,
      recallBotId: recallBotId ?? undefined,
    };
  } catch (error: any) {
    console.error('[SessionManager] rescheduleExistingSession error:', error);
    return { success: false, error: error.message };
  }
}
