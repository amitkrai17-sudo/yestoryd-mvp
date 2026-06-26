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

import { cancelEvent } from '@/lib/calendar';
import { reconcileSessionCalendarEvent } from '@/lib/scheduling/session-calendar-writer';
import { cancelRecallBot, createRecallBot } from '@/lib/recall-auto-bot';
import { notify } from '../notification-manager';
import { withCircuitBreaker } from '../circuit-breaker';
import { createLogger } from '../logger';
import { executeWithCompensation, type TransactionStep } from '../transaction-manager';
import { getSupabase, logAudit, getSessionWithRelations } from './helpers';
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

    // PHASE 2A: the canonical reconciling writer owns the calendar event — it runs
    // AFTER the DB date/time write below (it reads the new slot from scheduled_sessions,
    // the SSOT), DETACHes shared/recurring events (siblings untouched), patches a true
    // 1:1 in place, and is the sole event + link writer.

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

    // Canonical reconcile against the just-written slot (shared → detach; 1:1 → patch).
    const recon = await reconcileSessionCalendarEvent(sessionId);
    const calendarUpdated = recon.action !== 'skipped' && recon.action !== 'noop';
    const newMeetLink = recon.meetLink ?? session.google_meet_link;

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
            // PHASE 2A: route creation through the canonical reconciling writer. Step 1
            // already set status='scheduled' with the new slot, so the writer reads SSOT,
            // creates a unique offline/online-correct event, and writes the link itself.
            const recon = await withCircuitBreaker('google-calendar', () =>
              reconcileSessionCalendarEvent(sessionId),
            );
            calendarEventId = recon.eventId;
            meetLink = recon.meetLink;
            logger.info('calendar_created', { requestId, sessionId, eventId: calendarEventId, action: recon.action });
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
