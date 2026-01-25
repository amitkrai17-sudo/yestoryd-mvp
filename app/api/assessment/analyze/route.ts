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
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/api-auth';
import { generateEmbedding, buildSearchableContent } from '@/lib/rai/embeddings';
import { z } from 'zod';
import { phoneSchemaOptional } from '@/lib/utils/phone';
import crypto from 'crypto';

// --- CONFIGURATION (Lazy initialization) ---
const getGenAI = () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    .refine(val => val >= 3 && val <= 15, 'Age must be between 3 and 15'),
  
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

function getStrictnessForAge(age: number): { level: string; guidance: string; minScore: number; minCompleteness: number } {
  if (age <= 5) {
    return {
      level: 'FOUNDATIONAL',
      guidance: `Assessment context: ${age}-year-old (early reader). Expected skills: letter recognition, simple CVC words, basic sight words. Benchmark: Reading 60%+ of age-appropriate passage with support is typical.`,
      minScore: 3,
      minCompleteness: 60
    };
  } else if (age <= 8) {
    return {
      level: 'DEVELOPING',
      guidance: `Assessment context: ${age}-year-old (developing reader). Expected skills: Blending sounds, common sight words, simple sentences. Benchmark: Reading 70%+ of passage with developing fluency is typical.`,
      minScore: 4,
      minCompleteness: 70
    };
  } else if (age <= 11) {
    return {
      level: 'INTERMEDIATE',
      guidance: `Assessment context: ${age}-year-old (intermediate reader). Expected skills: Multi-syllable words, expression, self-correction. Benchmark: Reading 75%+ of passage with reasonable fluency is expected.`,
      minScore: 4,
      minCompleteness: 75
    };
  } else {
    return {
      level: 'ADVANCED',
      guidance: `Assessment context: ${age}-year-old (advancing reader). Expected skills: Complex vocabulary, expression, comprehension. Benchmark: Reading 80%+ of passage fluently is expected.`,
      minScore: 4,
      minCompleteness: 80
    };
  }
}

// --- TYPES ---
interface ErrorClassification {
  substitutions: { original: string; read_as: string }[];
  omissions: string[];
  insertions: string[];
  reversals: { original: string; read_as: string }[];
  mispronunciations: { word: string; issue: string }[];
}

interface PhonicsAnalysis {
  struggling_phonemes: string[];
  phoneme_details: { phoneme: string; examples: string[]; frequency: string }[];
  strong_phonemes: string[];
  recommended_focus: string;
}

interface SkillScore {
  score: number;
  notes: string;
}

interface SkillBreakdown {
  decoding: SkillScore;
  sight_words: SkillScore;
  blending: SkillScore;
  segmenting: SkillScore;
  expression: SkillScore;
  comprehension_indicators: SkillScore;
}

interface PracticeRecommendations {
  daily_words: string[];
  phonics_focus: string;
  suggested_activity: string;
}

interface AnalysisResult {
  clarity_score: number;
  fluency_score: number;
  speed_score: number;
  wpm: number;
  completeness_percentage: number;
  error_classification: ErrorClassification;
  phonics_analysis: PhonicsAnalysis;
  skill_breakdown: SkillBreakdown;
  feedback: string;
  errors: string[];
  strengths: string[];
  areas_to_improve: string[];
  practice_recommendations: PracticeRecommendations;
}

function getDefaultAnalysis(name: string): AnalysisResult {
  return {
    clarity_score: 5,
    fluency_score: 5,
    speed_score: 5,
    wpm: 60,
    completeness_percentage: 80,
    error_classification: {
      substitutions: [],
      omissions: [],
      insertions: [],
      reversals: [],
      mispronunciations: []
    },
    phonics_analysis: {
      struggling_phonemes: [],
      phoneme_details: [],
      strong_phonemes: [],
      recommended_focus: 'Continue practicing current level'
    },
    skill_breakdown: {
      decoding: { score: 5, notes: 'Assessment needed' },
      sight_words: { score: 5, notes: 'Assessment needed' },
      blending: { score: 5, notes: 'Assessment needed' },
      segmenting: { score: 5, notes: 'Assessment needed' },
      expression: { score: 5, notes: 'Assessment needed' },
      comprehension_indicators: { score: 5, notes: 'Assessment needed' }
    },
    errors: [],
    strengths: ['Completed the reading', 'Showed effort'],
    areas_to_improve: ['Practice reading aloud daily', 'Work on fluency'],
    feedback: `${name} completed the reading assessment with moderate fluency and acceptable pace. The reading showed engagement with the passage content, though some words required additional effort. Continue practicing daily reading aloud to build confidence and smooth out hesitations. With consistent effort, ${name} will show noticeable improvement in reading skills.`,
    practice_recommendations: {
      daily_words: [],
      phonics_focus: 'Review current phonics level',
      suggested_activity: 'Read aloud for 10 minutes daily'
    }
  };
}

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
    const { audio, passage, childName, childAge, parentName, parentEmail, parentPhone } = params;
    
    const name = childName;
    const age = childAge;
    const strictness = getStrictnessForAge(age);
    const wordCount = passage.split(' ').length;

    console.log(JSON.stringify({
      requestId,
      event: 'assessment_started',
      childAge: age,
      passageWords: wordCount,
      email: maskEmail(parentEmail),
      phone: maskPhone(parentPhone || undefined),
    }));

    // 5. Build AI prompt (Accuracy-focused v3.0)
    const analysisPrompt = `
You are a reading assessment specialist. Your task is to ACCURATELY analyze a ${age}-year-old child named ${name} reading aloud.

PASSAGE THE CHILD WAS ASKED TO READ:
"${passage}"
(Word count: ${wordCount} words)

PRIMARY OBJECTIVE: ACCURACY
Your analysis must be precise. Parents rely on this assessment to understand their child's actual reading level. Do not inflate or deflate scores - report what you observe.

LISTEN CAREFULLY FOR:
1. Which specific words were read correctly
2. Which specific words were mispronounced (note exactly how they were said)
3. Which words were skipped entirely
4. Which words were substituted with other words
5. Any self-corrections the child made

AGE CONTEXT:
${strictness.guidance}

SCORING SCALE (1-10):
- 9-10: Reads fluently with minimal errors, appropriate for age or above
- 7-8: Reads well with occasional errors, meeting age expectations
- 5-6: Developing reader, noticeable errors but shows understanding
- 3-4: Struggling reader, frequent errors, needs significant support
- 1-2: Early emergent reader, unable to decode most words

Score based on ACTUAL PERFORMANCE, not effort or age alone.

RESPONSE FORMAT - Provide ONLY valid JSON:
{
    "clarity_score": <integer 1-10, how clearly words were pronounced>,
    "fluency_score": <integer 1-10, smoothness of reading>,
    "speed_score": <integer 1-10, appropriate pace for age>,
    "wpm": <integer, actual words per minute calculated from audio>,
    "completeness_percentage": <integer 0-100, portion of passage actually read>,

    "error_classification": {
        "substitutions": [{"original": "actual_word", "read_as": "what_child_said"}],
        "omissions": ["words skipped entirely"],
        "insertions": ["words added that were not in passage"],
        "reversals": [{"original": "was", "read_as": "saw"}],
        "mispronunciations": [{"word": "word", "issue": "read as 'wurd'"}]
    },

    "phonics_analysis": {
        "struggling_phonemes": ["specific phonemes: th, ch, silent e, long vowels"],
        "phoneme_details": [
            {"phoneme": "th", "examples": ["the->da", "this->dis"], "frequency": "frequent"}
        ],
        "strong_phonemes": ["phonemes handled well"],
        "recommended_focus": "Primary phonics area to practice with specific examples"
    },

    "skill_breakdown": {
        "decoding": {"score": 1-10, "notes": "ability to sound out unfamiliar words"},
        "sight_words": {"score": 1-10, "notes": "recognition of common high-frequency words"},
        "blending": {"score": 1-10, "notes": "combining sounds to form words"},
        "segmenting": {"score": 1-10, "notes": "breaking words into individual sounds"},
        "expression": {"score": 1-10, "notes": "reading with appropriate intonation"},
        "comprehension_indicators": {"score": 1-10, "notes": "pausing at punctuation, emphasis on key words"}
    },

    "practice_recommendations": {
        "daily_words": ["5 specific words from errors to practice daily"],
        "phonics_focus": "Primary skill needing work with examples",
        "suggested_activity": "One specific practice activity for home"
    },

    "feedback": "4 sentences following structure below",

    "errors": ["PRECISE list: read 'house' as 'horse', skipped 'the', struggled with 'through'"],
    "strengths": ["2-3 specific things done well with evidence"],
    "areas_to_improve": ["2-3 specific areas with actionable advice"]
}

FEEDBACK STRUCTURE (4 sentences, factual tone):
- Sentence 1: State what ${name} accomplished factually (e.g., "${name} read 75% of the passage at a steady pace.")
- Sentence 2: Note specific observations with examples (e.g., "Words with 'th' sounds like 'through' and 'the' were challenging.")
- Sentence 3: Provide one clear, actionable recommendation (e.g., "Practice 'th' words daily: the, this, that, through, three.")
- Sentence 4: State the path forward neutrally (e.g., "Consistent practice with these sounds will build reading accuracy.")

CRITICAL ACCURACY RULES:
1. QUOTE EXACT WORDS - If the child said "hospe" instead of "hospital", write exactly that
2. DO NOT GUESS - If audio is unclear, note "unclear pronunciation of [word]"
3. COUNT ACCURATELY - Completeness % must reflect actual words read vs total words
4. BE SPECIFIC - Never say "some words were mispronounced" - list which ones
5. USE THE NAME "${name}" - Never use "the child" or "the reader"

If the passage was incomplete, state it factually: "${name} read X out of ${wordCount} words (Y%)."

Respond ONLY with valid JSON. No markdown, no explanation.`;

    // 6. Call Gemini AI
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const audioData = audio.split(',')[1] || audio;

    let analysisResult: AnalysisResult;

    try {
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'audio/webm',
            data: audioData,
          },
        },
        { text: analysisPrompt },
      ]);

      const response = await result.response;
      const responseText = response.text();

      let cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      analysisResult = JSON.parse(cleanedResponse);

      // Fix wrong names in feedback
      if (analysisResult.feedback) {
        const wrongNames = ['Aisha', 'Ali', 'Ahmed', 'Sara', 'Omar', 'Fatima', 'Mohammed', 'Zara', 'Aryan', 'Priya', 'Rahul', 'Ananya', 'the child', 'The child', 'this child', 'This child'];
        let feedback = analysisResult.feedback;
        wrongNames.forEach(wrongName => {
          const regex = new RegExp(wrongName, 'gi');
          feedback = feedback.replace(regex, name);
        });
        analysisResult.feedback = feedback;
      }

      console.log(JSON.stringify({
        requestId,
        event: 'ai_analysis_complete',
        wpm: analysisResult.wpm,
        completeness: analysisResult.completeness_percentage,
      }));

    } catch (aiError) {
      console.error(JSON.stringify({
        requestId,
        event: 'ai_analysis_failed',
        error: (aiError as Error).message,
      }));
      analysisResult = getDefaultAnalysis(name);
    }

    // 7. Calculate scores
    const clarityScore = Math.min(10, Math.max(1, analysisResult.clarity_score || 5));
    const fluencyScore = Math.min(10, Math.max(1, analysisResult.fluency_score || 5));
    const speedScore = Math.min(10, Math.max(1, analysisResult.speed_score || 5));
    const overallScore = Math.round((clarityScore * 0.35) + (fluencyScore * 0.40) + (speedScore * 0.25));

    const skillScores = analysisResult.skill_breakdown;
    const avgSkillScore = Math.round(
      (skillScores.decoding.score +
        skillScores.sight_words.score +
        skillScores.blending.score +
        skillScores.segmenting.score +
        skillScores.expression.score +
        skillScores.comprehension_indicators.score) / 6
    );

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
            event_data: eventData,
            ai_summary: aiSummary,
            content_for_embedding: searchableContent,
            embedding: embedding,
          });

        console.log(JSON.stringify({ requestId, event: 'learning_event_saved' }));
      } catch (eventError) {
        console.error(JSON.stringify({ requestId, event: 'learning_event_failed', error: (eventError as Error).message }));
      }
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
