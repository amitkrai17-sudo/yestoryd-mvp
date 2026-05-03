// ============================================================
// FILE: lib/communication/aisensy.ts
// ============================================================
// AiSensy WhatsApp Business API Integration.
// Every send is logged to communication_logs via logCommunication().
// Optional `meta` enriches the log row with recipient/context info;
// if omitted, the send is still logged with recipient_type='system'.
//
// Input/return shapes live in ./types and are shared with the Lead Bot
// adapter (Phase B). AiSensy silently ignores the languageCode and
// header fields on WaSendParams — those are Meta Cloud concerns.
// ============================================================

import { formatForWhatsApp, isValidPhone } from '@/lib/utils/phone';
import { logCommunication, RecipientType, TriggeredBy } from './log';
import type { WaSendParams, WaSendResult, TemplateButtons } from './types';

/**
 * @deprecated Prefer sendNotification() from lib/communication/notify.ts.
 *   Direct callers of sendWhatsAppMessage will be migrated in a follow-up pass.
 * Send WhatsApp message via AiSensy. Always logs to communication_logs.
 *
 * Fields on WaSendParams that AiSensy ignores: languageCode (handled
 * server-side by AiSensy), header (use the flat mediaUrl/mediaFilename
 * pair instead).
 */
export async function sendWhatsAppMessage(params: WaSendParams): Promise<WaSendResult> {
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
    // ────────────────────────────────────────────────────────────
    // AUTHENTICATION-CATEGORY BRANCH (Block 2.6a)
    // ────────────────────────────────────────────────────────────
    // Meta Authentication templates (e.g. parent_otp_v3) require a URL
    // button with the OTP duplicated into both templateParams and
    // buttons[0].parameters. AiSensy's API rejects auth templates without
    // this buttons[] structure (verified 2026-05-03 smoke test:
    //   "buttons: Button at index 0 of type Url requires a parameter").
    //
    // Trigger: params.templateCategory === 'authentication'.
    // Source: communication_templates.wa_template_category, plumbed via
    // notify.ts. Adapter does not query DB.
    //
    // OTP resolution priority:
    //   1. params.templateButtons.otp (if union present, category matches)
    //   2. params.variables[0] (backward-compat fallback)
    //   3. throw — auth contract violation
    //
    // Defensive rules:
    //   - variables.length must be exactly 1 (mirrors leadbot.ts auth branch)
    //   - caller-supplied params.buttons is ignored with a warn
    //   - templateButtons.category mismatch with templateCategory: warn
    //
    // Wire shape mirrors the production bypass at
    // app/api/auth/send-otp/route.ts:85-92 (index is number 0, not string).
    if (params.templateCategory === 'authentication') {
      if (params.variables.length !== 1) {
        throw new Error(
          `[AiSensy] Authentication template '${params.templateName}' requires exactly 1 variable (OTP), got ${params.variables.length}`,
        );
      }

      const tb = params.templateButtons;
      if (tb && tb.category !== 'authentication') {
        console.warn(
          '[AiSensy] auth_template_warning: templateButtons.category mismatch with templateCategory',
          params.templateName,
          tb.category,
        );
      }

      const otp =
        tb && tb.category === 'authentication'
          ? tb.otp
          : String(params.variables[0] ?? '');

      if (!otp) {
        throw new Error(
          `[AiSensy] Authentication template '${params.templateName}' resolved empty OTP from templateButtons and variables`,
        );
      }

      if (params.buttons && params.buttons.length > 0) {
        console.warn(
          '[AiSensy] auth_template_warning: caller-supplied buttons ignored for authentication template',
          params.templateName,
        );
      }

      payload.buttons = [
        {
          type: 'button',
          sub_type: 'url',
          index: 0,
          parameters: [{ type: 'text', text: otp }],
        },
      ];
    } else if (params.buttons && params.buttons.length > 0) {
      payload.buttons = params.buttons;
    }
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
