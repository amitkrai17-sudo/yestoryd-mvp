// ============================================================================
// SCHEDULING CONFIG — Re-export barrel
// lib/scheduling/config.ts
// ============================================================================
//
// Merged into config-provider.ts (March 2026).
// This file re-exports everything for backwards compatibility.
//
// ============================================================================

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
} from './config-provider';
