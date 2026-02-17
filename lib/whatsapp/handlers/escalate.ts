// ============================================================
// Handler: ESCALATE - Human handoff
// Sets is_bot_active=false, notifies admin
// ============================================================

import { sendText } from '@/lib/whatsapp/cloud-api';
import { createAdminClient } from '@/lib/supabase/admin';
const getSupabase = createAdminClient;

export interface EscalateResult {
  response: string;
  nextState: 'ESCALATED';
}

export async function handleEscalate(
  phone: string,
  conversationId: string,
  collectedData: Record<string, unknown>,
  leadScore: number
): Promise<EscalateResult> {
  const supabase = getSupabase();

  // 1. Deactivate bot for this conversation
  await supabase
    .from('wa_lead_conversations')
    .update({
      is_bot_active: false,
      current_state: 'ESCALATED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  // 2. Send user confirmation
  const body = `Connecting you with a Yestoryd reading expert! They'll respond shortly 🙏\n\nIn the meantime, feel free to share any details about your child.`;
  await sendText(phone, body);

  // 3. Log escalation with lead summary for admin
  const summary = {
    phone,
    conversationId,
    child_name: collectedData.child_name || 'Not collected',
    child_age: collectedData.child_age || 'Not collected',
    reading_concerns: collectedData.reading_concerns || 'Not collected',
    lead_score: leadScore,
    escalated_at: new Date().toISOString(),
  };
  console.log(JSON.stringify({
    event: 'wa_leadbot_escalation',
    ...summary,
  }));

  return {
    response: body,
    nextState: 'ESCALATED',
  };
}
