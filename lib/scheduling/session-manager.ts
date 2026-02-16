// ============================================================================
// SESSION MANAGER
// lib/scheduling/session-manager.ts
// ============================================================================
//
// All session operations go through here:
// - scheduleSession: create session + Google Calendar + Recall.ai bot
// - rescheduleSession: update session + calendar + Recall bot
// - cancelSession: cancel session + calendar + Recall bot
// - reassignCoach: transfer session to new coach
// - bulkReassign: transfer all sessions for an enrollment
//
// Each operation: validate → check constraints → execute DB →
// update Calendar → update Recall.ai → audit log → notifications →
// on failure: send to Retry Queue
//
// ============================================================================

import {
  scheduleCalendarEvent,
  rescheduleEvent,
  cancelEvent,
  updateEventAttendees,
} from '@/lib/googleCalendar';
import { createRecallBot, cancelRecallBot } from '@/lib/recall-auto-bot';
import { getSessionDuration } from './config-provider';
import { enqueue as retryEnqueue } from './retry-queue';
import { notify } from './notification-manager';
import { withCircuitBreaker } from './circuit-breaker';
import { createLogger } from './logger';
import { executeWithCompensation, type TransactionStep } from './transaction-manager';
import { createAdminClient } from '@/lib/supabase/admin';

const logger = createLogger('session-manager');

// ============================================================================
// TYPES
// ============================================================================

export interface ScheduleSessionInput {
  enrollmentId: string;
  childId: string;
  coachId: string;
  sessionType: string;
  weekNumber?: number;
  durationMinutes?: number;
  scheduledDate?: string;
  scheduledTime?: string;
  sessionNumber?: number;
  sessionTitle?: string;
}

export interface ScheduleSessionOptions {
  isRetry?: boolean;
  sessionId?: string; // If updating existing session (retry)
  skipNotifications?: boolean;
  skipCalendar?: boolean;
  skipRecall?: boolean;
}

export interface SessionResult {
  success: boolean;
  sessionId?: string;
  calendarEventId?: string;
  meetLink?: string;
  recallBotId?: string;
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getSupabase() {
  return createAdminClient();
}

async function logAudit(
  supabase: any,
  action: string,
  details: Record<string, any>
) {
  try {
    await supabase.from('activity_log').insert({
      user_email: 'engage@yestoryd.com',
      user_type: 'system',
      action,
      metadata: { ...details, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SessionManager] Audit log error:', error);
  }
}

async function getSessionWithRelations(supabase: any, sessionId: string) {
  const { data, error } = await supabase
    .from('scheduled_sessions')
    .select(`
      *,
      children:child_id (id, name, child_name, parent_name, parent_email, parent_phone),
      coaches:coach_id (id, name, email)
    `)
    .eq('id', sessionId)
    .single();

  return { session: data, error };
}

// ============================================================================
// SCHEDULE SESSION
// ============================================================================

/**
 * Create or update a session with Calendar + Recall.ai integration.
 * On transient failure, enqueues to retry queue.
 */
export async function scheduleSession(
  input: ScheduleSessionInput,
  options: ScheduleSessionOptions = {}
): Promise<SessionResult> {
  const supabase = getSupabase();

  try {
    const duration = input.durationMinutes || await getSessionDuration(
      input.sessionType === 'parent_checkin' ? 'checkin' : 'coaching'
    );

    // If no date/time provided, we can't create calendar events
    if (!input.scheduledDate || !input.scheduledTime) {
      return { success: false, error: 'scheduledDate and scheduledTime required' };
    }

    const startTime = new Date(`${input.scheduledDate}T${input.scheduledTime}`);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + duration);

    // Get child and coach info for calendar
    const { data: child } = await supabase
      .from('children')
      .select('name, child_name, parent_email, parent_phone, parent_name')
      .eq('id', input.childId)
      .single();

    const { data: coach } = await supabase
      .from('coaches')
      .select('name, email')
      .eq('id', input.coachId)
      .single();

    const childName = child?.child_name || child?.name || 'Student';
    const coachName = coach?.name || 'Coach';
    const coachEmail = coach?.email || '';
    const parentEmail = child?.parent_email || '';

    // ================================================================
    // Execute with compensating actions (DB → Calendar → Recall)
    // ================================================================
    let sessionId = options.sessionId;
    let calendarEventId: string | null = null;
    let meetLink: string | null = null;
    let recallBotId: string | null = null;

    const attendees: string[] = [];
    if (parentEmail) attendees.push(parentEmail);
    if (coachEmail) attendees.push(coachEmail);

    const steps: TransactionStep[] = [
      // Step 1: DB insert/update
      {
        name: 'upsert_session',
        execute: async () => {
          if (sessionId) {
            const { error: updateError } = await supabase
              .from('scheduled_sessions')
              .update({
                scheduled_date: input.scheduledDate,
                scheduled_time: input.scheduledTime,
                duration_minutes: duration,
                status: 'scheduled',
                failure_reason: null,
                next_retry_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', sessionId);
            if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
            return { id: sessionId, isNew: false };
          } else {
            const { data: newSession, error: insertError } = await supabase
              .from('scheduled_sessions')
              .insert({
                enrollment_id: input.enrollmentId,
                child_id: input.childId,
                coach_id: input.coachId,
                session_type: input.sessionType,
                session_number: input.sessionNumber || 1,
                session_title: input.sessionTitle || `${input.sessionType} Session`,
                week_number: input.weekNumber,
                scheduled_date: input.scheduledDate,
                scheduled_time: input.scheduledTime,
                duration_minutes: duration,
                status: 'scheduled',
              })
              .select('id')
              .single();
            if (insertError || !newSession) throw new Error(`DB insert failed: ${insertError?.message}`);
            sessionId = newSession.id;
            return { id: newSession.id, isNew: true };
          }
        },
        compensate: async (result) => {
          if (result.isNew) {
            await supabase.from('scheduled_sessions').delete().eq('id', result.id);
            logger.info('compensated_session_delete', { sessionId: result.id });
          } else {
            await supabase.from('scheduled_sessions')
              .update({ status: 'pending_scheduling', failure_reason: 'Rolled back', updated_at: new Date().toISOString() })
              .eq('id', result.id);
          }
        },
      },
    ];

    // Step 2: Calendar (optional, non-fatal on its own but participates in compensation)
    if (!options.skipCalendar) {
      steps.push({
        name: 'create_calendar_event',
        execute: async () => {
          try {
            const calResult = await withCircuitBreaker('google-calendar', () =>
              scheduleCalendarEvent({
                title: `Yestoryd ${input.sessionType} - ${childName} (Session ${input.sessionNumber || ''})`,
                description: `Reading ${input.sessionType} session for ${childName}`,
                startTime,
                endTime,
                attendees,
                sessionType: input.sessionType === 'parent_checkin' ? 'parent_checkin' : 'coaching',
              })
            );
            calendarEventId = calResult.eventId;
            meetLink = calResult.meetLink;
            // Patch session with calendar info
            await supabase.from('scheduled_sessions')
              .update({ google_event_id: calendarEventId, google_meet_link: meetLink, updated_at: new Date().toISOString() })
              .eq('id', sessionId);
            logger.info('calendar_created', { sessionId, eventId: calendarEventId });
            return { eventId: calendarEventId, meetLink };
          } catch (calError: any) {
            logger.error('calendar_creation_failed', { error: calError.message });
            // Non-fatal: return null so compensation is a no-op
            return { eventId: null, meetLink: null };
          }
        },
        compensate: async (result) => {
          if (result.eventId) {
            try {
              await cancelEvent(result.eventId, true);
            } catch {}
          }
        },
      });
    }

    // Step 3: Recall bot (optional)
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
                childId: input.childId,
                childName,
                coachId: input.coachId,
                sessionType: (input.sessionType === 'parent_checkin' ? 'parent_checkin' : 'coaching') as 'coaching' | 'parent_checkin',
              })
            );
            recallBotId = botResult?.botId || null;
            logger.info('recall_bot_created', { sessionId, botId: recallBotId });
            return { botId: recallBotId };
          } catch (recallError: any) {
            logger.error('recall_bot_creation_failed', { error: recallError.message });
            return { botId: null };
          }
        },
        compensate: async (result) => {
          if (result.botId) {
            try {
              await cancelRecallBot(result.botId);
            } catch {}
          }
        },
      });
    }

    const txResult = await executeWithCompensation(steps);
    if (!txResult.success) {
      const errorMsg = txResult.error || `Transaction failed at ${txResult.failedAt}`;
      // Enqueue for retry on transient failure
      if (options.sessionId && !options.isRetry) {
        try { await retryEnqueue(options.sessionId, errorMsg); } catch {}
      }
      return { success: false, error: errorMsg };
    }

    // Audit log
    await logAudit(supabase, 'session_scheduled', {
      sessionId,
      enrollmentId: input.enrollmentId,
      childId: input.childId,
      coachId: input.coachId,
      sessionType: input.sessionType,
      date: input.scheduledDate,
      time: input.scheduledTime,
      calendarEventId,
      recallBotId,
      isRetry: options.isRetry || false,
    });

    // Send notifications
    if (!options.skipNotifications) {
      try {
        await notify('session.scheduled', {
          sessionId,
          enrollmentId: input.enrollmentId,
          childId: input.childId,
          childName,
          coachName,
          parentPhone: child?.parent_phone,
          parentEmail,
          parentName: child?.parent_name,
          sessionDate: input.scheduledDate,
          sessionTime: input.scheduledTime,
          sessionType: input.sessionType,
          meetLink: meetLink || undefined,
        });
      } catch {
        // Non-fatal
      }
    }

    return {
      success: true,
      sessionId,
      calendarEventId: calendarEventId || undefined,
      meetLink: meetLink || undefined,
      recallBotId: recallBotId || undefined,
    };
  } catch (error: any) {
    console.error('[SessionManager] scheduleSession error:', error);

    // Enqueue for retry on transient failure
    if (options.sessionId && !options.isRetry) {
      try {
        await retryEnqueue(options.sessionId, error.message);
      } catch {
        // Last resort: log
      }
    }

    return { success: false, error: error.message };
  }
}

// ============================================================================
// RESCHEDULE SESSION
// ============================================================================

/**
 * Reschedule an existing session. Updates DB, Calendar, Recall bot.
 */
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

    const child = session.children as any;
    const coach = session.coaches as any;
    const duration = session.duration_minutes || 45;
    const newStart = new Date(`${newSlot.date}T${newSlot.time}`);

    let calendarUpdated = false;
    let newMeetLink = session.google_meet_link;

    // Update Google Calendar (with circuit breaker)
    if (session.google_event_id) {
      try {
        const result = await withCircuitBreaker('google-calendar', () =>
          rescheduleEvent(session.google_event_id, newStart, duration)
        );
        if (result.success) {
          calendarUpdated = true;
          if (result.meetLink) newMeetLink = result.meetLink;
        }
      } catch (calError: any) {
        logger.error('calendar_reschedule_failed', { sessionId, error: calError.message });
      }
    }

    // Cancel old Recall bot and create new one
    if (session.recall_bot_id) {
      try {
        await cancelRecallBot(session.recall_bot_id);
      } catch {
        // Non-fatal
      }
    }

    // Update DB
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        scheduled_date: newSlot.date,
        scheduled_time: newSlot.time,
        google_meet_link: newMeetLink,
        status: 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      return { success: false, error: `DB update failed: ${updateError.message}` };
    }

    // Audit + notifications
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
      childName: child?.child_name || child?.name,
      coachName: coach?.name,
      parentPhone: child?.parent_phone,
      parentEmail: child?.parent_email,
      parentName: child?.parent_name,
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
// CANCEL SESSION
// ============================================================================

/**
 * Cancel a session. Cancels Calendar event and Recall bot.
 */
export async function cancelSession(
  sessionId: string,
  reason: string,
  cancelledBy: string = 'system'
): Promise<SessionResult> {
  const supabase = getSupabase();

  try {
    const { session, error: fetchError } = await getSessionWithRelations(supabase, sessionId);
    if (fetchError || !session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'completed') {
      return { success: false, error: 'Cannot cancel completed session' };
    }

    if (session.status === 'cancelled') {
      return { success: true, sessionId }; // Already cancelled
    }

    const child = session.children as any;
    const coach = session.coaches as any;

    // Cancel Google Calendar event (with circuit breaker)
    if (session.google_event_id) {
      try {
        await withCircuitBreaker('google-calendar', () =>
          cancelEvent(session.google_event_id, true)
        );
      } catch (calError: any) {
        logger.error('calendar_cancel_failed', { sessionId, error: calError.message });
      }
    }

    // Cancel Recall bot (with circuit breaker)
    if (session.recall_bot_id) {
      try {
        await withCircuitBreaker('recall-ai', () =>
          cancelRecallBot(session.recall_bot_id)
        );
      } catch (recallError: any) {
        logger.error('recall_cancel_failed', { sessionId, error: recallError.message });
      }
    }

    // Update DB
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'cancelled',
        coach_notes: `Cancelled by ${cancelledBy}: ${reason}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      return { success: false, error: `DB update failed: ${updateError.message}` };
    }

    // Audit + notifications
    await logAudit(supabase, 'session_cancelled', {
      sessionId,
      reason,
      cancelledBy,
      date: session.scheduled_date,
    });

    await notify('session.cancelled', {
      sessionId,
      childId: session.child_id,
      childName: child?.child_name || child?.name,
      coachName: coach?.name,
      parentPhone: child?.parent_phone,
      parentEmail: child?.parent_email,
      parentName: child?.parent_name,
      sessionDate: session.scheduled_date,
      sessionTime: session.scheduled_time,
      reason,
    });

    return { success: true, sessionId };
  } catch (error: any) {
    console.error('[SessionManager] cancelSession error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// REASSIGN COACH
// ============================================================================

/**
 * Reassign a single session to a new coach.
 * Updates calendar attendees and creates reassignment log.
 */
export async function reassignCoach(
  sessionId: string,
  newCoachId: string,
  reason: string,
  options: { isTemporary?: boolean; expectedEndDate?: string } = {}
): Promise<SessionResult> {
  const supabase = getSupabase();

  try {
    const { session, error: fetchError } = await getSessionWithRelations(supabase, sessionId);
    if (fetchError || !session) {
      return { success: false, error: 'Session not found' };
    }

    const originalCoachId = session.coach_id;

    // Get new coach info
    const { data: newCoach } = await supabase
      .from('coaches')
      .select('id, name, email')
      .eq('id', newCoachId)
      .single();

    if (!newCoach) {
      return { success: false, error: 'New coach not found' };
    }

    const child = session.children as any;
    const oldCoach = session.coaches as any;

    // Update session
    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        coach_id: newCoachId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      return { success: false, error: `DB update failed: ${updateError.message}` };
    }

    // Update calendar attendees
    if (session.google_event_id) {
      try {
        await updateEventAttendees(session.google_event_id, {
          addAttendees: newCoach.email ? [newCoach.email] : [],
          removeAttendees: oldCoach?.email ? [oldCoach.email] : [],
        });
      } catch (calError: any) {
        console.error('[SessionManager] Calendar attendee update failed:', calError.message);
      }
    }

    // Log reassignment
    await supabase.from('coach_reassignment_log').insert({
      enrollment_id: session.enrollment_id,
      child_id: session.child_id,
      original_coach_id: originalCoachId,
      new_coach_id: newCoachId,
      reason,
      reassignment_type: options.isTemporary ? 'temporary' : 'permanent',
      is_temporary: options.isTemporary || false,
      start_date: new Date().toISOString().split('T')[0],
      expected_end_date: options.expectedEndDate || null,
      created_by: 'system',
    });

    // Audit + notifications
    await logAudit(supabase, 'coach_reassigned', {
      sessionId,
      originalCoachId,
      newCoachId,
      reason,
      isTemporary: options.isTemporary || false,
    });

    await notify('coach.reassigned', {
      sessionId,
      enrollmentId: session.enrollment_id,
      childId: session.child_id,
      childName: child?.child_name || child?.name,
      coachName: newCoach.name,
      oldCoachName: oldCoach?.name,
      newCoachName: newCoach.name,
      parentPhone: child?.parent_phone,
      parentEmail: child?.parent_email,
      parentName: child?.parent_name,
      reason,
      isTemporary: options.isTemporary,
      expectedReturnDate: options.expectedEndDate,
    });

    return { success: true, sessionId };
  } catch (error: any) {
    console.error('[SessionManager] reassignCoach error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// BULK REASSIGN
// ============================================================================

/**
 * Reassign all upcoming sessions for an enrollment to a new coach.
 * Optionally updates enrollment.coach_id for permanent changes.
 */
export async function bulkReassign(
  enrollmentId: string,
  newCoachId: string,
  reason: string,
  options: { isTemporary?: boolean; expectedEndDate?: string; updateEnrollment?: boolean } = {}
): Promise<{ success: boolean; sessionsReassigned: number; errors: string[] }> {
  const supabase = getSupabase();
  const errors: string[] = [];
  let reassigned = 0;

  try {
    // Get all future sessions for this enrollment
    const today = new Date().toISOString().split('T')[0];
    const { data: sessions, error: fetchError } = await supabase
      .from('scheduled_sessions')
      .select('id')
      .eq('enrollment_id', enrollmentId)
      .gte('scheduled_date', today)
      .in('status', ['scheduled', 'pending', 'rescheduled'])
      .order('scheduled_date', { ascending: true });

    if (fetchError || !sessions) {
      return { success: false, sessionsReassigned: 0, errors: [fetchError?.message || 'Fetch failed'] };
    }

    // Reassign each session
    for (const session of sessions) {
      const result = await reassignCoach(session.id, newCoachId, reason, {
        isTemporary: options.isTemporary,
        expectedEndDate: options.expectedEndDate,
      });

      if (result.success) {
        reassigned++;
      } else {
        errors.push(`Session ${session.id}: ${result.error}`);
      }
    }

    // Update enrollment coach_id for permanent reassignment
    if (options.updateEnrollment !== false && !options.isTemporary) {
      await supabase
        .from('enrollments')
        .update({
          coach_id: newCoachId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);
    }

    await logAudit(supabase, 'bulk_coach_reassigned', {
      enrollmentId,
      newCoachId,
      reason,
      sessionsReassigned: reassigned,
      isTemporary: options.isTemporary || false,
      errors: errors.length,
    });

    return {
      success: errors.length === 0,
      sessionsReassigned: reassigned,
      errors,
    };
  } catch (error: any) {
    console.error('[SessionManager] bulkReassign error:', error);
    return { success: false, sessionsReassigned: reassigned, errors: [error.message] };
  }
}
