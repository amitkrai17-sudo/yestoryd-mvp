import { google } from 'googleapis';

// Initialize Google Calendar API
const getCalendarClient = () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
    clientOptions: {
      subject: process.env.GOOGLE_CALENDAR_DELEGATED_USER || 'engage@yestoryd.com',
    },
  });

  return google.calendar({ version: 'v3', auth });
};

// Email to impersonate (must have domain-wide delegation)
const CALENDAR_EMAIL = process.env.GOOGLE_CALENDAR_EMAIL || 'engage@yestoryd.com';

// Constants
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

interface SessionDetails {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  sessionType: 'coaching' | 'parent_checkin';
}

// ScheduledSession with ALL property names used by ALL routes
interface ScheduledSession {
  // Used by enrollment/complete
  eventId: string;
  number: number;
  week: number;
  scheduledAt: string;
  
  // Used by sessions/confirm
  googleEventId: string;
  sessionNumber: number;
  scheduledDate: string;
  scheduledTime: string;
  
  // Common
  meetLink: string;
  title: string;
  type: string;
}

interface CreateAllSessionsParams {
  childId?: string;
  childName: string;
  parentEmail: string;
  parentName?: string;
  parentPhone?: string;
  coachEmail: string;
  coachId?: string;
  coachName?: string;
  startDate: Date;
  preferredDay?: number;
  preferredTime?: string;
  preferredHour?: number;
  enrollmentId?: string;
}

interface CreateAllSessionsResult {
  success: boolean;
  sessions: ScheduledSession[];
  error?: string;
}

// Schedule a single calendar event
export async function scheduleCalendarEvent(
  session: SessionDetails
): Promise<{ eventId: string; meetLink: string }> {
  try {
    const calendar = getCalendarClient();

    const event = {
      summary: session.title,
      description: session.description,
      start: {
        dateTime: session.startTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: session.endTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      attendees: session.attendees.map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: `yestoryd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 60 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: CALENDAR_EMAIL,
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });

    return {
      eventId: response.data.id || '',
      meetLink: response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri || '',
    };
  } catch (error) {
    console.error('Error scheduling calendar event:', error);
    throw error;
  }
}

// Create all sessions - returns { success, sessions, error }
export async function createAllSessions(params: CreateAllSessionsParams): Promise<CreateAllSessionsResult> {
  const { childName, parentEmail, coachEmail, startDate, preferredTime, preferredHour, preferredDay } = params;
  
  const sessions: ScheduledSession[] = [];
  const sessionSchedule = [
    { week: 1, type: 'coaching', title: 'Session 1: Initial Assessment', number: 1 },
    { week: 2, type: 'coaching', title: 'Session 2: Phonics Foundation', number: 2 },
    { week: 3, type: 'coaching', title: 'Session 3: Reading Fluency', number: 3 },
    { week: 4, type: 'parent_checkin', title: 'Parent Check-in 1', number: 4 },
    { week: 5, type: 'coaching', title: 'Session 4: Comprehension Skills', number: 5 },
    { week: 6, type: 'coaching', title: 'Session 5: Vocabulary Building', number: 6 },
    { week: 7, type: 'coaching', title: 'Session 6: Reading Practice', number: 7 },
    { week: 8, type: 'parent_checkin', title: 'Parent Check-in 2', number: 8 },
    { week: 12, type: 'parent_checkin', title: 'Final Parent Check-in', number: 9 },
  ];

  try {
    for (const schedule of sessionSchedule) {
      const sessionDate = new Date(startDate);
      
      // If preferredDay is set, find the next occurrence of that day
      if (preferredDay !== undefined) {
        const currentDay = sessionDate.getDay();
        const daysUntilPreferred = (preferredDay - currentDay + 7) % 7;
        sessionDate.setDate(sessionDate.getDate() + daysUntilPreferred);
      }
      
      // Add weeks
      sessionDate.setDate(sessionDate.getDate() + (schedule.week - 1) * 7);
      
      // Set time
      if (preferredHour !== undefined) {
        sessionDate.setHours(preferredHour, 0, 0, 0);
      } else if (preferredTime) {
        const [hours, minutes] = preferredTime.split(':');
        sessionDate.setHours(parseInt(hours), parseInt(minutes || '0'), 0, 0);
      } else {
        sessionDate.setHours(16, 0, 0, 0);
      }

      const durationMinutes = schedule.type === 'coaching' ? 45 : 30;
      const endTime = new Date(sessionDate);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      const dateStr = sessionDate.toISOString().split('T')[0];
      const timeStr = sessionDate.toTimeString().slice(0, 8);

      try {
        const result = await scheduleCalendarEvent({
          title: `${schedule.title} - ${childName}`,
          description: `Yestoryd Reading Session for ${childName}\n\nType: ${schedule.type}\nCoach will join via Google Meet.`,
          startTime: sessionDate,
          endTime: endTime,
          attendees: [parentEmail, coachEmail, CALENDAR_EMAIL].filter(Boolean),
          sessionType: schedule.type as 'coaching' | 'parent_checkin',
        });

        sessions.push({
          // For enrollment/complete route
          eventId: result.eventId,
          number: schedule.number,
          week: schedule.week,
          scheduledAt: sessionDate.toISOString(),
          
          // For sessions/confirm route
          googleEventId: result.eventId,
          sessionNumber: schedule.number,
          scheduledDate: dateStr,
          scheduledTime: timeStr,
          
          // Common
          meetLink: result.meetLink,
          title: schedule.title,
          type: schedule.type,
        });
      } catch (error) {
        console.error(`Error scheduling ${schedule.title}:`, error);
        // Continue with other sessions even if one fails
      }
    }

    return {
      success: sessions.length > 0,
      sessions,
      error: sessions.length === 0 ? 'Failed to schedule any sessions' : undefined,
    };
  } catch (error) {
    console.error('Error in createAllSessions:', error);
    return {
      success: false,
      sessions: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// Alias for backward compatibility
export { createAllSessions as scheduleAllSessions };

// Get available time slots for a coach
export async function getAvailableSlots(
  coachEmail: string,
  date: Date,
  durationMinutes: number = 60
): Promise<{ start: string; end: string }[]> {
  try {
    const calendar = getCalendarClient();

    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 14);

    const busyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: coachEmail }],
      },
    });

    const busyTimes = busyResponse.data.calendars?.[coachEmail]?.busy || [];

    const availableSlots: { start: string; end: string }[] = [];
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        for (let hour = 9; hour < 18; hour++) {
          const slotStart = new Date(currentDate);
          slotStart.setHours(hour, 0, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

          if (slotEnd.getHours() > 18) continue;

          const isAvailable = !busyTimes.some((busy) => {
            const busyStart = new Date(busy.start || '');
            const busyEnd = new Date(busy.end || '');
            return slotStart < busyEnd && slotEnd > busyStart;
          });

          if (isAvailable) {
            availableSlots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
            });
          }
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableSlots;
  } catch (error) {
    console.error('Error getting available slots:', error);
    return [];
  }
}

// Reschedule an existing event
// Route calls: rescheduleEvent(eventId, newDate, duration)
export async function rescheduleEvent(
  eventId: string,
  newDateTime: Date,
  durationMinutes: number = 45
): Promise<{ success: boolean; error?: string; meetLink?: string }> {
  try {
    const calendar = getCalendarClient();

    const newEndTime = new Date(newDateTime);
    newEndTime.setMinutes(newEndTime.getMinutes() + durationMinutes);

    const response = await calendar.events.patch({
      calendarId: CALENDAR_EMAIL,
      eventId: eventId,
      requestBody: {
        start: {
          dateTime: newDateTime.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: newEndTime.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
      },
      sendUpdates: 'all',
    });

    return {
      success: true,
      meetLink: response.data.hangoutLink || '',
    };
  } catch (error) {
    console.error('Error rescheduling event:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to reschedule'
    };
  }
}

// Cancel an event
// Route calls: cancelEvent(eventId, true)
export async function cancelEvent(
  eventId: string, 
  sendNotifications: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = getCalendarClient();

    await calendar.events.delete({
      calendarId: CALENDAR_EMAIL,
      eventId: eventId,
      sendUpdates: sendNotifications ? 'all' : 'none',
    });

    return { success: true };
  } catch (error) {
    console.error('Error canceling event:', error);
    return { 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel'
    };
  }
}

// Get event details
export async function getEventDetails(eventId: string) {
  try {
    const calendar = getCalendarClient();

    const response = await calendar.events.get({
      calendarId: CALENDAR_EMAIL,
      eventId: eventId,
    });

    return response.data;
  } catch (error) {
    console.error('Error getting event details:', error);
    return null;
  }
}

// Cancel all future sessions for a child (for termination)
export async function cancelAllFutureSessions(
  sessionEventIds: string[]
): Promise<{ cancelled: number; failed: number }> {
  let cancelled = 0;
  let failed = 0;

  for (const eventId of sessionEventIds) {
    const result = await cancelEvent(eventId, true);
    if (result.success) {
      cancelled++;
    } else {
      failed++;
    }
  }

  return { cancelled, failed };
}