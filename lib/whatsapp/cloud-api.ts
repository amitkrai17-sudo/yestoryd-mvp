// ============================================================
// FILE: lib/whatsapp/cloud-api.ts
// ============================================================
// Meta Graph API v21.0 Client for WhatsApp Lead Bot
// Phone Number ID: 1055529114299828 (+91 85912 87997)
//
// ENV: META_WA_PHONE_NUMBER_ID, META_WA_ACCESS_TOKEN
// ============================================================

import { formatForWhatsApp } from '@/lib/utils/phone';
import type { SendResult } from './types';

const GRAPH_API_VERSION = 'v21.0';

function getConfig() {
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  const accessToken = process.env.META_WA_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error('[WA-LeadBot] Missing META_WA_PHONE_NUMBER_ID or META_WA_ACCESS_TOKEN');
  }

  return { phoneNumberId, accessToken };
}

function getMessagesUrl(): string {
  const { phoneNumberId } = getConfig();
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

/**
 * Send a raw payload to the Messages API
 */
async function sendPayload(payload: Record<string, unknown>): Promise<SendResult> {
  const { accessToken } = getConfig();
  const url = getMessagesUrl();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }

    const errorMsg = data.error?.message || data.error?.error_data?.details || 'Unknown error';
    console.error('[WA-LeadBot] Send failed:', errorMsg);
    return { success: false, error: errorMsg };
  } catch (error) {
    console.error('[WA-LeadBot] Send exception:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Send a plain text message
 */
export async function sendText(to: string, body: string): Promise<SendResult> {
  return sendPayload({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatForWhatsApp(to),
    type: 'text',
    text: { body },
  });
}

/**
 * Send a text message with URL preview enabled
 */
export async function sendTextWithPreview(to: string, body: string): Promise<SendResult> {
  return sendPayload({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatForWhatsApp(to),
    type: 'text',
    text: { preview_url: true, body },
  });
}

/**
 * Send an interactive button message (max 3 buttons, 20 char titles)
 */
export async function sendButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  options?: { header?: string; footer?: string }
): Promise<SendResult> {
  if (buttons.length > 3) {
    console.warn('[WA-LeadBot] Max 3 buttons allowed, truncating');
    buttons = buttons.slice(0, 3);
  }

  const interactive: Record<string, unknown> = {
    type: 'button',
    body: { text: body },
    action: {
      buttons: buttons.map(b => ({
        type: 'reply',
        reply: {
          id: b.id,
          title: b.title.slice(0, 20), // Meta enforces 20 char limit
        },
      })),
    },
  };

  if (options?.header) {
    interactive.header = { type: 'text', text: options.header };
  }
  if (options?.footer) {
    interactive.footer = { text: options.footer };
  }

  return sendPayload({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatForWhatsApp(to),
    type: 'interactive',
    interactive,
  });
}

/**
 * Send an interactive list message
 */
export async function sendList(
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  options?: { header?: string; footer?: string }
): Promise<SendResult> {
  const interactive: Record<string, unknown> = {
    type: 'list',
    body: { text: body },
    action: {
      button: buttonText.slice(0, 20),
      sections: sections.map(s => ({
        title: s.title,
        rows: s.rows.map(r => ({
          id: r.id,
          title: r.title.slice(0, 24),
          description: r.description?.slice(0, 72),
        })),
      })),
    },
  };

  if (options?.header) {
    interactive.header = { type: 'text', text: options.header };
  }
  if (options?.footer) {
    interactive.footer = { text: options.footer };
  }

  return sendPayload({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatForWhatsApp(to),
    type: 'interactive',
    interactive,
  });
}

/**
 * Send a template message (pre-approved by Meta)
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  parameters?: Array<{ type: 'text'; text: string }>
): Promise<SendResult> {
  const template: Record<string, unknown> = {
    name: templateName,
    language: { code: languageCode },
  };

  if (parameters?.length) {
    template.components = [
      {
        type: 'body',
        parameters,
      },
    ];
  }

  return sendPayload({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formatForWhatsApp(to),
    type: 'template',
    template,
  });
}

/**
 * Mark a message as read (blue ticks)
 */
export async function markAsRead(messageId: string): Promise<void> {
  try {
    const { accessToken, phoneNumberId } = getConfig();
    await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      }
    );
  } catch (error) {
    console.error('[WA-LeadBot] Failed to mark as read:', error);
  }
}
