// ============================================================
// FILE: app/api/admin/coach-applications/send-confirmation/route.ts
// ============================================================
// HARDENED VERSION - Send Coach Application Confirmation Emails
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ⚠️ CRITICAL FIX: Original had NO AUTHENTICATION!
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email/resend-client';
import { loadAuthConfig, loadEmailConfig } from '@/lib/config/loader';

export const dynamic = 'force-dynamic';
const WHATSAPP_NUMBER = '+91 89762 87997';

// --- VALIDATION SCHEMA ---
const sendConfirmationSchema = z.object({
  applicantEmail: z.string().email('Invalid email'),
  applicantName: z.string().min(1).max(100),
  applicantPhone: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  applicationId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const [auth, authConfig, emailConfig] = await Promise.all([requireAdmin(), loadAuthConfig(), loadEmailConfig()]);
    const FROM_EMAIL = emailConfig.fromEmail;
    const FROM_NAME = emailConfig.fromName;
    const ADMIN_EMAILS = authConfig.adminEmails;

    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'send_confirmation_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = sendConfirmationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { applicantEmail, applicantName, applicantPhone, city, applicationId } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'send_confirmation_request', adminEmail: auth.email, applicantEmail, applicantName }));

    // 1. Send confirmation email to applicant
    const applicantEmailContent = {
      to: applicantEmail,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: '🎉 Application Received - Yestoryd Academy',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://yestoryd.com/images/logo.png" alt="Yestoryd" style="height: 40px;" />
          </div>
          <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 20px;">
            Namaste ${applicantName}! 🙏
          </h1>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            Thank you for applying to become a Yestoryd Reading Coach. We're excited to learn more about you!
          </p>
          <div style="background: linear-gradient(135deg, #fdf2f8 0%, #f5f3ff 100%); border-radius: 12px; padding: 24px; margin: 24px 0;">
            <h3 style="color: #1e293b; margin-top: 0;">📋 What happens next?</h3>
            <ul style="color: #475569; line-height: 1.8; padding-left: 20px;">
              <li><strong>Within 48 hours:</strong> Our team reviews your application and voice statement</li>
              <li><strong>If shortlisted:</strong> You'll receive an email to schedule a video call with Rucha, our founder</li>
              <li><strong>After the call:</strong> We'll share next steps for onboarding</li>
            </ul>
          </div>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">
            In the meantime, feel free to explore our website to learn more about how Yestoryd helps children become confident readers.
          </p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;">
              Questions? Reply to this email or WhatsApp us at <a href="https://wa.me/918976287997" style="color: #22c55e;">${WHATSAPP_NUMBER}</a>
            </p>
            <p style="color: #64748b; font-size: 14px; margin-top: 10px;">
              Warm regards,<br/>
              <strong>Team Yestoryd</strong>
            </p>
          </div>
        </div>
      `,
      text: `
Namaste ${applicantName}!

Thank you for applying to become a Yestoryd Reading Coach. We're excited to learn more about you!

What happens next?
- Within 48 hours: Our team reviews your application and voice statement
- If shortlisted: You'll receive an email to schedule a video call with Rucha, our founder
- After the call: We'll share next steps for onboarding

Questions? WhatsApp us at ${WHATSAPP_NUMBER}

Warm regards,
Team Yestoryd
      `,
    };

    // 2. Send notification email to admins
    const adminEmailContent = {
      to: ADMIN_EMAILS,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: `🆕 New Coach Application: ${applicantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1e293b; font-size: 24px; margin-bottom: 20px;">
            New Coach Application Received 🎯
          </h1>
          <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <h3 style="color: #1e293b; margin-top: 0;">Applicant Details</h3>
            <table style="width: 100%; color: #475569;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 120px;">Name:</td>
                <td style="padding: 8px 0;">${applicantName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                <td style="padding: 8px 0;"><a href="mailto:${applicantEmail}">${applicantEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Phone:</td>
                <td style="padding: 8px 0;"><a href="https://wa.me/91${(applicantPhone || '').replace(/\D/g, '')}">${applicantPhone || 'Not provided'}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">City:</td>
                <td style="padding: 8px 0;">${city || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Application ID:</td>
                <td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${applicationId || 'N/A'}</td>
              </tr>
            </table>
          </div>
          <div style="margin-top: 20px;">
            <a href="https://yestoryd.com/admin/coach-applications"
               style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Review Application →
            </a>
          </div>
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            Triggered by: ${auth.email}
          </p>
        </div>
      `,
      text: `
New Coach Application Received

Applicant Details:
- Name: ${applicantName}
- Email: ${applicantEmail}
- Phone: ${applicantPhone || 'Not provided'}
- City: ${city || 'Not provided'}
- Application ID: ${applicationId || 'N/A'}

Triggered by: ${auth.email}

Review at: https://yestoryd.com/admin/coach-applications
      `,
    };

    // Send both emails
    await Promise.all([
      sendEmail({
        to: applicantEmailContent.to,
        subject: applicantEmailContent.subject,
        html: applicantEmailContent.html,
        text: applicantEmailContent.text,
        from: applicantEmailContent.from,
      }),
      sendEmail({
        to: adminEmailContent.to,
        subject: adminEmailContent.subject,
        html: adminEmailContent.html,
        text: adminEmailContent.text,
        from: adminEmailContent.from,
      }),
    ]);

    // Audit log
    const supabase = getServiceSupabase();
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'coach_application_confirmation_sent',
      metadata: {
        request_id: requestId,
        applicant_email: applicantEmail,
        applicant_name: applicantName,
        application_id: applicationId || null,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'send_confirmation_success', applicantEmail, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Confirmation emails sent successfully',
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'send_confirmation_error', error: error.message }));
    return NextResponse.json({ error: 'Failed to send emails', details: error.message, requestId }, { status: 500 });
  }
}
