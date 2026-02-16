// =============================================================================
// FILE: app/api/group-classes/verify-payment/route.ts
// PURPOSE: Verify Razorpay payment and complete registration
// FIXED: Uses child_id and parent_id foreign keys for email
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// =============================================================================
// SEND CONFIRMATION EMAIL via SendGrid
// =============================================================================
async function sendConfirmationEmail(
  parentEmail: string,
  parentName: string,
  childName: string,
  sessionTitle: string,
  sessionDate: string,
  sessionTime: string,
  meetLink: string | null,
  priceInr: number
): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SendGrid API key not configured');
      return false;
    }

    const formattedDate = new Date(sessionDate).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const formattedTime = formatTime(sessionTime);

    const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 16px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #ff0099, #7b008b); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Registration Confirmed!</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <p style="font-size: 18px; color: #333;">Hi ${parentName},</p>
      
      <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Great news! <strong>${childName}</strong> is registered for the upcoming group class. We're excited to have them join us!
      </p>
      
      <!-- Session Details Card -->
      <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #ff0099;">
        <h2 style="color: #333; margin-top: 0; font-size: 20px;">📚 ${sessionTitle}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">📅 Date</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">🕐 Time</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${formattedTime} IST</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">💰 Amount Paid</td>
            <td style="padding: 8px 0; color: #ff0099; font-weight: 600;">₹${priceInr}</td>
          </tr>
        </table>
      </div>
      
      ${meetLink ? `
      <!-- Join Button -->
      <div style="text-align: center; margin: 30px 0;">
        <p style="color: #666; margin-bottom: 15px;">Join the session using this link:</p>
        <a href="${meetLink}" style="display: inline-block; background: linear-gradient(135deg, #ff0099, #7b008b); color: white; padding: 15px 40px; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 16px;">
          🎥 Join Google Meet
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 10px;">
          Or copy: <a href="${meetLink}" style="color: #ff0099;">${meetLink}</a>
        </p>
      </div>
      ` : ''}
      
      <!-- Instructions -->
      <div style="background: #fff8e1; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #f57c00; margin-top: 0;">📝 Before the Session</h3>
        <ul style="color: #666; line-height: 1.8; padding-left: 20px;">
          <li>Test your camera and microphone</li>
          <li>Find a quiet, well-lit space</li>
          <li>Have a notebook ready for activities</li>
          <li>Join 5 minutes early to settle in</li>
        </ul>
      </div>
      
      <p style="color: #666; line-height: 1.6;">
        We'll send a reminder before the session. If you have any questions, just reply to this email or WhatsApp us at <strong>+91 89762 87997</strong>.
      </p>
      
      <p style="color: #333; margin-top: 30px;">
        See you soon! 🌟<br>
        <strong>Team Yestoryd</strong>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px; margin: 0;">
        © 2025 Yestoryd | Building confident readers, one story at a time
      </p>
      <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">
        <a href="https://yestoryd.com" style="color: #ff0099;">yestoryd.com</a> | 
        <a href="https://wa.me/918976287997" style="color: #25D366;">WhatsApp</a>
      </p>
    </div>
    
  </div>
</body>
</html>
    `;

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: parentEmail, name: parentName }],
            subject: `🎉 ${childName} is registered for ${sessionTitle}!`,
          },
        ],
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'engage@yestoryd.com',
          name: 'Yestoryd',
        },
        content: [
          {
            type: 'text/html',
            value: emailContent,
          },
        ],
      }),
    });

    if (response.ok) {
      console.log('✅ Confirmation email sent to:', parentEmail);
      return true;
    } else {
      const error = await response.text();
      console.error('❌ SendGrid error:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Email sending error:', error);
    return false;
  }
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// =============================================================================
// MAIN API HANDLER
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      registrationId,
    } = body;

    console.log('Verifying payment for registration:', registrationId);

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !registrationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('Payment signature verification failed');
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    console.log('✅ Payment signature verified');

    // Get registration record
    const { data: registration, error: regError } = await supabase
      .from('group_session_participants')
      .select('*')
      .eq('id', registrationId)
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (regError || !registration) {
      console.error('Registration not found:', regError);
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Check if already paid
    if (registration.payment_status === 'paid') {
      return NextResponse.json({
        success: true,
        message: 'Payment already verified',
        registrationId,
      });
    }

    // Update registration with payment details
    const { error: updateError } = await supabase
      .from('group_session_participants')
      .update({
        razorpay_payment_id,
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        attendance_status: 'confirmed',
      })
      .eq('id', registrationId);

    if (updateError) {
      console.error('Error updating registration:', updateError);
      return NextResponse.json(
        { error: 'Failed to update registration' },
        { status: 500 }
      );
    }

    console.log('✅ Registration updated to paid');

    // Get session details
    const { data: session } = await supabase
      .from('group_sessions')
      .select('id, title, scheduled_date, scheduled_time, google_meet_link, current_participants')
      .eq('id', registration.group_session_id)
      .single();

    if (session) {
      // Update session participant count
      await supabase
        .from('group_sessions')
        .update({ current_participants: (session.current_participants || 0) + 1 })
        .eq('id', session.id);
    }

    // Increment coupon usage if applicable
    if (registration.coupon_id) {
      await supabase.rpc('increment_coupon_usage', { coupon_id: registration.coupon_id });
    }

    // =============================================================================
    // GET PARENT AND CHILD DETAILS FOR EMAIL
    // =============================================================================
    let emailSent = false;

    if (session) {
      // Get child details
      const { data: child } = await supabase
        .from('children')
        .select('id, name')
        .eq('id', registration.child_id)
        .single();

      // Get parent details
      const { data: parent } = await supabase
        .from('parents')
        .select('id, name, email')
        .eq('id', registration.parent_id)
        .single();

      if (parent && child) {
        console.log('Sending confirmation email to:', parent.email);
        
        emailSent = await sendConfirmationEmail(
          parent.email,
          parent.name,
          child.name,
          session.title,
          session.scheduled_date,
          session.scheduled_time,
          session.google_meet_link,
          registration.amount_paid || 0
        );
      } else {
        console.error('Could not find parent or child for email');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      registrationId,
      sessionId: session?.id,
      emailSent,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}