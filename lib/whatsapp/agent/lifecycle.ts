// ============================================================
// Agent 2: Lifecycle Updater
// Updates lead_lifecycle table based on agent decision
// Trigger handles updated_at, previous_state, state_changed_at
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { AgentDecision } from './types';

type TypedClient = SupabaseClient<Database>;

export async function updateLifecycle(
  supabase: TypedClient,
  lifecycleId: string,
  decision: AgentDecision
): Promise<void> {
  const update: Record<string, unknown> = {};

  // State transition (trigger auto-sets previous_state + state_changed_at)
  if (decision.stateTransition) {
    update.current_state = decision.stateTransition;
  }

  // Merge qualification data (don't overwrite existing with null)
  const qe = decision.qualificationExtracted;
  if (qe.child_name) update.child_name = qe.child_name;
  if (typeof qe.child_age === 'number') update.child_age = qe.child_age;
  if (qe.parent_concerns && qe.parent_concerns.length > 0) {
    update.parent_concerns = qe.parent_concerns;
  }
  if (qe.urgency_signal) {
    const urgencyMap: Record<string, number> = { high: 8, medium: 5, low: 2 };
    update.urgency_score = urgencyMap[qe.urgency_signal] || 5;
  }
  if (qe.budget_signal && qe.budget_signal !== 'unknown') {
    update.budget_signal = qe.budget_signal;
  }

  // Nurture scheduling
  if (decision.scheduleFollowup) {
    update.nurture_sequence = decision.scheduleFollowup.action;
    update.next_nurture_at = new Date(
      Date.now() + decision.scheduleFollowup.delayHours * 60 * 60 * 1000
    ).toISOString();
  }

  // AI score: update confidence as a factor
  if (decision.confidence > 0) {
    update.score_factors = {
      last_action: decision.action,
      last_confidence: decision.confidence,
      last_reasoning: decision.reasoning,
    };
  }

  // Skip update if nothing to change
  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from('lead_lifecycle')
    .update(update)
    .eq('id', lifecycleId);

  if (error) {
    console.error(JSON.stringify({
      event: 'agent2_lifecycle_update_error',
      lifecycleId,
      error: error.message,
    }));
  }
}
