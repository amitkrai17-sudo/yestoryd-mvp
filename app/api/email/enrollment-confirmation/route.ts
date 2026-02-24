import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, isEmailConfigured } from '@/lib/email/resend-client';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();
export const dynamic = 'force-dynamic';

// Initialize Supabase
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enrollmentId, parentEmail, childName, parentName } = body;

    if (!parentEmail || !childName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get enrollment details
    let enrollmentData = null;
    if (enrollmentId) {
      const { data } = await supabase
        .from('enrollments')
        .select('*, children(*), coaches!coach_id(name, phone)')
        .eq('id', enrollmentId)
        .single();
      enrollmentData = data;
    }

    const coachName = enrollmentData?.coaches?.name || 'Rucha';
    const coachPhone = enrollmentData?.coaches?.phone || '+91 8976287997';
    const programStart = enrollmentData?.program_start 
      ? new Date(enrollmentData.program_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // Email HTML template
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Yestoryd!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f0fdf4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #22c55e, #16a34a); border-radius: 24px 24px 0 0; padding: 40px 30px; text-align: center;">
      <img src="https://yestoryd.com/images/logo.png" alt="Yestoryd" style="max-width: 160px; margin-bottom: 20px;" />
      <h1 style="color: white; font-size: 28px; margin: 0;">🎉 Welcome to Yestoryd!</h1>
      <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin-top: 10px;">
        ${childName} is officially enrolled!
      </p>
    </div>

    <!-- Main Content -->
    <div style="background-color: white; padding: 30px; border-radius: 0 0 24px 24px; border: 1px solid #dcfce7;">
      
      <!-- Greeting -->
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Dear ${parentName || 'Parent'},
      </p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Thank you for enrolling ${childName} in our <strong>3-Month Reading Coaching Program</strong>! We're excited to be part of ${childName}'s reading journey.
      </p>

      <!-- Enrollment Details Card -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 24px; margin: 24px 0;">
        <h2 style="color: #166534; font-size: 18px; margin: 0 0 16px 0;">📋 Enrollment Details</h2>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 40%;">Student</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600;">${childName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Program</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600;">3-Month Reading Coaching</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Coach</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600;">Coach ${coachName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Total Sessions</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600;">${enrollmentData?.total_sessions || 'Personalized'} Coaching Sessions</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Start Date</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600;">${programStart}</td>
          </tr>
          ${enrollmentId ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Enrollment ID</td>
            <td style="padding: 8px 0; color: #111827; font-family: monospace; font-size: 12px;">${enrollmentId.slice(0, 8)}...</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- What's Next Section -->
      <h2 style="color: #111827; font-size: 18px; margin: 24px 0 16px 0;">🚀 What Happens Next</h2>
      
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
          <div style="width: 32px; height: 32px; background-color: #fef3c7; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;">
            <span style="font-size: 16px;">📅</span>
          </div>
          <div>
            <p style="margin: 0; color: #111827; font-weight: 600;">Calendar Invites Coming</p>
            <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">You'll receive Google Calendar invites for all your sessions within 24 hours.</p>
          </div>
        </div>
        
        <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
          <div style="width: 32px; height: 32px; background-color: #dbeafe; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;">
            <span style="font-size: 16px;">👋</span>
          </div>
          <div>
            <p style="margin: 0; color: #111827; font-weight: 600;">Coach Will Reach Out</p>
            <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">Coach ${coachName} will WhatsApp you within 24 hours to introduce herself and discuss ${childName}'s goals.</p>
          </div>
        </div>
        
        <div style="display: flex; align-items: flex-start;">
          <div style="width: 32px; height: 32px; background-color: #f3e8ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0;">
            <span style="font-size: 16px;">🎯</span>
          </div>
          <div>
            <p style="margin: 0; color: #111827; font-weight: 600;">First Session</p>
            <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">Your first session will be scheduled based on your preferred time. Get ready for an exciting journey!</p>
          </div>
        </div>
      </div>

      <!-- CTA Buttons -->
      <div style="margin: 32px 0; text-align: center;">
        <a href="https://yestoryd.com/parent/dashboard" 
           style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #ea580c); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; margin-bottom: 12px;">
          View Parent Dashboard →
        </a>
        <br><br>
        <a href="https://wa.me/918976287997?text=Hi! I just enrolled ${encodeURIComponent(childName)} in the reading program." 
           style="display: inline-block; background-color: #22c55e; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">
          💬 Say Hi on WhatsApp
        </a>
      </div>

      <!-- Coach Contact Card -->
      <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 16px; padding: 20px; margin: 24px 0;">
        <h3 style="color: #92400e; font-size: 16px; margin: 0 0 12px 0;">👩‍🏫 Your Coach</h3>
        <p style="margin: 0; color: #78350f;">
          <strong>Coach ${coachName}</strong><br>
          📱 WhatsApp: ${coachPhone}<br>
          📧 Email: ${coachName.toLowerCase()}@yestoryd.com
        </p>
      </div>

      <!-- Footer Note -->
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 24px;">
        If you have any questions, simply reply to this email or WhatsApp us. We're here to help ${childName} become a confident reader!
      </p>
      
      <p style="color: #374151; font-size: 16px; margin-top: 24px;">
        Warm regards,<br>
        <strong>Team Yestoryd</strong> 📚
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0;">© ${new Date().getFullYear()} Yestoryd • AI-Powered Reading Coach for Kids</p>
      <p style="margin: 8px 0 0 0;">
        <a href="https://yestoryd.com" style="color: #f59e0b; text-decoration: none;">yestoryd.com</a>
      </p>
    </div>

  </div>
</body>
</html>
`;

    // Send email
    if (!isEmailConfigured()) {
      console.log('Email not configured, skipping email');
      return NextResponse.json({ success: true, message: 'Email skipped (Resend not configured)' });
    }

    await sendEmail({
      to: parentEmail,
      subject: `🎉 Welcome! ${childName} is enrolled in Reading Coaching`,
      html: htmlContent,
      from: { email: 'engage@yestoryd.com', name: 'Yestoryd' },
    });
    console.log(`✅ Enrollment confirmation email sent to ${parentEmail}`);

    return NextResponse.json({ success: true, message: 'Confirmation email sent' });

  } catch (error: any) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { success: true, message: 'Enrollment confirmed (email may be delayed)' },
      { status: 200 }
    );
  }
}
