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
  console.log('[AiSensy] ========== sendWhatsAppMessage START ==========');
  console.log('[AiSensy] Template:', params.templateName);
  console.log('[AiSensy] To:', params.to);
  console.log('[AiSensy] Variables count:', params.variables?.length);

  const apiKey = process.env.AISENSY_API_KEY;
  const baseUrl = process.env.AISENSY_BASE_URL || 'https://backend.aisensy.com/campaign/t1/api/v2';

  console.log('[AiSensy] API Key configured:', apiKey ? `Yes (${apiKey.substring(0, 8)}...)` : 'NO - MISSING!');
  console.log('[AiSensy] Base URL:', baseUrl);

  if (!apiKey) {
    console.error('[AiSensy] API key not configured - ABORTING');
    return { success: false, error: 'API key not configured' };
  }

  // Validate phone
  if (!isValidPhone(params.to)) {
    console.error('[AiSensy] Invalid phone number:', params.to);
    return { success: false, error: 'Invalid phone number' };
  }

  // Format phone for AiSensy (no + sign)
  const formattedPhone = formatForWhatsApp(params.to);
  console.log('[AiSensy] Formatted phone:', formattedPhone);

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

    // Log payload without API key for security
    const logPayload = { ...payload, apiKey: '[REDACTED]' };
    console.log('[AiSensy] Request payload:', JSON.stringify(logPayload));

    console.log('[AiSensy] Sending HTTP request...');
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('[AiSensy] HTTP status:', response.status, response.statusText);

    const data = await response.json();
    console.log('[AiSensy] Full response:', JSON.stringify(data));

    if (response.ok && data.status === 'success') {
      console.log('[AiSensy] SUCCESS - messageId:', data.messageId || data.id || 'N/A');
      console.log('[AiSensy] ========== sendWhatsAppMessage END ==========');
      return { success: true, messageId: data.messageId || data.id };
    } else {
      console.error('[AiSensy] FAILED - Status:', data.status);
      console.error('[AiSensy] FAILED - Message:', data.message);
      console.error('[AiSensy] FAILED - Error:', data.error);
      console.error('[AiSensy] FAILED - Full data:', JSON.stringify(data));
      console.log('[AiSensy] ========== sendWhatsAppMessage END ==========');
      return { success: false, error: data.message || data.error || 'Unknown error' };
    }
  } catch (error) {
    console.error('[AiSensy] EXCEPTION:', error);
    console.error('[AiSensy] Exception message:', error instanceof Error ? error.message : 'Unknown');
    console.error('[AiSensy] Exception stack:', error instanceof Error ? error.stack : 'N/A');
    console.log('[AiSensy] ========== sendWhatsAppMessage END ==========');
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
