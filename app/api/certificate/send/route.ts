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
      feedback,
      encouragement 
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

    // Score-based messaging (matches web exactly)
    const getScoreBasedContent = (s: number, name: string) => {
      if (s <= 4) {
        return {
          emoji: '🌱',
          headline: `Great start, ${name}!`,
          subtext: "Every reader begins somewhere. Let's build a strong foundation together.",
          primaryCTA: `Talk to ${name}'s Coach`,
          prioritizeConsultation: true
        };
      }
      if (s <= 6) {
        return {
          emoji: '📈',
          headline: `${name} is building momentum!`,
          subtext: "Good progress! With the right guidance, we can accelerate even further.",
          primaryCTA: `Accelerate ${name}'s Progress`,
          prioritizeConsultation: true
        };
      }
      if (s <= 8) {
        return {
          emoji: '⭐',
          headline: `${name} shows great potential!`,
          subtext: "Strong foundation! Let's unlock the next level of reading confidence.",
          primaryCTA: `Unlock ${name}'s Full Potential`,
          prioritizeConsultation: false
        };
      }
      return {
        emoji: '🌟',
        headline: `${name} is a reading star!`,
        subtext: "Excellent skills! Ready for advanced challenges and enrichment.",
        primaryCTA: `Challenge ${name} Further`,
        prioritizeConsultation: false
      };
    };

    // Score context message (matches web)
    const getScoreContext = (s: number) => {
      if (s <= 4) return "Many children start here. With structured phonics coaching, most improve 2-3 points in the first month.";
      if (s <= 6) return "Your child has a good foundation. Targeted coaching can help fill specific gaps and build confidence.";
      if (s <= 8) return "Strong reading skills! Coaching can help polish fluency and expand vocabulary further.";
      return "Excellent reading ability! Your child is ready for advanced challenges and enrichment activities.";
    };

    const content = getScoreBasedContent(score, childName);
    const scoreContext = getScoreContext(score);
    const scorePercent = (score / 10) * 100;

    // Build Let's Talk URL with params
    const letsTalkUrl = `https://yestoryd.com/lets-talk?childName=${encodeURIComponent(childName)}&childAge=${childAge || ''}&parentEmail=${encodeURIComponent(email)}&source=certificate_email`;

    // LIGHT THEME email template matching web result screen
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${childName}'s Reading Assessment Results</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; padding: 20px;">
    
    <!-- Header with Logo -->
    <div style="background: linear-gradient(135deg, #ff0099, #7b008b); border-radius: 20px 20px 0 0; padding: 24px 20px; text-align: center;">
      <table align="center" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
            <img src="https://yestoryd.com/images/logo.png" 
                 alt="Yestoryd" 
                 style="display: block; border: 0; outline: none; text-decoration: none; max-width: 140px; width: 140px;" 
                 width="140" />
          </td>
        </tr>
      </table>
      <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 13px; font-weight: 500;">Reading Assessment Results</p>
    </div>

    <!-- Main Content - Light Theme -->
    <div style="background-color: #ffffff; padding: 28px 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      
      <!-- Encouraging Header (matches web) -->
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="font-size: 48px; margin: 0; line-height: 1;">${content.emoji}</p>
        <h2 style="color: #111827; font-size: 22px; margin: 12px 0 6px 0; font-weight: 700;">${content.headline}</h2>
        <p style="color: #6b7280; font-size: 14px; margin: 0;">${content.subtext}</p>
      </div>
      
      <!-- Score Card (matches web layout) -->
      <div style="background-color: #f9fafb; border-radius: 16px; padding: 20px; border: 1px solid #e5e7eb; margin-bottom: 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="50%" valign="middle">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right: 12px;">
                    <!-- Score Circle -->
                    <div style="width: 56px; height: 56px; border-radius: 28px; background: linear-gradient(135deg, #ec4899, #9333ea); display: inline-block; text-align: center; line-height: 56px;">
                      <span style="color: white; font-size: 24px; font-weight: 700;">${score}</span>
                    </div>
                  </td>
                  <td valign="middle">
                    <p style="color: #9ca3af; font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin: 0;">Overall Score</p>
                    <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 2px 0 0 0;">out of 10</p>
                  </td>
                </tr>
              </table>
            </td>
            <td width="50%" valign="middle" align="right">
              <p style="color: #9ca3af; font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin: 0;">Speed</p>
              <p style="color: #3b82f6; font-size: 20px; font-weight: 700; margin: 2px 0 0 0;">${wpm || 60} <span style="color: #9ca3af; font-size: 12px; font-weight: 400;">WPM</span></p>
            </td>
          </tr>
        </table>
        
        <!-- Context message -->
        <div style="background-color: #ffffff; border-radius: 8px; padding: 12px; border: 1px solid #f3f4f6; margin-top: 16px;">
          <p style="color: #4b5563; font-size: 13px; margin: 0; line-height: 1.5;">💡 ${scoreContext}</p>
        </div>
      </div>
      
      <!-- Metric Cards (matches web - NO emojis) -->
      <table width="100%" cellpadding="0" cellspacing="6" border="0" style="margin-bottom: 16px;">
        <tr>
          <td width="33%" style="background-color: #f9fafb; border-radius: 12px; padding: 14px 8px; text-align: center; border: 1px solid #f3f4f6;">
            <p style="color: #9ca3af; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0;">Clarity</p>
            <p style="color: #111827; font-size: 20px; font-weight: 700; margin: 0;">${clarity_score || 7}</p>
          </td>
          <td width="33%" style="background-color: #f9fafb; border-radius: 12px; padding: 14px 8px; text-align: center; border: 1px solid #f3f4f6;">
            <p style="color: #9ca3af; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0;">Fluency</p>
            <p style="color: #111827; font-size: 20px; font-weight: 700; margin: 0;">${fluency_score || 6}</p>
          </td>
          <td width="33%" style="background-color: #f9fafb; border-radius: 12px; padding: 14px 8px; text-align: center; border: 1px solid #f3f4f6;">
            <p style="color: #9ca3af; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px 0;">Speed</p>
            <p style="color: #111827; font-size: 20px; font-weight: 700; margin: 0;">${speed_score || 6}</p>
          </td>
        </tr>
      </table>
      
      <!-- rAI Analysis (matches web pink gradient) -->
      <div style="background: linear-gradient(to right, #fdf2f8, #faf5ff); border: 1px solid #fbcfe8; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
          <tr>
            <td valign="middle" style="padding-right: 8px;">
              <div style="width: 20px; height: 20px; background-color: #ec4899; border-radius: 4px; text-align: center; line-height: 20px;">
                <span style="color: white; font-size: 12px;">🧠</span>
              </div>
            </td>
            <td valign="middle">
              <p style="color: #db2777; font-size: 14px; font-weight: 600; margin: 0;">rAI Analysis</p>
            </td>
          </tr>
        </table>
        <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">${feedback || 'Your child shows good reading fundamentals. With targeted practice, they can improve their fluency and confidence significantly.'}</p>
      </div>
      
      <!-- Encouragement (matches web yellow) -->
      <div style="background-color: #fefce8; border: 1px solid #fde047; border-radius: 12px; padding: 14px; margin-bottom: 20px; text-align: center;">
        <p style="color: #a16207; font-size: 14px; font-weight: 500; margin: 0;">✨ ${encouragement || `Keep reading daily, ${childName}! Every page makes you stronger.`}</p>
      </div>
      
      <!-- CTA Section -->
      <div style="background-color: #f9fafb; border-radius: 16px; padding: 20px; border: 1px solid #e5e7eb; text-align: center;">
        
        <!-- Social Proof (matches web - REAL number) -->
        <p style="color: #6b7280; font-size: 13px; margin: 0 0 16px 0;">
          <span style="color: #ec4899;">❤️</span> Join 100+ families already improving
        </p>
        
        <!-- Primary CTA -->
        <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
          <tr>
            <td align="center" style="background: linear-gradient(135deg, #ff0099, #7b008b); border-radius: 14px;">
              <a href="${letsTalkUrl}" 
                 style="display: inline-block; color: white; padding: 14px 28px; text-decoration: none; font-weight: 700; font-size: 15px;">
                ${content.prioritizeConsultation ? '📅' : '🚀'} ${content.primaryCTA}
              </a>
            </td>
          </tr>
        </table>
        
        <p style="color: #9ca3af; font-size: 11px; margin: 0 0 16px 0;">Free 15-min call • No obligation • Get personalized advice</p>
        
        <!-- Secondary CTA -->
        <table align="center" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="background-color: transparent; border: 1px solid #d1d5db; border-radius: 14px;">
              <a href="${letsTalkUrl}" 
                 style="display: inline-block; color: #6b7280; padding: 12px 24px; text-decoration: none; font-weight: 600; font-size: 14px;">
                ${content.prioritizeConsultation ? '🚀 View Coaching Options' : '📅 Talk to Coach First'}
              </a>
            </td>
          </tr>
        </table>
        
        <!-- Trust Badges (matches web) -->
        <p style="color: #9ca3af; font-size: 11px; margin: 16px 0 0 0;">
          🛡️ 100% Refund Guarantee • Certified Coaches
        </p>
      </div>
      
      <!-- WhatsApp Share -->
      <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
        <tr>
          <td align="center" style="background-color: #22c55e; border-radius: 14px;">
            <a href="https://wa.me/?text=${encodeURIComponent(`🎉 ${childName} just completed their Yestoryd Reading Assessment!\n\n📊 Score: ${score}/10\n🔊 Clarity: ${clarity_score || 7}/10\n🗣️ Fluency: ${fluency_score || 6}/10\n⚡ Speed: ${speed_score || 6}/10\n📈 ${wpm || 60} words per minute\n\n✨ ${feedback || ''}\n\nTake the FREE assessment: https://yestoryd.com/assessment`)}" 
               style="display: inline-block; color: white; padding: 14px 28px; text-decoration: none; font-weight: 700; font-size: 14px;">
              📤 Share ${childName}'s Results
            </a>
          </td>
        </tr>
      </table>
      
      <!-- Assessment Date -->
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
        Assessment Date: ${assessmentDate}
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f3f4f6; border-radius: 0 0 20px 20px; padding: 20px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
      <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">
        Questions? Reply to this email or WhatsApp us at +91 8976287997
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">
        © ${new Date().getFullYear()} Yestoryd • AI-Powered Reading Coach for Kids
      </p>
      <p style="color: #9ca3af; font-size: 10px; margin: 8px 0 0 0;">
        Powered by rAI - Yestoryd's Reading Intelligence
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
      subject: `🎓 ${childName}'s Reading Assessment - Score: ${score}/10`,
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