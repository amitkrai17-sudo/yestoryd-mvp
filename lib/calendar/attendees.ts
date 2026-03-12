/**
 * Calendar attendee management
 * Extracted from lib/googleCalendar.ts
 */

import { getCalendarClient, CALENDAR_EMAIL } from './auth';

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

    const { data: event } = await calendar.events.get({
      calendarId,
      eventId: eventId,
    });

    if (!event) {
      return { success: false, error: 'Event not found' };
    }

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

    await calendar.events.patch({
      calendarId,
      eventId: eventId,
      sendUpdates: 'all',
      requestBody: {
        attendees,
      },
    });

    console.log(`[CALENDAR] Updated attendees for event ${eventId}:`, {
      added: options.addAttendees,
      removed: options.removeAttendees,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating event attendees:', error);

    if (error.code === 404 || error.code === 410) {
      return { success: false, error: 'Event not found (404)' };
    }

    return {
      success: false,
      error: error.message || 'Failed to update attendees',
    };
  }
}
