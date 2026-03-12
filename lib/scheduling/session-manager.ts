/**
 * @deprecated Import from '@/lib/scheduling/operations' instead.
 * This file exists for backward compatibility only.
 */

export { scheduleSession } from './operations/create-session';
export { rescheduleSession } from './operations/reschedule-session';
export { cancelSession } from './operations/cancel-session';
export { reassignCoach, bulkReassign } from './operations/reassign-coach';
export type { ScheduleSessionInput, ScheduleSessionOptions, SessionResult } from './operations/types';
