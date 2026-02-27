// ============================================================
// FILE: app/api/assessment/analyze/route.ts
// ============================================================
// HARDENED VERSION - rAI v2.2 Assessment Analysis
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Rate limiting (prevent cost abuse)
// - File size limits
// - Input validation with Zod
// - Request tracing
// - Lazy initialization
// - PII protection in logs
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { assessmentRateLimiter, getClientIP, rateLimitResponse } from '@/lib/rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServiceSupabase } from '@/lib/api-auth';
import { generateEmbedding, buildSearchableContent } from '@/lib/rai/embeddings';
import { z } from 'zod';
import { phoneSchemaOptional } from '@/lib/utils/phone';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGeminiModel } from '@/lib/gemini-config';
import {
  getAgeConfig,
  buildFullAssessmentPrompt,
  type FullAssessmentResult,
  type ErrorClassification,
  type PhonicsAnalysis,
  type SkillScore,
  type SkillBreakdown,
  type PracticeRecommendations,
} from '@/lib/gemini/assessment-prompts';

export const dynamic = 'force-dynamic';

// --- AI PROVIDER FALLBACK CHAIN ---
interface AIProvider {
  name: string;
  model: string;
  type: 'gemini' | 'openai';
}

const AI_PROVIDERS: AIProvider[] = [
  { name: 'gemini-flash-lite', model: getGeminiModel('assessment_analysis'), type: 'gemini' },
  { name: 'gemini-flash', model: getGeminiModel('default'), type: 'gemini' },
  { name: 'openai-gpt4o-mini', model: 'gpt-4o-mini', type: 'openai' },
];

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = createAdminClient;

// --- CONSTANTS ---
const MAX_AUDIO_SIZE_MB = 5; // 5MB max audio file (keeps Gemini processing under 10s)
const MAX_AUDIO_SIZE_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024;
const MAX_PASSAGE_LENGTH = 2000; // Max characters in passage

// --- RATE LIMITING ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = {
  maxRequests: 5,      // 5 assessments
  windowMs: 60 * 60 * 1000, // per hour
};

function checkRateLimit(identifier: string): { success: boolean; remaining: number } {
  const now = Date.now();
  const key = `assessment_${identifier}`;
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
const AssessmentSchema = z.object({
  audio: z.string()
    .min(100, 'Audio data is required')
    .refine(
      (val) => {
        // Check base64 size (rough estimate)
        const base64Data = val.split(',')[1] || val;
        const sizeInBytes = (base64Data.length * 3) / 4;
        return sizeInBytes <= MAX_AUDIO_SIZE_BYTES;
      },
      { message: `Audio file too large. Maximum size is ${MAX_AUDIO_SIZE_MB}MB` }
    ),
  
  passage: z.string()
    .min(10, 'Passage is required')
    .max(MAX_PASSAGE_LENGTH, `Passage too long (max ${MAX_PASSAGE_LENGTH} characters)`),
  
  childName: z.string()
    .min(1, 'Child name is required')
    .max(100, 'Child name too long')
    .transform(val => val.trim()),
  
  childAge: z.union([z.string(), z.number()])
    .transform(val => parseInt(String(val)))
    .refine(val => val >= 4 && val <= 12, 'Age must be between 4 and 12'),
  
  parentName: z.string()
    .min(1, 'Parent name is required')
    .max(100, 'Parent name too long')
    .optional(),
  
  parentEmail: z.string()
    .email('Invalid email format')
    .max(255)
    .transform(val => val.toLowerCase()),
  
  parentPhone: phoneSchemaOptional,
  
  lead_source: z.enum(['yestoryd', 'coach', 'referral', 'organic', 'ad'])
    .optional()
    .default('yestoryd'),
  
  lead_source_coach_id: z.string().uuid().optional().nullable(),

  referral_code_used: z.string().max(50).optional().nullable(),

  mimeType: z.string().optional().default('audio/webm'),

  recordingDuration: z.union([z.string(), z.number()])
    .transform(val => parseFloat(String(val)))
    .optional(),
});

type AssessmentInput = z.infer<typeof AssessmentSchema>;

// --- HELPER FUNCTIONS ---
function maskPhone(phone: string | undefined): string {
  if (!phone) return 'N/A';
  return '***' + phone.slice(-4);
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return local.slice(0, 2) + '***@' + domain;
}

// --- TYPES (re-export from shared module) ---
type AnalysisResult = FullAssessmentResult;

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

    // ??? UPSTASH RATE LIMITING - Persistent across serverless instances
    const clientIP = getClientIP(request);
    const { success: ipAllowed, limit, remaining, reset } = await assessmentRateLimiter.limit(clientIP);
    
    if (!ipAllowed) {
      console.log(JSON.stringify({ requestId, event: 'rate_limit_ip', ip: clientIP }));
      return rateLimitResponse(limit, remaining, reset);
    }

  try {
    // 1. Get client identifier for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = forwardedFor?.split(',')[0]?.trim() || 'unknown';

    // 2. Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 3. Check rate limit by email (more reliable than IP)
    const email = body.parentEmail?.toLowerCase() || clientIp;
    const rateLimit = checkRateLimit(email);

    if (!rateLimit.success) {
      console.log(JSON.stringify({
        requestId,
        event: 'rate_limited',
        identifier: maskEmail(email),
      }));

      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many assessments. Please try again later.',
          retryAfter: '1 hour',
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'Retry-After': '3600',
          },
        }
      );
    }

    // 4. Validate input
    const validation = AssessmentSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      
      console.log(JSON.stringify({
        requestId,
        event: 'validation_failed',
        errors,
      }));

      return NextResponse.json(
        { success: false, error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    const params = validation.data;
    const { audio, passage, childName, childAge, parentName, parentEmail, parentPhone, mimeType, recordingDuration } = params;

    const name = childName;
    const age = childAge;
    const audioMimeType = mimeType || 'audio/webm';
    const wordCount = passage.split(' ').length;

    console.log(JSON.stringify({
      requestId,
      event: 'assessment_started',
      childAge: age,
      passageWords: wordCount,
      passagePreview: passage.substring(0, 80) + '...',
      email: maskEmail(parentEmail),
      phone: maskPhone(parentPhone || undefined),
    }));

    // 5. Build AI prompt (shared standardized prompt)
    const analysisPrompt = buildFullAssessmentPrompt({
      childName: name,
      childAge: age,
      passage,
      wordCount,
    });

    // 6. Call AI with multi-provider fallback
    const audioData = audio.split(',')[1] || audio;

    let analysisResult: AnalysisResult | null = null;
    let aiProviderUsed: string = 'none';
    const providerErrors: string[] = [];

    for (const provider of AI_PROVIDERS) {
      try {
        console.log(JSON.stringify({ requestId, event: 'ai_trying_provider', provider: provider.name }));

        let responseText: string;

        if (provider.type === 'gemini') {
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
          const model = genAI.getGenerativeModel({ model: provider.model });
          const result = await model.generateContent([
            { inlineData: { mimeType: audioMimeType, data: audioData } },
            { text: analysisPrompt },
          ]);
          responseText = result.response.text();
        } else {
          // OpenAI fallback (text-only, no audio)
          const openaiKey = process.env.OPENAI_API_KEY;
          if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: provider.model,
              messages: [
                { role: 'system', content: 'You are a reading assessment specialist. Respond ONLY with valid JSON.' },
                { role: 'user', content: analysisPrompt },
              ],
              response_format: { type: 'json_object' },
            }),
          });
          if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
          const data = await res.json();
          responseText = data.choices[0].message.content;
        }

        const cleanedResponse = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        analysisResult = JSON.parse(cleanedResponse);
        aiProviderUsed = provider.name;

        // Fix wrong names in feedback
        if (analysisResult!.feedback) {
          const wrongNames = ['Aisha', 'Ali', 'Ahmed', 'Sara', 'Omar', 'Fatima', 'Mohammed', 'Zara', 'Aryan', 'Priya', 'Rahul', 'Ananya', 'the child', 'The child', 'this child', 'This child'];
          let feedback = analysisResult!.feedback;
          wrongNames.forEach(wrongName => {
            const regex = new RegExp(wrongName, 'gi');
            feedback = feedback.replace(regex, name);
          });
          analysisResult!.feedback = feedback;
        }

        console.log(JSON.stringify({
          requestId,
          event: 'ai_analysis_complete',
          provider: provider.name,
          wpm: analysisResult!.wpm,
          completeness: analysisResult!.completeness_percentage,
        }));

        break; // Success — stop trying providers
      } catch (providerError) {
        const errMsg = (providerError as Error).message;
        providerErrors.push(`${provider.name}: ${errMsg}`);
        console.error(JSON.stringify({
          requestId,
          event: 'ai_provider_failed',
          provider: provider.name,
          error: errMsg,
        }));
        continue;
      }
    }

    // ALL PROVIDERS FAILED — Queue for retry
    if (!analysisResult) {
      console.error(JSON.stringify({
        requestId,
        event: 'all_ai_providers_failed',
        errors: providerErrors,
      }));

      // Save to pending_assessments for async retry
      const supabase = getServiceSupabase();
      const pendingId = crypto.randomUUID();

      try {
        await supabase.from('pending_assessments').insert({
          id: pendingId,
          child_name: name,
          child_age: age,
          parent_email: parentEmail,
          parent_name: parentName || null,
          parent_phone: parentPhone || null,
          audio_url: audioData.substring(0, 100) + '...[truncated_for_log]',
          audio_data: audioData,
          passage: passage,
          status: 'pending',
          retry_count: 0,
          error_message: providerErrors.join('; '),
          lead_source: params.lead_source || 'yestoryd',
          lead_source_coach_id: params.lead_source_coach_id || null,
          referral_code_used: params.referral_code_used || null,
        });

        // Queue retry via QStash (5 minute delay)
        try {
          const { queueAssessmentRetry } = await import('@/lib/qstash');
          await queueAssessmentRetry({ pendingAssessmentId: pendingId, requestId });
        } catch (queueError) {
          console.error(JSON.stringify({ requestId, event: 'assessment_retry_queue_failed', error: (queueError as Error).message }));
        }
      } catch (dbError) {
        console.error(JSON.stringify({ requestId, event: 'pending_assessment_save_failed', error: (dbError as Error).message }));
      }

      return NextResponse.json({
        success: true,
        pending: true,
        requestId,
        pendingAssessmentId: pendingId,
        message: "Your reading is being analyzed! Results will arrive via email in 5-10 minutes.",
        childName: name,
        childAge: age,
        parentEmail,
      }, {
        headers: { 'X-Request-Id': requestId },
      });
    }

    // 7. Calculate scores
    const clarityScore = Math.min(10, Math.max(1, analysisResult.clarity_score || 5));
    const fluencyScore = Math.min(10, Math.max(1, analysisResult.fluency_score || 5));
    const speedScore = Math.min(10, Math.max(1, analysisResult.speed_score || 5));
    const overallScore = Math.round((clarityScore * 0.35) + (fluencyScore * 0.40) + (speedScore * 0.25));

    // 7a. Server-side WPM calculation
    let finalWpm = analysisResult.wpm;
    if (recordingDuration && recordingDuration > 0) {
      const durationSeconds = recordingDuration > 1000 ? recordingDuration / 1000 : recordingDuration;
      const calculatedWpm = Math.round((wordCount / durationSeconds) * 60);
      const geminiWpm = analysisResult.wpm || 0;
      const wpmDiff = Math.abs(calculatedWpm - geminiWpm);

      if (wpmDiff > 20) {
        console.log(JSON.stringify({
          requestId,
          event: 'wpm_discrepancy',
          calculatedWpm,
          geminiWpm,
          diff: wpmDiff,
          durationSeconds,
          wordCount,
        }));
      }

      // Prefer server-side calculation when recording duration is available
      finalWpm = calculatedWpm;
    }
    // WPM sanity check: clamp to 5-200 for children
    finalWpm = Math.min(200, Math.max(5, finalWpm || 60));

    // Override analysis result wpm with validated value
    analysisResult.wpm = finalWpm;

    // 7b. Null-safe skill breakdown averaging
    const defaultSkill = { score: 5, notes: 'Assessment needed' };
    const sb = analysisResult.skill_breakdown || {} as any;
    const safeSkill = (field: any) => (field && typeof field.score === 'number') ? field.score : 5;
    const avgSkillScore = Math.round(
      (safeSkill(sb.decoding) +
        safeSkill(sb.sight_words) +
        safeSkill(sb.blending) +
        safeSkill(sb.segmenting) +
        safeSkill(sb.expression) +
        safeSkill(sb.comprehension_indicators)) / 6
    );

    // Fill missing skill_breakdown fields to prevent downstream crashes
    analysisResult.skill_breakdown = {
      decoding: sb.decoding || defaultSkill,
      sight_words: sb.sight_words || defaultSkill,
      blending: sb.blending || defaultSkill,
      segmenting: sb.segmenting || defaultSkill,
      expression: sb.expression || defaultSkill,
      comprehension_indicators: sb.comprehension_indicators || defaultSkill,
    };

    // 8. Save to database
    const supabase = getServiceSupabase();
    let childId: string | null = null;

    try {
      const { data: existingChild } = await supabase
        .from('children')
        .select('id')
        .eq('name', name)
        .eq('parent_email', parentEmail)
        .maybeSingle();

      if (existingChild) {
        childId = existingChild.id;
        await supabase
          .from('children')
          .update({
            age,
            parent_name: parentName,
            parent_phone: parentPhone,
            latest_assessment_score: overallScore,
            assessment_completed_at: new Date().toISOString(),
            phonics_focus: analysisResult.phonics_analysis?.recommended_focus || null,
            struggling_phonemes: analysisResult.phonics_analysis?.struggling_phonemes || [],
            ...(params.lead_source === 'coach' && params.lead_source_coach_id ? {
              lead_source: 'coach',
              lead_source_coach_id: params.lead_source_coach_id,
              referral_code_used: params.referral_code_used,
            } : {}),
          })
          .eq('id', childId);

        console.log(JSON.stringify({ requestId, event: 'child_updated', childId }));
      } else {
        const { data: newChild, error: childError } = await supabase
          .from('children')
          .insert({
            name,
            child_name: name,
            age,
            parent_name: parentName,
            parent_email: parentEmail,
            parent_phone: parentPhone,
            lead_status: 'assessed',
            latest_assessment_score: overallScore,
            assessment_completed_at: new Date().toISOString(),
            phonics_focus: analysisResult.phonics_analysis?.recommended_focus || null,
            struggling_phonemes: analysisResult.phonics_analysis?.struggling_phonemes || [],
            lead_source: params.lead_source || 'yestoryd',
            lead_source_coach_id: params.lead_source_coach_id || null,
            referral_code_used: params.referral_code_used || null,
          })
          .select('id')
          .single();

        if (childError) {
          console.error(JSON.stringify({ requestId, event: 'child_create_failed', error: childError.message }));
        } else {
          childId = newChild.id;
          console.log(JSON.stringify({ requestId, event: 'child_created', childId }));
        }
      }
    } catch (dbError) {
      console.error(JSON.stringify({ requestId, event: 'database_error', error: (dbError as Error).message }));
    }

    // 9. Save learning event with embedding
    if (childId) {
      try {
        const eventData = {
          score: overallScore,
          child_age: age,  // Store age at time of assessment
          passage_preview: passage.substring(0, 80),  // Store passage for debugging
          wpm: analysisResult.wpm,
          completeness: analysisResult.completeness_percentage,
          feedback: analysisResult.feedback,
          errors: analysisResult.errors,
          strengths: analysisResult.strengths,
          areas_to_improve: analysisResult.areas_to_improve,
          clarity_score: clarityScore,
          fluency_score: fluencyScore,
          speed_score: speedScore,
          passage_word_count: wordCount,
          error_classification: analysisResult.error_classification,
          phonics_analysis: analysisResult.phonics_analysis,
          skill_breakdown: analysisResult.skill_breakdown,
          practice_recommendations: analysisResult.practice_recommendations,
          ai_provider_used: aiProviderUsed,
        };

        const searchableContent = buildSearchableContent(
          'assessment',
          name,
          eventData,
          analysisResult.feedback
        );

        let embedding: number[] | null = null;
        try {
          embedding = await generateEmbedding(searchableContent);
        } catch (embError) {
          console.error(JSON.stringify({ requestId, event: 'embedding_failed', error: (embError as Error).message }));
        }

        const fluencyDesc = fluencyScore >= 7 ? 'smooth' : fluencyScore >= 5 ? 'moderate' : 'developing';
        const phonicsFocus = analysisResult.phonics_analysis?.recommended_focus || 'general practice';
        const aiSummary = `${name} scored ${overallScore}/10 with ${fluencyDesc} fluency at ${analysisResult.wpm} WPM. Focus area: ${phonicsFocus}. ${analysisResult.strengths?.[0] || 'Showed good effort'}.`;

        await supabase
          .from('learning_events')
          .insert({
            child_id: childId,
            event_type: 'assessment',
            event_date: new Date().toISOString(),
            event_data: JSON.parse(JSON.stringify(eventData)),
            ai_summary: aiSummary,
            content_for_embedding: searchableContent,
            embedding: embedding ? JSON.stringify(embedding) : null,
          });

        console.log(JSON.stringify({ requestId, event: 'learning_event_saved' }));
      } catch (eventError) {
        console.error(JSON.stringify({ requestId, event: 'learning_event_failed', error: (eventError as Error).message }));
      }
    }

    // 9b. Link WhatsApp lead to child record (fire-and-forget, never blocks assessment)
    // Enables Agent Brain to include assessment results in future WhatsApp conversations
    if (childId && parentPhone) {
      const linkPhone = parentPhone; // capture for async closure (TS can't narrow inside IIFE)
      const linkChildId = childId;
      (async () => {
        try {
          // wa_leads stores phone without + prefix (WhatsApp format: 919687606177)
          const waPhone = linkPhone.replace(/^\+/, '');

          const { data: waLead } = await supabase
            .from('wa_leads')
            .select('id, child_id')
            .eq('phone_number', waPhone)
            .maybeSingle();

          // No WhatsApp lead (parent didn't come from WA) or already linked
          if (!waLead || waLead.child_id) return;

          await Promise.all([
            supabase
              .from('wa_leads')
              .update({ child_id: linkChildId, updated_at: new Date().toISOString() })
              .eq('id', waLead.id),
            supabase
              .from('wa_lead_conversations')
              .update({ child_id: linkChildId, updated_at: new Date().toISOString() })
              .eq('phone_number', waPhone),
            supabase
              .from('lead_lifecycle')
              .update({ child_id: linkChildId, current_state: 'assessed' })
              .eq('wa_lead_id', waLead.id)
              .in('current_state', ['new', 'engaging', 'qualifying']),
          ]);

          console.log(JSON.stringify({
            requestId,
            event: 'wa_lead_linked_to_child',
            phone: maskPhone(linkPhone),
            childId: linkChildId,
            waLeadId: waLead.id,
          }));
        } catch (linkError) {
          console.error(JSON.stringify({
            requestId,
            event: 'wa_lead_link_failed',
            error: linkError instanceof Error ? linkError.message : 'Unknown error',
          }));
        }
      })();
    }

    // 10. Lead scoring
    if (childId) {
      try {
        let leadScore = 10;

        if (overallScore <= 3) leadScore += 50;
        else if (overallScore <= 5) leadScore += 30;
        else if (overallScore <= 7) leadScore += 15;
        else leadScore += 5;

        if (age >= 4 && age <= 7) leadScore += 15;
        else if (age >= 8 && age <= 10) leadScore += 10;

        const strugglingCount = analysisResult.phonics_analysis?.struggling_phonemes?.length || 0;
        if (strugglingCount >= 3) leadScore += 10;
        else if (strugglingCount >= 1) leadScore += 5;

        const leadStatus = leadScore >= 60 ? 'hot' : leadScore >= 30 ? 'warm' : 'new';

        await supabase
          .from('children')
          .update({
            lead_score: leadScore,
            lead_status: leadStatus,
            lead_score_updated_at: new Date().toISOString(),
          })
          .eq('id', childId);

        console.log(JSON.stringify({ requestId, event: 'lead_scored', leadScore, leadStatus }));

        // Hot lead alert via QStash (async, non-blocking)
        if (leadStatus === 'hot') {
          console.log(JSON.stringify({ requestId, event: 'hot_lead_detected', childId }));

          // Use QStash instead of self-HTTP call
          try {
            const { queueHotLeadAlert } = await import('@/lib/qstash');
            await queueHotLeadAlert(childId, requestId);
          } catch (queueError) {
            console.error(JSON.stringify({ requestId, event: 'hot_lead_queue_failed', error: (queueError as Error).message }));
          }
        }

        // Admin real-time WhatsApp alert (fire-and-forget, NEVER blocks main flow)
        console.log(JSON.stringify({
          requestId,
          event: 'admin_alert_check',
          parentPhone: parentPhone ? 'present' : 'MISSING',
          leadStatus,
        }));

        if (parentPhone) {
          console.log(JSON.stringify({ requestId, event: 'admin_alert_triggering' }));

          import('@/lib/notifications/admin-alerts').then(({ sendNewLeadAlert }) => {
            console.log(JSON.stringify({ requestId, event: 'admin_alert_imported' }));

            sendNewLeadAlert({
              childId,
              childName: name,
              childAge: age,
              parentName: parentName || 'Parent',
              parentPhone: parentPhone,
              parentEmail: parentEmail || undefined,
              assessmentScore: overallScore,
              wpm: analysisResult.wpm || 0,
              leadStatus: leadStatus as 'hot' | 'warm' | 'cool',
              requestId,
            }).then(success => {
              console.log(JSON.stringify({ requestId, event: 'admin_alert_result', success }));
            }).catch(err => {
              console.error(JSON.stringify({ requestId, event: 'admin_alert_error', error: err.message }));
            });
          }).catch(err => {
            console.error(JSON.stringify({ requestId, event: 'admin_alert_import_failed', error: err.message }));
          });

          // ═══════════════════════════════════════════════════════════════════════════
          // PARENT WHATSAPP - Assessment Results with Let's Talk CTA (fire-and-forget)
          // Template: assessment_results_v2 (pending Meta approval)
          // Variables: parent_name, child_name, overall_score, clarity_score,
          //            fluency_score, speed_score, booking_link
          // ═══════════════════════════════════════════════════════════════════════════
          const bookingLink = `https://yestoryd.com/lets-talk?childId=${childId}&childName=${encodeURIComponent(name)}&source=assessment_whatsapp`;

          import('@/lib/communication/aisensy').then(({ sendWhatsAppMessage }) => {
            console.log(JSON.stringify({ requestId, event: 'parent_whatsapp_triggering' }));

            sendWhatsAppMessage({
              to: parentPhone,
              templateName: 'assessment_results_v2',
              variables: [
                parentName || 'Parent',       // {{1}} parent_name
                name,                          // {{2}} child_name
                String(overallScore),          // {{3}} overall_score
                String(clarityScore),          // {{4}} clarity_score
                String(fluencyScore),          // {{5}} fluency_score
                String(speedScore),            // {{6}} speed_score
                bookingLink,                   // {{7}} booking_link (CTA URL)
              ],
            }).then(result => {
              if (result.success) {
                console.log(JSON.stringify({ requestId, event: 'parent_whatsapp_sent', childId, messageId: result.messageId }));
              } else {
                console.log(JSON.stringify({ requestId, event: 'parent_whatsapp_failed', childId, error: result.error }));
              }
            }).catch(err => {
              console.error(JSON.stringify({ requestId, event: 'parent_whatsapp_error', childId, error: err.message }));
            });
          }).catch(err => {
            console.error(JSON.stringify({ requestId, event: 'parent_whatsapp_import_failed', error: err.message }));
          });

        } else {
          console.log(JSON.stringify({ requestId, event: 'admin_alert_skipped', reason: 'no_parent_phone' }));
        }

      } catch (leadError) {
        console.error(JSON.stringify({ requestId, event: 'lead_scoring_failed', error: (leadError as Error).message }));
      }
    }

    // 11. Calculate total errors
    const totalErrors =
      (analysisResult.error_classification?.substitutions?.length || 0) +
      (analysisResult.error_classification?.omissions?.length || 0) +
      (analysisResult.error_classification?.insertions?.length || 0) +
      (analysisResult.error_classification?.reversals?.length || 0) +
      (analysisResult.error_classification?.mispronunciations?.length || 0);

    // 12. Return response
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'assessment_complete',
      overallScore,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      childId,
      childName: name,
      childAge: age,
      parentName,
      parentEmail,
      parentPhone: parentPhone ? maskPhone(parentPhone) + ' (masked)' : null,
      passage,

      // Core scores
      overall_score: overallScore,
      clarity_score: clarityScore,
      fluency_score: fluencyScore,
      speed_score: speedScore,
      wpm: analysisResult.wpm,
      completeness: analysisResult.completeness_percentage,

      // Error analysis
      errors: analysisResult.errors,
      error_classification: analysisResult.error_classification,
      total_error_count: totalErrors,

      // Phonics analysis
      phonics_analysis: analysisResult.phonics_analysis,

      // Skill breakdown
      skill_breakdown: analysisResult.skill_breakdown,
      avg_skill_score: avgSkillScore,

      // Feedback & recommendations
      feedback: analysisResult.feedback,
      strengths: analysisResult.strengths,
      areas_to_improve: analysisResult.areas_to_improve,
      practice_recommendations: analysisResult.practice_recommendations,

      encouragement: `Keep reading daily, ${name}! Every page makes you stronger.`,
      ai_provider_used: aiProviderUsed,
      lead_source: params.lead_source || 'yestoryd',
    }, {
      headers: {
        'X-Request-Id': requestId,
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      },
    });

  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'assessment_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, error: 'Analysis failed', requestId },
      { status: 500 }
    );
  }
}

// --- HEALTH CHECK ---
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Assessment Analysis API v2.2 (Hardened)',
    limits: {
      maxAudioSizeMB: MAX_AUDIO_SIZE_MB,
      maxPassageChars: MAX_PASSAGE_LENGTH,
      rateLimit: `${RATE_LIMIT.maxRequests} per hour`,
    },
    timestamp: new Date().toISOString(),
  });
}
