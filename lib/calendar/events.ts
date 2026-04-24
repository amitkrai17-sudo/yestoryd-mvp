/**
 * Calendar event CRUD operations
 * Extracted from lib/googleCalendar.ts
 */

import { getCalendarClient, CALENDAR_EMAIL, DEFAULT_COACH_ORGANIZER } from './auth';

// ==================== CONSTANTS ====================

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// ==================== TYPES ====================

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
  number: number;
  week: number;
  scheduledAt: string;
  googleEventId: string;
  sessionNumber: number;
  scheduledDate: string;
  scheduledTime: string;
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

export interface DiscoverySlot {
  date: string;
  time: string;
  datetime: string;
  available: boolean;
}

export interface DiscoveryBookingData {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childName: string;
  childAge: number;
  childId?: string;
  slotDate: string;
  slotTime: string;
  coachEmail?: string;
  notes?: string;
}

export interface DiscoveryBookingResult {
  success: boolean;
  eventId?: string;
  meetLink?: string;
  error?: string;
}

// ==================== SINGLE EVENT OPERATIONS ====================

export async function scheduleCalendarEvent(
  session: SessionDetails,
  organizerEmail?: string
): Promise<{ eventId: string; meetLink: string }> {
  try {
    const calendar = getCalendarClient(organizerEmail);

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
          { method: 'email' as const, minutes: 24 * 60 },
          { method: 'popup' as const, minutes: 60 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: organizerEmail || CALENDAR_EMAIL,
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

export async function rescheduleEvent(
  eventId: string,
  newDateTime: Date,
  durationMinutes: number = 45,
  organizerEmail?: string
): Promise<{ success: boolean; error?: string; meetLink?: string }> {
  try {
    const calendar = getCalendarClient(organizerEmail);

    const newEndTime = new Date(newDateTime);
    newEndTime.setMinutes(newEndTime.getMinutes() + durationMinutes);

    const response = await calendar.events.patch({
      calendarId: organizerEmail || CALENDAR_EMAIL,
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
      error: error instanceof Error ? error.message : 'Failed to reschedule',
    };
  }
}

export async function cancelEvent(
  eventId: string,
  sendNotifications: boolean = true,
  organizerEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = getCalendarClient(organizerEmail);

    await calendar.events.delete({
      calendarId: organizerEmail || CALENDAR_EMAIL,
      eventId: eventId,
      sendUpdates: sendNotifications ? 'all' : 'none',
    });

    return { success: true };
  } catch (error) {
    console.error('Error canceling event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel',
    };
  }
}

export async function deleteCalendarEvent(eventId: string, organizerEmail?: string): Promise<boolean> {
  try {
    const calendar = getCalendarClient(organizerEmail);

    await calendar.events.delete({
      calendarId: organizerEmail || CALENDAR_EMAIL,
      eventId: eventId,
      sendUpdates: 'none',
    });

    console.log('[DELETE] Calendar event deleted (rollback):', eventId);
    return true;
  } catch (error: any) {
    if (error.code === 404 || error.code === 410) {
      console.log('Calendar event already deleted or not found:', eventId);
      return true;
    }
    console.error('Failed to delete calendar event:', eventId, error.message);
    return false;
  }
}

// Patch a calendar event when session_mode changes. Preserves
// conferenceData + Meet link (conferenceDataVersion: 0) in both directions.
// offline: appends the '[OFFLINE SESSION - In Person]' marker and sets location.
// online:  strips any '[OFFLINE SESSION...]' marker and clears location.
export async function updateCalendarEventForMode(
  eventId: string,
  organizerEmail: string,
  mode: 'online' | 'offline',
  location?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = getCalendarClient(organizerEmail);

    const current = await calendar.events.get({
      calendarId: organizerEmail,
      eventId,
    });

    const currentDescription = current.data.description || '';

    let updatedDescription = currentDescription;
    if (mode === 'offline') {
      if (!currentDescription.includes('[OFFLINE SESSION')) {
        updatedDescription = currentDescription + '\n\n[OFFLINE SESSION - In Person]';
      }
    } else {
      updatedDescription = currentDescription
        .replace(/\n?\n?\[OFFLINE SESSION[^\]]*\]/g, '')
        .trimEnd();
    }

    const requestBody: Record<string, unknown> = { description: updatedDescription };
    if (mode === 'offline') {
      if (location) requestBody.location = location;
    } else {
      requestBody.location = '';
    }

    await calendar.events.patch({
      calendarId: organizerEmail,
      eventId,
      conferenceDataVersion: 0,
      requestBody,
      sendUpdates: 'all',
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating calendar event for mode:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update calendar event',
    };
  }
}

export async function getEventDetails(eventId: string, organizerEmail?: string) {
  try {
    const calendar = getCalendarClient(organizerEmail);

    const response = await calendar.events.get({
      calendarId: organizerEmail || CALENDAR_EMAIL,
      eventId: eventId,
    });

    return response.data;
  } catch (error) {
    console.error('Error getting event details:', error);
    return null;
  }
}

// ==================== BATCH OPERATIONS ====================

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

// ==================== AVAILABILITY ====================

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

// ==================== LEGACY BULK SESSION CREATION ====================

/**
 * @deprecated LEGACY — V3 scheduling uses enrollment-scheduler.ts with weekly_pattern.
 * This function creates a flat 6+3 schedule and is only used as a fallback.
 */
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

      if (preferredDay !== undefined) {
        const currentDay = sessionDate.getDay();
        const daysUntilPreferred = (preferredDay - currentDay + 7) % 7;
        sessionDate.setDate(sessionDate.getDate() + daysUntilPreferred);
      }

      sessionDate.setDate(sessionDate.getDate() + (schedule.week - 1) * 7);

      if (preferredHour !== undefined) {
        sessionDate.setHours(preferredHour, 0, 0, 0);
      } else if (preferredTime) {
        const [hours, minutes] = preferredTime.split(':');
        sessionDate.setHours(parseInt(hours), parseInt(minutes || '0'), 0, 0);
      } else {
        sessionDate.setHours(16, 0, 0, 0);
      }

      const durationMinutes = (schedule as any).durationMinutes || (schedule.type === 'coaching' ? 45 : 30);
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
          attendees: [parentEmail, CALENDAR_EMAIL].filter(Boolean),
          sessionType: schedule.type as 'coaching' | 'parent_checkin',
        }, coachEmail || DEFAULT_COACH_ORGANIZER);

        sessions.push({
          eventId: result.eventId,
          number: schedule.number,
          week: schedule.week,
          scheduledAt: sessionDate.toISOString(),
          googleEventId: result.eventId,
          sessionNumber: schedule.number,
          scheduledDate: dateStr,
          scheduledTime: timeStr,
          meetLink: result.meetLink,
          title: schedule.title,
          type: schedule.type,
        });
      } catch (error) {
        console.error(`Error scheduling ${schedule.title}:`, error);
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

// ==================== DISCOVERY CALLS ====================

export async function getDiscoverySlots(days: number = 14): Promise<DiscoverySlot[]> {
  try {
    const calendar = getCalendarClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);

    let busyTimes: { start: Date; end: Date }[] = [];
    try {
      const busyResponse = await calendar.freebusy.query({
        requestBody: {
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          items: [{ id: CALENDAR_EMAIL }],
        },
      });

      busyTimes = (busyResponse.data.calendars?.[CALENDAR_EMAIL]?.busy || []).map(b => ({
        start: new Date(b.start || ''),
        end: new Date(b.end || ''),
      }));
    } catch (error) {
      console.error('Error getting busy times for discovery:', error);
    }

    const slots: DiscoverySlot[] = [];
    const current = new Date(startDate);

    const timeWindows = [
      { startHour: 10, endHour: 13 },
      { startHour: 17, endHour: 19 },
    ];

    while (current < endDate) {
      const dayOfWeek = current.getDay();

      if (dayOfWeek !== 0) {
        const dateStr = current.toISOString().split('T')[0];

        for (const window of timeWindows) {
          for (let hour = window.startHour; hour < window.endHour; hour++) {
            for (const minute of [0, 30]) {
              if (hour === window.endHour - 1 && minute === 30) continue;

              const slotStart = new Date(current);
              slotStart.setHours(hour, minute, 0, 0);

              const slotEnd = new Date(slotStart);
              slotEnd.setMinutes(slotEnd.getMinutes() + 30);

              if (slotStart <= new Date()) continue;

              const isBusy = busyTimes.some(busy =>
                slotStart < busy.end && slotEnd > busy.start
              );

              const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

              slots.push({
                date: dateStr,
                time: timeStr,
                datetime: slotStart.toISOString(),
                available: !isBusy,
              });
            }
          }
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return slots;
  } catch (error) {
    console.error('Error getting discovery slots:', error);
    return [];
  }
}

export async function bookDiscoveryCall(data: DiscoveryBookingData): Promise<DiscoveryBookingResult> {
  try {
    const calendar = getCalendarClient();

    const [hours, minutes] = data.slotTime.split(':').map(Number);
    const slotDatetime = new Date(data.slotDate);
    slotDatetime.setHours(hours, minutes, 0, 0);

    const endDatetime = new Date(slotDatetime);
    endDatetime.setMinutes(endDatetime.getMinutes() + 30);

    const attendees = [
      { email: data.parentEmail },
      { email: CALENDAR_EMAIL },
    ];

    if (data.coachEmail) {
      attendees.push({ email: data.coachEmail });
    }

    const event = {
      summary: `Discovery Call: ${data.childName} (${data.childAge}yr)`,
      description: `FREE Discovery Call - Yestoryd Reading Coaching

Parent: ${data.parentName}
Phone: ${data.parentPhone}
Email: ${data.parentEmail}
Child: ${data.childName} (Age ${data.childAge})

${data.notes ? `Notes: ${data.notes}` : ''}

This is a FREE 20-minute call to discuss ${data.childName}'s reading journey and see if Yestoryd is the right fit.`,
      start: {
        dateTime: slotDatetime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endDatetime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `discovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email' as const, minutes: 24 * 60 },
          { method: 'popup' as const, minutes: 60 },
          { method: 'popup' as const, minutes: 15 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: CALENDAR_EMAIL,
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });

    const meetLink = response.data.hangoutLink ||
      response.data.conferenceData?.entryPoints?.[0]?.uri || '';

    return {
      success: true,
      eventId: response.data.id || '',
      meetLink,
    };
  } catch (error) {
    console.error('Error booking discovery call:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create calendar event',
    };
  }
}

export async function cancelDiscoveryCall(
  eventId: string,
  _reason?: string
): Promise<{ success: boolean; error?: string }> {
  return cancelEvent(eventId, true);
}
