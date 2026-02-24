// lib/email/resend-client.ts
// Central email sending utility using Resend SDK
// Replaces all SendGrid usage across the codebase

import { Resend } from 'resend';

// Lazy-init singleton
let resendInstance: Resend | null = null;
function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: { email: string; name?: string };
  replyTo?: string | { email: string; name?: string };
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.error('[Email] RESEND_API_KEY not configured');
    return { success: false, error: 'API key not configured' };
  }

  try {
    const fromEmail = params.from?.email || 'engage@yestoryd.com';
    const fromName = params.from?.name || 'Yestoryd';
    const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

    console.log(`[Email] Sending to ${toAddresses.join(', ')}, subject: ${params.subject}`);

    const { data, error } = await getResend().emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: toAddresses,
      subject: params.subject,
      html: params.html,
      ...(params.text && { text: params.text }),
      ...(params.replyTo && {
        replyTo: typeof params.replyTo === 'string'
          ? params.replyTo
          : params.replyTo.email,
      }),
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Success: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[Email] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
