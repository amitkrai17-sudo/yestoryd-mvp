// file: app/api/certificate/send/route.ts
// Email template - EXACT match to assessment result UI

import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const COLORS = {
  pink: '#ff0099',
  blue: '#00abff',
  purple: '#7b008b',
  yellow: '#ffde00',
  white: '#ffffff',
  lightGray: '#f8f9fa',
  darkGray: '#333333',
  mediumGray: '#666666',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
};

function getHeadline(score: number, name: string): { headline: string; subheadline: string } {
  if (score >= 8) return { headline: `${name} is doing amazingly!`, subheadline: 'A true reading champion' };
  if (score >= 6) return { headline: `${name} is doing wonderfully!`, subheadline: 'Ready to reach the next level' };
  if (score >= 4) return { headline: `${name} is making progress!`, subheadline: 'Ready to accelerate learning' };
  return { headline: `${name} needs support`, subheadline: 'Expert coaching can help' };
}

function getInsight(score: number, age: number): string {
  if (score >= 8) return `${score}/10 is excellent for age ${age}! Advanced coaching can take skills even higher.`;
  if (score >= 6) return `${score}/10 is above average for ages ${age}+! Coaching can help reach excellence.`;
  if (score >= 4) return `${score}/10 shows potential for age ${age}. Focused coaching will accelerate progress.`;
  return `${score}/10 indicates coaching would be highly beneficial. Expert support makes a big difference.`;
}

function getScoreColor(score: number): string {
  if (score >= 8) return COLORS.green;
  if (score >= 6) return COLORS.pink;
  if (score >= 4) return COLORS.orange;
  return COLORS.red;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Certificate email request:', JSON.stringify(body, null, 2));
    
    const {
      email,
      childName,
      childAge,
      score,
      wpm,
      fluencyScore,
      clarityScore,
      speedScore,
      feedback,
      phonicsAnalysis,
      skillBreakdown,
      errorClassification,
      practiceRecommendations,
      strengths,
      areasToImprove,
    } = body;

    if (!email || !childName) {
      return NextResponse.json({ error: 'Email and child name required' }, { status: 400 });
    }

    const finalScore = score || 0;
    const finalFluencyScore = fluencyScore ?? body.fluency_score ?? finalScore;
    const finalClarityScore = clarityScore ?? body.clarity_score ?? finalScore;
    const finalSpeedScore = speedScore ?? body.speed_score ?? finalScore;
    const finalWpm = wpm || 0;
    const finalAge = childAge || '';
    
    const { headline, subheadline } = getHeadline(finalScore, childName);
    const insight = getInsight(finalScore, parseInt(finalAge) || 8);
    const scoreColor = getScoreColor(finalScore);
    const currentDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // Build skills breakdown section (if available)
    let skillsHtml = '';
    if (skillBreakdown && Object.keys(skillBreakdown).length > 0) {
      const skills = [
        { key: 'decoding', label: 'Decoding' },
        { key: 'sight_words', label: 'Sight Words' },
        { key: 'blending', label: 'Blending' },
        { key: 'segmenting', label: 'Segmenting' },
        { key: 'expression', label: 'Expression' },
        { key: 'comprehension_indicators', label: 'Comprehension' },
      ];
      
      const skillRows = skills
        .filter(s => skillBreakdown[s.key] && skillBreakdown[s.key].score)
        .map(s => {
          const data = skillBreakdown[s.key];
          const pct = (data.score / 10) * 100;
          const color = data.score >= 7 ? COLORS.green : data.score >= 5 ? COLORS.pink : COLORS.red;
          return `
            <tr>
              <td style="padding: 6px 0;">
                <table style="width: 100%;" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color: ${COLORS.darkGray}; font-size: 13px;">${s.label}</td>
                    <td style="text-align: right; color: ${COLORS.purple}; font-weight: bold; font-size: 13px;">${data.score}/10</td>
                  </tr>
                </table>
                <div style="background: #e5e7eb; border-radius: 4px; height: 6px; margin-top: 4px;">
                  <div style="background: ${color}; height: 6px; width: ${pct}%; border-radius: 4px;"></div>
                </div>
              </td>
            </tr>
          `;
        }).join('');

      if (skillRows) {
        skillsHtml = `
          <div style="background: white; border-radius: 16px; padding: 20px; margin: 16px 0; border: 1px solid #e5e7eb;">
            <p style="color: ${COLORS.purple}; font-size: 14px; font-weight: bold; margin: 0 0 16px;">📊 Skills Breakdown</p>
            <table style="width: 100%;" cellpadding="0" cellspacing="0">${skillRows}</table>
          </div>
        `;
      }
    }

    // Build phonics section
    let phonicsHtml = '';
    if (phonicsAnalysis) {
      const struggling = phonicsAnalysis.struggling_phonemes || [];
      const strong = phonicsAnalysis.strong_phonemes || [];
      const focus = phonicsAnalysis.recommended_focus;

      if (focus || struggling.length > 0 || strong.length > 0) {
        phonicsHtml = `
          <div style="background: white; border-radius: 16px; padding: 20px; margin: 16px 0; border: 1px solid #e5e7eb;">
            <p style="color: ${COLORS.purple}; font-size: 14px; font-weight: bold; margin: 0 0 12px;">🔤 Phonics Analysis</p>
            
            ${focus ? `<p style="color: ${COLORS.darkGray}; font-size: 13px; margin: 0 0 12px;"><strong style="color: ${COLORS.pink};">Focus:</strong> ${focus}</p>` : ''}
            
            ${struggling.length > 0 ? `
              <p style="color: ${COLORS.mediumGray}; font-size: 11px; text-transform: uppercase; margin: 0 0 6px;">Needs Practice</p>
              <div style="margin-bottom: 12px;">${struggling.map((p: string) => `<span style="display: inline-block; background: #fef2f2; color: #dc2626; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin: 2px;">${p}</span>`).join('')}</div>
            ` : ''}
            
            ${strong.length > 0 ? `
              <p style="color: ${COLORS.mediumGray}; font-size: 11px; text-transform: uppercase; margin: 0 0 6px;">Strong</p>
              <div>${strong.map((p: string) => `<span style="display: inline-block; background: #f0fdf4; color: #16a34a; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin: 2px;">${p}</span>`).join('')}</div>
            ` : ''}
          </div>
        `;
      }
    }

    // Build practice recommendations
    let practiceHtml = '';
    if (practiceRecommendations) {
      const words = practiceRecommendations.daily_words || [];
      const activity = practiceRecommendations.suggested_activity;

      if (words.length > 0 || activity) {
        practiceHtml = `
          <div style="background: white; border-radius: 16px; padding: 20px; margin: 16px 0; border: 1px solid #e5e7eb;">
            <p style="color: ${COLORS.purple}; font-size: 14px; font-weight: bold; margin: 0 0 12px;">📝 Practice at Home</p>
            
            ${words.length > 0 ? `
              <p style="color: ${COLORS.mediumGray}; font-size: 11px; text-transform: uppercase; margin: 0 0 6px;">Daily Words</p>
              <div style="margin-bottom: 12px;">${words.map((w: string) => `<span style="display: inline-block; background: #eff6ff; color: ${COLORS.blue}; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; margin: 3px;">${w}</span>`).join('')}</div>
            ` : ''}
            
            ${activity ? `<p style="color: ${COLORS.darkGray}; font-size: 13px; margin: 0;"><strong style="color: ${COLORS.green};">🎯 Activity:</strong> ${activity}</p>` : ''}
          </div>
        `;
      }
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${childName}'s Reading Assessment Report</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; padding: 16px;">
    
    <!-- Header Bar -->
    <div style="background: linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple}); border-radius: 16px 16px 0 0; padding: 20px; text-align: center;">
      <div style="width: 60px; height: 60px; margin: 0 auto 8px; background: white; border-radius: 12px;">
        <img src="https://yestoryd.com/images/rai-mascot.png" alt="rAI" style="width: 60px; height: 60px; border-radius: 12px;" />
      </div>
      <h1 style="color: white; font-size: 22px; margin: 0;">Yestoryd</h1>
      <p style="color: rgba(255,255,255,0.85); font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin: 6px 0 0;">Reading Assessment Report</p>
    </div>
    
    <!-- Main Card -->
    <div style="background: white; padding: 24px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb; border-top: none;">
      
      <!-- Star + Headline -->
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 40px; margin-bottom: 8px;">⭐</div>
        <h2 style="color: ${COLORS.darkGray}; font-size: 22px; margin: 0 0 4px; text-transform: capitalize;">${headline}</h2>
        <p style="color: ${COLORS.mediumGray}; font-size: 14px; margin: 0;">${subheadline}</p>
      </div>
      
      <!-- Score Box (matching UI exactly) -->
      <div style="background: #faf5ff; border-radius: 16px; padding: 16px; margin-bottom: 16px;">
        <table style="width: 100%;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width: 70px; vertical-align: middle;">
              <div style="width: 56px; height: 56px; background: ${COLORS.purple}; border-radius: 50%; text-align: center; line-height: 56px;">
                <span style="color: white; font-size: 28px; font-weight: bold;">${finalScore}</span>
              </div>
            </td>
            <td style="vertical-align: middle; padding-left: 12px;">
              <p style="color: ${COLORS.mediumGray}; font-size: 11px; text-transform: uppercase; margin: 0;">Overall Score</p>
              <p style="color: ${COLORS.darkGray}; font-size: 16px; font-weight: bold; margin: 2px 0 0;">out of 10</p>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <p style="color: ${COLORS.mediumGray}; font-size: 11px; text-transform: uppercase; margin: 0;">Speed</p>
              <p style="color: ${COLORS.purple}; font-size: 20px; font-weight: bold; margin: 2px 0 0;">${finalWpm} <span style="font-size: 12px; font-weight: normal;">WPM</span></p>
            </td>
          </tr>
        </table>
        
        <!-- Insight -->
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e9d5ff;">
          <p style="color: ${COLORS.mediumGray}; font-size: 13px; margin: 0;">
            <span style="color: ${COLORS.yellow}; font-size: 14px;">💡</span> ${insight}
          </p>
        </div>
      </div>
      
      <!-- Three Stats (Clarity, Fluency, Speed) -->
      <table style="width: 100%; margin-bottom: 16px;" cellpadding="0" cellspacing="8">
        <tr>
          <td style="width: 33%; text-align: center; background: ${COLORS.lightGray}; border-radius: 12px; padding: 14px 8px;">
            <p style="color: ${COLORS.mediumGray}; font-size: 11px; text-transform: uppercase; margin: 0;">Clarity</p>
            <p style="color: ${COLORS.purple}; font-size: 24px; font-weight: bold; margin: 4px 0 0;">${finalClarityScore}</p>
          </td>
          <td style="width: 33%; text-align: center; background: ${COLORS.lightGray}; border-radius: 12px; padding: 14px 8px;">
            <p style="color: ${COLORS.mediumGray}; font-size: 11px; text-transform: uppercase; margin: 0;">Fluency</p>
            <p style="color: ${COLORS.purple}; font-size: 24px; font-weight: bold; margin: 4px 0 0;">${finalFluencyScore}</p>
          </td>
          <td style="width: 33%; text-align: center; background: ${COLORS.lightGray}; border-radius: 12px; padding: 14px 8px;">
            <p style="color: ${COLORS.mediumGray}; font-size: 11px; text-transform: uppercase; margin: 0;">Speed</p>
            <p style="color: ${COLORS.purple}; font-size: 24px; font-weight: bold; margin: 4px 0 0;">${finalSpeedScore}</p>
          </td>
        </tr>
      </table>
      
      <!-- rAI Analysis (Feedback) -->
      ${feedback ? `
        <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 16px; border-left: 4px solid ${COLORS.pink}; border: 1px solid #fce7f3; border-left: 4px solid ${COLORS.pink};">
          <p style="color: ${COLORS.pink}; font-size: 14px; font-weight: bold; margin: 0 0 8px;">
            <span style="margin-right: 6px;">🤖</span> rAI Analysis
          </p>
          <p style="color: ${COLORS.darkGray}; font-size: 13px; line-height: 1.6; margin: 0;">${feedback}</p>
        </div>
      ` : ''}
      
      <!-- Encouragement Banner -->
      <div style="background: linear-gradient(135deg, #fef9c3, #fef08a); border-radius: 12px; padding: 14px; margin-bottom: 16px; text-align: center;">
        <p style="color: #854d0e; font-size: 14px; font-weight: 600; margin: 0;">
          ✨ Keep reading daily, ${childName}! Every page makes you stronger.
        </p>
      </div>
      
      <!-- Skills, Phonics, Practice sections -->
      ${skillsHtml}
      ${phonicsHtml}
      ${practiceHtml}
      
      <!-- Social Proof -->
      <p style="text-align: center; color: ${COLORS.mediumGray}; font-size: 13px; margin: 16px 0;">
        ❤️ Join 100+ families already improving
      </p>
      
      <!-- Primary CTA -->
      <a href="https://yestoryd.com/checkout?source=email" style="display: block; background: ${COLORS.pink}; color: white; padding: 16px; border-radius: 30px; text-decoration: none; font-weight: bold; font-size: 16px; text-align: center; margin-bottom: 12px;">
        🚀 Unlock ${childName}'s Full Potential
      </a>
      
      <p style="text-align: center; color: ${COLORS.mediumGray}; font-size: 12px; margin: 0 0 16px;">
        100% Refund Guarantee • Start within 3-5 days
      </p>
      
      <!-- Secondary CTA -->
      <a href="https://yestoryd.com/lets-talk?source=email" style="display: block; background: white; color: ${COLORS.darkGray}; padding: 14px; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 14px; text-align: center; border: 1px solid #e5e7eb;">
        📅 Have Questions? Talk to Coach First
      </a>
      
      <!-- Date -->
      <p style="text-align: center; color: ${COLORS.mediumGray}; font-size: 11px; margin: 20px 0 0;">
        ${currentDate} • <a href="https://yestoryd.com" style="color: ${COLORS.pink}; text-decoration: none;">yestoryd.com</a>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 16px; color: ${COLORS.mediumGray}; font-size: 11px;">
      <p style="margin: 0;">Questions? Reply to this email or WhatsApp us</p>
    </div>
    
  </div>
</body>
</html>
    `;

    await sgMail.send({
      to: email,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'engage@yestoryd.com', name: 'Yestoryd - Reading Coach' },
      subject: `⭐ ${childName}'s Reading Assessment Report - Score: ${finalScore}/10`,
      html: emailHtml,
    });
    
    console.log('Certificate sent to', email, 'Scores:', { finalScore, finalFluencyScore, finalClarityScore, finalSpeedScore, finalWpm });
    return NextResponse.json({ success: true, message: 'Certificate sent' });

  } catch (error) {
    console.error('Certificate email error:', error);
    return NextResponse.json({ error: 'Failed to send certificate' }, { status: 500 });
  }
}