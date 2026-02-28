// ============================================================
// POST /api/intelligence/micro-assessment
// ============================================================
// Micro-Assessment endpoint for group-class-only children.
// Accepts reading audio + optional comprehension answers,
// calls Gemini for fluency analysis, writes to micro_assessments
// + learning_events, updates child_intelligence_profiles.
//
// Produces HIGH confidence intelligence signals.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiModel } from '@/lib/gemini-config';
import { getAgeConfig, getAntiHallucinationRules } from '@/lib/gemini/assessment-prompts';
import { generateEmbedding } from '@/lib/rai/embeddings';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ============================================================
// Validation
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const comprehensionAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
  correct: z.boolean().optional(),
});

const requestSchema = z.object({
  child_id: z.string().regex(UUID_RE),
  passage_id: z.string().regex(UUID_RE).optional(),
  passage_text: z.string().min(10).max(5000).optional(),
  audio_url: z.string().min(1),
  comprehension_answers: z.array(comprehensionAnswerSchema).default([]),
  group_session_id: z.string().regex(UUID_RE).optional(),
  micro_assessment_id: z.string().regex(UUID_RE).optional(),
});

// ============================================================
// Types
// ============================================================

interface GeminiMicroResult {
  fluency_rating: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  estimated_wpm: number;
  accuracy_percent: number;
  errors: string[];
  self_corrections: string[];
  hesitations: string[];
  strengths: string[];
  areas_to_improve: string[];
  brief_analysis: string;
}

// ============================================================
// Helpers
// ============================================================

function getGenAI(): GoogleGenerativeAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp4: 'audio/mp4', m4a: 'audio/mp4', webm: 'audio/webm',
    ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav',
  };
  return mimeMap[ext || ''] || 'audio/webm';
}

async function downloadAudioBase64(audioUrl: string): Promise<{ base64: string; mimeType: string }> {
  const supabase = getServiceSupabase();

  // If it's a Supabase storage path, download directly
  // Otherwise try as a public URL
  if (audioUrl.startsWith('http')) {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error(`Failed to download audio: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { base64: buffer.toString('base64'), mimeType: getMimeType(audioUrl) };
  }

  // Supabase storage path
  const { data, error } = await supabase.storage
    .from('session-audio')
    .download(audioUrl);

  if (error || !data) {
    throw new Error(`Failed to download audio from storage: ${error?.message || 'No data'}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return { base64: buffer.toString('base64'), mimeType: getMimeType(audioUrl) };
}

function buildMicroAssessmentPrompt(
  childName: string,
  childAge: number,
  passageText: string,
  wordCount: number,
): string {
  const ageConfig = getAgeConfig(childAge);

  return `You are a reading fluency specialist conducting a MICRO-ASSESSMENT — a quick reading check for a child who attends group reading classes.

CHILD: ${childName}, age ${childAge}
PASSAGE READ:
"${passageText}"
(Word count: ${wordCount})

AGE CONTEXT (${ageConfig.level}):
${ageConfig.guidance}
- Be ${ageConfig.tone} in your assessment
- WPM expectation: ${ageConfig.expectedWPM} WPM typical

TASK: Analyze the attached audio of ${childName} reading the passage above.

${getAntiHallucinationRules(childName)}

Provide your analysis as JSON with this EXACT structure:
{
  "fluency_rating": "<MUST be exactly one of: Poor, Fair, Good, Excellent>",
  "estimated_wpm": <integer>,
  "accuracy_percent": <integer 0-100>,
  "errors": ["list of specific words misread or omitted"],
  "self_corrections": ["words initially misread then corrected"],
  "hesitations": ["words with significant pauses before reading"],
  "strengths": ["2-3 specific strengths observed"],
  "areas_to_improve": ["2-3 specific areas for improvement"],
  "brief_analysis": "<2-3 sentence summary of reading performance>"
}

IMPORTANT: fluency_rating MUST be exactly "Poor", "Fair", "Good", or "Excellent". No alternatives.
Do NOT provide an overall numeric score — just the fields above.

Respond ONLY with valid JSON. No markdown, no explanation.`;
}

/**
 * Compute a 0-100 intelligence score for a micro-assessment.
 * Server-side computation — NOT from Gemini.
 */
function computeMicroAssessmentScore(
  fluencyRating: string,
  accuracyPercent: number,
  comprehensionScore: number | null,
  hasAudio: boolean,
): number {
  // Fluency: 0-30 points
  const fluencyMap: Record<string, number> = { Poor: 8, Fair: 15, Good: 23, Excellent: 30 };
  const fluencyPts = fluencyMap[fluencyRating] || 15;

  // Accuracy: 0-30 points
  const accuracyPts = Math.round((accuracyPercent / 100) * 30);

  // Comprehension: 0-25 points
  const compPts = comprehensionScore != null ? Math.round((comprehensionScore / 100) * 25) : 12;

  // Artifact support: 0-15 points (audio always present in micro-assessment)
  const artifactPts = hasAudio ? 15 : 0;

  return Math.min(100, Math.max(0, fluencyPts + accuracyPts + compPts + artifactPts));
}

// ============================================================
// Handler
// ============================================================

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Auth
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { child_id, passage_id, passage_text: passageTextInput, audio_url, comprehension_answers, group_session_id, micro_assessment_id } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'micro_assessment_start', childId: child_id, hasPassageId: !!passage_id, hasAudio: !!audio_url }));

    const supabase = getServiceSupabase();

    // ─── Fetch child info ───
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age, age_band')
      .eq('id', child_id)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    const childName = child.child_name || 'Unknown';
    const childAge = child.age || 8;

    // ─── Resolve passage ───
    let passageText = passageTextInput || '';
    let resolvedPassageId = passage_id || null;

    if (passage_id && !passageText) {
      const { data: passage } = await supabase
        .from('reading_passages')
        .select('id, title, content, word_count')
        .eq('id', passage_id)
        .single();

      if (passage) {
        passageText = passage.content || '';
        resolvedPassageId = passage.id;
      }
    }

    if (!passageText) {
      return NextResponse.json({ error: 'No passage text provided or resolved' }, { status: 400 });
    }

    const wordCount = passageText.split(/\s+/).filter(Boolean).length;

    // ─── Download audio and call Gemini ───
    let geminiResult: GeminiMicroResult;

    try {
      const { base64, mimeType } = await downloadAudioBase64(audio_url);
      const prompt = buildMicroAssessmentPrompt(childName, childAge, passageText, wordCount);

      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: getGeminiModel('reading_level') });

      const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: base64 } },
      ]);

      const responseText = result.response.text()
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      geminiResult = JSON.parse(responseText);

      // Validate fluency_rating enum
      const validRatings = ['Poor', 'Fair', 'Good', 'Excellent'];
      if (!validRatings.includes(geminiResult.fluency_rating)) {
        geminiResult.fluency_rating = 'Fair';
      }

      // Clamp values
      geminiResult.estimated_wpm = Math.max(0, geminiResult.estimated_wpm || 0);
      geminiResult.accuracy_percent = Math.min(100, Math.max(0, geminiResult.accuracy_percent || 0));

    } catch (geminiErr) {
      console.error(JSON.stringify({ requestId, event: 'gemini_analysis_failed', error: geminiErr instanceof Error ? geminiErr.message : 'Unknown' }));
      // Fallback — return neutral result so pipeline doesn't break
      geminiResult = {
        fluency_rating: 'Fair',
        estimated_wpm: 0,
        accuracy_percent: 0,
        errors: [],
        self_corrections: [],
        hesitations: [],
        strengths: ['Completed the reading'],
        areas_to_improve: ['Audio analysis unavailable'],
        brief_analysis: 'Audio analysis could not be completed. Manual review recommended.',
      };
    }

    // ─── Score comprehension answers ───
    let comprehensionScore: number | null = null;
    if (comprehension_answers.length > 0) {
      const correct = comprehension_answers.filter(a => a.correct === true).length;
      comprehensionScore = Math.round((correct / comprehension_answers.length) * 100);
    }

    // ─── Compute intelligence score server-side ───
    const intelligenceScore = computeMicroAssessmentScore(
      geminiResult.fluency_rating,
      geminiResult.accuracy_percent,
      comprehensionScore,
      true,
    );

    const now = new Date().toISOString();

    // ─── Write to micro_assessments ───
    const triggeredBy = auth.coachId || auth.email || 'manual';

    let microAssessmentRow: { id: string } | null = null;

    if (micro_assessment_id) {
      // Update existing pending micro-assessment
      const { data, error: updateErr } = await supabase
        .from('micro_assessments')
        .update({
          passage_id: resolvedPassageId,
          passage_text: passageText,
          audio_url,
          status: 'completed' as const,
          fluency_rating: geminiResult.fluency_rating.toLowerCase(),
          estimated_wpm: geminiResult.estimated_wpm,
          comprehension_score: comprehensionScore,
          comprehension_questions: comprehension_answers.length > 0 ? comprehension_answers as any : null,
          gemini_analysis: geminiResult as any,
          group_session_id: group_session_id || null,
          completed_at: now,
        })
        .eq('id', micro_assessment_id)
        .select('id')
        .single();

      if (updateErr) {
        console.error(JSON.stringify({ requestId, event: 'micro_assessment_update_error', error: updateErr.message }));
      }
      microAssessmentRow = data;
    } else {
      // Insert new
      const { data, error: insertErr } = await supabase
        .from('micro_assessments')
        .insert({
          child_id,
          passage_id: resolvedPassageId,
          passage_text: passageText,
          audio_url,
          status: 'completed' as const,
          triggered_by: triggeredBy,
          fluency_rating: geminiResult.fluency_rating.toLowerCase(),
          estimated_wpm: geminiResult.estimated_wpm,
          comprehension_score: comprehensionScore,
          comprehension_questions: comprehension_answers.length > 0 ? comprehension_answers as any : null,
          gemini_analysis: geminiResult as any,
          group_session_id: group_session_id || null,
          completed_at: now,
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error(JSON.stringify({ requestId, event: 'micro_assessment_insert_error', error: insertErr.message }));
      }
      microAssessmentRow = data;
    }

    // ─── Create learning_event with HIGH confidence ───
    const contentForEmbedding = [
      `${childName} micro-assessment: fluency ${geminiResult.fluency_rating}, ${geminiResult.estimated_wpm} WPM.`,
      comprehensionScore != null ? `Comprehension: ${comprehensionScore}%.` : '',
      geminiResult.brief_analysis,
      geminiResult.strengths.length > 0 ? `Strengths: ${geminiResult.strengths.join(', ')}.` : '',
      geminiResult.areas_to_improve.length > 0 ? `Areas to improve: ${geminiResult.areas_to_improve.join(', ')}.` : '',
    ].filter(Boolean).join(' ');

    let embeddingStr: string | null = null;
    try {
      const embedding = await generateEmbedding(contentForEmbedding);
      embeddingStr = JSON.stringify(embedding);
    } catch (embErr) {
      console.error(JSON.stringify({ requestId, event: 'micro_embedding_error', error: embErr instanceof Error ? embErr.message : 'Unknown' }));
    }

    const { data: eventRow } = await supabase
      .from('learning_events')
      .insert({
        child_id,
        coach_id: auth.coachId || null,
        event_type: 'micro_assessment',
        event_date: now.split('T')[0],
        signal_confidence: 'high',
        signal_source: 'micro_assessment',
        intelligence_score: intelligenceScore,
        session_modality: 'online_group',
        event_data: {
          micro_assessment_id: microAssessmentRow?.id || null,
          fluency_rating: geminiResult.fluency_rating,
          estimated_wpm: geminiResult.estimated_wpm,
          accuracy_percent: geminiResult.accuracy_percent,
          comprehension_score: comprehensionScore,
          passage_id: resolvedPassageId,
          group_session_id: group_session_id || null,
        },
        content_for_embedding: contentForEmbedding,
        embedding: embeddingStr,
        created_by: auth.email || null,
      })
      .select('id')
      .single();

    // ─── Update child_intelligence_profiles ───
    try {
      const { data: existing } = await supabase
        .from('child_intelligence_profiles')
        .select('id, total_event_count, high_confidence_event_count')
        .eq('child_id', child_id)
        .single();

      if (existing) {
        await supabase
          .from('child_intelligence_profiles')
          .update({
            freshness_status: 'fresh',
            last_high_confidence_signal_at: now,
            last_any_signal_at: now,
            total_event_count: (existing.total_event_count || 0) + 1,
            high_confidence_event_count: (existing.high_confidence_event_count || 0) + 1,
            updated_at: now,
          })
          .eq('child_id', child_id);
      } else {
        await supabase
          .from('child_intelligence_profiles')
          .insert({
            child_id,
            freshness_status: 'fresh',
            overall_confidence: 'medium',
            last_high_confidence_signal_at: now,
            last_any_signal_at: now,
            total_event_count: 1,
            high_confidence_event_count: 1,
          });
      }
    } catch (profileErr) {
      console.error(JSON.stringify({ requestId, event: 'micro_profile_update_error', error: profileErr instanceof Error ? profileErr.message : 'Unknown' }));
    }

    console.log(JSON.stringify({
      requestId, event: 'micro_assessment_complete',
      childId: child_id, fluency: geminiResult.fluency_rating,
      wpm: geminiResult.estimated_wpm, score: intelligenceScore,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      microAssessment: {
        id: microAssessmentRow?.id || null,
        fluencyRating: geminiResult.fluency_rating,
        estimatedWpm: geminiResult.estimated_wpm,
        accuracyPercent: geminiResult.accuracy_percent,
        comprehensionScore,
        intelligenceScore,
        signalConfidence: 'high',
        learningEventId: eventRow?.id || null,
        analysis: geminiResult.brief_analysis,
        strengths: geminiResult.strengths,
        areasToImprove: geminiResult.areas_to_improve,
      },
    }, { status: 201 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'micro_assessment_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
