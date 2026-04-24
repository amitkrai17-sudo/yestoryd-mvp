/**
 * Schedule (create) a session with Calendar + Recall.ai integration.
 *
 * As of Phase 2.3, scheduleSession is a thin wrapper around the engine's
 * createScheduledSession. The retry-queue update-existing-row path was
 * extracted into rescheduleExistingSession (see reschedule-session.ts).
 */

import { getSessionDuration } from '../config-provider';
import { createScheduledSession } from '../session-engine';
import type { ScheduleSessionInput, ScheduleSessionOptions, SessionResult } from './types';

export async function scheduleSession(
  input: ScheduleSessionInput,
  options: ScheduleSessionOptions = {}
): Promise<SessionResult> {
  try {
    const duration = input.durationMinutes || await getSessionDuration(
      input.sessionType === 'parent_checkin' ? 'checkin' : 'coaching'
    );

    if (!input.scheduledDate || !input.scheduledTime) {
      return { success: false, error: 'scheduledDate and scheduledTime required' };
    }

    const result = await createScheduledSession(
      {
        enrollmentId: input.enrollmentId,
        childId: input.childId,
        coachId: input.coachId,
        sessionType: input.sessionType,
        sessionNumber: input.sessionNumber,
        sessionTitle: input.sessionTitle ?? `${input.sessionType} Session`,
        weekNumber: input.weekNumber ?? undefined,
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime,
        durationMinutes: duration,
      },
      {
        skipCalendar: options.skipCalendar,
        skipRecall: options.skipRecall,
        skipNotifications: options.skipNotifications,
        auditAction: 'session_scheduled',
      },
    );

    return {
      success: result.success,
      sessionId: result.sessionId,
      calendarEventId: result.googleEventId,
      meetLink: result.meetLink,
      recallBotId: result.recallBotId,
      error: result.error,
    };
  } catch (error: any) {
    console.error('[SessionManager] scheduleSession error:', error);
    return { success: false, error: error.message };
  }
}
