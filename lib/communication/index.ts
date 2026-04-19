// lib/communication/index.ts
// Central Communication Engine

import { sendWhatsAppMessage, isWhatsAppConfigured } from './aisensy';
import { logCommunication, RecipientType, TriggeredBy } from './log';
import { sendEmail, isEmailConfigured } from '@/lib/email/resend-client';
import { loadAuthConfig } from '@/lib/config/loader';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

// Re-export WhatsApp Cloud API (prospect-facing AI assistant)
export { sendWhatsAppCloudMessage, markMessageAsRead, isWhatsAppCloudConfigured } from './whatsapp-cloud';
// Re-export unified logger
export { logCommunication } from './log';
// Re-export unified sendNotification() engine
export { sendNotification, type NotifyResult } from './notify';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

// Admin phone numbers for alerts (add more as needed)
const ADMIN_PHONES = [
  COMPANY_CONFIG.aiSensyWhatsApp,  // Amit (AiSensy outbound)
  // '91XXXXXXXXXX',  // Rucha - add her number
];

// Admin emails loaded from config at runtime

export interface SendCommunicationParams {
  templateCode: string;
  recipientType: 'parent' | 'coach' | 'admin';
  recipientId?: string;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  variables: Record<string, string>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  skipChannels?: ('whatsapp' | 'email' | 'sms')[];
  // Manual trigger metadata (populated by /api/communication/trigger)
  triggeredBy?: 'system' | 'coach' | 'admin';
  triggeredByUserId?: string;
  contextType?: string;
  contextId?: string;
}

export interface SendCommunicationResult {
  success: boolean;
  results: {
    channel: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }[];
  logId?: string;
}

export async function sendCommunication(params: SendCommunicationParams): Promise<SendCommunicationResult> {
  const results: SendCommunicationResult['results'] = [];

  try {
    // 1. Fetch template from database
    const { data: template, error: templateError } = await supabase
      .from('communication_templates')
      .select('*')
      .eq('template_code', params.templateCode)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error(`[Comm] Template not found: ${params.templateCode}`);
      return {
        success: false,
        results: [{ channel: 'all', success: false, error: 'Template not found or inactive' }],
      };
    }

    // 2. Get recipient contact info
    let phone = params.recipientPhone;
    let email = params.recipientEmail;
    let name = params.recipientName;

    // For admin alerts, use admin contacts
    if (params.recipientType === 'admin') {
      // Send to all admins
      for (const adminPhone of ADMIN_PHONES) {
        if (template.use_whatsapp && !params.skipChannels?.includes('whatsapp')) {
          const waResult = await sendWhatsAppToRecipient(template, adminPhone, params.variables, {
            templateCode: params.templateCode,
            recipientType: 'admin',
            triggeredBy: (params.triggeredBy as TriggeredBy) ?? 'system',
            triggeredByUserId: params.triggeredByUserId ?? null,
            contextType: params.contextType ?? params.relatedEntityType ?? null,
            contextId: params.contextId ?? params.relatedEntityId ?? null,
          });
          results.push({ channel: 'whatsapp', ...waResult });
        }
      }
      const authConfig = await loadAuthConfig();
      for (const adminEmail of authConfig.adminEmails) {
        if (template.use_email && !params.skipChannels?.includes('email')) {
          const emailResult = await sendEmailToRecipient(template, adminEmail, params.variables);
          results.push({ channel: 'email', ...emailResult });
          await logCommunication({
            templateCode: params.templateCode,
            recipientType: 'admin',
            recipientEmail: adminEmail,
            emailSent: emailResult.success,
            errorMessage: emailResult.error ?? null,
            triggeredBy: (params.triggeredBy as TriggeredBy) ?? 'system',
            triggeredByUserId: params.triggeredByUserId ?? null,
            contextType: params.contextType ?? params.relatedEntityType ?? null,
            contextId: params.contextId ?? params.relatedEntityId ?? null,
            contextData: { variables: params.variables, provider_message_id: emailResult.messageId ?? null },
          });
        }
      }
    } else {
      // For parent/coach, fetch contact from database if not provided
      if ((!phone || !email) && params.recipientId) {
        const contactInfo = await getRecipientContact(params.recipientType, params.recipientId);
        phone = phone || contactInfo.phone;
        email = email || contactInfo.email;
        name = name || contactInfo.name;
      }

      // Merge name into variables if available
      const mergedVariables = { ...params.variables };
      if (params.recipientType === 'parent') {
        if (!mergedVariables.parent_name) {
          mergedVariables.parent_name = name?.split(' ')[0] || 'there';
        }
      } else {
        if (!mergedVariables.coach_name) {
          mergedVariables.coach_name = name || '';
        }
      }

      // 2b. Check parent notification preferences
      let prefs: Record<string, any> = {};
      if (params.recipientType === 'parent' && params.recipientId) {
        const { data: parentPrefs } = await supabase
          .from('parents')
          .select('notification_preferences')
          .eq('id', params.recipientId)
          .single();
        prefs = (parentPrefs?.notification_preferences as Record<string, any>) || {};
      }

      // Determine if this category is allowed by preferences
      const category = (template as any).category || '';
      const categoryAllowed =
        (category === 'session_reminder' ? prefs.session_reminders !== false : true) &&
        (category === 'progress' ? prefs.progress_updates !== false : true) &&
        (category === 'promotional' ? prefs.promotional !== false : true);

      // 3. Send via enabled channels (respecting preferences)
      const whatsappAllowed = prefs.whatsapp !== false && categoryAllowed;
      const emailAllowed = prefs.email !== false && categoryAllowed;

      const waMeta = {
        templateCode: params.templateCode,
        recipientType: params.recipientType as RecipientType,
        recipientId: params.recipientId ?? null,
        recipientEmail: email ?? null,
        triggeredBy: (params.triggeredBy as TriggeredBy) ?? 'system' as TriggeredBy,
        triggeredByUserId: params.triggeredByUserId ?? null,
        contextType: params.contextType ?? params.relatedEntityType ?? null,
        contextId: params.contextId ?? params.relatedEntityId ?? null,
      };

      if (template.use_whatsapp && phone && !params.skipChannels?.includes('whatsapp') && whatsappAllowed) {
        const waResult = await sendWhatsAppToRecipient(template, phone, mergedVariables, waMeta);
        results.push({ channel: 'whatsapp', ...waResult });
      }

      if (template.use_email && email && !params.skipChannels?.includes('email') && emailAllowed) {
        const emailResult = await sendEmailToRecipient(template, email, mergedVariables);
        results.push({ channel: 'email', ...emailResult });
        await logCommunication({
          templateCode: params.templateCode,
          recipientType: params.recipientType as RecipientType,
          recipientId: params.recipientId ?? null,
          recipientEmail: email,
          recipientPhone: phone ?? null,
          emailSent: emailResult.success,
          errorMessage: emailResult.error ?? null,
          triggeredBy: (params.triggeredBy as TriggeredBy) ?? 'system',
          triggeredByUserId: params.triggeredByUserId ?? null,
          contextType: params.contextType ?? params.relatedEntityType ?? null,
          contextId: params.contextId ?? params.relatedEntityId ?? null,
          contextData: { variables: params.variables, provider_message_id: emailResult.messageId ?? null },
        });
      }

      if (template.use_sms && phone && !params.skipChannels?.includes('sms')) {
        // SMS fallback - for now just log, implement later
        console.log(`[Comm] SMS not implemented yet. Would send to ${phone}`);
        results.push({ channel: 'sms', success: false, error: 'SMS not implemented' });
      }
    }

    const overallSuccess = results.some(r => r.success);
    return { success: overallSuccess, results };

  } catch (error) {
    console.error('[Comm] Unexpected error:', error);
    return {
      success: false,
      results: [{ channel: 'all', success: false, error: error instanceof Error ? error.message : 'Unknown error' }],
    };
  }
}

// Send WhatsApp using template
async function sendWhatsAppToRecipient(
  template: any,
  phone: string,
  variables: Record<string, string>,
  meta: {
    templateCode: string;
    recipientType: RecipientType;
    recipientId?: string | null;
    recipientEmail?: string | null;
    triggeredBy: TriggeredBy;
    triggeredByUserId?: string | null;
    contextType?: string | null;
    contextId?: string | null;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isWhatsAppConfigured()) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  // Build variables array in order specified by template
  const variableArray = (template.wa_variables || []).map((key: string) => variables[key] || '');

  return sendWhatsAppMessage({
    to: phone,
    templateName: template.wa_template_name,
    variables: variableArray,
    meta,
  });
}

// Send Email using template
async function sendEmailToRecipient(
  template: any,
  email: string,
  variables: Record<string, string>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!isEmailConfigured()) {
    return { success: false, error: 'Email not configured' };
  }

  // Replace variables in subject and body
  let subject = template.email_subject || '';
  let body = template.email_body_html || '';

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    body = body.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  // Clean up any remaining unresolved {{variables}} so they never show as raw text
  subject = subject.replace(/\{\{[a-zA-Z_]+\}\}/g, '');
  body = body.replace(/\{\{[a-zA-Z_]+\}\}/g, '');

  return sendEmail({
    to: email,
    subject,
    html: body,
  });
}

// Get contact info from database
async function getRecipientContact(
  type: 'parent' | 'coach',
  id: string
): Promise<{ phone?: string; email?: string; name?: string }> {
  const table = type === 'parent' ? 'parents' : 'coaches';
  
  const { data, error } = await supabase
    .from(table)
    .select('phone, email, name')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error(`[Comm] Could not fetch ${type} contact:`, error);
    return {};
  }

  return {
    phone: data.phone ?? undefined,
    email: data.email,
    name: data.name ?? undefined,
  };
}

// Schedule a message for later
export async function scheduleCommunication(params: SendCommunicationParams & {
  scheduledFor: Date;
}): Promise<{ success: boolean; queueId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('communication_queue')
      .insert({
        template_code: params.templateCode,
        recipient_type: params.recipientType,
        recipient_id: params.recipientId!,
        variables: params.variables as any,
        related_entity_type: params.relatedEntityType,
        related_entity_id: params.relatedEntityId,
        scheduled_for: params.scheduledFor.toISOString(),
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, queueId: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper to send admin alert quickly
export async function sendAdminAlert(
  templateCode: string,
  variables: Record<string, string>,
  relatedEntityType?: string,
  relatedEntityId?: string
): Promise<SendCommunicationResult> {
  return sendCommunication({
    templateCode,
    recipientType: 'admin',
    variables,
    relatedEntityType,
    relatedEntityId,
  });
}
