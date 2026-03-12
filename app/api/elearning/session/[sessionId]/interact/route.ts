// ============================================================
// POST /api/elearning/session/[sessionId]/interact
// ============================================================
// Evaluates a child's response to a session segment.
// Routes by response_type: pronunciation, comprehension, creative.
// Creates learning_event with embedding (non-blocking).
// Updates session progress (segments_completed, started/completed).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';
import { generateEmbedding } from '@/lib/rai/embeddings';
import {
  buildPronunciationAnalysisPrompt,
  buildComprehensionEvalPrompt,
  buildCreativeEvalPrompt,
} from '@/lib/gemini/elearning-prompts';
import type {
  SessionPlan,
  WarmUpSegment,
  ReadingSegment,
  ComprehensionSegment,
  CreativeSegment,
  InteractionResult,
} from '@/lib/elearning/types';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ─── Helpers ──────────────────────────────────────────────────

function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

// ─── Handler ──────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const requestId = crypto.randomUUID();
  const { sessionId } = await params;

  try {
    // ─── Auth ───
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    // ─── Parse body ───
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { segment_index, response_type, response_data } = body as {
      segment_index?: number;
      response_type?: string;
      response_data?: Record<string, unknown>;
    };

    if (segment_index == null || !response_type || !response_data) {
      return NextResponse.json({
        error: 'Required: segment_index (number), response_type (string), response_data (object)',
      }, { status: 400 });
    }

    const validTypes = ['pronunciation', 'comprehension', 'creative'];
    if (!validTypes.includes(response_type)) {
      return NextResponse.json({ error: `response_type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    console.log(JSON.stringify({ requestId, event: 'elearning_interact_start', sessionId, segmentIndex: segment_index, responseType: response_type }));

    const supabase = getServiceSupabase();

    // ─── Fetch session ───
    const { data: session } = await supabase
      .from('elearning_sessions' as any)
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionData = session as any;
    const sessionPlan = sessionData.session_plan as SessionPlan;
    const childId = sessionData.child_id as string;

    // ─── Verify child ownership ───
    const { data: child } = await supabase
      .from('children')
      .select('id, parent_email, parent_id, child_name, age')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    const isOwner =
      (child.parent_email && child.parent_email === auth.email) ||
      (child.parent_id && child.parent_id === auth.userId);

    if (!isOwner) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // ─── Get segment ───
    if (segment_index < 0 || segment_index >= sessionPlan.segments.length) {
      return NextResponse.json({ error: 'Invalid segment_index' }, { status: 400 });
    }

    const segment = sessionPlan.segments[segment_index];
    const childName = child.child_name || 'Reader';
    const childAge = child.age || 8;

    // ─── Route by response type ───
    let result: InteractionResult;

    if (response_type === 'pronunciation') {
      result = await handlePronunciation(
        childName, childAge, segment as WarmUpSegment, response_data,
      );
    } else if (response_type === 'comprehension') {
      // Need the reading passage for context
      const readingSegment = sessionPlan.segments.find(s => s.type === 'reading') as ReadingSegment | undefined;
      result = await handleComprehension(
        childName, childAge, segment as ComprehensionSegment, readingSegment, response_data,
      );
    } else {
      // creative
      const readingSegment = sessionPlan.segments.find(s => s.type === 'reading') as ReadingSegment | undefined;
      result = await handleCreative(
        childName, childAge, segment as CreativeSegment, readingSegment, response_data,
      );
    }

    // ─── Create learning_event (non-blocking) ───
    const capturedChildId = childId;
    const capturedAuthEmail = auth.email || null;
    const capturedScore = result.score;
    const capturedFeedback = result.feedback;

    (async () => {
      try {
        const contentForEmbedding = [
          `${childName} e-learning ${response_type}: score ${capturedScore}/10.`,
          capturedFeedback,
        ].join(' ');

        let embeddingStr: string | null = null;
        try {
          const embedding = await generateEmbedding(contentForEmbedding);
          embeddingStr = JSON.stringify(embedding);
        } catch {
          // embedding failure is non-fatal
        }

        const { data: eventRow } = await supabase
          .from('learning_events')
          .insert({
            child_id: capturedChildId,
            event_type: 'elearning_interaction',
            event_subtype: response_type,
            event_date: new Date().toISOString().split('T')[0],
            signal_confidence: 'medium',
            signal_source: 'elearning',
            session_modality: 'elearning',
            event_data: {
              session_id: sessionId,
              segment_index,
              response_type,
              score: capturedScore,
              feedback: capturedFeedback,
              xp_earned: result.xp_earned,
            } as any,
            content_for_embedding: contentForEmbedding,
            embedding: embeddingStr,
            created_by: capturedAuthEmail,
          })
          .select('id')
          .single();

        // Attach learning_event_id to result (already returned, so this is for logs)
        if (eventRow) {
          console.log(JSON.stringify({ requestId, event: 'elearning_event_created', eventId: eventRow.id }));
        }
      } catch (err) {
        console.error(JSON.stringify({
          requestId, event: 'elearning_event_error',
          error: err instanceof Error ? err.message : 'Unknown',
        }));
      }
    })();

    // ─── Update session progress ───
    const now = new Date().toISOString();
    const newSegmentsCompleted = (sessionData.segments_completed || 0) + 1;
    const isComplete = newSegmentsCompleted >= (sessionData.total_segments || sessionPlan.segments.length);

    await supabase
      .from('elearning_sessions' as any)
      .update({
        segments_completed: newSegmentsCompleted,
        ...(sessionData.started_at ? {} : { started_at: now }),
        ...(isComplete ? { completed_at: now } : {}),
      } as any)
      .eq('id', sessionId);

    console.log(JSON.stringify({
      requestId, event: 'elearning_interact_complete',
      sessionId, segmentIndex: segment_index, responseType: response_type,
      score: result.score, isComplete,
    }));

    return NextResponse.json({
      success: true,
      score: result.score,
      feedback: result.feedback,
      encouragement: result.encouragement,
      details: result.details,
      xp_earned: result.xp_earned,
      session_progress: {
        segments_completed: newSegmentsCompleted,
        total_segments: sessionPlan.segments.length,
        is_complete: isComplete,
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'elearning_interact_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// ─── Pronunciation Handler ────────────────────────────────────

async function handlePronunciation(
  childName: string,
  childAge: number,
  segment: WarmUpSegment,
  responseData: Record<string, unknown>,
): Promise<InteractionResult> {
  const wordIndex = typeof responseData.word_index === 'number' ? responseData.word_index : 0;
  const audioBase64 = responseData.audio_base64 as string | undefined;
  const audioMimeType = (responseData.audio_mime_type as string) || 'audio/webm';

  if (!audioBase64) {
    return {
      success: false,
      score: 0,
      feedback: 'No audio received. Please try recording again.',
      encouragement: 'You can do it! Try saying the word one more time.',
      details: {},
      xp_earned: 0,
      learning_event_id: null,
    };
  }

  const word = segment.words[wordIndex];
  if (!word) {
    return {
      success: false,
      score: 0,
      feedback: 'Invalid word index.',
      encouragement: '',
      details: {},
      xp_earned: 0,
      learning_event_id: null,
    };
  }

  const prompt = buildPronunciationAnalysisPrompt(childName, childAge, word.word, word.phonics_focus);
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: getGeminiModel('content_generation') });

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: audioMimeType, data: audioBase64 } },
  ]);

  const analysis = parseJsonResponse<{
    is_correct: boolean;
    quality: string;
    feedback: string;
    phonics_tip: string;
  }>(result.response.text());

  const score = analysis.is_correct ? (analysis.quality === 'excellent' ? 10 : 8) : 4;
  const xp = analysis.is_correct ? 5 : 2;

  return {
    success: true,
    score,
    feedback: analysis.feedback,
    encouragement: analysis.is_correct
      ? `Great job saying "${word.word}"!`
      : `Good try! Keep practicing "${word.word}".`,
    details: {
      word: word.word,
      is_correct: analysis.is_correct,
      quality: analysis.quality,
      phonics_tip: analysis.phonics_tip,
    },
    xp_earned: xp,
    learning_event_id: null,
  };
}

// ─── Comprehension Handler ────────────────────────────────────

async function handleComprehension(
  childName: string,
  childAge: number,
  segment: ComprehensionSegment,
  readingSegment: ReadingSegment | undefined,
  responseData: Record<string, unknown>,
): Promise<InteractionResult> {
  const questionIndex = typeof responseData.question_index === 'number' ? responseData.question_index : 0;
  const answer = responseData.answer as string | undefined;

  if (!answer || answer.trim().length === 0) {
    return {
      success: false,
      score: 0,
      feedback: 'Please type your answer before submitting.',
      encouragement: 'Take your time — read the question again!',
      details: {},
      xp_earned: 0,
      learning_event_id: null,
    };
  }

  const question = segment.questions[questionIndex];
  if (!question) {
    return {
      success: false,
      score: 0,
      feedback: 'Invalid question index.',
      encouragement: '',
      details: {},
      xp_earned: 0,
      learning_event_id: null,
    };
  }

  const passage = readingSegment?.passage || '';
  const prompt = buildComprehensionEvalPrompt(
    childName, childAge, passage, question.question, question.expected_answer_hint, answer,
  );

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: getGeminiModel('content_generation') });
  const result = await model.generateContent(prompt);

  const evaluation = parseJsonResponse<{
    is_correct: boolean;
    quality: string;
    feedback: string;
    model_answer_hint: string;
  }>(result.response.text());

  const qualityScores: Record<string, number> = {
    excellent: 10, good: 8, partial: 6, needs_help: 3,
  };
  const score = qualityScores[evaluation.quality] || 5;
  const xp = evaluation.is_correct ? 8 : 3;

  return {
    success: true,
    score,
    feedback: evaluation.feedback,
    encouragement: evaluation.is_correct
      ? 'You understood the story really well!'
      : 'Good thinking! Let\'s look at this together.',
    details: {
      is_correct: evaluation.is_correct,
      quality: evaluation.quality,
      model_answer_hint: evaluation.model_answer_hint,
      question_type: question.type,
    },
    xp_earned: xp,
    learning_event_id: null,
  };
}

// ─── Creative Handler ─────────────────────────────────────────

async function handleCreative(
  childName: string,
  childAge: number,
  segment: CreativeSegment,
  readingSegment: ReadingSegment | undefined,
  responseData: Record<string, unknown>,
): Promise<InteractionResult> {
  const response = responseData.text as string | undefined;

  if (!response || response.trim().length === 0) {
    return {
      success: false,
      score: 0,
      feedback: 'Please write something before submitting.',
      encouragement: 'Even a few words count — give it a try!',
      details: {},
      xp_earned: 0,
      learning_event_id: null,
    };
  }

  const passageContext = readingSegment
    ? `"${readingSegment.title}" — ${readingSegment.passage.substring(0, 200)}`
    : 'No passage context';

  const prompt = buildCreativeEvalPrompt(
    childName, childAge, segment.prompt_text, response, passageContext,
  );

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: getGeminiModel('content_generation') });
  const result = await model.generateContent(prompt);

  const evaluation = parseJsonResponse<{
    creativity_score: number;
    vocabulary_score: number;
    feedback: string;
    effort_acknowledgment: string;
  }>(result.response.text());

  // Average of creativity and vocabulary, clamped 1-10
  const score = Math.min(10, Math.max(1, Math.round(
    (evaluation.creativity_score + evaluation.vocabulary_score) / 2,
  )));
  const xp = Math.max(5, score); // minimum 5 XP for creative work

  return {
    success: true,
    score,
    feedback: evaluation.feedback,
    encouragement: evaluation.effort_acknowledgment,
    details: {
      creativity_score: evaluation.creativity_score,
      vocabulary_score: evaluation.vocabulary_score,
      prompt_type: segment.prompt_type,
      word_count: response.split(/\s+/).filter(Boolean).length,
    },
    xp_earned: xp,
    learning_event_id: null,
  };
}
