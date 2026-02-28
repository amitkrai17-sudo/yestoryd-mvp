// ============================================================
// POST /api/intelligence/capture
// Accepts structured capture from coach/instructor, computes
// intelligence score, writes to structured_capture_responses
// and creates a learning_event.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { computeIntelligenceScore, getSignalConfidence, DEFAULT_WEIGHTS } from '@/lib/intelligence/score';
import { generateEmbedding } from '@/lib/rai/embeddings';
import type { StructuredCapturePayload, CaptureMethod, SessionModality, EngagementLevel } from '@/lib/intelligence/types';
import type { IntelligenceWeights } from '@/lib/intelligence/score';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ============================================================
// Validation
// ============================================================

const VALID_CAPTURE_METHODS: CaptureMethod[] = ['auto_filled', 'voice_to_structured', 'manual_structured', 'instructor_console'];
const VALID_MODALITIES: SessionModality[] = ['online_1on1', 'online_group', 'in_person_1on1', 'in_person_group', 'hybrid', 'elearning', 'self_practice'];
const VALID_ENGAGEMENT: EngagementLevel[] = ['low', 'moderate', 'high', 'exceptional'];
const VALID_RATINGS = ['struggling', 'developing', 'proficient', 'advanced'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validatePayload(body: unknown): { valid: true; data: StructuredCapturePayload } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const b = body as Record<string, unknown>;

  // Required UUIDs
  if (!b.childId || typeof b.childId !== 'string' || !UUID_RE.test(b.childId)) {
    return { valid: false, error: 'childId must be a valid UUID' };
  }
  if (!b.coachId || typeof b.coachId !== 'string' || !UUID_RE.test(b.coachId)) {
    return { valid: false, error: 'coachId must be a valid UUID' };
  }

  // sessionId / groupSessionId — at least one should be provided (or both null for ad-hoc)
  const sessionId = (b.sessionId && typeof b.sessionId === 'string' && UUID_RE.test(b.sessionId)) ? b.sessionId : null;
  const groupSessionId = (b.groupSessionId && typeof b.groupSessionId === 'string' && UUID_RE.test(b.groupSessionId)) ? b.groupSessionId : null;

  // sessionDate
  if (!b.sessionDate || typeof b.sessionDate !== 'string' || !DATE_RE.test(b.sessionDate)) {
    return { valid: false, error: 'sessionDate must be YYYY-MM-DD' };
  }

  // Enums
  if (!b.captureMethod || !VALID_CAPTURE_METHODS.includes(b.captureMethod as CaptureMethod)) {
    return { valid: false, error: `captureMethod must be one of: ${VALID_CAPTURE_METHODS.join(', ')}` };
  }
  if (!b.sessionModality || !VALID_MODALITIES.includes(b.sessionModality as SessionModality)) {
    return { valid: false, error: `sessionModality must be one of: ${VALID_MODALITIES.join(', ')}` };
  }
  if (!b.engagementLevel || !VALID_ENGAGEMENT.includes(b.engagementLevel as EngagementLevel)) {
    return { valid: false, error: `engagementLevel must be one of: ${VALID_ENGAGEMENT.join(', ')}` };
  }

  // skillsCovered
  const skillsCovered = Array.isArray(b.skillsCovered) ? b.skillsCovered.filter((s): s is string => typeof s === 'string' && UUID_RE.test(s)) : [];

  // skillPerformances
  const skillPerformances = Array.isArray(b.skillPerformances)
    ? b.skillPerformances.filter((p): p is Record<string, unknown> => {
        if (!p || typeof p !== 'object') return false;
        const sp = p as Record<string, unknown>;
        return typeof sp.skillId === 'string' && UUID_RE.test(sp.skillId)
          && typeof sp.rating === 'string' && VALID_RATINGS.includes(sp.rating);
      }).map(p => ({
        skillId: p.skillId as string,
        rating: p.rating as 'struggling' | 'developing' | 'proficient' | 'advanced',
        observationIds: Array.isArray(p.observationIds) ? (p.observationIds as unknown[]).filter((o): o is string => typeof o === 'string') : [],
        note: typeof p.note === 'string' ? p.note : undefined,
      }))
    : [];

  // Observation arrays (string arrays of IDs)
  const strengthObservations = Array.isArray(b.strengthObservations)
    ? b.strengthObservations.filter((s): s is string => typeof s === 'string')
    : [];
  const struggleObservations = Array.isArray(b.struggleObservations)
    ? b.struggleObservations.filter((s): s is string => typeof s === 'string')
    : [];

  // Child artifact
  let childArtifact: StructuredCapturePayload['childArtifact'] = undefined;
  if (b.childArtifact && typeof b.childArtifact === 'object') {
    const a = b.childArtifact as Record<string, unknown>;
    if (typeof a.type === 'string' && ['audio', 'text', 'image'].includes(a.type) && typeof a.url === 'string') {
      childArtifact = {
        type: a.type as 'audio' | 'text' | 'image',
        url: a.url,
        text: typeof a.text === 'string' ? a.text : undefined,
        durationSeconds: typeof a.durationSeconds === 'number' ? a.durationSeconds : undefined,
        analysis: (a.analysis && typeof a.analysis === 'object') ? a.analysis as Record<string, unknown> : undefined,
      };
    }
  }

  return {
    valid: true,
    data: {
      childId: b.childId as string,
      coachId: b.coachId as string,
      sessionId,
      groupSessionId,
      sessionDate: b.sessionDate as string,
      sessionModality: b.sessionModality as SessionModality,
      captureMethod: b.captureMethod as CaptureMethod,
      skillsCovered,
      skillPerformances,
      engagementLevel: b.engagementLevel as EngagementLevel,
      strengthObservations,
      struggleObservations,
      customStrengthNote: typeof b.customStrengthNote === 'string' ? b.customStrengthNote : undefined,
      customStruggleNote: typeof b.customStruggleNote === 'string' ? b.customStruggleNote : undefined,
      contextTags: Array.isArray(b.contextTags) ? b.contextTags.filter((t): t is string => typeof t === 'string') : undefined,
      aiPrefilled: typeof b.aiPrefilled === 'boolean' ? b.aiPrefilled : undefined,
      coachConfirmed: typeof b.coachConfirmed === 'boolean' ? b.coachConfirmed : undefined,
      voiceInputUrl: typeof b.voiceInputUrl === 'string' ? b.voiceInputUrl : undefined,
      childArtifact,
    },
  };
}

// ============================================================
// Weight loader from site_settings
// ============================================================

async function loadWeights(): Promise<IntelligenceWeights> {
  try {
    const supabase = getServiceSupabase();
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [
        'intelligence_weight_skill_coverage',
        'intelligence_weight_performance',
        'intelligence_weight_child_artifact',
        'intelligence_weight_observations',
        'intelligence_weight_engagement',
      ]);

    if (!data || data.length === 0) return DEFAULT_WEIGHTS;

    const get = (key: string, fallback: number): number => {
      const row = data.find(s => s.key === key);
      if (!row) return fallback;
      const val = parseFloat(String(row.value));
      return isNaN(val) ? fallback : val;
    };

    return {
      skillCoverage: get('intelligence_weight_skill_coverage', DEFAULT_WEIGHTS.skillCoverage),
      performance: get('intelligence_weight_performance', DEFAULT_WEIGHTS.performance),
      childArtifact: get('intelligence_weight_child_artifact', DEFAULT_WEIGHTS.childArtifact),
      observations: get('intelligence_weight_observations', DEFAULT_WEIGHTS.observations),
      engagement: get('intelligence_weight_engagement', DEFAULT_WEIGHTS.engagement),
    };
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

// ============================================================
// Handler
// ============================================================

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // Auth: coach or admin
  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validatePayload(rawBody);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const payload = validation.data;

  try {
    const supabase = getServiceSupabase();

    // 1. Load weights and compute score
    const weights = await loadWeights();
    const score = computeIntelligenceScore({
      hasSkillsCovered: payload.skillsCovered.length > 0,
      hasPerformanceRatings: payload.skillPerformances.length > 0 && payload.skillPerformances.every(sp => !!sp.rating),
      hasChildArtifact: !!payload.childArtifact,
      hasObservations: payload.strengthObservations.length > 0 || payload.struggleObservations.length > 0,
      hasEngagement: true,
    }, weights);

    const confidence = getSignalConfidence(payload.captureMethod);

    // 2. Write to structured_capture_responses
    const { data: capture, error: captureError } = await supabase
      .from('structured_capture_responses')
      .insert({
        child_id: payload.childId,
        coach_id: payload.coachId,
        session_id: payload.sessionId,
        group_session_id: payload.groupSessionId,
        session_date: payload.sessionDate,
        session_modality: payload.sessionModality,
        capture_method: payload.captureMethod,
        skills_covered: payload.skillsCovered,
        skill_performances: payload.skillPerformances as any,
        engagement_level: payload.engagementLevel,
        strength_observations: payload.strengthObservations,
        struggle_observations: payload.struggleObservations,
        custom_strength_note: payload.customStrengthNote || null,
        custom_struggle_note: payload.customStruggleNote || null,
        context_tags: payload.contextTags || null,
        ai_prefilled: payload.aiPrefilled ?? null,
        coach_confirmed: payload.coachConfirmed ?? null,
        voice_input_url: payload.voiceInputUrl || null,
        child_artifact_type: payload.childArtifact?.type || null,
        child_artifact_url: payload.childArtifact?.url || null,
        child_artifact_text: payload.childArtifact?.text || null,
        child_artifact_duration_seconds: payload.childArtifact?.durationSeconds || null,
        child_artifact_analysis: (payload.childArtifact?.analysis as any) || null,
        intelligence_score: score,
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (captureError || !capture) {
      console.error(JSON.stringify({
        requestId,
        event: 'capture_insert_error',
        error: captureError?.message,
      }));
      return NextResponse.json({ error: 'Failed to save capture response' }, { status: 500 });
    }

    // 3. Build content_for_embedding
    const embeddingParts: string[] = [
      `structured capture ${payload.sessionModality}`,
      `engagement: ${payload.engagementLevel}`,
    ];
    if (payload.skillPerformances.length > 0) {
      embeddingParts.push(`skills: ${payload.skillPerformances.map(sp => `${sp.skillId}=${sp.rating}`).join(', ')}`);
    }
    if (payload.customStrengthNote) embeddingParts.push(`strengths: ${payload.customStrengthNote}`);
    if (payload.customStruggleNote) embeddingParts.push(`struggles: ${payload.customStruggleNote}`);
    if (payload.childArtifact?.text) embeddingParts.push(`artifact: ${payload.childArtifact.text}`);
    const contentForEmbedding = embeddingParts.join(' ').trim();

    // 4. Generate embedding (non-blocking failure)
    let embeddingStr: string | null = null;
    try {
      const embedding = await generateEmbedding(contentForEmbedding);
      embeddingStr = JSON.stringify(embedding);
    } catch (err) {
      console.error(JSON.stringify({
        requestId,
        event: 'capture_embedding_error',
        error: err instanceof Error ? err.message : 'Unknown',
      }));
    }

    // 5. Create learning_event
    const { data: learningEvent, error: eventError } = await supabase
      .from('learning_events')
      .insert({
        child_id: payload.childId,
        coach_id: payload.coachId,
        event_type: 'structured_capture',
        event_subtype: payload.captureMethod,
        event_date: payload.sessionDate,
        session_id: payload.sessionId,
        signal_confidence: confidence,
        signal_source: 'structured_capture',
        intelligence_score: score,
        session_modality: payload.sessionModality,
        data: {
          captureId: capture.id,
          skillsCovered: payload.skillsCovered,
          skillPerformances: payload.skillPerformances as any,
          engagementLevel: payload.engagementLevel,
          strengthObservations: payload.strengthObservations,
          struggleObservations: payload.struggleObservations,
          captureMethod: payload.captureMethod,
          hasArtifact: !!payload.childArtifact,
        } as any,
        content_for_embedding: contentForEmbedding,
        embedding: embeddingStr,
        created_by: auth.email || null,
      })
      .select('id')
      .single();

    if (eventError) {
      console.error(JSON.stringify({
        requestId,
        event: 'capture_learning_event_error',
        error: eventError.message,
      }));
      // Non-fatal — capture was saved. Log but don't fail.
    }

    console.log(JSON.stringify({
      requestId,
      event: 'capture_complete',
      captureId: capture.id,
      learningEventId: learningEvent?.id,
      score,
      confidence,
    }));

    return NextResponse.json({
      success: true,
      capture: {
        id: capture.id,
        intelligenceScore: score,
        signalConfidence: confidence,
        learningEventId: learningEvent?.id || null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'capture_error',
      error: error instanceof Error ? error.message : 'Unknown',
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
