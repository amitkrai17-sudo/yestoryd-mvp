// ============================================================
// FILE: app/api/coach/diagnostic/[id]/route.ts
// PURPOSE: Save and retrieve diagnostic assessment data
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { generateLearningPlan } from '@/lib/plan-generation/generate-learning-plan';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// GET: Retrieve existing diagnostic data for a session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const supabase = getServiceSupabase();

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, child_id, coach_id, session_type, session_number,
        is_diagnostic, session_template_id, duration_minutes, status
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get child details including age_band
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age, age_band')
      .eq('id', session.child_id)
      .single();

    // Get template details if assigned
    let template = null;
    if (session.session_template_id) {
      const { data: t } = await supabase
        .from('session_templates')
        .select('*')
        .eq('id', session.session_template_id)
        .single();
      template = t;
    }

    // Look for existing diagnostic event
    const { data: existingEvent } = await supabase
      .from('learning_events')
      .select('id, event_data, created_at, updated_at')
      .eq('child_id', session.child_id)
      .eq('event_type', 'diagnostic_assessment')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Determine age_band: prefer child's, fall back to template, fall back to computation
    let ageBand = child?.age_band || template?.age_band || null;
    if (!ageBand && child?.age) {
      if (child.age >= 4 && child.age <= 6) ageBand = 'foundation';
      else if (child.age >= 7 && child.age <= 9) ageBand = 'building';
      else if (child.age >= 10 && child.age <= 12) ageBand = 'mastery';
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        child_id: session.child_id,
        coach_id: session.coach_id,
        session_number: session.session_number,
        is_diagnostic: session.is_diagnostic,
        status: session.status,
        duration_minutes: session.duration_minutes,
      },
      child: child || null,
      age_band: ageBand || 'building',
      template: template || null,
      diagnostic: existingEvent
        ? {
            id: existingEvent.id,
            data: existingEvent.event_data?.diagnostic_data || existingEvent.event_data || {},
            created_at: existingEvent.created_at,
            updated_at: existingEvent.updated_at,
          }
        : null,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'diagnostic_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Save diagnostic assessment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const body = await request.json();
    const { diagnosticData } = body;

    if (!diagnosticData || typeof diagnosticData !== 'object') {
      return NextResponse.json({ error: 'diagnosticData is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, coach_id, is_diagnostic, session_template_id, enrollment_id, status')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.is_diagnostic) {
      return NextResponse.json({ error: 'This session is not a diagnostic session' }, { status: 400 });
    }

    // Verify coach is assigned
    if (auth.role === 'coach' && session.coach_id !== auth.coachId) {
      return NextResponse.json({ error: 'Not authorized for this session' }, { status: 403 });
    }

    // Get child details
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age, age_band')
      .eq('id', session.child_id)
      .single();

    const ageBand = child?.age_band || diagnosticData.age_band || 'building';

    // Build event data
    const eventData = {
      session_id: sessionId,
      age_band: ageBand,
      diagnostic_data: diagnosticData,
      template_used: session.session_template_id,
      coach_id: session.coach_id,
      completed_at: new Date().toISOString(),
    };

    // Build content for embedding
    const contentParts = [
      `Diagnostic assessment for ${child?.child_name || 'child'}, age ${child?.age || 'unknown'}`,
      `Age band: ${ageBand}`,
    ];
    // Add key observations to searchable content
    if (diagnosticData.coach_observations) {
      contentParts.push(`Observations: ${diagnosticData.coach_observations}`);
    }
    if (diagnosticData.coach_recommended_focus?.length) {
      contentParts.push(`Recommended focus: ${diagnosticData.coach_recommended_focus.join(', ')}`);
    }
    if (diagnosticData.confidence_level) {
      contentParts.push(`Confidence: ${diagnosticData.confidence_level}`);
    }
    const contentForEmbedding = contentParts.join('\n');

    // Check for existing diagnostic event (upsert pattern)
    const { data: existing } = await supabase
      .from('learning_events')
      .select('id')
      .eq('child_id', session.child_id)
      .eq('event_type', 'diagnostic_assessment')
      .limit(1)
      .maybeSingle();

    let eventId: string;

    if (existing) {
      // Update existing
      const { data: updated, error: updateError } = await supabase
        .from('learning_events')
        .update({
          event_data: eventData,
          content_for_embedding: contentForEmbedding,
          coach_id: session.coach_id,
          session_id: sessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id')
        .single();

      if (updateError) {
        console.error(JSON.stringify({ requestId, event: 'diagnostic_update_error', error: updateError.message }));
        return NextResponse.json({ error: 'Failed to update diagnostic' }, { status: 500 });
      }
      eventId = updated.id;
    } else {
      // Insert new
      const { data: created, error: insertError } = await supabase
        .from('learning_events')
        .insert({
          child_id: session.child_id,
          coach_id: session.coach_id,
          session_id: sessionId,
          event_type: 'diagnostic_assessment',
          event_date: new Date().toISOString(),
          event_data: eventData,
          data: eventData, // legacy field
          content_for_embedding: contentForEmbedding,
          created_by: auth.email,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(JSON.stringify({ requestId, event: 'diagnostic_insert_error', error: insertError.message }));
        return NextResponse.json({ error: 'Failed to save diagnostic' }, { status: 500 });
      }
      eventId = created.id;
    }

    // Mark session as completed if not already
    if (session.status !== 'completed') {
      await supabase
        .from('scheduled_sessions')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }

    console.log(JSON.stringify({
      requestId,
      event: 'diagnostic_saved',
      eventId,
      sessionId,
      childId: session.child_id,
      ageBand,
      by: auth.email,
    }));

    // Trigger learning plan generation (non-blocking for response, but await to include result)
    let planResult = null;
    try {
      planResult = await generateLearningPlan(session.child_id, diagnosticData);
      console.log(JSON.stringify({
        requestId,
        event: 'plan_generation_complete',
        childId: session.child_id,
        success: planResult.success,
        roadmapId: planResult.roadmap_id,
        planItems: planResult.plan_items?.length || 0,
      }));
    } catch (planError: any) {
      // Plan generation failure should not block diagnostic save
      console.error(JSON.stringify({
        requestId,
        event: 'plan_generation_error',
        childId: session.child_id,
        error: planError.message,
      }));
    }

    return NextResponse.json({
      success: true,
      eventId,
      message: 'Diagnostic assessment saved',
      plan: planResult ? {
        roadmap_id: planResult.roadmap_id,
        season_name: planResult.season_name,
        plan_items: planResult.plan_items?.length || 0,
        focus_areas: planResult.focus_areas,
      } : null,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'diagnostic_post_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
