// ============================================================
// FILE: lib/communication/whatsapp-cloud.ts
// ============================================================
// Meta WhatsApp Cloud API Integration
// Used for prospect-facing AI assistant on NEW number
// (Existing AiSensy integration on 8976287997 is untouched)
// ============================================================

import { formatForWhatsApp, isValidPhone } from '@/lib/utils/phone';

interface CloudMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a text message via WhatsApp Cloud API
 */
export async function sendWhatsAppCloudMessage(
  to: string,
  message: string
): Promise<CloudMessageResponse> {
  console.log('[WA-Cloud] ========== sendWhatsAppCloudMessage START ==========');
  console.log('[WA-Cloud] To:', to);
  console.log('[WA-Cloud] Message length:', message.length);

  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_ID;

  if (!token || !phoneNumberId) {
    console.error('[WA-Cloud] Missing WHATSAPP_CLOUD_TOKEN or WHATSAPP_CLOUD_PHONE_ID');
    return { success: false, error: 'WhatsApp Cloud API not configured' };
  }

  // Validate phone
  if (!isValidPhone(to)) {
    console.error('[WA-Cloud] Invalid phone number:', to);
    return { success: false, error: 'Invalid phone number' };
  }

  const formattedPhone = formatForWhatsApp(to);
  console.log('[WA-Cloud] Formatted phone:', formattedPhone);

  try {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'text',
      text: { body: message },
    };

    console.log('[WA-Cloud] Sending to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[WA-Cloud] HTTP status:', response.status, response.statusText);

    const data = await response.json();
    console.log('[WA-Cloud] Response:', JSON.stringify(data));

    if (response.ok && data.messages?.[0]?.id) {
      const messageId = data.messages[0].id;
      console.log('[WA-Cloud] SUCCESS - messageId:', messageId);
      console.log('[WA-Cloud] ========== sendWhatsAppCloudMessage END ==========');
      return { success: true, messageId };
    } else {
      const errorMsg = data.error?.message || data.error?.error_data?.details || 'Unknown error';
      console.error('[WA-Cloud] FAILED:', errorMsg);
      console.log('[WA-Cloud] ========== sendWhatsAppCloudMessage END ==========');
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error('[WA-Cloud] EXCEPTION:', error);
    console.log('[WA-Cloud] ========== sendWhatsAppCloudMessage END ==========');
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

/**
 * Mark a message as read (blue ticks)
 */
export async function markMessageAsRead(messageId: string): Promise<void> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_ID;

  if (!token || !phoneNumberId) return;

  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
  } catch (error) {
    console.error('[WA-Cloud] Failed to mark as read:', error);
  }
}

/**
 * Check if WhatsApp Cloud API is configured
 */
export function isWhatsAppCloudConfigured(): boolean {
  return !!(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_CLOUD_PHONE_ID);
}
