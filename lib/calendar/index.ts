/**
 * Calendar module — barrel export
 * All calendar functionality re-exported from here.
 */

export { getCalendarClient, CALENDAR_EMAIL, DEFAULT_COACH_ORGANIZER } from './auth';

export {
  DAY_NAMES,
  formatTime,
  scheduleCalendarEvent,
  rescheduleEvent,
  cancelEvent,
  deleteCalendarEvent,
  updateCalendarEventForMode,
  getEventDetails,
  cancelAllFutureSessions,
  getAvailableSlots,
  createAllSessions,
  scheduleAllSessions,
  getDiscoverySlots,
  bookDiscoveryCall,
  cancelDiscoveryCall,
} from './events';

export type {
  DiscoverySlot,
  DiscoveryBookingData,
  DiscoveryBookingResult,
} from './events';

export { updateEventAttendees } from './attendees';

// Re-export operations (already existed)
export {
  createEnrollmentSessions,
  rescheduleSession,
  cancelSession,
  cancelAllChildSessions,
  generateSessionSchedule,
} from './operations';

export type {
  SessionToCreate,
  CreatedSession,
  EnrollmentResult,
} from './operations';
