// lib/business/index.ts
// Central export for all business logic modules

export {
  calculateRevenueSplit,
  determineLeadSource,
  formatSplitForDisplay,
  generatePayoutSummary,
  type LeadSource,
  type RevenueSplitResult,
} from './revenue-split';

export {
  generateSessionSchedule,
  isValidRescheduleTime,
  formatForCalendar,
  getProgramEndDate,
  getUpcomingSessions,
  DEFAULT_CONFIG,
  type ScheduleConfig,
  type ScheduledSession,
} from './session-scheduler';
