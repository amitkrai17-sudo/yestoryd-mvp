// ============================================================================
// SCHEDULING LIBRARY
// lib/scheduling/index.ts
// ============================================================================
//
// Unified scheduling library for Yestoryd enrollment system.
//
// Usage:
//   import { scheduleEnrollmentSessions, findAvailableSlot } from '@/lib/scheduling';
//
// ============================================================================

// Configuration
export {
  // Types
  type PlanSchedule,
  type SchedulingDurations,
  type TimePreference,
  type SlotMatchType,
  // Constants
  DEFAULT_DURATIONS,
  DEFAULT_PLAN_SCHEDULES,
  TIME_BUCKETS,
  SESSION_TITLES,
  // Functions
  getSchedulingDurations,
  getPlanSchedule,
  getHoursForBucket,
  getTimeBucket,
  getSessionTitle,
} from './config';

// Smart Slot Finder
export {
  // Types
  type AvailableSlot,
  type SlotSearchResult,
  type SlotFinderOptions,
  // Functions
  findAvailableSlot,
  findConsistentSlot,
  findSlotsForSchedule,
} from './smart-slot-finder';

// Enrollment Scheduler
export {
  // Types
  type ScheduledSession,
  type EnrollmentSchedulerOptions,
  type EnrollmentSchedulerResult,
  // Functions
  scheduleEnrollmentSessions,
  createSessionsSimple,
} from './enrollment-scheduler';

// Config Provider
export {
  type WorkingHours,
  type UnavailabilityThresholds,
  type RetryConfig,
  type ParentPreferences,
  getSessionDuration,
  getWorkingHours,
  getUnavailabilityThresholds,
  getRetryConfig,
  getParentPreferences,
  isFeatureEnabled,
  clearConfigCache,
} from './config-provider';

// Session Manager
export {
  type ScheduleSessionInput,
  type SessionResult,
  scheduleSession,
  rescheduleSession,
  cancelSession,
  reassignCoach,
  bulkReassign,
} from './session-manager';

// Coach Availability Handler
export {
  processUnavailability,
  processCoachReturn,
  processCoachExit,
} from './coach-availability-handler';

// Retry Queue
export {
  enqueue as retryEnqueue,
  processRetry,
} from './retry-queue';

// Manual Queue
export {
  type QueueItem,
  type QueueFilters,
  escalate,
  resolve as resolveQueueItem,
  getQueue,
} from './manual-queue';

// Notification Manager
export {
  type SchedulingEvent,
  type NotificationData,
  notify as sendSchedulingNotification,
} from './notification-manager';

// Redis Store
export {
  checkIdempotency,
  setIdempotency,
  getCircuitStateFromRedis,
  setCircuitStateInRedis,
} from './redis-store';

// Transaction Manager
export {
  type TransactionStep,
  type TransactionResult,
  executeWithCompensation,
} from './transaction-manager';

// Orchestrator
export {
  type SchedulingEventType,
  type DispatchPayload,
  type DispatchResult,
  dispatch,
} from './orchestrator';
