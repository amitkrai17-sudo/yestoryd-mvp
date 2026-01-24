// lib/communication/index.ts
// Central Communication Engine

import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage, isWhatsAppConfigured } from './aisensy';
import { sendEmail, isEmailConfigured } from './sendgrid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Admin phone numbers for alerts (add more as needed)
const ADMIN_PHONES = [
  '918976287997',  // Amit
  // '91XXXXXXXXXX',  // Rucha - add her number
];

const ADMIN_EMAILS = [
  'amitkrai17@gmail.com',
  'rucha.rai@yestoryd.com',
];

export interface SendCommunicationParams {
  templateCode: string;
  recipientType: 'parent' | 'coach' | 'admin';
  recipientId?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
  variables: Record<string, string>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  skipChannels?: ('whatsapp' | 'email' | 'sms')[];
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
          const waResult = await sendWhatsAppToRecipient(template, adminPhone, params.variables);
          results.push({ channel: 'whatsapp', ...waResult });
        }
      }
      for (const adminEmail of ADMIN_EMAILS) {
        if (template.use_email && !params.skipChannels?.includes('email')) {
          const emailResult = await sendEmailToRecipient(template, adminEmail, params.variables);
          results.push({ channel: 'email', ...emailResult });
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
      if (name && !mergedVariables.parent_name && !mergedVariables.coach_name) {
        if (params.recipientType === 'parent') {
          mergedVariables.parent_name = name;
        } else {
          mergedVariables.coach_name = name;
        }
      }

      // 3. Send via enabled channels
      if (template.use_whatsapp && phone && !params.skipChannels?.includes('whatsapp')) {
        const waResult = await sendWhatsAppToRecipient(template, phone, mergedVariables);
        results.push({ channel: 'whatsapp', ...waResult });
      }

      if (template.use_email && email && !params.skipChannels?.includes('email')) {
        const emailResult = await sendEmailToRecipient(template, email, mergedVariables);
        results.push({ channel: 'email', ...emailResult });
      }

      if (template.use_sms && phone && !params.skipChannels?.includes('sms')) {
        // SMS fallback - for now just log, implement later
        console.log(`[Comm] SMS not implemented yet. Would send to ${phone}`);
        results.push({ channel: 'sms', success: false, error: 'SMS not implemented' });
      }
    }

    // 4. Log all communications
    for (const result of results) {
      await logCommunication({
        templateId: template.id,
        templateCode: params.templateCode,
        channel: result.channel,
        recipientType: params.recipientType,
        recipientId: params.recipientId,
        recipientName: name,
        recipientContact: result.channel === 'email' ? email : phone,
        variablesUsed: params.variables,
        status: result.success ? 'sent' : 'failed',
        providerMessageId: result.messageId,
        errorMessage: result.error,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
      });
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
  variables: Record<string, string>
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

  return sendEmail({
    to: email,
    subject,
    htmlBody: body,
    templateId: template.email_sendgrid_template_id,
    dynamicData: variables,
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
    phone: data.phone,
    email: data.email,
    name: data.name,
  };
}

// Log communication to database
async function logCommunication(params: {
  templateId: string;
  templateCode: string;
  channel: string;
  recipientType: string;
  recipientId?: string;
  recipientName?: string;
  recipientContact?: string;
  variablesUsed: Record<string, string>;
  status: string;
  providerMessageId?: string;
  errorMessage?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): Promise<void> {
  try {
    await supabase.from('communication_logs').insert({
      template_id: params.templateId,
      template_code: params.templateCode,
      channel: params.channel,
      recipient_type: params.recipientType,
      recipient_id: params.recipientId,
      recipient_name: params.recipientName,
      recipient_contact: params.recipientContact,
      variables_used: params.variablesUsed,
      status: params.status,
      provider_message_id: params.providerMessageId,
      error_message: params.errorMessage,
      related_entity_type: params.relatedEntityType,
      related_entity_id: params.relatedEntityId,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
      failed_at: params.status === 'failed' ? new Date().toISOString() : null,
    });
  } catch (error) {
    console.error('[Comm] Failed to log communication:', error);
  }
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
        recipient_id: params.recipientId,
        variables: params.variables,
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
