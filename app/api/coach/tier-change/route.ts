// ============================================================
// FILE: app/api/coach/tier-change/route.ts
// ============================================================
// Send Email + WhatsApp notification when coach tier changes
// Called by admin when manually changing coach tier

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// AiSensy WhatsApp API
const AISENSY_API_KEY = process.env.AISENSY_API_KEY;
const AISENSY_API_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';

// SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

interface TierChangeRequest {
  coachId: string;
  oldTierName: string;
  newTierName: string;
  newTierDisplayName: string;
  newCoachPercent: number;
  newLeadPercent: number;
  isPromotion: boolean; // true = promotion, false = demotion
  reason?: string; // Optional reason for demotion
}

// Tier emojis for messages
const TIER_EMOJIS: Record<string, string> = {
  rising: '🌱',
  expert: '⭐',
  master: '👑',
  founding: '✨',
};

export async function POST(request: NextRequest) {
  try {
    const body: TierChangeRequest = await request.json();
    const {
      coachId,
      oldTierName,
      newTierName,
      newTierDisplayName,
      newCoachPercent,
      newLeadPercent,
      isPromotion,
      reason,
    } = body;

    // Get coach details
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('name, email, phone')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { success: false, error: 'Coach not found' },
        { status: 404 }
      );
    }

    const results = {
      email: { sent: false, error: null as string | null },
      whatsapp: { sent: false, error: null as string | null },
    };

    // Calculate earnings
    const enrollmentAmount = 5999;
    const coachEarnings = Math.round(enrollmentAmount * newCoachPercent / 100);
    const coachEarningsWithLead = Math.round(
      enrollmentAmount * (newCoachPercent + newLeadPercent) / 100
    );

    const tierEmoji = TIER_EMOJIS[newTierName] || '🎯';

    // ==========================================
    // SEND EMAIL (SendGrid)
    // ==========================================
    if (coach.email && SENDGRID_API_KEY) {
      try {
        const subject = isPromotion
          ? `🎉 Congratulations! You've been promoted to ${newTierDisplayName}`
          : `Important: Your coach tier has been updated`;

        const htmlContent = isPromotion
          ? generatePromotionEmail(coach.name, newTierDisplayName, newCoachPercent, newLeadPercent, coachEarnings, coachEarningsWithLead)
          : generateDemotionEmail(coach.name, newTierDisplayName, newCoachPercent, reason);

        const emailResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [
              {
                to: [{ email: coach.email, name: coach.name }],
              },
            ],
            from: {
              email: 'team@yestoryd.com',
              name: 'Yestoryd Team',
            },
            subject,
            content: [
              {
                type: 'text/html',
                value: htmlContent,
              },
            ],
          }),
        });

        results.email.sent = emailResponse.ok;
        if (!emailResponse.ok) {
          results.email.error = `SendGrid error: ${emailResponse.status}`;
        }
      } catch (emailError: any) {
        results.email.error = emailError.message;
      }
    }

    // ==========================================
    // SEND WHATSAPP (AiSensy)
    // ==========================================
    if (coach.phone && AISENSY_API_KEY) {
      try {
        // Format phone number (ensure +91)
        let phone = coach.phone.replace(/\D/g, '');
        if (phone.length === 10) phone = `91${phone}`;
        if (!phone.startsWith('91')) phone = `91${phone}`;

        // Use appropriate template based on promotion/demotion
        const templateName = isPromotion
          ? 'coach_tier_promotion' // You'll need to create this in AiSensy
          : 'coach_tier_update';

        const whatsappResponse = await fetch(AISENSY_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: AISENSY_API_KEY,
            campaignName: templateName,
            destination: phone,
            userName: coach.name,
            templateParams: isPromotion
              ? [
                  coach.name.split(' ')[0], // First name
                  tierEmoji,
                  newTierDisplayName,
                  `${newCoachPercent}%`,
                  `₹${coachEarnings.toLocaleString()}`,
                  `₹${coachEarningsWithLead.toLocaleString()}`,
                ]
              : [
                  coach.name.split(' ')[0],
                  newTierDisplayName,
                  `${newCoachPercent}%`,
                  reason || 'performance review',
                ],
          }),
        });

        const whatsappResult = await whatsappResponse.json();
        results.whatsapp.sent = whatsappResult.status === 'success' || whatsappResponse.ok;
        if (!results.whatsapp.sent) {
          results.whatsapp.error = whatsappResult.message || 'WhatsApp send failed';
        }
      } catch (whatsappError: any) {
        results.whatsapp.error = whatsappError.message;
      }
    }

    // Log the tier change
    try {
      await supabase.from('coach_tier_changes').insert({
        coach_id: coachId,
        old_tier: oldTierName,
        new_tier: newTierName,
        is_promotion: isPromotion,
        reason: reason,
        email_sent: results.email.sent,
        whatsapp_sent: results.whatsapp.sent,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Table might not exist yet, ignore
    }

    return NextResponse.json({
      success: true,
      coach: { name: coach.name, email: coach.email },
      notifications: results,
    });
  } catch (error: any) {
    console.error('Tier change notification error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ==========================================
// EMAIL TEMPLATES
// ==========================================
function generatePromotionEmail(
  coachName: string,
  tierName: string,
  coachPercent: number,
  leadPercent: number,
  earnings: number,
  earningsWithLead: number
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ff0099, #7b008b); padding: 30px; border-radius: 16px 16px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 16px 16px; }
    .tier-badge { display: inline-block; background: linear-gradient(135deg, #ff0099, #7b008b); color: white; padding: 8px 20px; border-radius: 50px; font-weight: bold; font-size: 18px; margin: 20px 0; }
    .earnings-box { background: white; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .earnings-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .earnings-row:last-child { border-bottom: none; }
    .earnings-label { color: #666; }
    .earnings-value { font-weight: bold; color: #22c55e; font-size: 18px; }
    .cta-button { display: inline-block; background: #ff0099; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Congratulations!</h1>
      <p>You've earned a promotion</p>
    </div>
    <div class="content">
      <p>Dear ${coachName.split(' ')[0]},</p>
      
      <p>We're thrilled to announce that based on your outstanding performance and dedication, you've been promoted to:</p>
      
      <div style="text-align: center;">
        <span class="tier-badge">${tierName}</span>
      </div>
      
      <p>Your new earnings structure:</p>
      
      <div class="earnings-box">
        <div class="earnings-row">
          <span class="earnings-label">Yestoryd Lead (${coachPercent}%)</span>
          <span class="earnings-value">₹${earnings.toLocaleString()}</span>
        </div>
        <div class="earnings-row">
          <span class="earnings-label">Your Own Lead (${coachPercent + leadPercent}%)</span>
          <span class="earnings-value">₹${earningsWithLead.toLocaleString()}</span>
        </div>
      </div>
      
      <p>This change is effective immediately and applies to all future enrollments.</p>
      
      <p>Keep up the amazing work! Your students and their families appreciate your dedication.</p>
      
      <div style="text-align: center;">
        <a href="https://yestoryd.com/coach/dashboard" class="cta-button">View Your Dashboard</a>
      </div>
      
      <div class="footer">
        <p>With gratitude,<br><strong>The Yestoryd Team</strong></p>
        <p style="font-size: 12px; color: #aaa;">Yestoryd • AI-Powered Reading Intelligence</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

function generateDemotionEmail(
  coachName: string,
  tierName: string,
  coachPercent: number,
  reason?: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #475569; padding: 30px; border-radius: 16px 16px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 16px 16px; }
    .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .cta-button { display: inline-block; background: #00abff; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Important: Tier Update</h1>
    </div>
    <div class="content">
      <p>Dear ${coachName.split(' ')[0]},</p>
      
      <p>We wanted to inform you that your coach tier has been updated to <strong>${tierName}</strong>.</p>
      
      ${reason ? `
      <div class="info-box">
        <strong>Reason:</strong> ${reason}
      </div>
      ` : ''}
      
      <p>Your earnings will now be <strong>${coachPercent}%</strong> per enrollment for Yestoryd-sourced leads.</p>
      
      <p>We believe in your potential and are here to support you. If you'd like to discuss this or get tips on improving your performance, please reach out to us.</p>
      
      <p>Remember, you can always work your way back up by:</p>
      <ul>
        <li>Maintaining high NPS scores from parents</li>
        <li>Completing sessions consistently</li>
        <li>Engaging proactively with your students</li>
      </ul>
      
      <div style="text-align: center;">
        <a href="https://yestoryd.com/coach/dashboard" class="cta-button">View Your Dashboard</a>
      </div>
      
      <div class="footer">
        <p>We're here to help,<br><strong>The Yestoryd Team</strong></p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}