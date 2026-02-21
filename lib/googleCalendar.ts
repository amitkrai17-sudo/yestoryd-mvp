import { google } from 'googleapis';

// Initialize Google Calendar API
// Pass impersonateEmail to create events on a specific user's calendar (e.g., coach as organizer)
// Defaults to GOOGLE_CALENDAR_DELEGATED_USER (engage@yestoryd.com) for discovery calls etc.
const getCalendarClient = (impersonateEmail?: string) => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
    clientOptions: {
      subject: impersonateEmail || process.env.GOOGLE_CALENDAR_DELEGATED_USER || 'engage@yestoryd.com',
    },
  });

  return google.calendar({ version: 'v3', auth });
};

// Email to impersonate (must have domain-wide delegation)
const CALENDAR_EMAIL = process.env.GOOGLE_CALENDAR_EMAIL || 'engage@yestoryd.com';

// For coaching sessions, fall back to DEFAULT_COACH_EMAIL (not engage@) so a coach is always organizer
const DEFAULT_COACH_ORGANIZER = process.env.DEFAULT_COACH_EMAIL || CALENDAR_EMAIL;

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

// =============================================================================
// DISCOVERY CALL TYPES (NEW)
// =============================================================================

export interface DiscoverySlot {
  date: string;      // 'YYYY-MM-DD'
  time: string;      // 'HH:MM'
  datetime: string;  // ISO string
  available: boolean;
}

export interface DiscoveryBookingData {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  childName: string;
  childAge: number;
  childId?: string;
  slotDate: string;    // 'YYYY-MM-DD'
  slotTime: string;    // 'HH:MM'
  coachEmail?: string; // Optional: Include coach in calendar invite
  notes?: string;
}

export interface DiscoveryBookingResult {
  success: boolean;
  eventId?: string;
  meetLink?: string;
  error?: string;
}

// =============================================================================
// EXISTING FUNCTIONS
// =============================================================================

// Schedule a single calendar event
// Pass organizerEmail to create on a coach's calendar (coach becomes organizer)
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
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 60 },
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

/**
 * @deprecated LEGACY — V3 scheduling uses enrollment-scheduler.ts with weekly_pattern.
 * This function creates a flat 6+3 schedule and is only used as a fallback.
 */
export async function createAllSessions(params: CreateAllSessionsParams): Promise<CreateAllSessionsResult> {
  const { childName, parentEmail, coachEmail, startDate, preferredTime, preferredHour, preferredDay } = params;

  const sessions: ScheduledSession[] = [];
  // LEGACY: flat 6 coaching + 3 parent_checkin schedule
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

      // V2: Use schedule's own duration if provided, fallback to type-based defaults
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
          attendees: [parentEmail, CALENDAR_EMAIL].filter(Boolean), // Coach is organizer (implicit attendee)
          sessionType: schedule.type as 'coaching' | 'parent_checkin',
        }, coachEmail || DEFAULT_COACH_ORGANIZER); // Coach as organizer, fallback to default coach

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
      error: error instanceof Error ? error.message : 'Failed to reschedule'
    };
  }
}

// Cancel an event
// Route calls: cancelEvent(eventId, true)
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
      error: error instanceof Error ? error.message : 'Failed to cancel'
    };
  }
}

// =============================================================================
// DELETE CALENDAR EVENT (NEW - For Rollback)
// =============================================================================

/**
 * Delete a Google Calendar event silently (no notifications)
 * Used for rollback when booking DB insert fails
 * 
 * @param eventId - Google Calendar event ID
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteCalendarEvent(eventId: string, organizerEmail?: string): Promise<boolean> {
  try {
    const calendar = getCalendarClient(organizerEmail);

    await calendar.events.delete({
      calendarId: organizerEmail || CALENDAR_EMAIL,
      eventId: eventId,
      sendUpdates: 'none', // Silent delete - no notifications to attendees
    });

    console.log('🗑️ Calendar event deleted (rollback):', eventId);
    return true;
  } catch (error: any) {
    // If event doesn't exist (already deleted), that's fine
    if (error.code === 404 || error.code === 410) {
      console.log('Calendar event already deleted or not found:', eventId);
      return true;
    }
    
    console.error('Failed to delete calendar event:', eventId, error.message);
    return false;
  }
}

/**
 * Update a calendar event for offline mode:
 * - Remove conference data (Meet link)
 * - Add physical location if provided
 * - Update description to indicate offline
 */
export async function updateCalendarEventForOffline(
  eventId: string,
  organizerEmail: string,
  location?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = getCalendarClient(organizerEmail);

    // Fetch current event to get description
    const current = await calendar.events.get({
      calendarId: organizerEmail,
      eventId,
    });

    const currentDescription = current.data.description || '';
    const updatedDescription = currentDescription.includes('[OFFLINE SESSION')
      ? currentDescription
      : currentDescription + '\n\n[OFFLINE SESSION - In Person]';

    await calendar.events.patch({
      calendarId: organizerEmail,
      eventId,
      conferenceDataVersion: 0,
      requestBody: {
        description: updatedDescription,
        ...(location ? { location } : {}),
      },
      sendUpdates: 'all',
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating event for offline:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update calendar event',
    };
  }
}

// Get event details
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

// =============================================================================
// DISCOVERY CALL FUNCTIONS (NEW)
// =============================================================================

/**
 * Get available 30-min discovery call slots for next 14 days
 * Discovery slots: Mon-Sat, 10 AM - 1 PM and 5 PM - 7 PM
 */
export async function getDiscoverySlots(
  days: number = 14
): Promise<DiscoverySlot[]> {
  try {
    const calendar = getCalendarClient();
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Start tomorrow
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);

    // Get busy times from calendar
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
    
    // Discovery call time windows (IST)
    const timeWindows = [
      { startHour: 10, endHour: 13 },  // 10 AM - 1 PM
      { startHour: 17, endHour: 19 },  // 5 PM - 7 PM
    ];

    while (current < endDate) {
      const dayOfWeek = current.getDay();
      
      // Skip Sunday (0)
      if (dayOfWeek !== 0) {
        const dateStr = current.toISOString().split('T')[0];
        
        for (const window of timeWindows) {
          // Generate 30-min slots
          for (let hour = window.startHour; hour < window.endHour; hour++) {
            for (const minute of [0, 30]) {
              // Skip if we'd go past window end
              if (hour === window.endHour - 1 && minute === 30) continue;
              
              const slotStart = new Date(current);
              slotStart.setHours(hour, minute, 0, 0);
              
              const slotEnd = new Date(slotStart);
              slotEnd.setMinutes(slotEnd.getMinutes() + 30);
              
              // Skip if in the past
              if (slotStart <= new Date()) continue;
              
              // Check if busy
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

/**
 * Book a discovery call - creates Google Calendar event with Meet link
 */
export async function bookDiscoveryCall(
  data: DiscoveryBookingData
): Promise<DiscoveryBookingResult> {
  try {
    const calendar = getCalendarClient();
    
    // Create datetime from date + time
    const [hours, minutes] = data.slotTime.split(':').map(Number);
    const slotDatetime = new Date(data.slotDate);
    slotDatetime.setHours(hours, minutes, 0, 0);
    
    const endDatetime = new Date(slotDatetime);
    endDatetime.setMinutes(endDatetime.getMinutes() + 30);

    // Build attendees list
    const attendees = [
      { email: data.parentEmail },
      { email: CALENDAR_EMAIL },
    ];
    
    // Add coach if provided
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
          { method: 'email', minutes: 24 * 60 },  // 24 hours before
          { method: 'popup', minutes: 60 },        // 1 hour before
          { method: 'popup', minutes: 15 },        // 15 min before
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

/**
 * Cancel a discovery call
 */
export async function cancelDiscoveryCall(
  eventId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  return cancelEvent(eventId, true);
}

/**
 * Update event attendees (add/remove)
 * Used when reassigning coaches to calls or sessions
 */
export async function updateEventAttendees(
  eventId: string,
  options: {
    addAttendees?: string[];
    removeAttendees?: string[];
    organizerEmail?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendarId = options.organizerEmail || CALENDAR_EMAIL;
    const calendar = getCalendarClient(options.organizerEmail);

    // 1. Get current event
    const { data: event } = await calendar.events.get({
      calendarId,
      eventId: eventId,
    });

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

    // 2. Build updated attendees list
    let attendees = event.attendees || [];

    // Remove specified attendees
    if (options.removeAttendees?.length) {
      const removeSet = new Set(options.removeAttendees.map(e => e.toLowerCase()));
      attendees = attendees.filter(a => !removeSet.has(a.email?.toLowerCase() || ''));
    }

    // Add new attendees (avoid duplicates)
    if (options.addAttendees?.length) {
      const existingEmails = new Set(attendees.map(a => a.email?.toLowerCase()));
      for (const email of options.addAttendees) {
        if (!existingEmails.has(email.toLowerCase())) {
          attendees.push({ email, responseStatus: 'needsAction' });
        }
      }
    }

    // 3. Update the event
    await calendar.events.patch({
      calendarId,
      eventId: eventId,
      sendUpdates: 'all', // Notify all attendees of the change
      requestBody: {
        attendees,
      },
    });

    console.log(`📅 Updated attendees for event ${eventId}:`, {
      added: options.addAttendees,
      removed: options.removeAttendees,
    });

    return { success: true };

  } catch (error: any) {
    console.error('Error updating event attendees:', error);

    // Handle specific errors
    if (error.code === 404 || error.code === 410) {
      return { success: false, error: 'Event not found (404)' };
    }

    return {
      success: false,
      error: error.message || 'Failed to update attendees',
    };
  }
}