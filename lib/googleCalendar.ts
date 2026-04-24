/**
 * @deprecated Import from '@/lib/calendar' or specific sub-modules instead.
 * This file exists for backward compatibility only.
 */

export {
  DAY_NAMES,
  formatTime,
  scheduleCalendarEvent,
  createAllSessions,
  scheduleAllSessions,
  getAvailableSlots,
  rescheduleEvent,
  cancelEvent,
  deleteCalendarEvent,
  updateCalendarEventForMode,
  getEventDetails,
  cancelAllFutureSessions,
  getDiscoverySlots,
  bookDiscoveryCall,
  cancelDiscoveryCall,
  updateEventAttendees,
} from './calendar';

export type {
  DiscoverySlot,
  DiscoveryBookingData,
  DiscoveryBookingResult,
} from './calendar';
