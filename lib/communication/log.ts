// ============================================================
// FILE: lib/communication/log.ts
// ============================================================
// Unified logger for ALL WhatsApp/Email/SMS sends.
// Writes to the actual communication_logs schema (boolean
// wa_sent/email_sent/sms_sent + flat recipient_phone/email).
// Extra data (variables, provider message id, related entity)
// is stored inside context_data JSONB so nothing is lost.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export type RecipientType = 'parent' | 'coach' | 'admin' | 'lead' | 'system';
export type TriggeredBy = 'system' | 'coach' | 'admin' | 'cron';

export interface LogCommunicationParams {
  templateCode: string;
  recipientType: RecipientType;
  recipientId?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  waSent?: boolean;
  emailSent?: boolean;
  smsSent?: boolean;
  errorMessage?: string | null;
  triggeredBy?: TriggeredBy;
  triggeredByUserId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
  contextData?: Record<string, unknown> | null;
}

export async function logCommunication(params: LogCommunicationParams): Promise<void> {
  try {
    const anySent = !!(params.waSent || params.emailSent || params.smsSent);
    await supabase.from('communication_logs').insert({
      template_code: params.templateCode,
      recipient_type: params.recipientType,
      recipient_id: params.recipientId ?? null,
      recipient_phone: params.recipientPhone ?? null,
      recipient_email: params.recipientEmail ?? null,
      wa_sent: params.waSent ?? false,
      email_sent: params.emailSent ?? false,
      sms_sent: params.smsSent ?? false,
      error_message: params.errorMessage ?? null,
      sent_at: anySent ? new Date().toISOString() : null,
      triggered_by: params.triggeredBy ?? 'system',
      triggered_by_user_id: params.triggeredByUserId ?? null,
      context_type: params.contextType ?? null,
      context_id: params.contextId ?? null,
      context_data: (params.contextData as never) ?? null,
    });
  } catch (error) {
    console.error('[Comm Log] Insert failed:', error);
  }
}
