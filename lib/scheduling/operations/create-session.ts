/**
 * Schedule (create) a session with Calendar + Recall.ai integration.
 */

import {
  scheduleCalendarEvent,
  cancelEvent,
} from '@/lib/googleCalendar';
import { createRecallBot, cancelRecallBot } from '@/lib/recall-auto-bot';
import { getSessionDuration } from '../config-provider';
import { enqueue as retryEnqueue } from '../retry-queue';
import { notify } from '../notification-manager';
import { withCircuitBreaker } from '../circuit-breaker';
import { createLogger } from '../logger';
import { executeWithCompensation, type TransactionStep } from '../transaction-manager';
import { getSupabase, logAudit } from './helpers';
import type { ScheduleSessionInput, ScheduleSessionOptions, SessionResult } from './types';

const logger = createLogger('session-manager');

export async function scheduleSession(
  input: ScheduleSessionInput,
  options: ScheduleSessionOptions = {}
): Promise<SessionResult> {
  const supabase = getSupabase();

  try {
    const duration = input.durationMinutes || await getSessionDuration(
      input.sessionType === 'parent_checkin' ? 'checkin' : 'coaching'
    );

    if (!input.scheduledDate || !input.scheduledTime) {
      return { success: false, error: 'scheduledDate and scheduledTime required' };
    }

    const scheduledDate: string = input.scheduledDate;
    const scheduledTime: string = input.scheduledTime;

    const startTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + duration);

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

    let sessionId = options.sessionId;
    let calendarEventId: string | null = null;
    let meetLink: string | null = null;
    let recallBotId: string | null = null;

    const attendees: string[] = [];
    if (parentEmail) attendees.push(parentEmail);
    if (coachEmail) attendees.push(coachEmail);

    const steps: TransactionStep[] = [
      {
        name: 'upsert_session',
        execute: async () => {
          if (sessionId) {
            const { error: updateError } = await supabase
              .from('scheduled_sessions')
              .update({
                scheduled_date: scheduledDate,
                scheduled_time: scheduledTime,
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
                scheduled_date: scheduledDate,
                scheduled_time: scheduledTime,
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
            if (sessionId) {
              await supabase.from('scheduled_sessions')
                .update({ google_event_id: calendarEventId, google_meet_link: meetLink, updated_at: new Date().toISOString() })
                .eq('id', sessionId);
            }
            logger.info('calendar_created', { sessionId, eventId: calendarEventId });
            return { eventId: calendarEventId, meetLink };
          } catch (calError: any) {
            logger.error('calendar_creation_failed', { error: calError.message });
            return { eventId: null, meetLink: null };
          }
        },
        compensate: async (result) => {
          if (result.eventId) {
            try { await cancelEvent(result.eventId, true); } catch {}
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
            try { await cancelRecallBot(result.botId); } catch {}
          }
        },
      });
    }

    const txResult = await executeWithCompensation(steps);
    if (!txResult.success) {
      const errorMsg = txResult.error || `Transaction failed at ${txResult.failedAt}`;
      if (options.sessionId && !options.isRetry) {
        try { await retryEnqueue(options.sessionId, errorMsg); } catch {}
      }
      return { success: false, error: errorMsg };
    }

    await logAudit(supabase, 'session_scheduled', {
      sessionId,
      enrollmentId: input.enrollmentId,
      childId: input.childId,
      coachId: input.coachId,
      sessionType: input.sessionType,
      date: scheduledDate,
      time: scheduledTime,
      calendarEventId,
      recallBotId,
      isRetry: options.isRetry || false,
    });

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
          sessionDate: scheduledDate,
          sessionTime: scheduledTime,
          sessionType: input.sessionType,
          meetLink,
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

    if (options.sessionId && !options.isRetry) {
      try { await retryEnqueue(options.sessionId, error.message); } catch {}
    }

    return { success: false, error: error.message };
  }
}
