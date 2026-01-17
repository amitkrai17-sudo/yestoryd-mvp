// ============================================================
// FILE: app/api/certificate/send/route.ts
// ============================================================
// HARDENED VERSION - Email certificate after assessment
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Rate limiting (prevent email spam)
// - Input validation with Zod
// - Request tracing
// - Audit logging
// - Lazy initialization
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';
import { z } from 'zod';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/api-auth';

// --- CONFIGURATION (Lazy initialization) ---
const initSendGrid = () => {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
};

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = {
  maxRequests: 3,       // 3 certificates
  windowMs: 60 * 60 * 1000, // per hour per email
};

function checkRateLimit(email: string): { success: boolean; remaining: number } {
  const now = Date.now();
  const key = `cert_${email.toLowerCase()}`;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
    return { success: true, remaining: RATE_LIMIT.maxRequests - 1 };
  }

  if (record.count >= RATE_LIMIT.maxRequests) {
    return { success: false, remaining: 0 };
  }

  record.count++;
  return { success: true, remaining: RATE_LIMIT.maxRequests - record.count };
}

// --- VALIDATION SCHEMA ---
const CertificateSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  childName: z.string().min(1, 'Child name required').max(100),
  childAge: z.union([z.string(), z.number()]).optional(),
  childId: z.string().uuid().optional(), // For audit trail
  
  // Scores
  score: z.number().min(0).max(10).optional().default(0),
  wpm: z.number().min(0).max(500).optional().default(0),
  fluencyScore: z.number().min(0).max(10).optional(),
  fluency_score: z.number().min(0).max(10).optional(),
  clarityScore: z.number().min(0).max(10).optional(),
  clarity_score: z.number().min(0).max(10).optional(),
  speedScore: z.number().min(0).max(10).optional(),
  speed_score: z.number().min(0).max(10).optional(),
  
  // Detailed analysis
  feedback: z.string().max(2000).optional(),
  phonicsAnalysis: z.any().optional(),
  skillBreakdown: z.any().optional(),
  errorClassification: z.any().optional(),
  practiceRecommendations: z.any().optional(),
  strengths: z.array(z.string()).optional(),
  areasToImprove: z.array(z.string()).optional(),
});

// --- COLORS ---
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

// --- HELPER FUNCTIONS ---
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

function buildEmailHtml(data: {
  childName: string;
  childAge: string;
  finalScore: number;
  finalFluencyScore: number;
  finalClarityScore: number;
  finalSpeedScore: number;
  finalWpm: number;
  feedback?: string;
  skillBreakdown?: any;
  phonicsAnalysis?: any;
  practiceRecommendations?: any;
}): string {
  const { childName, childAge, finalScore, finalFluencyScore, finalClarityScore, finalSpeedScore, finalWpm, feedback, skillBreakdown, phonicsAnalysis, practiceRecommendations } = data;
  
  const { headline, subheadline } = getHeadline(finalScore, childName);
  const insight = getInsight(finalScore, parseInt(childAge) || 8);
  const currentDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  // Build skills breakdown section
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
        const d = skillBreakdown[s.key];
        const pct = (d.score / 10) * 100;
        const color = d.score >= 7 ? COLORS.green : d.score >= 5 ? COLORS.pink : COLORS.red;
        return `
          <tr>
            <td style="padding: 6px 0;">
              <table style="width: 100%;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color: ${COLORS.darkGray}; font-size: 13px;">${s.label}</td>
                  <td style="text-align: right; color: ${COLORS.purple}; font-weight: bold; font-size: 13px;">${d.score}/10</td>
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

  return `
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
      
      <!-- Score Box -->
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
        
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e9d5ff;">
          <p style="color: ${COLORS.mediumGray}; font-size: 13px; margin: 0;">
            <span style="color: ${COLORS.yellow}; font-size: 14px;">💡</span> ${insight}
          </p>
        </div>
      </div>
      
      <!-- Three Stats -->
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
      
      ${feedback ? `
        <div style="background: white; border-radius: 12px; padding: 16px; margin-bottom: 16px; border-left: 4px solid ${COLORS.pink}; border: 1px solid #fce7f3; border-left: 4px solid ${COLORS.pink};">
          <p style="color: ${COLORS.pink}; font-size: 14px; font-weight: bold; margin: 0 0 8px;">
            <span style="margin-right: 6px;">🤖</span> rAI Analysis
          </p>
          <p style="color: ${COLORS.darkGray}; font-size: 13px; line-height: 1.6; margin: 0;">${feedback}</p>
        </div>
      ` : ''}
      
      <div style="background: linear-gradient(135deg, #fef9c3, #fef08a); border-radius: 12px; padding: 14px; margin-bottom: 16px; text-align: center;">
        <p style="color: #854d0e; font-size: 14px; font-weight: 600; margin: 0;">
          ✨ Keep reading daily, ${childName}! Every page makes you stronger.
        </p>
      </div>
      
      ${skillsHtml}
      ${phonicsHtml}
      ${practiceHtml}
      
      <p style="text-align: center; color: ${COLORS.mediumGray}; font-size: 13px; margin: 16px 0;">
        ❤️ Join 100+ families already improving
      </p>
      
      <a href="https://yestoryd.com/checkout?source=email" style="display: block; background: ${COLORS.pink}; color: white; padding: 16px; border-radius: 30px; text-decoration: none; font-weight: bold; font-size: 16px; text-align: center; margin-bottom: 12px;">
        🚀 Unlock ${childName}'s Full Potential
      </a>
      
      <p style="text-align: center; color: ${COLORS.mediumGray}; font-size: 12px; margin: 0 0 16px;">
        100% Refund Guarantee • Start within 3-5 days
      </p>
      
      <a href="https://yestoryd.com/lets-talk?source=email" style="display: block; background: white; color: ${COLORS.darkGray}; padding: 14px; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 14px; text-align: center; border: 1px solid #e5e7eb;">
        📅 Have Questions? Talk to Coach First
      </a>
      
      <p style="text-align: center; color: ${COLORS.mediumGray}; font-size: 11px; margin: 20px 0 0;">
        ${currentDate} • <a href="https://yestoryd.com" style="color: ${COLORS.pink}; text-decoration: none;">yestoryd.com</a>
      </p>
    </div>
    
    <div style="text-align: center; padding: 16px; color: ${COLORS.mediumGray}; font-size: 11px;">
      <p style="margin: 0;">Questions? Reply to this email or WhatsApp us</p>
    </div>
    
  </div>
</body>
</html>
  `;
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 2. Validate input
    const validation = CertificateSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      
      console.log(JSON.stringify({
        requestId,
        event: 'validation_failed',
        errors,
      }));

      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const params = validation.data;
    const { email, childName, childId } = params;

    // 3. Rate limiting
    const rateLimit = checkRateLimit(email);
    if (!rateLimit.success) {
      console.log(JSON.stringify({
        requestId,
        event: 'rate_limited',
        email: email.substring(0, 3) + '***',
      }));

      return NextResponse.json(
        { 
          error: 'Too many certificate emails sent. Please wait before requesting again.',
          retryAfter: '1 hour',
        },
        { 
          status: 429,
          headers: { 'Retry-After': '3600' },
        }
      );
    }

    console.log(JSON.stringify({
      requestId,
      event: 'certificate_request',
      childName,
      score: params.score,
    }));

    // 4. Prepare scores
    const finalScore = params.score || 0;
    const finalFluencyScore = params.fluencyScore ?? params.fluency_score ?? finalScore;
    const finalClarityScore = params.clarityScore ?? params.clarity_score ?? finalScore;
    const finalSpeedScore = params.speedScore ?? params.speed_score ?? finalScore;
    const finalWpm = params.wpm || 0;
    const finalAge = params.childAge?.toString() || '';

    // 5. Build email HTML
    const emailHtml = buildEmailHtml({
      childName,
      childAge: finalAge,
      finalScore,
      finalFluencyScore,
      finalClarityScore,
      finalSpeedScore,
      finalWpm,
      feedback: params.feedback,
      skillBreakdown: params.skillBreakdown,
      phonicsAnalysis: params.phonicsAnalysis,
      practiceRecommendations: params.practiceRecommendations,
    });

    // 6. Send email
    initSendGrid();
    
    await sgMail.send({
      to: email,
      from: { 
        email: process.env.SENDGRID_FROM_EMAIL || 'engage@yestoryd.com', 
        name: 'Yestoryd - Reading Coach' 
      },
      subject: `⭐ ${childName}'s Reading Assessment Report - Score: ${finalScore}/10`,
      html: emailHtml,
    });

    // 7. Audit log
    try {
      const supabase = getServiceSupabase();
      await supabase.from('communication_logs').insert({
        template_code: 'assessment_certificate',
        recipient_email: email,
        recipient_type: 'parent',
        channel: 'email',
        status: 'sent',
        related_entity_type: childId ? 'child' : null,
        related_entity_id: childId || null,
        variables: {
          child_name: childName,
          score: finalScore,
          wpm: finalWpm,
        },
        sent_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error('Audit log failed (non-blocking):', logError);
    }

    // 8. Return success
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'certificate_sent',
      email: email.substring(0, 3) + '***',
      score: finalScore,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      message: 'Certificate sent',
      requestId,
    }, {
      headers: {
        'X-Request-Id': requestId,
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      },
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'certificate_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Failed to send certificate', requestId },
      { status: 500 }
    );
  }
}

// --- HEALTH CHECK ---
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Certificate Email API (Hardened)',
    rateLimit: `${RATE_LIMIT.maxRequests} per hour per email`,
    timestamp: new Date().toISOString(),
  });
}