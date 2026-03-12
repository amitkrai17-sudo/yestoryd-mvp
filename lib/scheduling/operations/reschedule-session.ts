/**
 * Reschedule an existing session. Updates DB, Calendar, Recall bot.
 */

import { rescheduleEvent } from '@/lib/googleCalendar';
import { cancelRecallBot } from '@/lib/recall-auto-bot';
import { notify } from '../notification-manager';
import { withCircuitBreaker } from '../circuit-breaker';
import { createLogger } from '../logger';
import { getSupabase, logAudit, getSessionWithRelations } from './helpers';
import type { SessionResult } from './types';

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
      try {
        const result = await withCircuitBreaker('google-calendar', () =>
          rescheduleEvent(eventId, newStart, duration)
        );
        if (result.success) {
          calendarUpdated = true;
          if (result.meetLink) newMeetLink = result.meetLink;
        }
      } catch (calError: any) {
        logger.error('calendar_reschedule_failed', { sessionId, error: calError.message });
      }
    }

    const botId = session.recall_bot_id;
    if (botId) {
      try { await cancelRecallBot(botId); } catch {}
    }

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
