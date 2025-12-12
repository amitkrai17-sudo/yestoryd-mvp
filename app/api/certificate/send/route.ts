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
    const { email, childName, childAge, score, wpm, fluency, pronunciation, feedback } = body;

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

    // Get score color and label
    const getScoreInfo = (s: number) => {
      if (s >= 8) return { color: '#22c55e', bg: '#166534', label: 'Reading Wizard', emoji: '🧙‍♂️' };
      if (s >= 5) return { color: '#eab308', bg: '#854d0e', label: 'Reading Star', emoji: '⭐' };
      return { color: '#f97316', bg: '#9a3412', label: 'Budding Reader', emoji: '🌱' };
    };

    const scoreInfo = getScoreInfo(score);
    const assessmentDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Mobile-optimized HTML email template
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${childName}'s Reading Assessment Certificate</title>
  <!--[if mso]>
  <style type="text/css">
    table, td {border-collapse: collapse;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <!-- Wrapper Table -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #111827;">
    <tr>
      <td align="center" style="padding: 20px 15px;">
        
        <!-- Main Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 420px; background-color: #1f2937; border-radius: 24px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #374151 0%, #1f2937 100%); padding: 28px 20px; text-align: center; border-bottom: 3px solid #ec4899;">
              <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #ec4899;">Yest</span><span style="color: white;">or</span><span style="color: #facc15;">yd</span>
              </h1>
              <p style="color: #9ca3af; margin: 12px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">Reading Assessment Certificate</p>
            </td>
          </tr>

          <!-- Certificate Body -->
          <tr>
            <td style="padding: 32px 24px; text-align: center;">
              
              <!-- Child Name -->
              <p style="color: #60a5fa; font-size: 18px; margin: 0; font-weight: 700; letter-spacing: 0.5px;">Certificate of Achievement</p>
              <p style="color: #9ca3af; font-size: 12px; margin: 6px 0 0 0;">Proudly presented to</p>
              <h2 style="color: white; font-size: 36px; margin: 12px 0 4px 0; font-weight: 700;">${childName}</h2>
              ${childAge ? `<p style="color: #6b7280; font-size: 14px; margin: 0;">Age ${childAge}</p>` : ''}

              <!-- Score Circle - Centered -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 32px 0;">
                    <div style="width: 130px; height: 130px; border-radius: 50%; border: 8px solid ${scoreInfo.color}; background-color: #111827; display: inline-block; line-height: 114px; text-align: center;">
                      <span style="color: ${scoreInfo.color}; font-size: 56px; font-weight: 800;">${score}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Score Label -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="background-color: ${scoreInfo.color}; color: white; padding: 12px 28px; border-radius: 50px; font-size: 16px; font-weight: 700; text-align: center;">
                    ${scoreInfo.emoji} ${scoreInfo.label}
                  </td>
                </tr>
              </table>

              <!-- Stats - Equal Height Cards -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 28px;">
                <tr>
                  <!-- Speed -->
                  <td width="32%" style="padding: 0 4px;" valign="top">
                    <div style="background-color: #111827; border-radius: 16px; padding: 18px 8px; text-align: center; height: 80px;">
                      <p style="color: #60a5fa; font-size: 11px; margin: 0; font-weight: 600;">Speed</p>
                      <p style="color: white; font-size: 24px; font-weight: 800; margin: 8px 0 4px 0;">${wpm}</p>
                      <p style="color: #6b7280; font-size: 10px; margin: 0; text-transform: uppercase;">WPM</p>
                    </div>
                  </td>
                  <!-- Fluency -->
                  <td width="34%" style="padding: 0 4px;" valign="top">
                    <div style="background-color: #111827; border-radius: 16px; padding: 18px 8px; text-align: center; height: 80px;">
                      <p style="color: #22c55e; font-size: 11px; margin: 0; font-weight: 600;">Fluency</p>
                      <p style="color: white; font-size: 18px; font-weight: 700; margin: 14px 0 0 0;">${fluency}</p>
                    </div>
                  </td>
                  <!-- Clarity -->
                  <td width="34%" style="padding: 0 4px;" valign="top">
                    <div style="background-color: #111827; border-radius: 16px; padding: 18px 8px; text-align: center; height: 80px;">
                      <p style="color: #a855f7; font-size: 11px; margin: 0; font-weight: 600;">Clarity</p>
                      <p style="color: white; font-size: 16px; font-weight: 700; margin: 14px 0 0 0;">${pronunciation}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Feedback - Expanded Box -->
              ${feedback ? `
              <div style="background-color: #111827; border-radius: 16px; padding: 24px; margin-top: 24px; text-align: left; border: 1px solid #374151;">
                <p style="color: #facc15; font-size: 15px; font-weight: 700; margin: 0 0 14px 0;">✨ Coach's Feedback</p>
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0;">${feedback}</p>
              </div>
              ` : ''}

              <!-- Date -->
              <p style="color: #6b7280; font-size: 12px; margin: 28px 0 0 0;">
                ${assessmentDate} • yestoryd.com
              </p>
            </td>
          </tr>

          <!-- CTA Section - Score Based, Matches Web Exactly -->
          <tr>
            <td style="padding: 0 20px 28px 20px;">
              <div style="background: linear-gradient(135deg, #ec4899 0%, #f97316 100%); border-radius: 20px; padding: 28px 20px; text-align: center;">
                <h3 style="color: white; font-size: 22px; margin: 0; font-weight: 800; line-height: 1.3;">🎯 ${score >= 8 ? `${childName} is a reading star!` : score >= 6 ? `${childName} shows great potential!` : score >= 4 ? `${childName} is ready to improve!` : `${childName} needs expert guidance`}</h3>
                <p style="color: rgba(255,255,255,0.9); font-size: 15px; margin: 10px 0 24px 0; line-height: 1.5;">
                  ${score >= 8 ? 'Take their skills to the advanced level' : score >= 6 ? 'Unlock their full reading abilities' : score >= 4 ? 'Accelerate their reading progress' : 'Get personalized support from our coaches'}
                </p>
                
                <!-- Primary CTA Button - Score Based -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom: 16px;">
                  <tr>
                    <td>
                      <a href="https://yestoryd.com/checkout?childName=${encodeURIComponent(childName)}&parentEmail=${encodeURIComponent(email)}&package=coaching-6" 
                         style="display: inline-block; background-color: white; color: #ec4899; padding: 18px 32px; border-radius: 50px; text-decoration: none; font-weight: 800; font-size: 17px; box-shadow: 0 4px 14px rgba(0,0,0,0.2);">
                        ${score >= 8 ? `Take ${childName} to Advanced Level` : score >= 6 ? `Unlock ${childName}'s Full Potential` : score >= 4 ? `Accelerate ${childName}'s Progress` : `Get ${childName} the Help They Need`}
                      </a>
                    </td>
                  </tr>
                </table>
                
                <p style="color: rgba(255,255,255,0.95); font-size: 18px; font-weight: 700; margin: 0 0 8px 0;">
                  ₹5,999 <span style="font-size: 13px; font-weight: 400;">one-time</span>
                </p>
                <p style="color: rgba(255,255,255,0.8); font-size: 12px; margin: 0;">
                  ✓ 6 personalized sessions &nbsp;&nbsp; ✓ 100% refund guarantee
                </p>
              </div>
              
              <!-- Secondary CTA - Talk to Coach First (Full Width) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top: 20px;">
                <tr>
                  <td>
                    <a href="https://yestoryd.com/book" 
                       style="display: block; background-color: #1f2937; color: white; padding: 16px 20px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; border: 2px solid #60a5fa; text-align: center; line-height: 1.4;">
                      📅 Talk to ${childName}'s Coach First
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 10px; text-align: center;">
                    <span style="color: #9ca3af; font-size: 13px;">Free 15-min call • No obligation</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #111827; padding: 20px; text-align: center; border-top: 1px solid #374151;">
              <p style="color: #6b7280; font-size: 11px; margin: 0; line-height: 1.6;">
                This certificate was generated by Yestoryd's AI Reading Assessment.<br>
                Questions? Reply to this email or visit <a href="https://yestoryd.com" style="color: #ec4899; text-decoration: none;">yestoryd.com</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- End Main Container -->

      </td>
    </tr>
  </table>
  <!-- End Wrapper -->

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
      subject: `🎓 ${childName}'s Reading Assessment Certificate`,
      html: htmlContent,
    };

    await sgMail.send(msg);
    console.log(`✅ Certificate email sent to ${email}`);

    return NextResponse.json({ success: true, message: 'Certificate email sent' });

  } catch (error: any) {
    console.error('Email send error:', error);
    
    // Return success anyway so UI doesn't break
    return NextResponse.json({ 
      success: true, 
      message: 'Certificate generated (email may be delayed)',
      error: error.message 
    });
  }
}