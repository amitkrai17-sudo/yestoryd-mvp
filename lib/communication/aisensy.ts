// ============================================================
// FILE: lib/communication/aisensy.ts
// ============================================================
// AiSensy WhatsApp Business API Integration
// UPDATED: Uses central phone utility for international support
// ============================================================

import { formatForWhatsApp, isValidPhone } from '@/lib/utils/phone';

interface AiSensyMessageParams {
  to: string;                    // Phone in any format
  templateName: string;          // Template name in AiSensy
  variables: string[];           // Variables to replace
  mediaUrl?: string;             // Optional media
  mediaFilename?: string;
}

interface AiSensyResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send WhatsApp message via AiSensy
 */
export async function sendWhatsAppMessage(params: AiSensyMessageParams): Promise<AiSensyResponse> {
  const apiKey = process.env.AISENSY_API_KEY;
  const baseUrl = process.env.AISENSY_BASE_URL || 'https://backend.aisensy.com/campaign/t1/api/v2';

  if (!apiKey) {
    console.error('[AiSensy] API key not configured');
    return { success: false, error: 'API key not configured' };
  }

  // Validate phone
  if (!isValidPhone(params.to)) {
    console.error('[AiSensy] Invalid phone number:', params.to);
    return { success: false, error: 'Invalid phone number' };
  }

  // Format phone for AiSensy (no + sign)
  const formattedPhone = formatForWhatsApp(params.to);

  try {
    const payload: Record<string, unknown> = {
      apiKey,
      campaignName: params.templateName,
      destination: formattedPhone,
      userName: 'Yestoryd',
      templateParams: params.variables,
    };

    // Add media if provided
    if (params.mediaUrl) {
      payload.media = {
        url: params.mediaUrl,
        filename: params.mediaFilename || 'document',
      };
    }

    console.log(`[AiSensy] Sending to ${formattedPhone}, template: ${params.templateName}`);

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      console.log(`[AiSensy] Success: ${data.messageId || 'sent'}`);
      return { success: true, messageId: data.messageId || data.id };
    } else {
      console.error(`[AiSensy] Failed:`, data);
      return { success: false, error: data.message || data.error || 'Unknown error' };
    }
  } catch (error) {
    console.error('[AiSensy] Exception:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

/**
 * Check if WhatsApp is configured
 */
export function isWhatsAppConfigured(): boolean {
  return !!process.env.AISENSY_API_KEY;
}

/**
 * Send OTP via WhatsApp
 */
export async function sendWhatsAppOTP(phone: string, otp: string): Promise<AiSensyResponse> {
  return sendWhatsAppMessage({
    to: phone,
    templateName: 'otp_verification', // Your AiSensy template name
    variables: [otp],
  });
}
