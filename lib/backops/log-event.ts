// ============================================================
// FILE: lib/backops/log-event.ts
// PURPOSE: Centralized event emitter for BackOps event bus.
//          This is the ONLY function that writes to ops_events.
//          Pattern: Same as insertLearningEvent() — never bypass.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';

// Match CHECK constraint enums EXACTLY from migration
export type OpsEventType =
  | 'cron_run' | 'cron_failure'
  | 'webhook_received' | 'webhook_failed'
  | 'job_queued' | 'job_completed' | 'job_failed'
  | 'anomaly_detected' | 'decision_made'
  | 'action_taken' | 'action_outcome'
  | 'health_check' | 'smoke_test'
  | 'payment_event' | 'enrollment_event'
  | 'session_event' | 'communication_sent' | 'communication_failed'
  | 'nudge_sent' | 'nudge_suppressed'
  | 'override_applied' | 'escalation'
  | 'policy_updated' | 'system_alert';

export type OpsSeverity = 'info' | 'warning' | 'error' | 'critical';

export type OpsEntityType =
  | 'child' | 'parent' | 'coach' | 'enrollment' | 'session'
  | 'payment' | 'lead' | 'discovery_call' | 'group_session'
  | 'tuition' | 'communication' | 'cron' | 'system';

export type OpsActionOutcome =
  | 'pending' | 'success' | 'failed' | 'awaiting_approval' | 'suppressed' | 'expired';

export interface OpsEventInput {
  event_type: OpsEventType;
  source: string;                    // e.g., 'cron:practice-nudge', 'webhook:razorpay'
  severity?: OpsSeverity;            // default: 'info'
  correlation_id?: string;           // UUID linking related events
  entity_type?: OpsEntityType;
  entity_id?: string;                // UUID of the entity
  decision_made?: string;            // What was decided
  decision_reason?: Json;              // Why
  action_taken?: string;             // What actuator fired
  action_outcome?: OpsActionOutcome;
  resolved_by?: string;              // 'auto' | 'openclaw' | 'admin_ui'
  metadata?: Json;
}

/**
 * Log an operational event to the BackOps event bus.
 *
 * This is the ONLY function that should write to ops_events.
 * NEVER call supabase.from('ops_events').insert() directly.
 */
export async function logOpsEvent(
  input: OpsEventInput,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('ops_events')
      .insert({
        event_type: input.event_type,
        source: input.source,
        severity: input.severity || 'info',
        correlation_id: input.correlation_id || null,
        entity_type: input.entity_type || null,
        entity_id: input.entity_id || null,
        decision_made: input.decision_made || null,
        decision_reason: input.decision_reason || null,
        action_taken: input.action_taken || null,
        action_outcome: input.action_outcome || null,
        resolved_by: input.resolved_by || null,
        metadata: input.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('[BackOps] Failed to log event:', error.message, {
        source: input.source,
        event_type: input.event_type,
      });
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error(
      '[BackOps] Exception logging event:',
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Generate a correlation ID for a new event chain.
 * Use at the START of a chain (e.g., payment webhook received).
 * Pass to all downstream events.
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Batch log multiple events (e.g., dispatcher logging all job results).
 */
export async function logOpsEventBatch(
  events: OpsEventInput[],
): Promise<{ success: boolean; count: number; errors: number }> {
  const rows = events.map((input) => ({
    event_type: input.event_type,
    source: input.source,
    severity: input.severity || 'info',
    correlation_id: input.correlation_id || null,
    entity_type: input.entity_type || null,
    entity_id: input.entity_id || null,
    decision_made: input.decision_made || null,
    decision_reason: input.decision_reason || null,
    action_taken: input.action_taken || null,
    action_outcome: input.action_outcome || null,
    resolved_by: input.resolved_by || null,
    metadata: input.metadata || {},
  }));

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('ops_events').insert(rows);

    if (error) {
      console.error('[BackOps] Batch insert failed:', error.message);
      return { success: false, count: rows.length, errors: rows.length };
    }

    return { success: true, count: rows.length, errors: 0 };
  } catch (err) {
    console.error(
      '[BackOps] Batch exception:',
      err instanceof Error ? err.message : err,
    );
    return { success: false, count: rows.length, errors: rows.length };
  }
}
