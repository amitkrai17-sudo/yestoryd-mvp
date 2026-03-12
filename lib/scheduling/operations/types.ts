/**
 * Shared types for session operations
 */

export interface ScheduleSessionInput {
  enrollmentId: string;
  childId: string;
  coachId: string;
  sessionType: string;
  weekNumber?: number | null;
  durationMinutes?: number;
  scheduledDate?: string;
  scheduledTime?: string;
  sessionNumber?: number;
  sessionTitle?: string;
}

export interface ScheduleSessionOptions {
  isRetry?: boolean;
  sessionId?: string;
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

/** Shape returned by getSessionWithRelations — replaces `as any` casts */
export interface ChildRelation {
  id: string;
  name: string | null;
  child_name: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
}

export interface CoachRelation {
  id: string;
  name: string | null;
  email: string | null;
}

export interface ScheduledSessionWithRelations {
  id: string;
  enrollment_id: string;
  child_id: string;
  coach_id: string;
  session_type: string;
  session_number: number | null;
  session_title: string | null;
  week_number: number | null;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number | null;
  status: string;
  google_event_id: string | null;
  google_meet_link: string | null;
  recall_bot_id: string | null;
  coach_notes: string | null;
  children: ChildRelation | null;
  coaches: CoachRelation | null;
}
