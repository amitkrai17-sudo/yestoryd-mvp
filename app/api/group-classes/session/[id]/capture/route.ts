// ============================================================
// POST /api/group-classes/session/[id]/capture
// ============================================================
// Group Class → UIP Structured Capture Bridge
//
// Accepts per-child structured observations from the instructor
// console, writes to structured_capture_responses + learning_events,
// computes intelligence scores, and updates child_intelligence_profiles.
//
// This upgrades the existing low-fidelity engagement/skillTags/note
// flow into full UIP-compatible intelligence signals.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { computeIntelligenceScore, getSignalConfidence, DEFAULT_WEIGHTS } from '@/lib/intelligence/score';
import type { IntelligenceWeights } from '@/lib/intelligence/score';
import { generateEmbedding } from '@/lib/rai/embeddings';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ============================================================
// Validation Schemas
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const childCaptureSchema = z.object({
  child_id: z.string().regex(UUID_RE, 'Invalid child_id UUID'),
  engagement_level: z.enum(['low', 'moderate', 'high', 'exceptional']),
  skill_ids: z.array(z.string().regex(UUID_RE)).default([]),
  skill_performances: z.array(z.object({
    skillId: z.string().regex(UUID_RE),
    rating: z.enum(['struggling', 'developing', 'proficient', 'advanced']),
    observationIds: z.array(z.string()).default([]),
    note: z.string().max(500).optional(),
  })).default([]),
  strength_observations: z.array(z.string()).default([]),
  struggle_observations: z.array(z.string()).default([]),
  custom_note: z.string().max(1000).optional(),
  voice_note_url: z.string().optional(),
});

const requestSchema = z.object({
  captures: z.array(childCaptureSchema).min(1).max(50),
  session_notes: z.string().max(5000).optional(),
});

// ============================================================
// Weight loader (reused from intelligence/capture)
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

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // ─── Auth ───
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { id: sessionId } = await context.params;
    if (!z.string().uuid().safeParse(sessionId).success) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // ─── Parse body ───
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

    const { captures, session_notes } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'group_capture_start', sessionId, captureCount: captures.length, email: auth.email }));

    const supabase = getServiceSupabase();

    // ─── Fetch session + class type ───
    const { data: session } = await supabase
      .from('group_sessions')
      .select(`
        id, instructor_id, coach_id, status, scheduled_date,
        blueprint_id, class_type_id, duration_minutes,
        group_class_types ( id, name, slug )
      `)
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // ─── Auth: must be assigned instructor/coach (or admin) ───
    if (auth.role !== 'admin') {
      const isAssigned = session.instructor_id === auth.coachId || session.coach_id === auth.coachId;
      if (!isAssigned) {
        return NextResponse.json({ error: 'Not assigned to this session' }, { status: 403 });
      }
    }

    const classTypeRaw = session.group_class_types;
    const classType = Array.isArray(classTypeRaw) ? classTypeRaw[0] : classTypeRaw;
    const classTypeName = classType?.name || 'Group Class';
    const sessionDate = session.scheduled_date || new Date().toISOString().split('T')[0];
    const coachId = session.instructor_id || session.coach_id || auth.coachId || 'unknown';

    // ─── Load intelligence weights ───
    const weights = await loadWeights();

    // ─── Fetch child names ───
    const childIds = captures.map(c => c.child_id);
    const { data: children } = await supabase
      .from('children')
      .select('id, child_name, age_band')
      .in('id', childIds);

    const childMap = new Map<string, { name: string; ageBand: string | null }>();
    for (const child of children || []) {
      childMap.set(child.id, { name: child.child_name || 'Unknown', ageBand: child.age_band || null });
    }

    // ─── Process each child capture ───
    const results: Array<{
      childId: string;
      childName: string;
      intelligenceScore: number;
      signalConfidence: string;
      captureId: string | null;
      learningEventId: string | null;
    }> = [];

    const confidence = getSignalConfidence('instructor_console');
    const now = new Date().toISOString();

    for (const capture of captures) {
      const childInfo = childMap.get(capture.child_id) || { name: 'Unknown', ageBand: null };

      try {
        // ─── (a) Compute intelligence score ───
        const score = computeIntelligenceScore({
          hasSkillsCovered: capture.skill_ids.length > 0,
          hasPerformanceRatings: capture.skill_performances.length > 0,
          hasChildArtifact: !!capture.voice_note_url,
          hasObservations: capture.strength_observations.length > 0 || capture.struggle_observations.length > 0,
          hasEngagement: true,
        }, weights);

        // ─── (b) Write to structured_capture_responses ───
        const { data: captureRow, error: captureErr } = await supabase
          .from('structured_capture_responses')
          .insert({
            child_id: capture.child_id,
            coach_id: coachId,
            session_id: null,
            group_session_id: sessionId,
            session_date: sessionDate,
            session_modality: 'group_class',
            capture_method: 'instructor_console',
            skills_covered: capture.skill_ids,
            skill_performances: capture.skill_performances as any,
            engagement_level: capture.engagement_level,
            strength_observations: capture.strength_observations,
            struggle_observations: capture.struggle_observations,
            custom_strength_note: null,
            custom_struggle_note: capture.custom_note || null,
            context_tags: null,
            ai_prefilled: false,
            coach_confirmed: true,
            voice_input_url: capture.voice_note_url || null,
            child_artifact_type: null,
            child_artifact_url: null,
            intelligence_score: score,
            submitted_at: now,
          })
          .select('id')
          .single();

        if (captureErr) {
          console.error(JSON.stringify({ requestId, event: 'capture_insert_error', childId: capture.child_id, error: captureErr.message }));
        }

        // ─── (c) Build embedding content + generate embedding ───
        const embeddingParts: string[] = [
          `${childInfo.name} attended ${classTypeName} on ${sessionDate}.`,
          `Engagement: ${capture.engagement_level}.`,
          capture.skill_ids.length > 0 ? `Skills covered: ${capture.skill_ids.length} skills.` : '',
          capture.strength_observations.length > 0 ? `Strengths observed: ${capture.strength_observations.length} observations.` : '',
          capture.struggle_observations.length > 0 ? `Struggles observed: ${capture.struggle_observations.length} observations.` : '',
          capture.custom_note ? `Notes: ${capture.custom_note}` : '',
        ].filter(Boolean);
        const contentForEmbedding = embeddingParts.join(' ').trim();

        let embeddingStr: string | null = null;
        try {
          const embedding = await generateEmbedding(contentForEmbedding);
          embeddingStr = JSON.stringify(embedding);
        } catch (embErr) {
          console.error(JSON.stringify({ requestId, event: 'capture_embedding_error', childId: capture.child_id, error: embErr instanceof Error ? embErr.message : 'Unknown' }));
        }

        // ─── (d) Create learning_event ───
        const { data: eventRow, error: eventErr } = await supabase
          .from('learning_events')
          .insert({
            child_id: capture.child_id,
            coach_id: coachId,
            event_type: 'group_class_observation',
            event_date: sessionDate,
            signal_confidence: confidence,
            signal_source: 'group_class',
            intelligence_score: score,
            session_modality: 'group_class',
            event_data: {
              session_id: sessionId,
              capture_id: captureRow?.id || null,
              class_type_name: classTypeName,
              engagement_level: capture.engagement_level,
              skills_covered: capture.skill_ids,
              skill_performances: capture.skill_performances,
              strength_observations: capture.strength_observations,
              struggle_observations: capture.struggle_observations,
              custom_note: capture.custom_note || null,
              voice_note_url: capture.voice_note_url || null,
              blueprint_id: session.blueprint_id || null,
              capture_method: 'instructor_console',
            },
            content_for_embedding: contentForEmbedding,
            embedding: embeddingStr,
            voice_note_url: capture.voice_note_url || null,
            created_by: auth.email || null,
          })
          .select('id')
          .single();

        if (eventErr) {
          console.error(JSON.stringify({ requestId, event: 'learning_event_error', childId: capture.child_id, error: eventErr.message }));
        }

        // ─── (e) Update child_intelligence_profiles freshness ───
        try {
          const { data: existing } = await supabase
            .from('child_intelligence_profiles')
            .select('id, total_event_count, low_confidence_event_count')
            .eq('child_id', capture.child_id)
            .single();

          if (existing) {
            await supabase
              .from('child_intelligence_profiles')
              .update({
                freshness_status: 'fresh',
                last_any_signal_at: now,
                total_event_count: (existing.total_event_count || 0) + 1,
                low_confidence_event_count: (existing.low_confidence_event_count || 0) + 1,
                updated_at: now,
              })
              .eq('child_id', capture.child_id);
          } else {
            await supabase
              .from('child_intelligence_profiles')
              .insert({
                child_id: capture.child_id,
                freshness_status: 'fresh',
                overall_confidence: 'low',
                last_any_signal_at: now,
                total_event_count: 1,
                low_confidence_event_count: 1,
              });
          }
        } catch (profileErr) {
          console.error(JSON.stringify({ requestId, event: 'profile_update_error', childId: capture.child_id, error: profileErr instanceof Error ? profileErr.message : 'Unknown' }));
        }

        results.push({
          childId: capture.child_id,
          childName: childInfo.name,
          intelligenceScore: score,
          signalConfidence: confidence,
          captureId: captureRow?.id || null,
          learningEventId: eventRow?.id || null,
        });
      } catch (childErr) {
        console.error(JSON.stringify({ requestId, event: 'child_capture_error', childId: capture.child_id, error: childErr instanceof Error ? childErr.message : 'Unknown' }));
        results.push({
          childId: capture.child_id,
          childName: childInfo.name,
          intelligenceScore: 0,
          signalConfidence: confidence,
          captureId: null,
          learningEventId: null,
        });
      }
    }

    // ─── Mark session as completed ───
    await supabase
      .from('group_sessions')
      .update({
        status: 'completed',
        completed_at: now,
        notes: session_notes || null,
        updated_at: now,
      })
      .eq('id', sessionId);

    // ─── Audit log ───
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: auth.role || 'coach',
      action: 'group_session_structured_capture',
      metadata: {
        request_id: requestId,
        session_id: sessionId,
        capture_count: captures.length,
        avg_score: results.length > 0 ? Math.round(results.reduce((sum, r) => sum + r.intelligenceScore, 0) / results.length) : 0,
        timestamp: now,
      },
      created_at: now,
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'group_capture_complete', sessionId, results: results.length, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      results,
      session_completed: true,
    }, { status: 201 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'group_capture_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
