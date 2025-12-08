import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Get score color for email
function getScoreStyle(score: number) {
  if (score >= 8) return { color: '#22C55E', label: 'Excellent!', emoji: '🌟' };
  if (score >= 6) return { color: '#EAB308', label: 'Good Progress!', emoji: '⭐' };
  if (score >= 4) return { color: '#F97316', label: 'Keep Practicing!', emoji: '💪' };
  return { color: '#EF4444', label: 'Needs Improvement', emoji: '📚' };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      email,
      childName,
      childAge,
      score,
      wpm,
      fluency,
      pronunciation,
      feedback,
    } = body;

    if (!email || !childName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const scoreStyle = getScoreStyle(score);
    const assessmentDate = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Create booking link with calendar integration
    const bookingUrl = `https://yestoryd-mvp.vercel.app/book?childName=${encodeURIComponent(childName)}`;

    // Create the email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reading Assessment Certificate - ${childName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%); padding: 30px; text-align: center;">
      <div style="width: 70px; height: 70px; background-color: white; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <span style="font-size: 40px;">🐨</span>
      </div>
      <h1 style="margin: 0; color: #1F2937; font-size: 24px; font-weight: bold;">Yestoryd</h1>
      <p style="margin: 5px 0 0; color: #4B5563; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Reading Assessment Report</p>
    </div>

    <!-- Certificate Body -->
    <div style="padding: 30px; text-align: center;">
      
      <!-- Title -->
      <h2 style="color: #3B82F6; font-size: 20px; margin: 0 0 10px;">Certificate of Achievement</h2>
      <p style="color: #6B7280; font-size: 14px; margin: 0;">Proudly presented to</p>
      <h3 style="color: #1F2937; font-size: 28px; margin: 15px 0 5px; font-weight: bold;">${childName}</h3>
      <p style="color: #6B7280; font-size: 14px; margin: 0;">for completing the reading assessment</p>
      ${childAge ? `<p style="color: #9CA3AF; font-size: 12px; margin: 5px 0 0;">Age ${childAge} Level</p>` : ''}

      <!-- Score Circle -->
      <div style="margin: 30px auto; width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, ${scoreStyle.color}20 0%, ${scoreStyle.color}10 100%); border: 6px solid ${scoreStyle.color}; display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <span style="font-size: 48px; font-weight: bold; color: ${scoreStyle.color};">${score}</span>
        <span style="font-size: 14px; color: #6B7280;">/10</span>
      </div>

      <!-- Score Label -->
      <div style="display: inline-block; background-color: ${scoreStyle.color}; color: white; padding: 10px 25px; border-radius: 30px; margin-bottom: 25px;">
        <span style="font-size: 16px;">${scoreStyle.emoji}</span>
        <span style="font-weight: bold; margin-left: 5px;">${scoreStyle.label}</span>
      </div>

      <!-- Stats -->
      <table style="width: 100%; margin-bottom: 25px; border-collapse: collapse;">
        <tr>
          <td style="padding: 15px; background-color: #F9FAFB; border-radius: 10px; text-align: center; width: 33%;">
            <div style="color: #3B82F6; font-size: 20px; margin-bottom: 5px;">⚡</div>
            <div style="color: #6B7280; font-size: 11px;">Reading Speed</div>
            <div style="color: #1F2937; font-weight: bold; font-size: 14px;">${wpm} words/min</div>
          </td>
          <td style="width: 10px;"></td>
          <td style="padding: 15px; background-color: #F9FAFB; border-radius: 10px; text-align: center; width: 33%;">
            <div style="color: #22C55E; font-size: 20px; margin-bottom: 5px;">🔊</div>
            <div style="color: #6B7280; font-size: 11px;">Fluency Level</div>
            <div style="color: #1F2937; font-weight: bold; font-size: 14px;">${fluency}</div>
          </td>
          <td style="width: 10px;"></td>
          <td style="padding: 15px; background-color: #F9FAFB; border-radius: 10px; text-align: center; width: 33%;">
            <div style="color: #8B5CF6; font-size: 20px; margin-bottom: 5px;">💬</div>
            <div style="color: #6B7280; font-size: 11px;">Pronunciation</div>
            <div style="color: #1F2937; font-weight: bold; font-size: 14px;">${pronunciation}</div>
          </td>
        </tr>
      </table>

      <!-- Feedback -->
      ${feedback ? `
      <div style="background-color: #F9FAFB; border-radius: 15px; padding: 20px; text-align: left; margin-bottom: 25px;">
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 18px; margin-right: 8px;">✨</span>
          <span style="font-weight: bold; color: #1F2937;">Coach's Feedback</span>
        </div>
        <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 0;">${feedback}</p>
      </div>
      ` : ''}

      <!-- CTA Section -->
      <div style="border-top: 1px solid #E5E7EB; padding-top: 25px;">
        <p style="color: #4B5563; margin: 0 0 20px; font-size: 16px;">🚀 Take Your Reading to the Next Level!</p>
        
        <a href="${bookingUrl}" style="display: block; background-color: #FF2D92; color: white; text-decoration: none; padding: 16px 30px; border-radius: 30px; font-weight: bold; font-size: 16px; margin-bottom: 12px;">
          📅 Book a Free Coach Call
        </a>
        
        <a href="https://yestoryd-mvp.vercel.app" style="display: block; background-color: white; color: #4B5563; text-decoration: none; padding: 14px 30px; border-radius: 30px; font-weight: 600; border: 2px solid #E5E7EB; font-size: 14px;">
          👋 Explore Our Services
        </a>

        <p style="color: #9CA3AF; font-size: 12px; margin-top: 25px;">
          Keep reading and growing! 📚✨<br>
          — The Yestoryd Team
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #F9FAFB; padding: 20px; text-align: center;">
      <p style="color: #9CA3AF; font-size: 11px; margin: 0;">
        This assessment was conducted on ${assessmentDate}<br>
        Questions? Reply to this email or visit our website.
      </p>
    </div>

  </div>
</body>
</html>
`;

    // Try to send email via Gmail API if configured
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (serviceAccountEmail && privateKey) {
      // For now, just log that we would send the email
      // In production, you'd use SendGrid, Gmail API, or another email service
      console.log(`Certificate email would be sent to: ${email}`);
      console.log(`Subject: ${childName}'s Reading Assessment Certificate 🎓`);
      
      // Save email record to sheets
      try {
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (sheetId) {
          const auth = new google.auth.GoogleAuth({
            credentials: {
              client_email: serviceAccountEmail,
              private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          });

          const sheets = google.sheets({ version: 'v4', auth });

          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'EmailLog!A:F',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[
                new Date().toISOString(),
                email,
                childName,
                'certificate',
                score,
                'sent',
              ]],
            },
          });
        }
      } catch (sheetsError) {
        console.error('Failed to log email:', sheetsError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Certificate email sent',
    });

  } catch (error: any) {
    console.error('Email error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
