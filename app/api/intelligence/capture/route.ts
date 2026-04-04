// ============================================================
// POST /api/intelligence/capture
// Accepts structured capture from coach/instructor, computes
// intelligence score, writes to structured_capture_responses
// and creates a learning_event.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { computeIntelligenceScore, getSignalConfidence, DEFAULT_WEIGHTS } from '@/lib/intelligence/score';
import { insertLearningEvent } from '@/lib/rai/learning-events';
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

      const { insertLearningEvent } = await import('@/lib/rai/learning-events');
      await insertLearningEvent({
        childId: existing.child_id,
        coachId: existing.coach_id,
        sessionId: existing.session_id ?? undefined,
        eventType: 'structured_capture',
        eventSubtype: payload.captureMethod,
        eventDate: payload.sessionDate,
        signalConfidence: signalConfidence as 'high' | 'medium' | 'low',
        signalSource: 'structured_capture',
        intelligenceScore: score,
        sessionModality: existing.session_modality,
        eventData: {
          captureId,
          skillsCovered: payload.skillsCovered,
          skillPerformances: payload.skillPerformances as any,
          engagementLevel: payload.engagementLevel,
          strengthObservations: payload.strengthObservations,
          struggleObservations: payload.struggleObservations,
          captureMethod: payload.captureMethod,
          hasArtifact: !!payload.childArtifact,
          homework_assigned: !!payload.homeworkAssigned,
          homework_description: payload.homeworkAssigned ? (payload.homeworkDescription || null) : null,
          ai_prefilled: existing.ai_prefilled,
          coach_confirmed: true,
        },
        contentForEmbedding,
        createdBy: auth.userId || undefined,
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

    // 4 + 5. Create learning_event (embedding generated internally by insertLearningEvent)
    const learningEvent = await insertLearningEvent({
      childId: payload.childId,
      coachId: payload.coachId,
      sessionId: payload.sessionId ?? undefined,
      eventType: 'structured_capture',
      eventSubtype: payload.captureMethod,
      eventDate: payload.sessionDate,
      signalConfidence: confidence,
      signalSource: 'structured_capture',
      intelligenceScore: score,
      sessionModality: payload.sessionModality as import('@/lib/rai/learning-events').SessionModality,
      eventData: {
        captureId: capture.id,
        skillsCovered: payload.skillsCovered,
        skillPerformances: payload.skillPerformances as any,
        engagementLevel: payload.engagementLevel,
        strengthObservations: payload.strengthObservations,
        struggleObservations: payload.struggleObservations,
        captureMethod: payload.captureMethod,
        hasArtifact: !!payload.childArtifact,
        homework_assigned: !!payload.homeworkAssigned,
        homework_description: payload.homeworkAssigned ? (payload.homeworkDescription || null) : null,
      },
      contentForEmbedding,
      createdBy: auth.userId || undefined,
    });

    if (!learningEvent) {
      console.error(JSON.stringify({
        requestId,
        event: 'capture_learning_event_error',
        error: 'insertLearningEvent returned null (see activity_log)',
      }));
      // Non-fatal — capture was saved. Log but don't fail.
    }

    // 6. Create parent_daily_task if homework was assigned
    let homeworkTaskId: string | null = null;
    if (payload.homeworkAssigned && payload.homeworkDescription) {
      try {
        // Look up enrollment_id from session
        let enrollmentId: string | null = null;
        if (payload.sessionId) {
          const { data: sess } = await supabase
            .from('scheduled_sessions')
            .select('enrollment_id')
            .eq('id', payload.sessionId)
            .single();
          enrollmentId = sess?.enrollment_id || null;
        }

        // Derive linked_skill from the primary skill performance (first rated skill)
        const primarySkill = payload.skillPerformances[0];
        let linkedSkill: string | null = null;
        if (primarySkill?.skillId) {
          const { data: skillRow } = await supabase
            .from('el_skills')
            .select('skill_tag')
            .eq('id', primarySkill.skillId)
            .single();
          linkedSkill = skillRow?.skill_tag || null;
        }

        const { data: task } = await supabase
          .from('parent_daily_tasks')
          .insert({
            child_id: payload.childId,
            enrollment_id: enrollmentId,
            session_id: payload.sessionId,
            task_date: payload.sessionDate,
            title: 'Coach Assigned Practice',
            description: payload.homeworkDescription,
            source: 'coach_assigned',
            linked_skill: linkedSkill,
            is_completed: false,
            duration_minutes: 15,
          })
          .select('id')
          .single();

        homeworkTaskId = task?.id || null;

        // Notify parent of homework assignment (same pattern as complete/route.ts)
        if (homeworkTaskId) {
          try {
            const { data: childInfo } = await supabase
              .from('children')
              .select('child_name, parent_phone, parent_email, parent_name, parent_id')
              .eq('id', payload.childId)
              .single();

            if (childInfo?.parent_phone || childInfo?.parent_email) {
              const { sendCommunication } = await import('@/lib/communication');
              const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';

              const commResult = await sendCommunication({
                templateCode: 'P22_practice_tasks_assigned',
                recipientType: 'parent',
                recipientId: childInfo.parent_id || undefined,
                recipientPhone: childInfo.parent_phone || undefined,
                recipientEmail: childInfo.parent_email || undefined,
                recipientName: childInfo.parent_name || undefined,
                variables: {
                  parent_first_name: (childInfo.parent_name || 'Parent').split(' ')[0],
                  child_name: childInfo.child_name || 'your child',
                  task_count: '1',
                  dashboard_link: `${baseUrl}/parent/dashboard`,
                },
                relatedEntityType: 'session',
                relatedEntityId: payload.sessionId || undefined,
              });

              console.log(JSON.stringify({
                requestId,
                event: 'homework_notify_result',
                success: commResult.success,
                results: commResult.results,
              }));
            }
          } catch (notifyErr) {
            console.error(JSON.stringify({
              requestId,
              event: 'homework_notify_error',
              error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
            }));
            // Non-blocking — task was already created
          }
        }
      } catch (taskErr) {
        console.error(JSON.stringify({
          requestId,
          event: 'homework_task_creation_error',
          error: taskErr instanceof Error ? taskErr.message : String(taskErr),
        }));
        // Non-fatal
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'capture_complete',
      captureId: capture.id,
      learningEventId: learningEvent?.id,
      homeworkTaskId,
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
