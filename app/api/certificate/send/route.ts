// file: app/api/certificate/send/route.ts
// Enhanced certificate email with detailed assessment analysis

import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

interface ErrorClassification {
  substitutions?: { original: string; read_as: string }[];
  omissions?: string[];
  insertions?: string[];
  reversals?: { original: string; read_as: string }[];
  mispronunciations?: { word: string; issue: string }[];
}

interface PhonicsAnalysis {
  struggling_phonemes?: string[];
  phoneme_details?: { phoneme: string; examples: string[]; frequency: string }[];
  strong_phonemes?: string[];
  recommended_focus?: string;
}

interface SkillScore {
  score: number;
  notes: string;
}

interface SkillBreakdown {
  decoding?: SkillScore;
  sight_words?: SkillScore;
  blending?: SkillScore;
  segmenting?: SkillScore;
  expression?: SkillScore;
  comprehension_indicators?: SkillScore;
}

interface PracticeRecommendations {
  daily_words?: string[];
  phonics_focus?: string;
  suggested_activity?: string;
}

// Helper to get score color
function getScoreColor(score: number): string {
  if (score >= 8) return '#22c55e'; // green
  if (score >= 6) return '#eab308'; // yellow
  if (score >= 4) return '#f97316'; // orange
  return '#ef4444'; // red
}

// Helper to get score label
function getScoreLabel(score: number): string {
  if (score >= 8) return 'Excellent!';
  if (score >= 6) return 'Good Progress!';
  if (score >= 4) return 'Keep Practicing!';
  return 'Needs Support';
}

// Helper to get score emoji
function getScoreEmoji(score: number): string {
  if (score >= 8) return '🌟';
  if (score >= 6) return '⭐';
  if (score >= 4) return '💪';
  return '📚';
}

// Generate skill bar HTML
function generateSkillBar(label: string, score: number, notes?: string): string {
  const percentage = (score / 10) * 100;
  const color = getScoreColor(score);
  
  return `
    <tr>
      <td style="padding: 8px 0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: #d1d5db; font-size: 14px;">${label}</span>
          <span style="color: white; font-weight: bold; font-size: 14px;">${score}/10</span>
        </div>
        <div style="background: #374151; border-radius: 4px; height: 8px; overflow: hidden;">
          <div style="background: ${color}; height: 100%; width: ${percentage}%; border-radius: 4px;"></div>
        </div>
        ${notes ? `<p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0 0;">${notes}</p>` : ''}
      </td>
    </tr>
  `;
}

// Generate phoneme tags HTML
function generatePhonemeTags(phonemes: string[], type: 'struggling' | 'strong'): string {
  if (!phonemes || phonemes.length === 0) return '';
  
  const bgColor = type === 'struggling' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
  const textColor = type === 'struggling' ? '#f87171' : '#4ade80';
  const borderColor = type === 'struggling' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)';
  
  return phonemes.map(p => 
    `<span style="display: inline-block; background: ${bgColor}; color: ${textColor}; padding: 4px 12px; border-radius: 16px; font-size: 13px; margin: 4px 4px 4px 0; border: 1px solid ${borderColor};">${p}</span>`
  ).join('');
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
      // Enhanced data
      clarityScore,
      fluencyScore,
      speedScore,
      phonicsAnalysis,
      skillBreakdown,
      errorClassification,
      practiceRecommendations,
      strengths,
      areasToImprove,
    } = body;

    if (!email || !childName) {
      return NextResponse.json(
        { error: 'Email and child name are required' },
        { status: 400 }
      );
    }

    const scoreColor = getScoreColor(score);
    const scoreLabel = getScoreLabel(score);
    const scoreEmoji = getScoreEmoji(score);
    const currentDate = new Date().toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    // Build skills section HTML
    let skillsHtml = '';
    if (skillBreakdown) {
      const sb = skillBreakdown as SkillBreakdown;
      skillsHtml = `
        <div style="background: #1f2937; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #ec4899; font-size: 16px; margin: 0 0 16px 0;">📊 Reading Skills Breakdown</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${sb.decoding ? generateSkillBar('Decoding', sb.decoding.score, sb.decoding.notes) : ''}
            ${sb.sight_words ? generateSkillBar('Sight Words', sb.sight_words.score, sb.sight_words.notes) : ''}
            ${sb.blending ? generateSkillBar('Blending', sb.blending.score, sb.blending.notes) : ''}
            ${sb.segmenting ? generateSkillBar('Segmenting', sb.segmenting.score, sb.segmenting.notes) : ''}
            ${sb.expression ? generateSkillBar('Expression', sb.expression.score, sb.expression.notes) : ''}
            ${sb.comprehension_indicators ? generateSkillBar('Comprehension', sb.comprehension_indicators.score, sb.comprehension_indicators.notes) : ''}
          </table>
        </div>
      `;
    }

    // Build phonics section HTML
    let phonicsHtml = '';
    if (phonicsAnalysis) {
      const pa = phonicsAnalysis as PhonicsAnalysis;
      phonicsHtml = `
        <div style="background: #1f2937; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #ec4899; font-size: 16px; margin: 0 0 16px 0;">🔤 Phonics Analysis</h3>
          
          ${pa.recommended_focus ? `
            <div style="background: rgba(236, 72, 153, 0.1); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
              <p style="color: #f472b6; font-size: 13px; margin: 0 0 4px 0; font-weight: 600;">💡 Focus Area</p>
              <p style="color: white; font-size: 14px; margin: 0;">${pa.recommended_focus}</p>
            </div>
          ` : ''}
          
          ${pa.struggling_phonemes && pa.struggling_phonemes.length > 0 ? `
            <div style="margin-bottom: 16px;">
              <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Needs Practice</p>
              <div>${generatePhonemeTags(pa.struggling_phonemes, 'struggling')}</div>
            </div>
          ` : ''}
          
          ${pa.strong_phonemes && pa.strong_phonemes.length > 0 ? `
            <div>
              <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Strong Areas ✓</p>
              <div>${generatePhonemeTags(pa.strong_phonemes, 'strong')}</div>
            </div>
          ` : ''}
        </div>
      `;
    }

    // Build errors section HTML
    let errorsHtml = '';
    if (errorClassification) {
      const ec = errorClassification as ErrorClassification;
      const hasErrors = (ec.substitutions?.length || 0) + (ec.omissions?.length || 0) + 
                       (ec.reversals?.length || 0) + (ec.mispronunciations?.length || 0) > 0;
      
      if (hasErrors) {
        errorsHtml = `
          <div style="background: #1f2937; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #ec4899; font-size: 16px; margin: 0 0 16px 0;">❌ Reading Errors to Address</h3>
            
            ${ec.substitutions && ec.substitutions.length > 0 ? `
              <div style="margin-bottom: 12px;">
                <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; margin: 0 0 8px 0;">Substitutions</p>
                ${ec.substitutions.map(s => `
                  <div style="background: #374151; border-radius: 4px; padding: 8px 12px; margin-bottom: 4px; font-size: 14px;">
                    <span style="color: #f87171; text-decoration: line-through;">${s.original}</span>
                    <span style="color: #6b7280;"> → </span>
                    <span style="color: #fbbf24;">${s.read_as}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            ${ec.omissions && ec.omissions.length > 0 ? `
              <div style="margin-bottom: 12px;">
                <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; margin: 0 0 8px 0;">Skipped Words</p>
                <div>
                  ${ec.omissions.map(w => `<span style="display: inline-block; background: rgba(249, 115, 22, 0.2); color: #fb923c; padding: 4px 8px; border-radius: 4px; font-size: 13px; margin: 2px;">${w}</span>`).join('')}
                </div>
              </div>
            ` : ''}
            
            ${ec.reversals && ec.reversals.length > 0 ? `
              <div style="margin-bottom: 12px;">
                <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; margin: 0 0 8px 0;">Reversals</p>
                ${ec.reversals.map(r => `
                  <div style="background: #374151; border-radius: 4px; padding: 8px 12px; margin-bottom: 4px; font-size: 14px;">
                    <span style="color: #f87171;">${r.original}</span>
                    <span style="color: #6b7280;"> → </span>
                    <span style="color: #fbbf24;">${r.read_as}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            ${ec.mispronunciations && ec.mispronunciations.length > 0 ? `
              <div>
                <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; margin: 0 0 8px 0;">Mispronunciations</p>
                ${ec.mispronunciations.map(m => `
                  <div style="background: #374151; border-radius: 4px; padding: 8px 12px; margin-bottom: 4px; font-size: 14px;">
                    <span style="color: white; font-weight: 500;">${m.word}:</span>
                    <span style="color: #9ca3af;"> ${m.issue}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }
    }

    // Build practice recommendations HTML
    let practiceHtml = '';
    if (practiceRecommendations) {
      const pr = practiceRecommendations as PracticeRecommendations;
      practiceHtml = `
        <div style="background: #1f2937; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #ec4899; font-size: 16px; margin: 0 0 16px 0;">📝 Practice at Home</h3>
          
          ${pr.daily_words && pr.daily_words.length > 0 ? `
            <div style="margin-bottom: 16px;">
              <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; margin: 0 0 8px 0;">Words to Practice Daily</p>
              <div>
                ${pr.daily_words.map(w => `<span style="display: inline-block; background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; margin: 4px 4px 4px 0; border: 1px solid rgba(59, 130, 246, 0.3);">${w}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          
          ${pr.phonics_focus ? `
            <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
              <p style="color: #c084fc; font-size: 13px; margin: 0 0 4px 0; font-weight: 600;">🔤 Phonics Focus</p>
              <p style="color: white; font-size: 14px; margin: 0;">${pr.phonics_focus}</p>
            </div>
          ` : ''}
          
          ${pr.suggested_activity ? `
            <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 12px;">
              <p style="color: #4ade80; font-size: 13px; margin: 0 0 4px 0; font-weight: 600;">🎯 Suggested Activity</p>
              <p style="color: white; font-size: 14px; margin: 0;">${pr.suggested_activity}</p>
            </div>
          ` : ''}
        </div>
      `;
    }

    // Build strengths & areas to improve HTML
    let strengthsAreasHtml = '';
    if ((strengths && strengths.length > 0) || (areasToImprove && areasToImprove.length > 0)) {
      strengthsAreasHtml = `
        <div style="display: flex; gap: 12px; margin: 20px 0;">
          ${strengths && strengths.length > 0 ? `
            <div style="flex: 1; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 16px;">
              <p style="color: #4ade80; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">✓ Strengths</p>
              <ul style="margin: 0; padding-left: 16px; color: #d1d5db; font-size: 13px;">
                ${strengths.map((s: string) => `<li style="margin-bottom: 4px;">${s}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${areasToImprove && areasToImprove.length > 0 ? `
            <div style="flex: 1; background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: 12px; padding: 16px;">
              <p style="color: #fb923c; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">↑ To Improve</p>
              <ul style="margin: 0; padding-left: 16px; color: #d1d5db; font-size: 13px;">
                ${areasToImprove.map((a: string) => `<li style="margin-bottom: 4px;">${a}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
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
<body style="margin: 0; padding: 0; background-color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #374151, #1f2937); border-radius: 16px 16px 0 0;">
      <div style="width: 80px; height: 80px; margin: 0 auto 16px; background: linear-gradient(135deg, #ec4899, #db2777); border-radius: 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 40px;">📚</span>
      </div>
      <h1 style="color: white; font-size: 28px; margin: 0;">Yestoryd</h1>
      <p style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin: 8px 0 0 0;">Reading Assessment Report</p>
    </div>
    
    <!-- Certificate Body -->
    <div style="background: #1f2937; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #374151; border-top: none;">
      
      <!-- Child Info -->
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="color: #60a5fa; font-size: 14px; margin: 0;">Certificate of Achievement</p>
        <p style="color: #9ca3af; font-size: 13px; margin: 4px 0;">Proudly presented to</p>
        <h2 style="color: white; font-size: 32px; margin: 8px 0;">${childName}</h2>
        ${childAge ? `<p style="color: #6b7280; font-size: 14px; margin: 0;">Age ${childAge}</p>` : ''}
      </div>
      
      <!-- Score Circle -->
      <div style="text-align: center; margin: 30px 0;">
        <div style="width: 120px; height: 120px; margin: 0 auto; border-radius: 50%; border: 8px solid ${scoreColor}; display: flex; align-items: center; justify-content: center; background: #111827;">
          <span style="font-size: 48px; font-weight: 800; color: ${scoreColor};">${score}</span>
        </div>
        <div style="display: inline-block; background: ${scoreColor}; color: white; padding: 8px 24px; border-radius: 20px; margin-top: 16px; font-weight: 600;">
          <span style="font-size: 18px; margin-right: 6px;">${scoreEmoji}</span>
          ${scoreLabel}
        </div>
      </div>
      
      <!-- Quick Stats -->
      <div style="display: flex; justify-content: space-around; margin: 24px 0; text-align: center;">
        <div style="background: #374151; border-radius: 12px; padding: 16px 24px; flex: 1; margin: 0 6px;">
          <p style="color: #60a5fa; font-size: 12px; margin: 0;">Speed</p>
          <p style="color: white; font-size: 24px; font-weight: bold; margin: 4px 0;">${wpm}</p>
          <p style="color: #6b7280; font-size: 10px; margin: 0;">WPM</p>
        </div>
        <div style="background: #374151; border-radius: 12px; padding: 16px 24px; flex: 1; margin: 0 6px;">
          <p style="color: #4ade80; font-size: 12px; margin: 0;">Fluency</p>
          <p style="color: white; font-size: 18px; font-weight: bold; margin: 4px 0;">${fluency || 'N/A'}</p>
        </div>
        <div style="background: #374151; border-radius: 12px; padding: 16px 24px; flex: 1; margin: 0 6px;">
          <p style="color: #a855f7; font-size: 12px; margin: 0;">Clarity</p>
          <p style="color: white; font-size: 18px; font-weight: bold; margin: 4px 0;">${pronunciation || 'N/A'}</p>
        </div>
      </div>
      
      <!-- Feedback -->
      ${feedback ? `
        <div style="background: rgba(55, 65, 81, 0.5); border-radius: 12px; padding: 16px; margin: 20px 0; border: 1px solid #4b5563;">
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 18px; margin-right: 8px;">✨</span>
            <span style="color: white; font-weight: 600;">Coach Feedback</span>
          </div>
          <p style="color: #d1d5db; font-size: 14px; line-height: 1.6; margin: 0;">${feedback}</p>
        </div>
      ` : ''}
      
      <!-- Enhanced Sections -->
      ${skillsHtml}
      ${phonicsHtml}
      ${errorsHtml}
      ${practiceHtml}
      ${strengthsAreasHtml}
      
      <!-- Date -->
      <p style="text-align: center; color: #6b7280; font-size: 12px; margin: 24px 0 0 0;">
        ${currentDate} • yestoryd.com
      </p>
    </div>
    
    <!-- CTA Section -->
    <div style="background: #1f2937; border-radius: 16px; padding: 24px; margin-top: 20px; text-align: center; border: 1px solid #374151;">
      <h3 style="color: white; font-size: 18px; margin: 0 0 8px 0;">Ready to improve ${childName}'s reading?</h3>
      <p style="color: #9ca3af; font-size: 14px; margin: 0 0 20px 0;">Get personalized coaching from certified reading experts</p>
      
      <a href="https://yestoryd.com/checkout?source=email" style="display: inline-block; background: linear-gradient(135deg, #ec4899, #db2777); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Start Coaching Program →
      </a>
      
      <p style="color: #6b7280; font-size: 12px; margin: 16px 0 0 0;">
        ✓ 6 personalized sessions &nbsp;•&nbsp; ✓ Expert coaches &nbsp;•&nbsp; ✓ 100% refund guarantee
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: #6b7280; font-size: 12px;">
      <p style="margin: 0 0 8px 0;">
        <a href="https://yestoryd.com" style="color: #ec4899; text-decoration: none;">yestoryd.com</a> • AI-Powered Reading Coach
      </p>
      <p style="margin: 0;">
        Questions? Reply to this email or WhatsApp us at +91-XXXXXXXXXX
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
        email: process.env.SENDGRID_FROM_EMAIL || 'engage@yestoryd.com',
        name: 'Yestoryd - Reading Coach',
      },
      subject: `🎉 ${childName}'s Reading Assessment Report - Score: ${score}/10`,
      html: emailHtml,
    };

    await sgMail.send(msg);
    
    console.log(`✅ Certificate email sent to ${email} for ${childName}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Certificate sent successfully' 
    });

  } catch (error) {
    console.error('Certificate email error:', error);
    return NextResponse.json(
      { error: 'Failed to send certificate' },
      { status: 500 }
    );
  }
}