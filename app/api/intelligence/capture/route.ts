// ============================================================
// POST /api/intelligence/capture
// Accepts structured capture from coach/instructor, computes
// intelligence score, writes to structured_capture_responses
// and creates a learning_event.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { computeIntelligenceScore, getSignalConfidence, DEFAULT_WEIGHTS } from '@/lib/intelligence/score';
import type { StructuredCapturePayload, CaptureMethod, SessionModality, EngagementLevel } from '@/lib/intelligence/types';
import type { IntelligenceWeights } from '@/lib/intelligence/score';
import { getSiteSettings } from '@/lib/config/site-settings-loader';
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
      coachVoiceNoteUrl: typeof b.coachVoiceNoteUrl === 'string' ? b.coachVoiceNoteUrl : undefined,
      wordsStruggled: Array.isArray(b.wordsStruggled) ? b.wordsStruggled.filter((w): w is string => typeof w === 'string') : undefined,
      wordsMastered: Array.isArray(b.wordsMastered) ? b.wordsMastered.filter((w): w is string => typeof w === 'string') : undefined,
      homeworkAssigned: typeof b.homeworkAssigned === 'boolean' ? b.homeworkAssigned : undefined,
      homeworkDescription: typeof b.homeworkDescription === 'string' ? b.homeworkDescription : undefined,
      childArtifact,
    },
  };
}

// ============================================================
// Weight loader from site_settings
// ============================================================

async function loadWeights(): Promise<IntelligenceWeights> {
  try {
    const data = await getSiteSettings([
      'intelligence_weight_skill_coverage',
      'intelligence_weight_performance',
      'intelligence_weight_child_artifact',
      'intelligence_weight_observations',
      'intelligence_weight_engagement',
    ]);

    if (Object.keys(data).length === 0) return DEFAULT_WEIGHTS;

    const get = (key: string, fallback: number): number => {
      const val = parseFloat(data[key]);
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

    // 0. Check for captureId — coach is confirming an AI-prefilled capture
    if ((rawBody as any).captureId) {
      const captureId = (rawBody as any).captureId as string;
      const { data: existing } = await supabase
        .from('structured_capture_responses')
        .select('id, child_id, coach_id, session_id, session_modality, capture_method, ai_prefilled')
        .eq('id', captureId)
        .single();

      if (!existing) {
        return NextResponse.json({ error: 'Capture not found' }, { status: 404 });
      }

      // Update with coach's confirmed data
      const weights = await loadWeights();
      const score = computeIntelligenceScore({
        hasSkillsCovered: payload.skillsCovered.length > 0,
        hasPerformanceRatings: payload.skillPerformances.length > 0 && payload.skillPerformances.every(sp => !!sp.rating),
        hasChildArtifact: !!payload.childArtifact,
        hasObservations: payload.strengthObservations.length > 0 || payload.struggleObservations.length > 0,
        hasEngagement: true,
      }, weights);
      const confidence = getSignalConfidence(payload.captureMethod);

      await supabase
        .from('structured_capture_responses')
        .update({
          skills_covered: payload.skillsCovered,
          skill_performances: payload.skillPerformances as any,
          engagement_level: payload.engagementLevel,
          strength_observations: payload.strengthObservations,
          struggle_observations: payload.struggleObservations,
          custom_strength_note: payload.customStrengthNote || null,
          custom_struggle_note: payload.customStruggleNote || null,
          context_tags: payload.contextTags || [],
          words_mastered: payload.wordsMastered || [],
          words_struggled: payload.wordsStruggled || [],
          intelligence_score: score,
          coach_confirmed: true,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', captureId);

      // Now create the learning_event (the gate opens)
      // Signal confidence: AI-prefilled + coach confirmed = high
      const signalConfidence = existing.ai_prefilled ? 'high' : confidence;

      // Fetch skill names for embedding
      const allSkillIds = payload.skillsCovered.length > 0
        ? payload.skillsCovered
        : payload.skillPerformances.map(sp => sp.skillId);

      const [skillResult, childResult] = await Promise.all([
        allSkillIds.length > 0
          ? supabase.from('el_skills').select('id, name, category_id').in('id', allSkillIds)
          : Promise.resolve({ data: [] as { id: string; name: string; category_id: string | null }[] }),
        supabase.from('children').select('child_name, name').eq('id', existing.child_id).single(),
      ]);

      const skillNameMap = new Map<string, string>();
      const skillCatIdMap = new Map<string, string>();
      for (const s of skillResult.data || []) {
        skillNameMap.set(s.id, s.name);
        if (s.category_id) skillCatIdMap.set(s.id, s.category_id);
      }

      const uniqueCatIds = Array.from(new Set(Array.from(skillCatIdMap.values())));
      const catLabelMap = new Map<string, string>();
      if (uniqueCatIds.length > 0) {
        const { data: cats } = await supabase.from('skill_categories').select('id, parent_label, label').in('id', uniqueCatIds);
        for (const c of cats || []) catLabelMap.set(c.id, c.parent_label || c.label);
      }

      const childName = childResult.data?.child_name || childResult.data?.name || 'Student';
      const ratingLabel: Record<string, string> = {
        struggling: 'Emerging', developing: 'Developing', proficient: 'Proficient', advanced: 'Mastered',
      };

      const coveredCategories = new Set<string>();
      for (const skillId of allSkillIds) {
        const catId = skillCatIdMap.get(skillId);
        if (catId) { const label = catLabelMap.get(catId); if (label) coveredCategories.add(label); }
      }

      const skillPerfs = payload.skillPerformances.map(sp => ({
        skillName: skillNameMap.get(sp.skillId) || 'Unknown Skill',
        accuracy: ratingLabel[sp.rating] || sp.rating,
        observations: sp.observationIds || [],
        note: sp.note || undefined,
      }));

      const strengthLabels = (payload.strengthObservations || []).map((o: any) => typeof o === 'string' ? o : o.label || o.id);
      const struggleLabels = (payload.struggleObservations || []).map((o: any) => typeof o === 'string' ? o : o.label || o.id);

      const { buildUnifiedEmbeddingContent: buildContent } = await import('@/lib/intelligence/embedding-builder');
      const contentForEmbedding = buildContent({
        childName,
        eventDate: payload.sessionDate,
        eventType: 'structured_capture',
        sessionModality: existing.session_modality,
        skillsCovered: coveredCategories.size > 0 ? Array.from(coveredCategories) : undefined,
        skillPerformances: skillPerfs.length > 0 ? skillPerfs : undefined,
        strengthObservations: strengthLabels.length > 0 ? strengthLabels : undefined,
        struggleObservations: struggleLabels.length > 0 ? struggleLabels : undefined,
        customStrengthNote: payload.customStrengthNote || undefined,
        customStruggleNote: payload.customStruggleNote || undefined,
        engagementLevel: payload.engagementLevel,
        wordsMastered: payload.wordsMastered?.length ? payload.wordsMastered : undefined,
        wordsStruggled: payload.wordsStruggled?.length ? payload.wordsStruggled : undefined,
        artifactText: payload.childArtifact?.text || undefined,
        homeworkAssigned: payload.homeworkAssigned && payload.homeworkDescription
          ? [payload.homeworkDescription] : undefined,
      });

      // Dispatch downstream automation to orchestrator (async)
      const { queuePostCaptureOrchestrator } = await import('@/lib/qstash');
      await queuePostCaptureOrchestrator({
        captureId,
        sessionId: existing.session_id,
        childId: existing.child_id,
        coachId: existing.coach_id,
        sessionModality: existing.session_modality,
        isAiPrefillConfirmation: true,
      });

      console.log(JSON.stringify({
        requestId,
        event: 'ai_capture_confirmed',
        captureId,
        childId: existing.child_id,
        sessionId: existing.session_id,
        score,
        signalConfidence,
      }));

      return NextResponse.json({
        success: true,
        capture: { id: captureId, intelligenceScore: score, signalConfidence },
      });
    }

    // 1. Load weights and compute score (new capture path)
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
        child_artifact_type: payload.childArtifact?.type || 'none',
        child_artifact_url: payload.childArtifact?.url || null,
        child_artifact_text: payload.childArtifact?.text || null,
        child_artifact_duration_seconds: payload.childArtifact?.durationSeconds || null,
        child_artifact_analysis: (payload.childArtifact?.analysis as any) || null,
        words_struggled: payload.wordsStruggled || [],
        words_mastered: payload.wordsMastered || [],
        coach_voice_note_url: payload.coachVoiceNoteUrl || null,
        intelligence_score: score,
        submitted_at: new Date().toISOString(),
      } as any)
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

    // 2b. Calculate capture delay using ACTUAL session time (not midnight)
    try {
      let sessionEndTime: Date;

      if (payload.sessionId) {
        // Get real session time from scheduled_sessions
        const { data: sessionRow } = await supabase
          .from('scheduled_sessions')
          .select('scheduled_date, scheduled_time, duration_minutes')
          .eq('id', payload.sessionId)
          .single();

        if (sessionRow?.scheduled_time) {
          // Build end time: scheduled_date + scheduled_time + duration
          const duration = sessionRow.duration_minutes || 45;
          sessionEndTime = new Date(`${sessionRow.scheduled_date}T${sessionRow.scheduled_time}`);
          sessionEndTime.setMinutes(sessionEndTime.getMinutes() + duration);
        } else {
          // Fallback: session date + 45min (shouldn't happen but defensive)
          sessionEndTime = new Date(payload.sessionDate + 'T00:00:00');
          sessionEndTime.setMinutes(sessionEndTime.getMinutes() + 45);
        }
      } else {
        // Ad-hoc capture (no session) — use session date as baseline
        sessionEndTime = new Date(payload.sessionDate + 'T00:00:00');
        sessionEndTime.setMinutes(sessionEndTime.getMinutes() + 45);
      }

      const submittedAt = new Date();
      const delayHours = Math.max(0, (submittedAt.getTime() - sessionEndTime.getTime()) / (1000 * 60 * 60));

      // Confidence multiplier based on delay
      let delayMultiplier = 1.0;
      if (delayHours > 48) delayMultiplier = 0.5;
      else if (delayHours > 24) delayMultiplier = 0.7;
      else if (delayHours > 6) delayMultiplier = 0.85;
      else if (delayHours > 1) delayMultiplier = 0.95;
      // delay <= 1hr (including during/right after session) → 1.0 (no penalty)

      await supabase
        .from('structured_capture_responses')
        .update({
          capture_delay_hours: Math.round(delayHours * 10) / 10,
          delay_confidence_multiplier: delayMultiplier,
        } as any)
        .eq('id', capture.id);

      // Apply delay to intelligence score only if there's actual decay
      if (delayMultiplier < 1.0) {
        const adjustedScore = Math.round(score * delayMultiplier);
        await supabase
          .from('structured_capture_responses')
          .update({ intelligence_score: adjustedScore } as any)
          .eq('id', capture.id);
      }
    } catch (delayErr: any) {
      console.error(JSON.stringify({ requestId, event: 'capture_delay_calc_error', error: delayErr.message }));
    }

    // 3. Build content_for_embedding with human-readable names
    const allSkillIds = payload.skillsCovered.length > 0
      ? payload.skillsCovered
      : payload.skillPerformances.map(sp => sp.skillId);

    // Batch-fetch: skill names + category IDs, child name (parallel)
    const [skillResult, childResult] = await Promise.all([
      allSkillIds.length > 0
        ? supabase.from('el_skills').select('id, name, category_id').in('id', allSkillIds)
        : Promise.resolve({ data: [] as { id: string; name: string; category_id: string | null }[] }),
      supabase.from('children').select('child_name, name').eq('id', payload.childId).single(),
    ]);

    const skillNameMap = new Map<string, string>();
    const skillCatIdMap = new Map<string, string>();
    for (const s of skillResult.data || []) {
      skillNameMap.set(s.id, s.name);
      if (s.category_id) skillCatIdMap.set(s.id, s.category_id);
    }

    // Fetch category labels for covered categories
    const uniqueCatIds = Array.from(new Set(Array.from(skillCatIdMap.values())));
    const catLabelMap = new Map<string, string>();
    if (uniqueCatIds.length > 0) {
      const { data: cats } = await supabase
        .from('skill_categories')
        .select('id, parent_label, label')
        .in('id', uniqueCatIds);
      for (const c of cats || []) {
        catLabelMap.set(c.id, c.parent_label || c.label);
      }
    }

    const childName = childResult.data?.child_name || childResult.data?.name || 'Student';
    const ratingLabel: Record<string, string> = {
      struggling: 'Emerging', developing: 'Developing', proficient: 'Proficient', advanced: 'Mastered',
    };

    // Category-level skill names for embedding
    const coveredCategories = new Set<string>();
    for (const skillId of allSkillIds) {
      const catId = skillCatIdMap.get(skillId);
      if (catId) {
        const label = catLabelMap.get(catId);
        if (label) coveredCategories.add(label);
      }
    }

    // Build per-skill performance for unified builder
    const skillPerfs = payload.skillPerformances.map(sp => ({
      skillName: skillNameMap.get(sp.skillId) || 'Unknown Skill',
      accuracy: ratingLabel[sp.rating] || sp.rating,
      observations: sp.observationIds || [],
      note: sp.note || undefined,
    }));

    // Resolve strength/struggle observation labels
    const strengthLabels = (payload.strengthObservations || []).map((o: any) => typeof o === 'string' ? o : o.label || o.id);
    const struggleLabels = (payload.struggleObservations || []).map((o: any) => typeof o === 'string' ? o : o.label || o.id);

    const { buildUnifiedEmbeddingContent } = await import('@/lib/intelligence/embedding-builder');
    const contentForEmbedding = buildUnifiedEmbeddingContent({
      childName,
      eventDate: payload.sessionDate,
      eventType: 'structured_capture',
      sessionModality: payload.sessionModality as string,
      skillsCovered: coveredCategories.size > 0 ? Array.from(coveredCategories) : undefined,
      skillPerformances: skillPerfs.length > 0 ? skillPerfs : undefined,
      strengthObservations: strengthLabels.length > 0 ? strengthLabels : undefined,
      struggleObservations: struggleLabels.length > 0 ? struggleLabels : undefined,
      customStrengthNote: payload.customStrengthNote || undefined,
      customStruggleNote: payload.customStruggleNote || undefined,
      engagementLevel: payload.engagementLevel,
      wordsMastered: payload.wordsMastered?.length ? payload.wordsMastered : undefined,
      wordsStruggled: payload.wordsStruggled?.length ? payload.wordsStruggled : undefined,
      artifactText: payload.childArtifact?.text || undefined,
      homeworkAssigned: payload.homeworkAssigned && payload.homeworkDescription
        ? [payload.homeworkDescription] : undefined,
    });

    // 4. Dispatch downstream automation to orchestrator (async via QStash)
    // Coach gets immediate response — orchestrator handles learning_event,
    // homework, WhatsApp, SmartPractice, continuations, session prep
    const { queuePostCaptureOrchestrator } = await import('@/lib/qstash');
    const queueResult = await queuePostCaptureOrchestrator({
      captureId: capture.id,
      sessionId: payload.sessionId ?? null,
      childId: payload.childId,
      coachId: payload.coachId,
      sessionModality: payload.sessionModality,
    });

    console.log(JSON.stringify({
      requestId,
      event: 'capture_complete',
      captureId: capture.id,
      orchestratorQueued: queueResult.success,
      orchestratorMessageId: queueResult.messageId,
      score,
      confidence,
    }));

    return NextResponse.json({
      success: true,
      capture: {
        id: capture.id,
        intelligenceScore: score,
        signalConfidence: confidence,
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
