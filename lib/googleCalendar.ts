import { google } from 'googleapis';

// ============================================
// GOOGLE CALENDAR INTEGRATION FOR YESTORYD
// ============================================

// Initialize auth with service account
function getAuth() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    subject: process.env.GOOGLE_CALENDAR_DELEGATED_USER, // engage@yestoryd.com
  });
  return auth;
}

// Get calendar client
function getCalendar() {
  const auth = getAuth();
  return google.calendar({ version: 'v3', auth });
}

// ============================================
// TYPES
// ============================================

export interface SessionEvent {
  childId: string;
  childName: string;
  parentEmail: string;
  parentName: string;
  coachEmail: string;
  coachName: string;
  sessionType: 'coaching' | 'parent_checkin';
  sessionNumber: number;
  weekNumber: number;
  startTime: Date;
  duration: number; // minutes
}

export interface CreatedEvent {
  eventId: string;
  meetLink: string;
  htmlLink: string;
  startTime: string;
  endTime: string;
}

export interface ScheduleConfig {
  childId: string;
  childName: string;
  parentEmail: string;
  parentName: string;
  coachEmail: string;
  coachName: string;
  startDate: Date; // When the program starts
  preferredDay?: number; // 0=Sunday, 1=Monday, etc.
  preferredHour?: number; // 9-18 (9am-6pm)
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Create a single calendar event with Google Meet
 */
export async function createSessionEvent(session: SessionEvent): Promise<CreatedEvent> {
  const calendar = getCalendar();
  
  const endTime = new Date(session.startTime);
  endTime.setMinutes(endTime.getMinutes() + session.duration);

  const sessionTitle = session.sessionType === 'coaching'
    ? `Yestoryd Coaching: ${session.childName} (Session ${session.sessionNumber})`
    : `Yestoryd Parent Check-in: ${session.childName} (Check-in ${session.sessionNumber})`;

  const description = `
📚 ${session.sessionType === 'coaching' ? 'Reading Coaching Session' : 'Parent Check-in'}

👶 Child: ${session.childName}
👨‍👩‍👧 Parent: ${session.parentName}
👩‍🏫 Coach: ${session.coachName}
📅 Week ${session.weekNumber} of 12

---
This session is part of the Yestoryd 3-month coaching program.

Need to reschedule? Reply to the calendar invite or contact your coach.

Powered by Yestoryd - AI-Powered Reading Intelligence
https://yestoryd.com
  `.trim();

  const event = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all', // Send email invites to all attendees
    requestBody: {
      summary: sessionTitle,
      description: description,
      start: {
        dateTime: session.startTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      attendees: [
        { email: session.parentEmail, displayName: session.parentName },
        { email: session.coachEmail, displayName: session.coachName },
        { email: process.env.GOOGLE_CALENDAR_DELEGATED_USER }, // Admin copy
      ],
      conferenceData: {
        createRequest: {
          requestId: `yestoryd-${session.childId}-${session.sessionType}-${session.sessionNumber}-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours before
          { method: 'popup', minutes: 60 }, // 1 hour before
          { method: 'popup', minutes: 15 }, // 15 minutes before
        ],
      },
      // Store metadata for later reference
      extendedProperties: {
        private: {
          childId: session.childId,
          sessionType: session.sessionType,
          sessionNumber: session.sessionNumber.toString(),
          weekNumber: session.weekNumber.toString(),
          platform: 'yestoryd',
        },
      },
    },
  });

  return {
    eventId: event.data.id!,
    meetLink: event.data.conferenceData?.entryPoints?.[0]?.uri || '',
    htmlLink: event.data.htmlLink!,
    startTime: event.data.start?.dateTime!,
    endTime: event.data.end?.dateTime!,
  };
}

/**
 * Schedule all 9 sessions for a new enrollment
 * - 6 Coaching Sessions (bi-weekly)
 * - 3 Parent Check-ins (monthly)
 */
export async function scheduleAllSessions(config: ScheduleConfig): Promise<{
  success: boolean;
  sessions: Array<{
    type: string;
    number: number;
    week: number;
    eventId: string;
    meetLink: string;
    scheduledAt: string;
  }>;
  error?: string;
}> {
  const sessions: Array<{
    type: string;
    number: number;
    week: number;
    eventId: string;
    meetLink: string;
    scheduledAt: string;
  }> = [];

  try {
    // Default to Monday at 10 AM if not specified
    const preferredDay = config.preferredDay ?? 1; // Monday
    const preferredHour = config.preferredHour ?? 10; // 10 AM

    // Find the first occurrence of preferred day from start date
    let baseDate = new Date(config.startDate);
    while (baseDate.getDay() !== preferredDay) {
      baseDate.setDate(baseDate.getDate() + 1);
    }
    baseDate.setHours(preferredHour, 0, 0, 0);

    // Schedule 6 Coaching Sessions (bi-weekly: weeks 1, 3, 5, 7, 9, 11)
    const coachingWeeks = [1, 3, 5, 7, 9, 11];
    for (let i = 0; i < coachingWeeks.length; i++) {
      const weekNumber = coachingWeeks[i];
      const sessionDate = new Date(baseDate);
      sessionDate.setDate(sessionDate.getDate() + (weekNumber - 1) * 7);

      const event = await createSessionEvent({
        childId: config.childId,
        childName: config.childName,
        parentEmail: config.parentEmail,
        parentName: config.parentName,
        coachEmail: config.coachEmail,
        coachName: config.coachName,
        sessionType: 'coaching',
        sessionNumber: i + 1,
        weekNumber: weekNumber,
        startTime: sessionDate,
        duration: 45, // 45 minutes
      });

      sessions.push({
        type: 'coaching',
        number: i + 1,
        week: weekNumber,
        eventId: event.eventId,
        meetLink: event.meetLink,
        scheduledAt: event.startTime,
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Schedule 3 Parent Check-ins (monthly: weeks 4, 8, 12)
    const checkinWeeks = [4, 8, 12];
    for (let i = 0; i < checkinWeeks.length; i++) {
      const weekNumber = checkinWeeks[i];
      const sessionDate = new Date(baseDate);
      sessionDate.setDate(sessionDate.getDate() + (weekNumber - 1) * 7);
      // Schedule check-ins 1 hour after coaching time
      sessionDate.setHours(sessionDate.getHours() + 1);

      const event = await createSessionEvent({
        childId: config.childId,
        childName: config.childName,
        parentEmail: config.parentEmail,
        parentName: config.parentName,
        coachEmail: config.coachEmail,
        coachName: config.coachName,
        sessionType: 'parent_checkin',
        sessionNumber: i + 1,
        weekNumber: weekNumber,
        startTime: sessionDate,
        duration: 15, // 15 minutes
      });

      sessions.push({
        type: 'parent_checkin',
        number: i + 1,
        week: weekNumber,
        eventId: event.eventId,
        meetLink: event.meetLink,
        scheduledAt: event.startTime,
      });

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { success: true, sessions };
  } catch (error: any) {
    console.error('Failed to schedule sessions:', error);
    return {
      success: false,
      sessions,
      error: error.message,
    };
  }
}

/**
 * Reschedule an existing event
 */
export async function rescheduleEvent(
  eventId: string,
  newStartTime: Date,
  duration: number
): Promise<{ success: boolean; meetLink?: string; error?: string }> {
  try {
    const calendar = getCalendar();
    
    const newEndTime = new Date(newStartTime);
    newEndTime.setMinutes(newEndTime.getMinutes() + duration);

    const event = await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all', // Notify all attendees
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
    });

    return {
      success: true,
      meetLink: event.data.conferenceData?.entryPoints?.[0]?.uri,
    };
  } catch (error: any) {
    console.error('Failed to reschedule event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel an event
 */
export async function cancelEvent(
  eventId: string,
  sendNotification: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = getCalendar();
    
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: sendNotification ? 'all' : 'none',
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to cancel event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get coach's busy times to find available slots
 */
export async function getCoachAvailability(
  coachEmail: string,
  startDate: Date,
  endDate: Date
): Promise<{ busy: Array<{ start: string; end: string }> }> {
  try {
    const calendar = getCalendar();
    
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        timeZone: 'Asia/Kolkata',
        items: [{ id: coachEmail }],
      },
    });

    const busy = response.data.calendars?.[coachEmail]?.busy || [];
    return {
      busy: busy.map(slot => ({
        start: slot.start!,
        end: slot.end!,
      })),
    };
  } catch (error: any) {
    console.error('Failed to get availability:', error);
    return { busy: [] };
  }
}

/**
 * Get available slots for a coach on a specific day
 */
export async function getAvailableSlots(
  coachEmail: string,
  date: Date,
  slotDuration: number = 45
): Promise<Array<{ start: Date; end: Date }>> {
  const startOfDay = new Date(date);
  startOfDay.setHours(9, 0, 0, 0); // 9 AM
  
  const endOfDay = new Date(date);
  endOfDay.setHours(18, 0, 0, 0); // 6 PM

  const { busy } = await getCoachAvailability(coachEmail, startOfDay, endOfDay);
  
  const slots: Array<{ start: Date; end: Date }> = [];
  let currentSlot = new Date(startOfDay);

  while (currentSlot.getTime() + slotDuration * 60000 <= endOfDay.getTime()) {
    const slotEnd = new Date(currentSlot.getTime() + slotDuration * 60000);
    
    // Check if this slot conflicts with any busy time
    const hasConflict = busy.some(busySlot => {
      const busyStart = new Date(busySlot.start);
      const busyEnd = new Date(busySlot.end);
      return currentSlot < busyEnd && slotEnd > busyStart;
    });

    if (!hasConflict) {
      slots.push({ start: new Date(currentSlot), end: slotEnd });
    }

    // Move to next 30-minute slot
    currentSlot.setMinutes(currentSlot.getMinutes() + 30);
  }

  return slots;
}

/**
 * Get event details by ID
 */
export async function getEventDetails(eventId: string) {
  try {
    const calendar = getCalendar();
    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });
    
    return {
      success: true,
      event: {
        id: event.data.id,
        title: event.data.summary,
        start: event.data.start?.dateTime,
        end: event.data.end?.dateTime,
        meetLink: event.data.conferenceData?.entryPoints?.[0]?.uri,
        attendees: event.data.attendees,
        status: event.data.status,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
