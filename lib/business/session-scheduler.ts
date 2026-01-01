// lib/business/session-scheduler.ts
// Centralized session scheduling logic
// Used by: payment verification, manual scheduling, rescheduling

export interface ScheduleConfig {
  programDurationMonths: number;
  coachingSessions: number;
  parentCheckIns: number;
  sessionDurationMinutes: number;
  checkInDurationMinutes: number;
}

export interface ScheduledSession {
  type: 'coaching' | 'parent_checkin';
  scheduledDate: Date;
  durationMinutes: number;
  weekNumber: number;
}

// Default program configuration
export const DEFAULT_CONFIG: ScheduleConfig = {
  programDurationMonths: 3,
  coachingSessions: 6,
  parentCheckIns: 3,
  sessionDurationMinutes: 60,
  checkInDurationMinutes: 15,
};

/**
 * Generate session schedule for a new enrollment
 * Sessions are distributed evenly across the program duration
 * 
 * Pattern: Week 1, 3, 5, 7, 9, 11 → Coaching
 *          Week 4, 8, 12 → Parent check-in
 */
export function generateSessionSchedule(
  startDate: Date,
  preferredDay: number = 6, // Saturday by default (0 = Sunday)
  preferredHour: number = 10, // 10 AM by default
  config: ScheduleConfig = DEFAULT_CONFIG
): ScheduledSession[] {
  const sessions: ScheduledSession[] = [];
  
  // Calculate coaching session weeks (bi-weekly)
  const coachingWeeks = [1, 3, 5, 7, 9, 11];
  
  // Parent check-ins at month end
  const checkInWeeks = [4, 8, 12];
  
  // Add coaching sessions
  for (let i = 0; i < config.coachingSessions; i++) {
    const weekNumber = coachingWeeks[i];
    const sessionDate = getDateForWeek(startDate, weekNumber, preferredDay, preferredHour);
    
    sessions.push({
      type: 'coaching',
      scheduledDate: sessionDate,
      durationMinutes: config.sessionDurationMinutes,
      weekNumber,
    });
  }
  
  // Add parent check-ins
  for (let i = 0; i < config.parentCheckIns; i++) {
    const weekNumber = checkInWeeks[i];
    const sessionDate = getDateForWeek(startDate, weekNumber, preferredDay, preferredHour + 1);
    
    sessions.push({
      type: 'parent_checkin',
      scheduledDate: sessionDate,
      durationMinutes: config.checkInDurationMinutes,
      weekNumber,
    });
  }
  
  // Sort by date
  return sessions.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
}

/**
 * Get date for a specific week number from start date
 */
function getDateForWeek(
  startDate: Date,
  weekNumber: number,
  preferredDay: number,
  preferredHour: number
): Date {
  const date = new Date(startDate);
  
  // Move to the first occurrence of preferred day
  const currentDay = date.getDay();
  const daysUntilPreferred = (preferredDay - currentDay + 7) % 7;
  date.setDate(date.getDate() + daysUntilPreferred);
  
  // Add weeks
  date.setDate(date.getDate() + (weekNumber - 1) * 7);
  
  // Set preferred hour (IST)
  date.setHours(preferredHour, 0, 0, 0);
  
  return date;
}

/**
 * Check if a proposed reschedule time is valid
 */
export function isValidRescheduleTime(
  originalDate: Date,
  newDate: Date,
  maxRescheduleDays: number = 7
): { valid: boolean; reason?: string } {
  const now = new Date();
  
  // Can't reschedule to the past
  if (newDate < now) {
    return { valid: false, reason: 'Cannot schedule sessions in the past' };
  }
  
  // Can't reschedule too far from original
  const daysDiff = Math.abs(newDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > maxRescheduleDays) {
    return { 
      valid: false, 
      reason: `Cannot reschedule more than ${maxRescheduleDays} days from original date` 
    };
  }
  
  // Must be during reasonable hours (8 AM - 8 PM IST)
  const hour = newDate.getHours();
  if (hour < 8 || hour > 20) {
    return { valid: false, reason: 'Sessions must be between 8 AM and 8 PM' };
  }
  
  return { valid: true };
}

/**
 * Format session for Google Calendar event
 */
export function formatForCalendar(
  session: ScheduledSession,
  childName: string,
  coachName: string
): {
  summary: string;
  description: string;
  startTime: Date;
  endTime: Date;
} {
  const endTime = new Date(session.scheduledDate);
  endTime.setMinutes(endTime.getMinutes() + session.durationMinutes);
  
  if (session.type === 'coaching') {
    return {
      summary: `Yestoryd: ${childName}'s Reading Session`,
      description: `Reading coaching session with ${coachName}\n\nChild: ${childName}\nWeek ${session.weekNumber} of program\n\nPowered by Yestoryd 📚`,
      startTime: session.scheduledDate,
      endTime,
    };
  } else {
    return {
      summary: `Yestoryd: Parent Check-in - ${childName}`,
      description: `Monthly progress review with ${coachName}\n\nDiscuss ${childName}'s reading progress\nWeek ${session.weekNumber} of program\n\nPowered by Yestoryd 📚`,
      startTime: session.scheduledDate,
      endTime,
    };
  }
}

/**
 * Calculate program end date based on schedule
 */
export function getProgramEndDate(sessions: ScheduledSession[]): Date {
  if (sessions.length === 0) {
    throw new Error('No sessions provided');
  }
  
  const lastSession = sessions.reduce((latest, session) => 
    session.scheduledDate > latest.scheduledDate ? session : latest
  );
  
  return lastSession.scheduledDate;
}

/**
 * Get upcoming sessions within a date range
 */
export function getUpcomingSessions(
  sessions: ScheduledSession[],
  daysAhead: number = 7
): ScheduledSession[] {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);
  
  return sessions.filter(session => 
    session.scheduledDate >= now && session.scheduledDate <= cutoff
  );
}
