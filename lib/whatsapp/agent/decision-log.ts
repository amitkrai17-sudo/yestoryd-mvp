// ============================================================
// Agent 2: Decision Logger
// Writes to agent_actions table — fire-and-forget
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { AgentDecision, AgentContext } from './types';

type TypedClient = SupabaseClient<Database>;

export async function logDecision(
  supabase: TypedClient,
  decision: AgentDecision,
  context: AgentContext,
  executionMs: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('agent_actions')
      .insert({
        agent_id: 'agent_2_lead_response',
        action_type: decision.action,
        lead_lifecycle_id: context.lifecycle?.id || null,
        wa_lead_id: context.waLead.id,
        context_json: {
          message: context.currentMessage,
          state: context.conversation.current_state,
          lifecycle_state: context.lifecycle?.current_state || null,
          message_count: context.recentMessages.length,
          message_type: context.messageType,
        },
        decision: decision.action,
        reasoning: decision.reasoning,
        confidence_score: decision.confidence,
        outcome: 'pending',
        escalated_to_human: decision.escalate,
        escalation_reason: decision.escalationReason || null,
        execution_ms: executionMs,
      });

    if (error) {
      console.error(JSON.stringify({
        event: 'agent2_decision_log_error',
        error: error.message,
        waLeadId: context.waLead.id,
      }));
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: 'agent2_decision_log_exception',
      error: err instanceof Error ? err.message : 'Unknown error',
    }));
  }
}
