// ============================================================
// FILE: app/api/coach/sessions/[id]/exit-assessment/route.ts
// PURPOSE: Save/retrieve exit assessment + trigger season completion
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { completeSeason } from '@/lib/completion/complete-season';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// GET: Load existing exit data + diagnostic baseline for comparison
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
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, child_id, coach_id, session_type, session_number,
        session_template_id, duration_minutes, status, enrollment_id
      `)
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get child details
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age, age_band')
      .eq('id', session.child_id)
      .single();

    // Check if template is season finale
    let isFinale = false;
    let template = null;
    if (session.session_template_id) {
      const { data: t } = await supabase
        .from('session_templates')
        .select('id, template_code, title, is_season_finale')
        .eq('id', session.session_template_id)
        .single();
      template = t;
      isFinale = t?.is_season_finale || false;
    }

    const ageBand = child?.age_band || 'building';

    // Get diagnostic baseline (Session 1)
    const { data: diagnosticEvent } = await supabase
      .from('learning_events')
      .select('event_data, created_at')
      .eq('child_id', session.child_id)
      .eq('event_type', 'diagnostic_assessment')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Get existing exit assessment
    const { data: exitEvent } = await supabase
      .from('learning_events')
      .select('id, event_data, created_at')
      .eq('child_id', session.child_id)
      .eq('event_type', 'exit_assessment')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        child_id: session.child_id,
        coach_id: session.coach_id,
        session_number: session.session_number,
        status: session.status,
        enrollment_id: session.enrollment_id,
        is_finale: isFinale,
      },
      child: child || null,
      age_band: ageBand,
      template: template || null,
      diagnostic_baseline: diagnosticEvent
        ? {
            data: diagnosticEvent.event_data?.diagnostic_data || diagnosticEvent.event_data || {},
            date: diagnosticEvent.created_at,
          }
        : null,
      exit_assessment: exitEvent
        ? {
            id: exitEvent.id,
            data: exitEvent.event_data?.exit_data || exitEvent.event_data || {},
            date: exitEvent.created_at,
          }
        : null,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'exit_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Save exit assessment + trigger season completion
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
    const { exitData } = body;

    if (!exitData || typeof exitData !== 'object') {
      return NextResponse.json({ error: 'exitData is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Get session details
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, coach_id, enrollment_id, status')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify coach assignment
    if (auth.role === 'coach' && session.coach_id !== auth.coachId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get child details
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age, age_band')
      .eq('id', session.child_id)
      .single();

    const ageBand = child?.age_band || 'building';

    // Build event data
    const eventData = {
      session_id: sessionId,
      enrollment_id: session.enrollment_id,
      age_band: ageBand,
      exit_data: exitData,
      coach_id: session.coach_id,
      completed_at: new Date().toISOString(),
    };

    // Build content for embedding
    const contentParts = [
      `Exit assessment for ${child?.child_name || 'child'}, age ${child?.age || 'unknown'}`,
      `Age band: ${ageBand}`,
      `Overall progress: ${exitData.overall_progress || 'not rated'}`,
    ];
    if (exitData.biggest_achievement) {
      contentParts.push(`Achievement: ${exitData.biggest_achievement}`);
    }
    if (exitData.areas_still_developing?.length) {
      contentParts.push(`Developing: ${exitData.areas_still_developing.join(', ')}`);
    }
    if (exitData.ready_for_next_season) {
      contentParts.push(`Next season: ${exitData.ready_for_next_season}`);
    }
    if (exitData.coach_notes_for_next_season) {
      contentParts.push(`Notes: ${exitData.coach_notes_for_next_season}`);
    }

    // Upsert exit assessment
    const { data: existing } = await supabase
      .from('learning_events')
      .select('id')
      .eq('child_id', session.child_id)
      .eq('event_type', 'exit_assessment')
      .limit(1)
      .maybeSingle();

    let eventId: string;

    if (existing) {
      const { data: updated } = await supabase
        .from('learning_events')
        .update({
          event_data: eventData,
          content_for_embedding: contentParts.join('\n'),
          coach_id: session.coach_id,
          session_id: sessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id')
        .single();
      eventId = updated!.id;
    } else {
      const { data: created } = await supabase
        .from('learning_events')
        .insert({
          child_id: session.child_id,
          coach_id: session.coach_id,
          session_id: sessionId,
          event_type: 'exit_assessment',
          event_date: new Date().toISOString(),
          event_data: eventData,
          data: eventData,
          content_for_embedding: contentParts.join('\n'),
          created_by: auth.email,
        })
        .select('id')
        .single();
      eventId = created!.id;
    }

    // Mark session as completed
    if (session.status !== 'completed') {
      await supabase
        .from('scheduled_sessions')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }

    // Trigger season completion
    let seasonResult = null;
    if (session.enrollment_id) {
      try {
        seasonResult = await completeSeason(session.enrollment_id);
        console.log(JSON.stringify({
          requestId,
          event: 'season_completion_triggered',
          enrollmentId: session.enrollment_id,
          success: seasonResult.success,
        }));
      } catch (err: any) {
        console.error(JSON.stringify({
          requestId,
          event: 'season_completion_error',
          error: err.message,
        }));
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'exit_assessment_saved',
      eventId,
      sessionId,
      childId: session.child_id,
      by: auth.email,
    }));

    return NextResponse.json({
      success: true,
      eventId,
      message: 'Exit assessment saved',
      season_completion: seasonResult ? {
        success: seasonResult.success,
        season_number: seasonResult.season_number,
        next_season: seasonResult.next_season_preview,
      } : null,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'exit_post_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
