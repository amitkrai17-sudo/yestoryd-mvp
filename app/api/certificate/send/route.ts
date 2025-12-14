import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

// Initialize SendGrid
const sendgridApiKey = process.env.SENDGRID_API_KEY;
if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      childName, 
      childAge, 
      parentName,
      score, 
      clarity_score,
      fluency_score,
      speed_score,
      wpm, 
      feedback 
    } = body;

    if (!email || !childName) {
      return NextResponse.json(
        { success: false, error: 'Email and child name required' },
        { status: 400 }
      );
    }

    if (!sendgridApiKey) {
      console.log('SendGrid not configured, skipping email');
      return NextResponse.json({ success: true, message: 'Email skipped (SendGrid not configured)' });
    }

    const assessmentDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Score-based CTA (same as web)
    const getCTA = (s: number, name: string) => {
      if (s <= 4) return { text: `Get ${name} the Help They Need`, headline: `${name} needs expert guidance`, emoji: '🆘' };
      if (s <= 6) return { text: `Accelerate ${name}'s Progress`, headline: `${name} is ready to improve!`, emoji: '📈' };
      if (s <= 8) return { text: `Unlock ${name}'s Full Potential`, headline: `${name} shows great potential!`, emoji: '⭐' };
      return { text: `Challenge ${name} Further`, headline: `${name} is a reading star!`, emoji: '🌟' };
    };

    const ctaInfo = getCTA(score, childName);
    const scorePercent = (score / 10) * 100;

    // Mobile-optimized HTML email template
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${childName}'s Reading Assessment Certificate</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030712; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; padding: 20px;">
    
    <!-- Header with Logo -->
    <div style="background: #1f2937; border-radius: 24px 24px 0 0; padding: 30px 20px; text-align: center; border-bottom: 3px solid #ff0099;">
      <!-- Logo - table wrapper to prevent stretching -->
      <table align="center" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <img src="https://yestoryd.com/images/logo.png" 
                 alt="Yestoryd" 
                 style="display: block; border: 0; outline: none; text-decoration: none; max-width: 160px; width: 160px;" 
                 width="160" />
          </td>
        </tr>
      </table>
      <p style="color: #9ca3af; margin: 15px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px;">Reading Assessment Certificate</p>
    </div>

    <!-- Certificate Body -->
    <div style="background-color: #111827; padding: 30px 20px;">
      
      <!-- Celebration Header -->
      <div style="text-align: center; margin-bottom: 25px;">
        <p style="font-size: 48px; margin: 0; line-height: 1;">🎉</p>
        <h2 style="color: white; font-size: 24px; margin: 15px 0 5px 0; font-weight: 700;">Great job, ${childName}!</h2>
        <p style="color: #9ca3af; font-size: 14px; margin: 0;">Here's your reading assessment</p>
      </div>
      
      <!-- Score Display -->
      <div style="text-align: center; margin: 30px 0;">
        <!-- Score Circle using table -->
        <table align="center" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" valign="middle" width="140" height="140" style="width: 140px; height: 140px; border-radius: 70px; border: 12px solid #ff0099; background-color: #111827; text-align: center; vertical-align: middle;">
              <span style="color: white; font-size: 56px; font-weight: 800;">${score}</span>
            </td>
          </tr>
        </table>
        
        <!-- Progress Bar -->
        <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px; width: 200px;">
          <tr>
            <td style="background-color: #374151; border-radius: 10px; height: 8px; padding: 0;">
              <table cellpadding="0" cellspacing="0" border="0" style="width: ${scorePercent}%;">
                <tr>
                  <td style="background: linear-gradient(90deg, #ff0099, #7b008b); height: 8px; border-radius: 10px;"></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">${score} out of 10</p>
      </div>
      
      <!-- Metric Cards -->
      <table width="100%" cellpadding="0" cellspacing="8" border="0" style="margin: 25px 0;">
        <tr>
          <td width="33%" style="background-color: #1f2937; border-radius: 16px; padding: 18px 10px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 8px;">🔊</div>
            <div style="color: white; font-size: 24px; font-weight: 700;">${clarity_score || 7}</div>
            <div style="color: #9ca3af; font-size: 12px; margin-top: 4px;">Clarity</div>
          </td>
          <td width="33%" style="background-color: #1f2937; border-radius: 16px; padding: 18px 10px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 8px;">🗣️</div>
            <div style="color: white; font-size: 24px; font-weight: 700;">${fluency_score || 6}</div>
            <div style="color: #9ca3af; font-size: 12px; margin-top: 4px;">Fluency</div>
          </td>
          <td width="33%" style="background-color: #1f2937; border-radius: 16px; padding: 18px 10px; text-align: center;">
            <div style="font-size: 28px; margin-bottom: 8px;">⚡</div>
            <div style="color: white; font-size: 24px; font-weight: 700;">${speed_score || 6}</div>
            <div style="color: #9ca3af; font-size: 12px; margin-top: 4px;">Speed</div>
          </td>
        </tr>
      </table>
      
      <!-- WPM -->
      <div style="background-color: rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6; border-radius: 16px; padding: 16px; margin: 20px 0; text-align: center;">
        <span style="color: #60a5fa; font-size: 15px; font-weight: 500;">📈 ${wpm || 60} Words Per Minute</span>
      </div>
      
      <!-- Vedant AI Feedback -->
      <div style="background-color: rgba(255, 0, 153, 0.1); border: 1px solid #ff0099; border-radius: 16px; padding: 20px; margin: 20px 0;">
        <p style="color: #ff0099; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">✨ Vedant AI Feedback</p>
        <p style="color: #d1d5db; font-size: 14px; line-height: 1.7; margin: 0;">${feedback}</p>
      </div>
      
      <!-- Encouragement -->
      <div style="background-color: rgba(234, 179, 8, 0.15); border: 1px solid #eab308; border-radius: 16px; padding: 16px; margin: 20px 0; text-align: center;">
        <p style="color: #fcd34d; font-size: 14px; font-weight: 500; margin: 0;">✨ Keep reading daily, ${childName}! Every page makes you stronger.</p>
      </div>
      
      <!-- Personalized CTA Section -->
      <div style="background-color: rgba(123, 0, 139, 0.2); border: 1px solid #7b008b; border-radius: 20px; padding: 25px 20px; margin: 25px 0; text-align: center;">
        <p style="font-size: 36px; margin: 0;">${ctaInfo.emoji}</p>
        <h3 style="color: white; font-size: 18px; margin: 12px 0 6px 0; font-weight: 700;">${ctaInfo.headline}</h3>
        <p style="color: #9ca3af; font-size: 13px; margin: 0 0 18px 0;">Our coaches specialize in building reading confidence</p>
        
        <!-- Social Proof -->
        <p style="color: #fb923c; font-size: 13px; margin: 0 0 18px 0;">🔥 12 parents enrolled today</p>
        
        <!-- Primary CTA Button -->
        <table align="center" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" bgcolor="#ff0099" style="background: linear-gradient(135deg, #ff0099, #7b008b); border-radius: 16px;">
              <a href="https://yestoryd.com/book?childName=${encodeURIComponent(childName)}" 
                 style="display: inline-block; color: white; padding: 16px 32px; text-decoration: none; font-weight: 700; font-size: 15px;">
                🚀 ${ctaInfo.text}
              </a>
            </td>
          </tr>
        </table>
        
        <!-- Trust Badges -->
        <p style="color: #6b7280; font-size: 11px; margin: 18px 0 0 0;">🛡️ 100% Refund Guarantee • 500+ Kids Improved</p>
      </div>
      
      <!-- Secondary CTA -->
      <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
        <tr>
          <td align="center" bgcolor="#1f2937" style="background-color: #1f2937; border: 1px solid #374151; border-radius: 16px;">
            <a href="https://yestoryd.com/book?childName=${encodeURIComponent(childName)}&type=consultation" 
               style="display: inline-block; color: white; padding: 14px 28px; text-decoration: none; font-weight: 600; font-size: 14px;">
              📅 Talk to ${childName}'s Coach First
            </a>
          </td>
        </tr>
      </table>
      
      <!-- Assessment Date -->
      <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 25px 0 0 0;">
        Assessment Date: ${assessmentDate}
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #0a0a0a; border-radius: 0 0 24px 24px; padding: 25px 20px; text-align: center; border-top: 1px solid #1f2937;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 10px 0;">
        Questions? Reply to this email or WhatsApp us at +91 8976287997
      </p>
      <p style="color: #6b7280; font-size: 11px; margin: 0;">
        © ${new Date().getFullYear()} Yestoryd • AI-Powered Reading Coach for Kids
      </p>
    </div>

  </div>
</body>
</html>
`;

    // Send email via SendGrid
    const msg = {
      to: email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'hello@yestoryd.com',
        name: 'Yestoryd',
      },
      subject: `🎓 ${childName}'s Reading Certificate - Score: ${score}/10`,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log(`✅ Certificate email sent to ${email}`);

    return NextResponse.json({ success: true, message: 'Certificate email sent' });

  } catch (error: any) {
    console.error('Email send error:', error);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Certificate generated (email may be delayed)',
      error: error.message 
    });
  }
}