/**
 * Cancel a session. Cancels Calendar event and Recall bot.
 */

import { cancelEvent } from '@/lib/googleCalendar';
import { cancelRecallBot } from '@/lib/recall-auto-bot';
import { notify } from '../notification-manager';
import { withCircuitBreaker } from '../circuit-breaker';
import { createLogger } from '../logger';
import { getSupabase, logAudit, getSessionWithRelations } from './helpers';
import type { SessionResult } from './types';

const logger = createLogger('session-manager');

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
      return { success: true, sessionId };
    }

    const child = session.children;
    const coach = session.coaches;

    const eventId = session.google_event_id;
    if (eventId) {
      try {
        await withCircuitBreaker('google-calendar', () =>
          cancelEvent(eventId, true)
        );
      } catch (calError: any) {
        logger.error('calendar_cancel_failed', { sessionId, error: calError.message });
      }
    }

    const botId = session.recall_bot_id;
    if (botId) {
      try {
        await withCircuitBreaker('recall-ai', () =>
          cancelRecallBot(botId)
        );
      } catch (recallError: any) {
        logger.error('recall_cancel_failed', { sessionId, error: recallError.message });
      }
    }

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

    await logAudit(supabase, 'session_cancelled', {
      sessionId,
      reason,
      cancelledBy,
      date: session.scheduled_date,
    });

    await notify('session.cancelled', {
      sessionId,
      childId: session.child_id,
      childName: child?.child_name || child?.name || undefined,
      coachName: coach?.name || undefined,
      parentPhone: child?.parent_phone || undefined,
      parentEmail: child?.parent_email || undefined,
      parentName: child?.parent_name || undefined,
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
