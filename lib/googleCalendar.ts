import { google } from 'googleapis';

// Initialize Google Calendar API
const getCalendarClient = () => {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
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

interface ScheduledSession {
  eventId: string;
  meetLink: string;
  startTime: string;
  endTime: string;
}

interface CreateAllSessionsParams {
  childName: string;
  parentEmail: string;
  coachEmail: string;
  startDate: Date;
  preferredDay?: number;
  preferredTime?: string;
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
          requestId: `yestoryd-${Date.now()}`,
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

// Create all sessions - used by /api/sessions/confirm
export async function createAllSessions(params: CreateAllSessionsParams): Promise<ScheduledSession[]> {
  const { childName, parentEmail, coachEmail, startDate, preferredTime } = params;
  
  const sessions: ScheduledSession[] = [];
  const sessionSchedule = [
    { week: 1, type: 'coaching' as const, title: 'Session 1: Initial Assessment' },
    { week: 2, type: 'coaching' as const, title: 'Session 2: Phonics Foundation' },
    { week: 3, type: 'coaching' as const, title: 'Session 3: Reading Fluency' },
    { week: 4, type: 'parent_checkin' as const, title: 'Parent Check-in 1' },
    { week: 5, type: 'coaching' as const, title: 'Session 4: Comprehension Skills' },
    { week: 6, type: 'coaching' as const, title: 'Session 5: Vocabulary Building' },
    { week: 7, type: 'coaching' as const, title: 'Session 6: Reading Practice' },
    { week: 8, type: 'parent_checkin' as const, title: 'Parent Check-in 2' },
    { week: 12, type: 'parent_checkin' as const, title: 'Final Parent Check-in' },
  ];

  for (const schedule of sessionSchedule) {
    const sessionDate = new Date(startDate);
    sessionDate.setDate(sessionDate.getDate() + (schedule.week - 1) * 7);
    
    // Use preferred time or default to 4 PM IST
    if (preferredTime) {
      const [hours, minutes] = preferredTime.split(':');
      sessionDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      sessionDate.setHours(16, 0, 0, 0);
    }

    const endTime = new Date(sessionDate);
    endTime.setMinutes(endTime.getMinutes() + (schedule.type === 'coaching' ? 45 : 30));

    try {
      const result = await scheduleCalendarEvent({
        title: `${schedule.title} - ${childName}`,
        description: `Yestoryd Reading Session for ${childName}\n\nType: ${schedule.type}\nCoach will join via Google Meet.`,
        startTime: sessionDate,
        endTime: endTime,
        attendees: [parentEmail, coachEmail, CALENDAR_EMAIL],
        sessionType: schedule.type,
      });

      sessions.push({
        eventId: result.eventId,
        meetLink: result.meetLink,
        startTime: sessionDate.toISOString(),
        endTime: endTime.toISOString(),
      });
    } catch (error) {
      console.error(`Error scheduling ${schedule.title}:`, error);
    }
  }

  return sessions;
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

    // Get slots for the next 14 days from the given date
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 14);

    // Get busy times
    const busyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: [{ id: coachEmail }],
      },
    });

    const busyTimes = busyResponse.data.calendars?.[coachEmail]?.busy || [];

    // Generate available slots (9 AM to 6 PM IST)
    const availableSlots: { start: string; end: string }[] = [];
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      // Skip weekends
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        for (let hour = 9; hour < 18; hour++) {
          const slotStart = new Date(currentDate);
          slotStart.setHours(hour, 0, 0, 0);

          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

          // Don't go past 6 PM
          if (slotEnd.getHours() > 18) continue;

          // Check if slot overlaps with busy times
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
export async function rescheduleEvent(
  eventId: string,
  newStartTime: Date,
  newEndTime: Date
): Promise<{ success: boolean; meetLink?: string }> {
  try {
    const calendar = getCalendarClient();

    const response = await calendar.events.patch({
      calendarId: CALENDAR_EMAIL,
      eventId: eventId,
      requestBody: {
        start: {
          dateTime: newStartTime.toISOString(),
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
    return { success: false };
  }
}

// Cancel an event
export async function cancelEvent(eventId: string): Promise<{ success: boolean }> {
  try {
    const calendar = getCalendarClient();

    await calendar.events.delete({
      calendarId: CALENDAR_EMAIL,
      eventId: eventId,
      sendUpdates: 'all',
    });

    return { success: true };
  } catch (error) {
    console.error('Error canceling event:', error);
    return { success: false };
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
    const result = await cancelEvent(eventId);
    if (result.success) {
      cancelled++;
    } else {
      failed++;
    }
  }

  return { cancelled, failed };
}