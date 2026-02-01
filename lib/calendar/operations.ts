/**
 * Calendar Operations with Rollback Support
 * 
 * Provides transaction-like behavior for creating multiple calendar events
 * If any event fails, all previously created events are deleted
 * 
 * Usage:
 * import { createEnrollmentSessions } from '@/lib/calendar/operations';
 */

import { google, calendar_v3 } from 'googleapis';

// ==================== TYPES ====================

export interface SessionToCreate {
  childId: string;
  childName: string;
  parentEmail: string;
  coachEmail: string;
  sessionType: 'coaching' | 'parent_checkin';
  sessionNumber: number;
  weekNumber: number;
  scheduledDate: Date;
  durationMinutes: number;
}

export interface CreatedSession {
  sessionData: SessionToCreate;
  googleEventId: string;
  meetLink: string;
}

export interface EnrollmentResult {
  success: boolean;
  sessions: CreatedSession[];
  errors: string[];
  rolledBack: boolean;
}

// ==================== GOOGLE CALENDAR CLIENT ====================

// For coaching sessions, fall back to DEFAULT_COACH_EMAIL (not engage@) so a coach is always organizer
const DEFAULT_COACH_ORGANIZER = process.env.DEFAULT_COACH_EMAIL || process.env.GOOGLE_CALENDAR_DELEGATED_USER;

function getCalendarClient(impersonateEmail?: string): calendar_v3.Calendar {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
    clientOptions: {
      subject: impersonateEmail || DEFAULT_COACH_ORGANIZER,
    },
  });

  return google.calendar({ version: 'v3', auth });
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Create all enrollment sessions with rollback on failure
 */
export async function createEnrollmentSessions(
  sessions: SessionToCreate[],
  adminEmail: string = 'engage@yestoryd.com'
): Promise<EnrollmentResult> {
  // Use the coach email from the first session as the organizer (falls back to DEFAULT_COACH_EMAIL)
  const coachEmail = sessions[0]?.coachEmail || DEFAULT_COACH_ORGANIZER;
  const calendar = getCalendarClient(coachEmail);
  const createdSessions: CreatedSession[] = [];
  const errors: string[] = [];

  console.log(`[Calendar] Creating ${sessions.length} sessions for enrollment...`);

  try {
    for (const session of sessions) {
      try {
        const event = await createCalendarEvent(calendar, session, adminEmail);
        
        createdSessions.push({
          sessionData: session,
          googleEventId: event.id!,
          meetLink: event.hangoutLink || '',
        });

        console.log(`[Calendar] Created session ${session.sessionNumber}: ${event.id}`);
      } catch (error: any) {
        const errorMsg = `Failed to create session ${session.sessionNumber}: ${error.message}`;
        console.error(`[Calendar] ${errorMsg}`);
        errors.push(errorMsg);

        // Rollback all created events
        console.log(`[Calendar] Rolling back ${createdSessions.length} created events...`);
        await rollbackCreatedEvents(calendar, createdSessions, coachEmail || 'primary');

        return {
          success: false,
          sessions: [],
          errors: [...errors, 'All events rolled back due to failure'],
          rolledBack: true,
        };
      }
    }

    console.log(`[Calendar] Successfully created all ${sessions.length} sessions`);
    return {
      success: true,
      sessions: createdSessions,
      errors: [],
      rolledBack: false,
    };
  } catch (error: any) {
    console.error(`[Calendar] Unexpected error:`, error);
    
    // Attempt rollback
    if (createdSessions.length > 0) {
      await rollbackCreatedEvents(calendar, createdSessions, coachEmail || 'primary');
    }

    return {
      success: false,
      sessions: [],
      errors: [error.message],
      rolledBack: createdSessions.length > 0,
    };
  }
}

/**
 * Create a single calendar event
 */
async function createCalendarEvent(
  calendar: calendar_v3.Calendar,
  session: SessionToCreate,
  adminEmail: string,
): Promise<calendar_v3.Schema$Event> {
  const startTime = new Date(session.scheduledDate);
  const endTime = new Date(startTime.getTime() + session.durationMinutes * 60 * 1000);

  const sessionTitle = session.sessionType === 'coaching'
    ? `📚 Coaching Session ${session.sessionNumber} - ${session.childName}`
    : `👨‍👩‍👧 Parent Check-in ${session.sessionNumber} - ${session.childName}`;

  const description = session.sessionType === 'coaching'
    ? `Yestoryd Reading Coaching Session
    
Child: ${session.childName}
Session: ${session.sessionNumber} of 6
Week: ${session.weekNumber}

Join via Google Meet link above.
Coach notes will be shared after the session.`
    : `Yestoryd Parent Check-in

Child: ${session.childName}
Check-in: ${session.sessionNumber} of 3
Week: ${session.weekNumber}

Discuss your child's progress and address any questions.`;

  const event: calendar_v3.Schema$Event = {
    summary: sessionTitle,
    description,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    attendees: [
      { email: session.parentEmail, displayName: 'Parent' },
      { email: adminEmail, displayName: 'Yestoryd (Recording)' },
      // Coach is the organizer (implicit attendee), not added here
    ],
    conferenceData: {
      createRequest: {
        requestId: `yestoryd-${session.childId}-${session.sessionNumber}-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 24 hours
        { method: 'popup', minutes: 60 }, // 1 hour
        { method: 'popup', minutes: 10 }, // 10 minutes
      ],
    },
    guestsCanModify: false,
    guestsCanInviteOthers: false,
  };

  const response = await calendar.events.insert({
    calendarId: session.coachEmail || 'primary', // Coach's calendar (coach is organizer)
    requestBody: event,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
  });

  if (!response.data.id) {
    throw new Error('Calendar event created but no ID returned');
  }

  return response.data;
}

/**
 * Rollback (delete) all created events
 */
async function rollbackCreatedEvents(
  calendar: calendar_v3.Calendar,
  createdSessions: CreatedSession[],
  calendarId: string = 'primary'
): Promise<void> {
  for (const session of createdSessions) {
    try {
      await calendar.events.delete({
        calendarId,
        eventId: session.googleEventId,
        sendUpdates: 'all',
      });
      console.log(`[Calendar] Rolled back event: ${session.googleEventId}`);
    } catch (error: any) {
      // Log but continue - best effort rollback
      console.error(`[Calendar] Failed to rollback event ${session.googleEventId}:`, error.message);
    }
  }
}

// ==================== INDIVIDUAL EVENT OPERATIONS ====================

/**
 * Reschedule a single session
 */
export async function rescheduleSession(
  eventId: string,
  newDate: Date,
  durationMinutes: number,
  sendNotifications: boolean = true,
  coachEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = getCalendarClient(coachEmail);
    const endTime = new Date(newDate.getTime() + durationMinutes * 60 * 1000);

    await calendar.events.patch({
      calendarId: coachEmail || 'primary',
      eventId,
      requestBody: {
        start: {
          dateTime: newDate.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
      },
      sendUpdates: sendNotifications ? 'all' : 'none',
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Cancel a single session
 */
export async function cancelSession(
  eventId: string,
  sendNotifications: boolean = true,
  coachEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = getCalendarClient(coachEmail);

    await calendar.events.delete({
      calendarId: coachEmail || 'primary',
      eventId,
      sendUpdates: sendNotifications ? 'all' : 'none',
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get event details
 */
export async function getEventDetails(
  eventId: string,
  coachEmail?: string
): Promise<{ success: boolean; event?: calendar_v3.Schema$Event; error?: string }> {
  try {
    const calendar = getCalendarClient(coachEmail);

    const response = await calendar.events.get({
      calendarId: coachEmail || 'primary',
      eventId,
    });

    return { success: true, event: response.data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==================== BATCH OPERATIONS ====================

/**
 * Cancel all sessions for a child (e.g., on enrollment cancellation)
 */
export async function cancelAllChildSessions(
  eventIds: string[],
  coachEmail?: string
): Promise<{ success: boolean; cancelled: number; errors: string[] }> {
  const calendar = getCalendarClient(coachEmail);
  let cancelled = 0;
  const errors: string[] = [];

  for (const eventId of eventIds) {
    try {
      await calendar.events.delete({
        calendarId: coachEmail || 'primary',
        eventId,
        sendUpdates: 'all',
      });
      cancelled++;
    } catch (error: any) {
      errors.push(`Failed to cancel ${eventId}: ${error.message}`);
    }
  }

  return {
    success: errors.length === 0,
    cancelled,
    errors,
  };
}

// ==================== SCHEDULE GENERATION ====================

/**
 * Generate session schedule for a 12-week program
 */
export function generateSessionSchedule(
  enrollmentDate: Date,
  coachAvailability: { dayOfWeek: number; time: string }[] = [
    { dayOfWeek: 6, time: '10:00' }, // Saturday 10 AM default
  ]
): Date[] {
  const sessions: Date[] = [];
  const startDate = new Date(enrollmentDate);
  
  // 12-week program: 6 coaching sessions + 3 parent check-ins
  // Coaching: Weeks 1, 2, 4, 6, 8, 10
  // Parent check-in: Weeks 4, 8, 12
  const coachingWeeks = [1, 2, 4, 6, 8, 10];
  const checkinWeeks = [4, 8, 12];
  const allWeeks = Array.from(new Set([...coachingWeeks, ...checkinWeeks])).sort((a, b) => a - b);

  for (const week of allWeeks) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (week - 1) * 7);

    // Find next available slot
    const slot = coachAvailability[0]; // Use first available slot
    const sessionDate = getNextDayOfWeek(weekStart, slot.dayOfWeek);
    
    // Set time
    const [hours, minutes] = slot.time.split(':').map(Number);
    sessionDate.setHours(hours, minutes, 0, 0);

    sessions.push(sessionDate);
  }

  return sessions;
}

function getNextDayOfWeek(date: Date, dayOfWeek: number): Date {
  const result = new Date(date);
  const diff = (dayOfWeek - date.getDay() + 7) % 7;
  result.setDate(result.getDate() + diff);
  return result;
}
