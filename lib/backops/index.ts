// ============================================================
// FILE: lib/backops/index.ts
// PURPOSE: Barrel exports for BackOps utilities.
// ============================================================

export { logOpsEvent, logOpsEventBatch, generateCorrelationId } from './log-event';
export type {
  OpsEventInput,
  OpsEventType,
  OpsSeverity,
  OpsEntityType,
  OpsActionOutcome,
} from './log-event';

export { logDecision, logSkippedDecision } from './log-decision';
export type { DecisionInput } from './log-decision';

export { getPolicy, getPolicyValue, invalidatePolicyCache } from './policy-loader';

export { verifyBackOpsAuth } from './auth';
export type { BackOpsAuthResult } from './auth';

export { detectSignals, deduplicateSignals } from './signal-detector';
export type { DetectedSignal } from './signal-detector';

export { formatAlertMessage, formatAlertEmailHtml, formatInAppNotification } from './alert-formatter';

export { isNudgeSuppressed, isCronPaused } from './override-checker';
