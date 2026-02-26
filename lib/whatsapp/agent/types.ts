// ============================================================
// Agent 2: Lead Response Agent — Type Definitions
// ============================================================

import type { Database } from '@/lib/supabase/database.types';

// DB Row types — single source from database.types.ts
export type WaLeadRow = Database['public']['Tables']['wa_leads']['Row'];
export type WaLeadConversationRow = Database['public']['Tables']['wa_lead_conversations']['Row'];
export type WaLeadMessageRow = Database['public']['Tables']['wa_lead_messages']['Row'];
export type LeadLifecycleRow = Database['public']['Tables']['lead_lifecycle']['Row'];
export type LeadLifecycleInsert = Database['public']['Tables']['lead_lifecycle']['Insert'];
export type AgentActionInsert = Database['public']['Tables']['agent_actions']['Insert'];

// ============================================================
// Agent Actions (what the agent can decide to do)
// ============================================================

export type AgentAction =
  | 'GREETING'
  | 'FAQ'
  | 'RESPOND_QUALIFY'
  | 'SEND_ASSESSMENT'
  | 'OFFER_DISCOVERY'
  | 'OFFER_SLOTS'
  | 'BOOK_DISCOVERY'
  | 'RESCHEDULE'
  | 'SHARE_PRICING'
  | 'SEND_TESTIMONIAL'
  | 'ENTER_NURTURE'
  | 'ESCALATE_HOT'
  | 'ESCALATE_OBJECTION'
  | 'CLOSE_COLD';

const VALID_ACTIONS: ReadonlySet<string> = new Set<AgentAction>([
  'GREETING', 'FAQ', 'RESPOND_QUALIFY', 'SEND_ASSESSMENT',
  'OFFER_DISCOVERY', 'OFFER_SLOTS', 'BOOK_DISCOVERY', 'RESCHEDULE',
  'SHARE_PRICING', 'SEND_TESTIMONIAL', 'ENTER_NURTURE', 'ESCALATE_HOT',
  'ESCALATE_OBJECTION', 'CLOSE_COLD',
]);

export function isValidAgentAction(value: string): value is AgentAction {
  return VALID_ACTIONS.has(value);
}

// ============================================================
// Agent Context (everything the brain needs to decide)
// ============================================================

export interface AgentContext {
  waLead: WaLeadRow;
  conversation: WaLeadConversationRow;
  recentMessages: WaLeadMessageRow[];
  lifecycle: LeadLifecycleRow | null;
  assessmentData: AssessmentData | null;
  currentMessage: string;
  messageType: string;
}

export interface AssessmentData {
  id: string;
  name: string | null;
  age: number | null;
  latest_assessment_score: number | null;
  lead_score: number | null;
}

// ============================================================
// Agent Decision (structured output from brain)
// ============================================================

export interface AgentDecision {
  action: AgentAction;
  responseMessage: string;
  responseType: 'text' | 'buttons' | 'list';
  buttons?: Array<{ id: string; title: string }>;
  listItems?: Array<{ id: string; title: string; description?: string }>;
  stateTransition: string | null;
  confidence: number;
  reasoning: string;
  escalate: boolean;
  escalationReason?: string;
  qualificationExtracted: QualificationExtracted;
  scheduleFollowup: FollowupSchedule | null;
}

export interface QualificationExtracted {
  child_name?: string;
  child_age?: number;
  parent_concerns?: string[];
  urgency_signal?: 'high' | 'medium' | 'low';
  budget_signal?: 'ready_to_pay' | 'value_focused' | 'price_sensitive' | 'unknown';
}

export interface FollowupSchedule {
  action: string;
  delayHours: number;
}
