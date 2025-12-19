// app/api/coach-application/send-confirmation/route.ts
// Send confirmation emails after coach application submission

import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const ADMIN_EMAILS = ['rucha.rai@yestoryd.com', 'amitkrai17@gmail.com']; // Notification recipients
const FROM_EMAIL = 'engage@yestoryd.com';  // All Yestoryd communication
const FROM_NAME = 'Yestoryd Academy';
const WHATSAPP_NUMBER = '+91 89762 87997';

export async function POST(request: NextRequest) {
  try {
    const { 
      applicantEmail, 
      applicantName, 
      applicantPhone,
      city,
      applicationId 
    } = await request.json();

    if (!applicantEmail || !applicantName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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

In the meantime, feel free to explore our website to learn more about how Yestoryd helps children become confident readers.

Questions? WhatsApp us at ${WHATSAPP_NUMBER}

Warm regards,
Team Yestoryd
      `
    };

    // 2. Send notification email to admins (Rucha + Amit)
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
            This application includes an AI assessment conversation. Review the full responses in the admin dashboard.
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

Review at: https://yestoryd.com/admin/coach-applications
      `
    };

    // Send both emails
    await Promise.all([
      sgMail.send(applicantEmailContent),
      sgMail.send(adminEmailContent)
    ]);

    console.log(`✅ Coach application emails sent for ${applicantName} (${applicantEmail})`);

    return NextResponse.json({ 
      success: true,
      message: 'Confirmation emails sent successfully'
    });

  } catch (error: any) {
    console.error('Email send error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to send emails',
        details: error.message 
      },
      { status: 500 }
    );
  }
}