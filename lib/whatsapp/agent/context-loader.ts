// ============================================================
// Agent 2: Context Loader
// Parallel-fetches all data the brain needs to make a decision
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type {
  AgentContext,
  WaLeadRow,
  WaLeadConversationRow,
  WaLeadMessageRow,
  LeadLifecycleRow,
  AssessmentData,
} from './types';

type TypedClient = SupabaseClient<Database>;

export async function loadAgentContext(
  supabase: TypedClient,
  phone: string,
  conversationId: string,
  currentMessage: string,
  messageType: string
): Promise<AgentContext | null> {
  // Parallel fetch: lead, conversation, messages
  const [leadResult, conversationResult, messagesResult] = await Promise.all([
    supabase
      .from('wa_leads')
      .select('*')
      .eq('phone_number', phone)
      .single<WaLeadRow>(),
    supabase
      .from('wa_lead_conversations')
      .select('*')
      .eq('id', conversationId)
      .single<WaLeadConversationRow>(),
    supabase
      .from('wa_lead_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10)
      .returns<WaLeadMessageRow[]>(),
  ]);

  const waLead = leadResult.data;
  const conversation = conversationResult.data;
  const recentMessages = messagesResult.data || [];

  if (!waLead || !conversation) {
    console.error(JSON.stringify({
      event: 'agent2_context_load_failed',
      phone,
      conversationId,
      hasLead: !!waLead,
      hasConversation: !!conversation,
    }));
    return null;
  }

  // Fetch lifecycle (may not exist yet) + assessment data (if child linked)
  const [lifecycleResult, assessmentData] = await Promise.all([
    loadOrCreateLifecycle(supabase, waLead),
    waLead.child_id ? loadAssessmentData(supabase, waLead.child_id) : Promise.resolve(null),
  ]);

  return {
    waLead,
    conversation,
    recentMessages,
    lifecycle: lifecycleResult,
    assessmentData,
    currentMessage,
    messageType,
  };
}

// ============================================================
// Load or create lead_lifecycle
// ============================================================

async function loadOrCreateLifecycle(
  supabase: TypedClient,
  waLead: WaLeadRow
): Promise<LeadLifecycleRow | null> {
  // Try to find existing
  const { data: existing } = await supabase
    .from('lead_lifecycle')
    .select('*')
    .eq('wa_lead_id', waLead.id)
    .single<LeadLifecycleRow>();

  if (existing) return existing;

  // Create new lifecycle record
  const { data: created, error } = await supabase
    .from('lead_lifecycle')
    .insert({
      wa_lead_id: waLead.id,
      child_id: waLead.child_id,
      current_state: 'new',
      child_name: waLead.child_name,
      child_age: waLead.child_age,
      lead_source: 'whatsapp',
      ai_lead_score: waLead.lead_score || 0,
    })
    .select()
    .single<LeadLifecycleRow>();

  if (error) {
    // Race condition: another request may have created it
    if (error.code === '23505') {
      const { data: retry } = await supabase
        .from('lead_lifecycle')
        .select('*')
        .eq('wa_lead_id', waLead.id)
        .single<LeadLifecycleRow>();
      return retry;
    }
    console.error(JSON.stringify({
      event: 'agent2_lifecycle_create_error',
      waLeadId: waLead.id,
      error: error.message,
    }));
    return null;
  }

  return created;
}

// ============================================================
// Load assessment data from children table
// ============================================================

async function loadAssessmentData(
  supabase: TypedClient,
  childId: string
): Promise<AssessmentData | null> {
  const { data } = await supabase
    .from('children')
    .select('id, name, age, latest_assessment_score, lead_score')
    .eq('id', childId)
    .single<AssessmentData>();

  return data;
}
