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

export const dynamic = 'force-dynamic';

// --- AI PROVIDER FALLBACK CHAIN ---
interface AIProvider {
  name: string;
  model: string;
  type: 'gemini' | 'openai';
}

const AI_PROVIDERS: AIProvider[] = [
  { name: 'gemini-flash-lite', model: 'gemini-2.5-flash-lite', type: 'gemini' },
  { name: 'gemini-flash', model: 'gemini-2.5-flash', type: 'gemini' },
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
    const strictness = getStrictnessForAge(age);
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

CRITICAL RULES TO PREVENT FALSE ERRORS:

MISPRONUNCIATIONS - BE VERY CAREFUL:
- ONLY mark a word as mispronounced if it sounds SIGNIFICANTLY different from the target
- Do NOT mark a word as mispronounced if the child said it correctly (e.g., "stories" read as "stories" is NOT an error)
- Syllable-by-syllable reading is ACCEPTABLE (e.g., "vill-age" for "village" is correct, NOT an error)
- Minor accent variations, regional pronunciations, and slight imperfections are NOT errors
- If the word is recognizable as the target word, it is CORRECT

SKIPPED/OMITTED WORDS:
- ONLY mark as "omitted" if the word was COMPLETELY ABSENT from the audio
- If you hear ANY attempt at the word (even partial), it is NOT skipped
- Self-corrections count as reading the word (not as skipped)
- When in doubt, do NOT mark as omitted

COMPLETENESS PERCENTAGE:
- If child read continuously through the entire passage, completeness should be 90-100%
- Audio quality issues should NOT lower completeness score
- Background noise is NOT the child's fault - give benefit of doubt
- Only reduce completeness if large sections were clearly not read

DO NOT MAKE THESE COMMON MISTAKES:
- Marking "stories" as mispronounced when child said "stories" correctly
- Marking natural syllable breaks or pauses as errors
- Being overly strict with young children (ages 4-7 especially)
- Counting the same error multiple times
- Marking words as skipped when audio was just unclear

ABSOLUTELY DO NOT HALLUCINATE:
- Only report errors for words that ACTUALLY appear in the passage above
- Do NOT invent words that aren't in the passage text
- Do NOT create fictional mispronunciations or errors
- Every word you mention in errors MUST exist in the provided passage
- If you're unsure about what you heard, mark it as "unclear" not as an error
- Base ALL analysis strictly on the audio and passage provided - nothing else
- Cross-check every error against the passage text before including it

CRITICAL ACCURACY RULES:
1. QUOTE EXACT WORDS - If the child said "hospe" instead of "hospital", write exactly that
2. DO NOT GUESS - If audio is unclear, assume the word was read correctly
3. COUNT ACCURATELY - Completeness % must reflect actual words read vs total words
4. BE SPECIFIC - Never say "some words were mispronounced" - list which ones
5. USE THE NAME "${name}" - Never use "the child" or "the reader"
6. GIVE BENEFIT OF DOUBT - When uncertain, assume correct pronunciation

If the passage was incomplete, state it factually: "${name} read X out of ${wordCount} words (Y%)."

Respond ONLY with valid JSON. No markdown, no explanation.`;

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
