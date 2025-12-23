// lib/communication/sendgrid.ts
// SendGrid Email Integration

interface SendGridMessageParams {
  to: string;                    // Email address
  subject: string;
  htmlBody: string;
  templateId?: string;           // SendGrid dynamic template ID
  dynamicData?: Record<string, any>;
}

interface SendGridResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(params: SendGridMessageParams): Promise<SendGridResponse> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const senderEmail = process.env.SENDGRID_FROM_EMAIL || 'engage@yestoryd.com';
  const senderName = process.env.SENDGRID_FROM_NAME || 'Yestoryd';

  if (!apiKey) {
    console.error('SENDGRID_API_KEY not configured');
    return { success: false, error: 'API key not configured' };
  }

  try {
    let payload: any = {
      personalizations: [
        {
          to: [{ email: params.to }],
        },
      ],
      from: {
        email: senderEmail,
        name: senderName,
      },
    };

    // Use dynamic template if provided
    if (params.templateId) {
      payload.template_id = params.templateId;
      if (params.dynamicData) {
        payload.personalizations[0].dynamic_template_data = params.dynamicData;
      }
    } else {
      // Use inline content
      payload.subject = params.subject;
      payload.content = [
        {
          type: 'text/html',
          value: params.htmlBody,
        },
      ];
    }

    console.log(`[SendGrid] Sending to ${params.to}, subject: ${params.subject || 'template'}`);

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok || response.status === 202) {
      const messageId = response.headers.get('x-message-id') || 'sent';
      console.log(`[SendGrid] Success: ${messageId}`);
      return {
        success: true,
        messageId,
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[SendGrid] Failed:`, errorData);
      return {
        success: false,
        error: JSON.stringify(errorData) || `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    console.error('[SendGrid] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// Utility to check if email is configured
export function isEmailConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY;
}
