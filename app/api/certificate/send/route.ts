// file: app/api/certificate/send/route.ts
// Certificate email - FIXED: integer scores, no yellow on white

import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

// Brand Colors - NO YELLOW ON WHITE (poor contrast)
const COLORS = {
  pink: '#ff0099',
  blue: '#00abff',
  purple: '#7b008b',
  white: '#ffffff',
  lightGray: '#f8f9fa',
  darkGray: '#333333',
  mediumGray: '#666666',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
};

function getScoreColor(score: number): string {
  if (score >= 8) return COLORS.green;
  if (score >= 6) return COLORS.pink; // Changed from yellow
  if (score >= 4) return COLORS.orange;
  return COLORS.red;
}

function getScoreLabel(score: number): string {
  if (score >= 8) return 'Excellent!';
  if (score >= 6) return 'Good Progress!';
  if (score >= 4) return 'Keep Practicing!';
  return 'Needs Support';
}

function getScoreEmoji(score: number): string {
  if (score >= 8) return '🌟';
  if (score >= 6) return '⭐';
  if (score >= 4) return '💪';
  return '📚';
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
      // Accept BOTH formats - scores take priority
      fluency,           // Label format: "Good"
      pronunciation,     // Label format: "Clear"
      fluencyScore,      // Integer format: 8
      clarityScore,      // Integer format: 7
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

    // Use integer scores - fallback to 0 if not provided
    const finalFluencyScore = fluencyScore || 0;
    const finalClarityScore = clarityScore || 0;
    const finalSpeedScore = speedScore || 0;

    const scoreColor = getScoreColor(score);
    const scoreLabel = getScoreLabel(score);
    const scoreEmoji = getScoreEmoji(score);
    const currentDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    // Build skills section
    let skillsHtml = '';
    if (skillBreakdown) {
      const skills = [
        { key: 'decoding', label: '📖 Decoding' },
        { key: 'sight_words', label: '⚡ Sight Words' },
        { key: 'blending', label: '🔗 Blending' },
        { key: 'segmenting', label: '✂️ Segmenting' },
        { key: 'expression', label: '🎭 Expression' },
        { key: 'comprehension_indicators', label: '💡 Comprehension' },
      ];
      
      const skillRows = skills
        .filter(s => skillBreakdown[s.key])
        .map(s => {
          const data = skillBreakdown[s.key];
          const pct = (data.score / 10) * 100;
          const color = data.score >= 7 ? COLORS.green : data.score >= 5 ? COLORS.pink : COLORS.red;
          return `
            <tr>
              <td style="padding: 8px 0;">
                <div style="margin-bottom: 4px;">
                  <span style="color: ${COLORS.darkGray}; font-size: 14px;">${s.label}</span>
                  <span style="float: right; color: ${COLORS.purple}; font-weight: bold;">${data.score}/10</span>
                </div>
                <div style="background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
                  <div style="background: ${color}; height: 100%; width: ${pct}%; border-radius: 4px;"></div>
                </div>
                ${data.notes ? `<p style="color: ${COLORS.mediumGray}; font-size: 12px; margin: 4px 0 0;">${data.notes}</p>` : ''}
              </td>
            </tr>
          `;
        }).join('');

      if (skillRows) {
        skillsHtml = `
          <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <h3 style="color: ${COLORS.pink}; font-size: 16px; margin: 0 0 16px;">📊 Reading Skills Breakdown</h3>
            <table style="width: 100%;">${skillRows}</table>
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
          <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <h3 style="color: ${COLORS.pink}; font-size: 16px; margin: 0 0 16px;">🔤 Phonics Analysis</h3>
            
            ${focus ? `
              <div style="background: rgba(255,0,153,0.1); border: 1px solid ${COLORS.pink}; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                <p style="color: ${COLORS.pink}; font-size: 13px; margin: 0 0 4px; font-weight: 600;">💡 Focus Area</p>
                <p style="color: ${COLORS.darkGray}; font-size: 14px; margin: 0;">${focus}</p>
              </div>
            ` : ''}
            
            ${struggling.length > 0 ? `
              <div style="margin-bottom: 16px;">
                <p style="color: ${COLORS.mediumGray}; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Needs Practice</p>
                <div>${struggling.map((p: string) => `<span style="display: inline-block; background: rgba(239,68,68,0.15); color: #dc2626; padding: 4px 12px; border-radius: 16px; font-size: 13px; margin: 4px 4px 4px 0; border: 1px solid rgba(239,68,68,0.3);">${p}</span>`).join('')}</div>
              </div>
            ` : ''}
            
            ${strong.length > 0 ? `
              <div>
                <p style="color: ${COLORS.mediumGray}; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Strong Areas ✓</p>
                <div>${strong.map((p: string) => `<span style="display: inline-block; background: rgba(34,197,94,0.15); color: #16a34a; padding: 4px 12px; border-radius: 16px; font-size: 13px; margin: 4px 4px 4px 0; border: 1px solid rgba(34,197,94,0.3);">${p}</span>`).join('')}</div>
              </div>
            ` : ''}
          </div>
        `;
      }
    }

    // Build errors section
    let errorsHtml = '';
    if (errorClassification) {
      const subs = errorClassification.substitutions || [];
      const omits = errorClassification.omissions || [];
      const mispro = errorClassification.mispronunciations || [];
      
      if (subs.length + omits.length + mispro.length > 0) {
        errorsHtml = `
          <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <h3 style="color: ${COLORS.pink}; font-size: 16px; margin: 0 0 16px;">❌ Reading Errors</h3>
            
            ${subs.length > 0 ? `
              <div style="margin-bottom: 12px;">
                <p style="color: ${COLORS.mediumGray}; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Substitutions</p>
                ${subs.map((s: any) => `<div style="background: white; border-radius: 4px; padding: 8px 12px; margin-bottom: 4px; font-size: 14px; border: 1px solid #e5e7eb;"><span style="color: #dc2626; text-decoration: line-through;">${s.original}</span> → <span style="color: ${COLORS.blue};">${s.read_as}</span></div>`).join('')}
              </div>
            ` : ''}
            
            ${omits.length > 0 ? `
              <div style="margin-bottom: 12px;">
                <p style="color: ${COLORS.mediumGray}; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Skipped Words</p>
                <div>${omits.map((w: string) => `<span style="display: inline-block; background: rgba(249,115,22,0.15); color: #ea580c; padding: 4px 8px; border-radius: 4px; font-size: 13px; margin: 2px;">${w}</span>`).join('')}</div>
              </div>
            ` : ''}
            
            ${mispro.length > 0 ? `
              <div>
                <p style="color: ${COLORS.mediumGray}; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Mispronunciations</p>
                ${mispro.map((m: any) => `<div style="background: white; border-radius: 4px; padding: 8px 12px; margin-bottom: 4px; font-size: 14px; border: 1px solid #e5e7eb;"><strong style="color: ${COLORS.purple};">${m.word}:</strong> <span style="color: ${COLORS.mediumGray};">${m.issue}</span></div>`).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }
    }

    // Build practice section
    let practiceHtml = '';
    if (practiceRecommendations) {
      const words = practiceRecommendations.daily_words || [];
      const pFocus = practiceRecommendations.phonics_focus;
      const activity = practiceRecommendations.suggested_activity;

      if (words.length > 0 || pFocus || activity) {
        practiceHtml = `
          <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <h3 style="color: ${COLORS.pink}; font-size: 16px; margin: 0 0 16px;">📝 Practice at Home</h3>
            
            ${words.length > 0 ? `
              <div style="margin-bottom: 16px;">
                <p style="color: ${COLORS.mediumGray}; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Words to Practice Daily</p>
                <div>${words.map((w: string) => `<span style="display: inline-block; background: rgba(0,171,255,0.15); color: ${COLORS.blue}; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; margin: 4px; border: 1px solid rgba(0,171,255,0.3);">${w}</span>`).join('')}</div>
              </div>
            ` : ''}
            
            ${pFocus ? `
              <div style="background: rgba(123,0,139,0.1); border: 1px solid ${COLORS.purple}; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                <p style="color: ${COLORS.purple}; font-size: 13px; margin: 0 0 4px; font-weight: 600;">🔤 Phonics Focus</p>
                <p style="color: ${COLORS.darkGray}; font-size: 14px; margin: 0;">${pFocus}</p>
              </div>
            ` : ''}
            
            ${activity ? `
              <div style="background: rgba(34,197,94,0.1); border: 1px solid ${COLORS.green}; border-radius: 8px; padding: 12px;">
                <p style="color: #16a34a; font-size: 13px; margin: 0 0 4px; font-weight: 600;">🎯 Suggested Activity</p>
                <p style="color: ${COLORS.darkGray}; font-size: 14px; margin: 0;">${activity}</p>
              </div>
            ` : ''}
          </div>
        `;
      }
    }

    // Strengths & Areas
    let strengthsAreasHtml = '';
    if ((strengths?.length > 0) || (areasToImprove?.length > 0)) {
      strengthsAreasHtml = `
        <table style="width: 100%; margin: 20px 0;" cellpadding="0" cellspacing="0">
          <tr>
            ${strengths?.length > 0 ? `
              <td style="width: 48%; vertical-align: top; padding-right: 8px;">
                <div style="background: rgba(34,197,94,0.1); border: 1px solid ${COLORS.green}; border-radius: 12px; padding: 16px;">
                  <p style="color: #16a34a; font-size: 14px; font-weight: 600; margin: 0 0 8px;">✓ Strengths</p>
                  <ul style="margin: 0; padding-left: 16px; color: ${COLORS.darkGray}; font-size: 13px;">
                    ${strengths.map((s: string) => `<li style="margin-bottom: 4px;">${s}</li>`).join('')}
                  </ul>
                </div>
              </td>
            ` : ''}
            ${areasToImprove?.length > 0 ? `
              <td style="width: 48%; vertical-align: top; padding-left: 8px;">
                <div style="background: rgba(249,115,22,0.1); border: 1px solid ${COLORS.orange}; border-radius: 12px; padding: 16px;">
                  <p style="color: #ea580c; font-size: 14px; font-weight: 600; margin: 0 0 8px;">↑ To Improve</p>
                  <ul style="margin: 0; padding-left: 16px; color: ${COLORS.darkGray}; font-size: 13px;">
                    ${areasToImprove.map((a: string) => `<li style="margin-bottom: 4px;">${a}</li>`).join('')}
                  </ul>
                </div>
              </td>
            ` : ''}
          </tr>
        </table>
      `;
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
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, ${COLORS.pink}, ${COLORS.purple}); border-radius: 16px 16px 0 0;">
      <div style="width: 70px; height: 70px; margin: 0 auto 12px; background: white; border-radius: 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 36px;">📚</span>
      </div>
      <h1 style="color: white; font-size: 26px; margin: 0;">Yestoryd</h1>
      <p style="color: rgba(255,255,255,0.9); font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 8px 0 0;">Reading Assessment Report</p>
    </div>
    
    <!-- Certificate Body -->
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb; border-top: none;">
      
      <!-- Child Info -->
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="color: ${COLORS.blue}; font-size: 14px; margin: 0;">Certificate of Achievement</p>
        <p style="color: ${COLORS.mediumGray}; font-size: 13px; margin: 4px 0;">Proudly presented to</p>
        <h2 style="color: ${COLORS.purple}; font-size: 32px; margin: 8px 0;">${childName}</h2>
        ${childAge ? `<p style="color: ${COLORS.mediumGray}; font-size: 14px; margin: 0;">Age ${childAge}</p>` : ''}
      </div>
      
      <!-- Score Circle - PINK border instead of yellow -->
      <div style="text-align: center; margin: 30px 0;">
        <div style="width: 120px; height: 120px; margin: 0 auto; border-radius: 50%; border: 8px solid ${scoreColor}; display: flex; align-items: center; justify-content: center; background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <span style="font-size: 48px; font-weight: 800; color: ${scoreColor};">${score}</span>
        </div>
        <div style="display: inline-block; background: ${scoreColor}; color: white; padding: 8px 24px; border-radius: 20px; margin-top: 16px; font-weight: 600;">
          <span style="font-size: 18px; margin-right: 6px;">${scoreEmoji}</span>
          ${scoreLabel}
        </div>
      </div>
      
      <!-- Quick Stats - INTEGER SCORES -->
      <table style="width: 100%; margin: 24px 0; text-align: center;" cellpadding="0" cellspacing="8">
        <tr>
          <td style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 16px; width: 33%;">
            <p style="color: ${COLORS.blue}; font-size: 12px; margin: 0;">Speed</p>
            <p style="color: ${COLORS.purple}; font-size: 24px; font-weight: bold; margin: 4px 0;">${wpm}</p>
            <p style="color: ${COLORS.mediumGray}; font-size: 10px; margin: 0;">WPM</p>
          </td>
          <td style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 16px; width: 33%;">
            <p style="color: ${COLORS.pink}; font-size: 12px; margin: 0;">Fluency</p>
            <p style="color: ${COLORS.purple}; font-size: 24px; font-weight: bold; margin: 4px 0;">${finalFluencyScore}/10</p>
          </td>
          <td style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 16px; width: 33%;">
            <p style="color: ${COLORS.purple}; font-size: 12px; margin: 0;">Clarity</p>
            <p style="color: ${COLORS.purple}; font-size: 24px; font-weight: bold; margin: 4px 0;">${finalClarityScore}/10</p>
          </td>
        </tr>
      </table>
      
      <!-- Feedback -->
      ${feedback ? `
        <div style="background: ${COLORS.lightGray}; border-radius: 12px; padding: 16px; margin: 20px 0; border-left: 4px solid ${COLORS.pink};">
          <div style="margin-bottom: 8px;">
            <span style="font-size: 18px; margin-right: 8px;">✨</span>
            <span style="color: ${COLORS.purple}; font-weight: 600;">Coach Feedback</span>
          </div>
          <p style="color: ${COLORS.darkGray}; font-size: 14px; line-height: 1.6; margin: 0;">${feedback}</p>
        </div>
      ` : ''}
      
      <!-- Enhanced Sections -->
      ${skillsHtml}
      ${phonicsHtml}
      ${errorsHtml}
      ${practiceHtml}
      ${strengthsAreasHtml}
      
      <!-- Date -->
      <p style="text-align: center; color: ${COLORS.mediumGray}; font-size: 12px; margin: 24px 0 0;">
        ${currentDate} • yestoryd.com
      </p>
    </div>
    
    <!-- CTA Section -->
    <div style="background: white; border-radius: 16px; padding: 24px; margin-top: 20px; text-align: center; border: 1px solid #e5e7eb;">
      <h3 style="color: ${COLORS.purple}; font-size: 18px; margin: 0 0 8px;">Ready to improve ${childName}'s reading?</h3>
      <p style="color: ${COLORS.mediumGray}; font-size: 14px; margin: 0 0 20px;">Get personalized coaching from certified reading experts</p>
      
      <a href="https://yestoryd.com/checkout?source=email" style="display: inline-block; background: ${COLORS.blue}; color: white; padding: 14px 32px; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Start Coaching Program →
      </a>
      
      <p style="color: ${COLORS.mediumGray}; font-size: 12px; margin: 16px 0 0;">
        ✓ 6 personalized sessions &nbsp;•&nbsp; ✓ Expert coaches &nbsp;•&nbsp; ✓ 100% refund guarantee
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: ${COLORS.mediumGray}; font-size: 12px;">
      <p style="margin: 0 0 8px;">
        <a href="https://yestoryd.com" style="color: ${COLORS.pink}; text-decoration: none;">yestoryd.com</a> • AI-Powered Reading Coach
      </p>
      <p style="margin: 0;">Questions? Reply to this email or WhatsApp us</p>
    </div>
    
  </div>
</body>
</html>
    `;

    await sgMail.send({
      to: email,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'engage@yestoryd.com', name: 'Yestoryd - Reading Coach' },
      subject: `🎉 ${childName}'s Reading Assessment Report - Score: ${score}/10`,
      html: emailHtml,
    });
    
    console.log('Certificate sent to', email, 'for', childName);
    return NextResponse.json({ success: true, message: 'Certificate sent' });

  } catch (error) {
    console.error('Certificate email error:', error);
    return NextResponse.json({ error: 'Failed to send certificate' }, { status: 500 });
  }
}