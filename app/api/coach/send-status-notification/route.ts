// file: app/api/coach/send-status-notification/route.ts
// Sends Email + WhatsApp notification when coach status changes
// Handles: approved, rejected, hold, qualified
// SECURITY: requireAdmin() - only admins can trigger status notifications

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { loadCoachConfig, loadIntegrationsConfig, loadEmailConfig } from '@/lib/config/loader';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const supabase = getServiceSupabase();

    const { coachId, coachEmail, coachName, coachPhone, status, interviewLink } = await request.json();

    if (!coachId || !coachEmail || !coachName || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const [coachConfig, integrationsConfig, emailConfig] = await Promise.all([
      loadCoachConfig(), loadIntegrationsConfig(), loadEmailConfig(),
    ]);
    const settings = { siteBaseUrl: integrationsConfig.siteBaseUrl, adminEmail: emailConfig.fromEmail };
    const onboardingLink = `${settings.siteBaseUrl}/coach/onboarding?coachId=${coachId}`;
    const websiteLink = settings.siteBaseUrl;
    const reapplyLink = `${settings.siteBaseUrl}/yestoryd-academy/apply`;
    
    let emailSubject = '';
    let emailHtml = '';
    let whatsappMessage = '';

    // ==================== APPROVED ====================
    if (status === 'approved') {
      emailSubject = '🎉 Congratulations! You\'re Approved to Join Yestoryd Academy';
      emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #ff0099; font-size: 28px; margin: 0;">🎉 Welcome to Yestoryd Academy!</h1>
      <p style="color: #64748b; font-size: 14px; margin-top: 8px;">You're officially part of our coaching family</p>
    </div>
    
    <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <p style="font-size: 18px; color: #334155; margin-bottom: 20px;">
        Dear <strong>${coachName}</strong>,
      </p>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
        We're thrilled to share some exciting news — <strong>you've been approved</strong> to join the Yestoryd Academy coaching team! 🌟
      </p>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
        Your passion for nurturing young readers truly shone through in your application and interview. We believe you'll make a wonderful addition to our mission of transforming children's reading journeys across India.
      </p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${onboardingLink}" style="display: inline-block; background: linear-gradient(135deg, #ff0099, #7b008b); color: white; text-decoration: none; padding: 16px 40px; border-radius: 30px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(255,0,153,0.3);">
          Complete Your Onboarding →
        </a>
      </div>
      
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 24px;">
        <h3 style="color: #334155; font-size: 16px; margin: 0 0 12px 0;">📋 Your Next Steps</h3>
        <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Complete your profile & bank details for payouts</li>
          <li>Get your unique referral link to share with parents</li>
          <li>Access exclusive coach training resources</li>
          <li>Start receiving student assignments</li>
        </ul>
      </div>
      
      <div style="background: linear-gradient(135deg, #fdf4ff, #fce7f3); border-radius: 12px; padding: 20px; margin-top: 20px;">
        <h3 style="color: #7b008b; font-size: 16px; margin: 0 0 12px 0;">💰 Your Earning Potential</h3>
        <p style="color: #6b21a8; font-size: 14px; line-height: 1.6; margin: 0;">
          <strong>50%</strong> of every enrollment you coach<br>
          <strong>70%</strong> when you bring your own students<br>
          <em>That's up to ₹4,200 per student!</em>
        </p>
      </div>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-top: 24px;">
        We're so excited to have you on board. Together, let's create confident readers, one child at a time! 📚✨
      </p>
      
      <p style="font-size: 16px; color: #334155; margin-top: 24px;">
        Warm regards,<br>
        <strong>Rucha & Team Yestoryd</strong>
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 14px; margin-bottom: 8px;">
        Questions? Reply to this email or WhatsApp us at +91 8976287997
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        © 2025 Yestoryd | AI-Powered Reading Intelligence for Children
      </p>
    </div>
  </div>
</body>
</html>`;

      whatsappMessage = `🎉 *Wonderful News, ${coachName}!*

You've been *approved* to join the Yestoryd Academy family! We're so excited to have you on board. 🌟

Your passion for helping children read better truly impressed us, and we can't wait to see the impact you'll make.

📋 *Complete your onboarding here:*
👉 ${onboardingLink}

💰 *What you can earn:*
• 50% per student you coach
• 70% when you bring your own students
• Up to ₹4,200 per enrollment!

Let's create confident readers together! 📚✨

Questions? Just reply here — we're always happy to help!

Warm regards,
*Rucha & Team Yestoryd* 💕`;

    // ==================== REJECTED ====================
    } else if (status === 'rejected') {
      emailSubject = 'Your Yestoryd Academy Application — Let\'s Stay Connected! 💫';
      emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #7b008b; font-size: 26px; margin: 0;">Thank You for Your Interest! 💫</h1>
      <p style="color: #64748b; font-size: 14px; margin-top: 8px;">Your application to Yestoryd Academy</p>
    </div>
    
    <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <p style="font-size: 18px; color: #334155; margin-bottom: 20px;">
        Dear <strong>${coachName}</strong>,
      </p>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
        First, we want to sincerely thank you for taking the time to apply to Yestoryd Academy. We were truly touched by your enthusiasm for helping children become better readers. 🙏
      </p>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
        After careful consideration, we've decided not to move forward with your application at this time. Please know this wasn't an easy decision — we receive many wonderful applications, and sometimes it comes down to specific requirements for our current cohort.
      </p>
      
      <div style="background: linear-gradient(135deg, #fdf4ff, #fce7f3); border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="color: #7b008b; font-size: 16px; margin: 0 0 12px 0;">🌱 This Isn't Goodbye!</h3>
        <p style="color: #6b21a8; font-size: 14px; line-height: 1.6; margin: 0;">
          We'd genuinely love to stay connected. Our needs evolve constantly, and there may be opportunities in the future that align perfectly with your unique skills. The door at Yestoryd is <strong>always open</strong> for passionate educators like you.
        </p>
      </div>
      
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 20px;">
        <h3 style="color: #334155; font-size: 16px; margin: 0 0 12px 0;">💡 Ways to Stay Connected</h3>
        <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li><strong>Reapply in 3-6 months</strong> — we'd genuinely love to hear from you again</li>
          <li>Follow us on social media for tips & updates</li>
          <li>Refer families who need reading support for their children</li>
          <li>Share Yestoryd with other passionate educators</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${reapplyLink}" style="display: inline-block; background: linear-gradient(135deg, #ff0099, #7b008b); color: white; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-size: 16px; font-weight: bold;">
          Apply Again in Future →
        </a>
      </div>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-top: 24px;">
        Thank you again for believing in our mission. The world needs more people who care about children's education as deeply as you do. We're cheering for you! 🌟
      </p>
      
      <p style="font-size: 16px; color: #334155; margin-top: 24px;">
        With warm wishes,<br>
        <strong>Rucha & Team Yestoryd</strong>
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 14px; margin-bottom: 8px;">
        Questions? Feel free to reach out at engage@yestoryd.com
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        © 2025 Yestoryd | Empowering Young Readers Across India
      </p>
    </div>
  </div>
</body>
</html>`;

      whatsappMessage = `Hi ${coachName} 👋

Thank you so much for applying to Yestoryd Academy! We truly appreciate the time and heart you put into your application. 🙏

After careful review, we've decided not to move forward at this time. But please know — *this isn't goodbye!*

🌱 Our needs change constantly, and we'd love to stay connected for future opportunities. The door is always open for passionate educators like you.

💡 *Stay in touch:*
• Reapply in 3-6 months — we'd love to hear from you again!
• Follow our journey on social media
• Share Yestoryd with families who need reading support

Thank you for believing in our mission. We're cheering for you! 🌟

Warm wishes,
*Rucha & Team Yestoryd* 💕

🔗 Visit: ${websiteLink}`;

    // ==================== HOLD ====================
    } else if (status === 'hold' || status === 'on_hold') {
      emailSubject = 'Quick Update on Your Yestoryd Academy Application ⏳';
      emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #00abff; font-size: 26px; margin: 0;">Your Application is On Hold ⏳</h1>
      <p style="color: #64748b; font-size: 14px; margin-top: 8px;">We wanted to keep you in the loop</p>
    </div>
    
    <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <p style="font-size: 18px; color: #334155; margin-bottom: 20px;">
        Dear <strong>${coachName}</strong>,
      </p>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
        Thank you for your patience! We wanted to give you a quick update on your Yestoryd Academy application.
      </p>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
        Your application is currently <strong>on hold</strong> — not because of any issue with your profile, but because we're carefully planning our next coaching cohort. We want to make sure every coach we onboard gets the attention and support they deserve.
      </p>
      
      <div style="background: linear-gradient(135deg, #e0f2fe, #bae6fd); border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="color: #0369a1; font-size: 16px; margin: 0 0 12px 0;">💙 What This Means</h3>
        <p style="color: #0c4a6e; font-size: 14px; line-height: 1.6; margin: 0;">
          We're keeping your application active and will reach out as soon as we're ready to expand our team. You're still very much in consideration — we just need a little more time.
        </p>
      </div>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
        We truly appreciate your interest in joining our mission to help children become confident readers. Your patience means a lot to us! 🙏
      </p>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6;">
        We'll be in touch soon with more updates. In the meantime, feel free to reach out if you have any questions!
      </p>
      
      <p style="font-size: 16px; color: #334155; margin-top: 24px;">
        Warm regards,<br>
        <strong>Rucha & Team Yestoryd</strong>
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 14px; margin-bottom: 8px;">
        Questions? Reply to this email or WhatsApp us at +91 8976287997
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        © 2025 Yestoryd | AI-Powered Reading Intelligence for Children
      </p>
    </div>
  </div>
</body>
</html>`;

      whatsappMessage = `Hi ${coachName} 👋

Quick update on your Yestoryd Academy application! ⏳

Your application is currently *on hold* — not because of any concern, but because we're carefully planning our next coaching cohort.

💙 *What this means:*
• Your application is still active
• We'll reach out as soon as we're ready
• You're very much in consideration!

We truly appreciate your patience and interest in our mission. 🙏

We'll be in touch soon with more updates!

Warm regards,
*Rucha & Team Yestoryd* 💕`;

    // ==================== QUALIFIED (Post-AI Assessment) ====================
    } else if (status === 'qualified') {
      emailSubject = '🌟 Great News! You\'ve Qualified for Interview — Yestoryd Academy';
      emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #ff0099; font-size: 28px; margin: 0;">🌟 You've Qualified!</h1>
      <p style="color: #64748b; font-size: 14px; margin-top: 8px;">Next step: A quick chat with our team</p>
    </div>
    
    <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <p style="font-size: 18px; color: #334155; margin-bottom: 20px;">
        Dear <strong>${coachName}</strong>,
      </p>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
        Exciting news! 🎉 You've successfully completed the AI assessment and <strong>qualified for the interview round</strong> at Yestoryd Academy.
      </p>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
        Your responses showed exactly the kind of passion and thoughtfulness we look for in our coaches. We can't wait to meet you and learn more about your journey!
      </p>
      
      <div style="background: linear-gradient(135deg, #fdf4ff, #fce7f3); border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="color: #7b008b; font-size: 16px; margin: 0 0 12px 0;">📅 What's Next?</h3>
        <p style="color: #6b21a8; font-size: 14px; line-height: 1.6; margin: 0;">
          Our team will reach out shortly to schedule a brief 15-20 minute video call. This is a friendly conversation where we get to know each other better — no pressure!
        </p>
      </div>
      
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 20px;">
        <h3 style="color: #334155; font-size: 16px; margin: 0 0 12px 0;">💡 Prepare For Your Interview</h3>
        <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
          <li>Share your passion for helping children read</li>
          <li>Tell us about any teaching or mentoring experience</li>
          <li>Ask us any questions about Yestoryd Academy</li>
          <li>Be yourself — we want to know the real you!</li>
        </ul>
      </div>
      
      <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-top: 24px;">
        Keep an eye on your phone and email — we'll be in touch very soon! 📱
      </p>
      
      <p style="font-size: 16px; color: #334155; margin-top: 24px;">
        Excited to meet you,<br>
        <strong>Rucha & Team Yestoryd</strong>
      </p>
    </div>
    
    <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 14px; margin-bottom: 8px;">
        Questions? Reply to this email or WhatsApp us at +91 8976287997
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        © 2025 Yestoryd | AI-Powered Reading Intelligence for Children
      </p>
    </div>
  </div>
</body>
</html>`;

      whatsappMessage = `🌟 *Exciting News, ${coachName}!*

You've *qualified* for the interview round at Yestoryd Academy! 🎉

Your AI assessment responses showed exactly the passion we look for in our coaches. We can't wait to meet you!

📅 *What's next?*
Our team will reach out shortly to schedule a quick 15-20 min video call. It's a friendly chat — no pressure!

💡 *Quick tips:*
• Share your passion for helping kids read
• Tell us about your experience
• Ask us anything about Yestoryd!
• Just be yourself 😊

Keep an eye on your phone — we'll be in touch very soon! 📱

Excited to meet you!
*Rucha & Team Yestoryd* 💕`;

    } else {
      return NextResponse.json(
        { success: false, error: `Invalid status: ${status}. Use approved, rejected, hold, or qualified` },
        { status: 400 }
      );
    }

    // ==================== SEND EMAIL ====================
    let emailSent = false;
    try {
      const { sendEmail } = require('@/lib/email/resend-client');

      const emailResult = await sendEmail({
        to: coachEmail,
        subject: emailSubject,
        html: emailHtml,
        from: { email: settings.adminEmail, name: 'Yestoryd Academy' },
        replyTo: { email: settings.adminEmail, name: 'Yestoryd Team' },
      });

      emailSent = emailResult.success;
      if (!emailSent) {
        console.error('Email error:', emailResult.error);
      } else {
        console.log(`✅ ${status} email sent to ${coachEmail}`);
      }
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    // ==================== SEND WHATSAPP ====================
    let whatsappSent = false;
    if (coachPhone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const twilioAuth = Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString('base64');

        // Format phone number
        let formattedPhone = coachPhone.replace(/\D/g, '');
        if (formattedPhone.length === 10) {
          formattedPhone = '91' + formattedPhone;
        } else if (!formattedPhone.startsWith('91') && formattedPhone.length > 10) {
          formattedPhone = formattedPhone.slice(-10);
          formattedPhone = '91' + formattedPhone;
        }

        const whatsappResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'}`,
              To: `whatsapp:+${formattedPhone}`,
              Body: whatsappMessage,
            }),
          }
        );

        whatsappSent = whatsappResponse.ok;
        if (!whatsappSent) {
          const errorText = await whatsappResponse.text();
          console.error('Twilio WhatsApp error:', errorText);
        } else {
          console.log(`✅ ${status} WhatsApp sent to ${formattedPhone}`);
        }
      } catch (whatsappError) {
        console.error('WhatsApp sending failed:', whatsappError);
      }
    } else {
      console.log('WhatsApp not sent: Missing phone or Twilio credentials');
    }

    // ==================== UPDATE DATABASE ====================
    try {
      await (supabase.from('coach_applications') as any)
        .update({
          [`${status}_notification_sent`]: true,
          [`${status}_notification_date`]: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', coachId);
    } catch (dbError) {
      console.error('DB update error:', dbError);
    }

    return NextResponse.json({
      success: true,
      status,
      emailSent,
      whatsappSent,
      message: `${status} notification sent successfully`,
    });

  } catch (error: any) {
    console.error('Status notification error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
