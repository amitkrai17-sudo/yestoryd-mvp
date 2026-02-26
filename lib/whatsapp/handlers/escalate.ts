// ============================================================
// Handler: ESCALATE - Human handoff
// Sets is_bot_active=false, notifies admin via WhatsApp + in-app
// ============================================================

import { sendText } from '@/lib/whatsapp/cloud-api';
import { formatForWhatsApp } from '@/lib/utils/phone';
import { loadAuthConfig } from '@/lib/config/loader';
import { createAdminClient } from '@/lib/supabase/admin';
const getSupabase = createAdminClient;

// TODO: Move to site_settings or a dedicated admin config table
const ADMIN_PHONE = process.env.ADMIN_WHATSAPP_PHONE || '+919687606177';

export interface EscalateResult {
  response: string;
  nextState: 'ESCALATED';
}

export async function handleEscalate(
  phone: string,
  conversationId: string,
  collectedData: Record<string, unknown>,
  leadScore: number,
  lastUserMessage?: string
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

  // 4. Send admin notifications (fire-and-forget, never blocks escalation)
  notifyAdmin(phone, conversationId, collectedData, leadScore, lastUserMessage).catch(err => {
    console.error(JSON.stringify({
      event: 'wa_leadbot_escalation_notify_error',
      conversationId,
      error: err instanceof Error ? err.message : 'Unknown error',
    }));
  });

  return {
    response: body,
    nextState: 'ESCALATED',
  };
}

// ============================================================
// Admin notification — WhatsApp + in-app
// ============================================================

async function notifyAdmin(
  phone: string,
  conversationId: string,
  collectedData: Record<string, unknown>,
  leadScore: number,
  lastUserMessage?: string
): Promise<void> {
  const supabase = getSupabase();

  // --- Get message count for context ---
  let messageCount = 0;
  try {
    const { count } = await supabase
      .from('wa_lead_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);
    messageCount = count || 0;
  } catch {
    // non-fatal
  }

  const parentName = (collectedData.contact_name || collectedData.parent_name || 'Unknown') as string;
  const childName = (collectedData.child_name || 'Not collected') as string;
  const childAge = collectedData.child_age ?? 'N/A';
  const concerns = (collectedData.reading_concerns || 'Not shared') as string;
  const waLink = `https://wa.me/${formatForWhatsApp(phone)}`;

  // --- a) WhatsApp alert to admin ---
  try {
    const lines = [
      `🚨 LEAD ESCALATION`,
      ``,
      `Parent: ${parentName} (${phone})`,
      `Child: ${childName}, Age ${childAge}`,
      `Concern: ${concerns}`,
      `Score: ${leadScore}/100`,
      `Messages: ${messageCount}`,
    ];

    if (lastUserMessage) {
      const truncated = lastUserMessage.length > 120
        ? lastUserMessage.slice(0, 120) + '…'
        : lastUserMessage;
      lines.push(``, `Last message: "${truncated}"`);
    }

    lines.push(``, `Reply on: ${waLink}`);

    const adminMessage = lines.join('\n');
    const result = await sendText(ADMIN_PHONE, adminMessage);

    console.log(JSON.stringify({
      event: 'wa_leadbot_escalation_wa_notify',
      conversationId,
      success: result.success,
      error: result.error,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      event: 'wa_leadbot_escalation_wa_notify_error',
      conversationId,
      error: err instanceof Error ? err.message : 'Unknown error',
    }));
  }

  // --- b) In-app notification for admin users ---
  try {
    const authConfig = await loadAuthConfig();
    const adminEmails = authConfig.adminEmails;

    if (adminEmails.length === 0) {
      console.log(JSON.stringify({
        event: 'wa_leadbot_escalation_in_app_skip',
        conversationId,
        reason: 'no_admin_emails_configured',
      }));
      return;
    }

    // Look up auth user IDs by email
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 100 });
    const adminUsers = (authData?.users || []).filter(u =>
      u.email && adminEmails.includes(u.email.toLowerCase())
    );

    if (adminUsers.length === 0) {
      console.log(JSON.stringify({
        event: 'wa_leadbot_escalation_in_app_skip',
        conversationId,
        reason: 'no_admin_auth_users_found',
      }));
      return;
    }

    const notifications = adminUsers.map(admin => ({
      user_id: admin.id,
      user_type: 'admin',
      title: `🚨 Lead escalation — ${parentName}`,
      body: `${childName} (age ${childAge}) • Score ${leadScore}/100 • ${messageCount} messages. Parent requested human help.`,
      notification_type: 'escalation',
      action_url: waLink,
      metadata: {
        conversation_id: conversationId,
        phone,
        lead_score: leadScore,
        child_name: childName,
        parent_name: parentName,
      },
      is_read: false,
      is_dismissed: false,
    }));

    const { error: insertError } = await supabase
      .from('in_app_notifications')
      .insert(notifications);

    console.log(JSON.stringify({
      event: 'wa_leadbot_escalation_in_app_notify',
      conversationId,
      adminCount: adminUsers.length,
      success: !insertError,
      error: insertError?.message,
    }));
  } catch (err) {
    console.error(JSON.stringify({
      event: 'wa_leadbot_escalation_in_app_notify_error',
      conversationId,
      error: err instanceof Error ? err.message : 'Unknown error',
    }));
  }
}
