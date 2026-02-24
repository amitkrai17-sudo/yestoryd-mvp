// lib/communication/sendgrid.ts
// Email Integration — now delegates to Resend via lib/email/resend-client.ts
// Keeps same interface so lib/communication/index.ts callers don't break

import {
  sendEmail as resendSendEmail,
  isEmailConfigured as resendConfigured,
} from '@/lib/email/resend-client';

interface SendGridMessageParams {
  to: string;                    // Email address
  subject: string;
  htmlBody: string;
  templateId?: string;           // Legacy SendGrid dynamic template ID (ignored)
  dynamicData?: Record<string, any>;
}

interface SendGridResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(params: SendGridMessageParams): Promise<SendGridResponse> {
  // templateId is ignored — Resend doesn't use SendGrid dynamic templates.
  // The caller (lib/communication/index.ts) already renders subject + body
  // from the communication_templates table before reaching here.
  return resendSendEmail({
    to: params.to,
    subject: params.subject,
    html: params.htmlBody,
  });
}

// Utility to check if email is configured
export function isEmailConfigured(): boolean {
  return resendConfigured();
}
