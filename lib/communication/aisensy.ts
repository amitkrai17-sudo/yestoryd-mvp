// lib/communication/aisensy.ts
// AiSensy WhatsApp Business API Integration

interface AiSensyMessageParams {
  to: string;                    // Phone number with country code (e.g., "918976287997")
  templateName: string;          // Template name as registered in AiSensy
  variables: string[];           // Variables to replace in template
  mediaUrl?: string;             // Optional media attachment
  mediaFilename?: string;
}

interface AiSensyResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage(params: AiSensyMessageParams): Promise<AiSensyResponse> {
  const apiKey = process.env.AISENSY_API_KEY;
  const baseUrl = process.env.AISENSY_BASE_URL || 'https://backend.aisensy.com/campaign/t1/api/v2';

  if (!apiKey) {
    console.error('AISENSY_API_KEY not configured');
    return { success: false, error: 'API key not configured' };
  }

  // Format phone number (ensure 91 prefix for India)
  const formattedPhone = formatIndianPhone(params.to);

  try {
    const payload: any = {
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && (data.status === 'success' || data.status === 'submitted')) {
      console.log(`[AiSensy] Success: ${data.messageId || data.id || 'sent'}`);
      return {
        success: true,
        messageId: data.messageId || data.id,
      };
    } else {
      console.error(`[AiSensy] Failed:`, data);
      return {
        success: false,
        error: data.message || data.error || JSON.stringify(data),
      };
    }
  } catch (error) {
    console.error('[AiSensy] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// Format phone number for Indian WhatsApp
function formatIndianPhone(phone: string): string {
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // If 10 digits, add 91 prefix
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  
  // If doesn't start with 91, add it
  if (!cleaned.startsWith('91')) {
    cleaned = '91' + cleaned;
  }
  
  return cleaned;
}

// Utility to check if WhatsApp is configured
export function isWhatsAppConfigured(): boolean {
  return !!process.env.AISENSY_API_KEY;
}
