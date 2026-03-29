// ============================================================
// FILE: lib/backops/log-decision.ts
// PURPOSE: Decision audit trail wrapper over logOpsEvent.
//          Makes it easy to add decision logging to crons.
// ============================================================

import { logOpsEvent, type OpsEntityType, type OpsActionOutcome } from './log-event';
import type { Json } from '@/lib/supabase/database.types';

export interface DecisionInput {
  source: string;                    // e.g., 'cron:practice-nudge'
  entity_type: OpsEntityType;
  entity_id: string;
  correlation_id?: string;
  decision: string;                  // e.g., 'send_nudge', 'skip_nudge', 'escalate_to_coach'
  reason: Json;                      // e.g., { engagement: 0.35, threshold: 0.4 }
  action?: string;                   // e.g., 'aisensy:practice_nudge_low'
  outcome?: OpsActionOutcome;        // Usually 'pending' at decision time
}

/**
 * Log an automated decision with full reasoning.
 *
 * Example:
 * ```
 * await logDecision({
 *   source: 'cron:practice-nudge',
 *   entity_type: 'child',
 *   entity_id: child.id,
 *   decision: 'send_practice_nudge',
 *   reason: { engagement: 0.35, threshold: 0.4, days_since_last: 3 },
 *   action: 'aisensy:practice_nudge_low',
 *   outcome: 'pending'
 * });
 * ```
 */
export async function logDecision(input: DecisionInput): Promise<void> {
  await logOpsEvent({
    event_type: 'decision_made',
    source: input.source,
    severity: 'info',
    correlation_id: input.correlation_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    decision_made: input.decision,
    decision_reason: input.reason,
    action_taken: input.action,
    action_outcome: input.outcome || 'pending',
    resolved_by: 'auto',
  });
}

/**
 * Log a decision to SKIP an action (equally important for audit trail).
 *
 * Example: "Didn't send nudge because engagement was above threshold"
 */
export async function logSkippedDecision(
  input: Omit<DecisionInput, 'action' | 'outcome'>,
): Promise<void> {
  await logOpsEvent({
    event_type: 'decision_made',
    source: input.source,
    severity: 'info',
    correlation_id: input.correlation_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    decision_made: `skipped:${input.decision}`,
    decision_reason: input.reason,
    action_outcome: 'suppressed',
    resolved_by: 'auto',
  });
}
