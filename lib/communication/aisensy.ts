// ============================================================
// FILE: lib/communication/aisensy.ts
// ============================================================
// AiSensy WhatsApp Business API Integration.
// Every send is logged to communication_logs via logCommunication().
// Optional `meta` enriches the log row with recipient/context info;
// if omitted, the send is still logged with recipient_type='system'.
// ============================================================

import { formatForWhatsApp, isValidPhone } from '@/lib/utils/phone';
import { logCommunication, RecipientType, TriggeredBy } from './log';

export interface AiSensyButton {
  type: string;
  sub_type?: string;
  index?: number;
  url?: string;
  parameters?: Array<{ type: string; text: string }>;
}

export interface AiSensySendMeta {
  templateCode?: string;
  recipientType?: RecipientType;
  recipientId?: string | null;
  recipientEmail?: string | null;
  triggeredBy?: TriggeredBy;
  triggeredByUserId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
  contextData?: Record<string, unknown> | null;
}

interface AiSensyMessageParams {
  to: string;
  templateName: string;
  variables: string[];
  mediaUrl?: string;
  mediaFilename?: string;
  buttons?: AiSensyButton[];
  source?: string;
  meta?: AiSensySendMeta;
}

interface AiSensyResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * @deprecated Prefer sendNotification() from lib/communication/notify.ts.
 *   Direct callers of sendWhatsAppMessage will be migrated in a follow-up pass.
 * Send WhatsApp message via AiSensy. Always logs to communication_logs.
 */
export async function sendWhatsAppMessage(params: AiSensyMessageParams): Promise<AiSensyResponse> {
  const apiKey = process.env.AISENSY_API_KEY;
  const baseUrl = process.env.AISENSY_BASE_URL || 'https://backend.aisensy.com/campaign/t1/api/v2';

  const logBase = {
    templateCode: params.meta?.templateCode ?? `direct:${params.templateName}`,
    recipientType: params.meta?.recipientType ?? ('system' as RecipientType),
    recipientId: params.meta?.recipientId ?? null,
    recipientPhone: params.to,
    recipientEmail: params.meta?.recipientEmail ?? null,
    triggeredBy: params.meta?.triggeredBy ?? ('system' as TriggeredBy),
    triggeredByUserId: params.meta?.triggeredByUserId ?? null,
    contextType: params.meta?.contextType ?? null,
    contextId: params.meta?.contextId ?? null,
  };

  const buildContextData = (extra: Record<string, unknown>) => ({
    variables: params.variables,
    ...(params.meta?.contextData ?? {}),
    ...extra,
  });

  if (!apiKey) {
    console.error('[AiSensy] API key not configured');
    await logCommunication({
      ...logBase,
      waSent: false,
      errorMessage: 'API key not configured',
      contextData: buildContextData({}),
    });
    return { success: false, error: 'API key not configured' };
  }

  if (!isValidPhone(params.to)) {
    console.error('[AiSensy] Invalid phone number:', params.to);
    await logCommunication({
      ...logBase,
      waSent: false,
      errorMessage: `Invalid phone number: ${params.to}`,
      contextData: buildContextData({}),
    });
    return { success: false, error: 'Invalid phone number' };
  }

  const formattedPhone = formatForWhatsApp(params.to);
  logBase.recipientPhone = formattedPhone;

  try {
    const payload: Record<string, unknown> = {
      apiKey,
      campaignName: params.templateName,
      destination: formattedPhone,
      userName: 'Yestoryd',
      templateParams: params.variables,
    };

    if (params.mediaUrl) {
      payload.media = { url: params.mediaUrl, filename: params.mediaFilename || 'document' };
    }
    if (params.buttons && params.buttons.length > 0) payload.buttons = params.buttons;
    if (params.source) payload.source = params.source;

    console.log('[AiSensy] Sending:', params.templateName, '→', formattedPhone);

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    const isSuccess = response.ok && (
      data.status === 'success' ||
      data.status === 'submitted' ||
      data.success === true ||
      data.success === 'true'
    );

    if (isSuccess) {
      const messageId = data.messageId || data.id;
      console.log('[AiSensy] SUCCESS:', params.templateName, messageId || '');
      await logCommunication({
        ...logBase,
        waSent: true,
        contextData: buildContextData({ provider_message_id: messageId ?? null, http_status: response.status }),
      });
      return { success: true, messageId };
    }

    const errorMsg = data.message || data.error || `HTTP ${response.status}: ${data.status || 'unknown'}`;
    console.error('[AiSensy] FAILED:', params.templateName, errorMsg);
    await logCommunication({
      ...logBase,
      waSent: false,
      errorMessage: errorMsg,
      contextData: buildContextData({ http_status: response.status, response_body: data }),
    });
    return { success: false, error: errorMsg };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Network error';
    console.error('[AiSensy] EXCEPTION:', errorMsg);
    await logCommunication({
      ...logBase,
      waSent: false,
      errorMessage: errorMsg,
      contextData: buildContextData({ exception: true }),
    });
    return { success: false, error: errorMsg };
  }
}

export function isWhatsAppConfigured(): boolean {
  return !!process.env.AISENSY_API_KEY;
}
