// ============================================================
// POST/GET /api/intelligence/micro-observation
// Quick-fire during-session observation taps. Must be FAST.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

// POST: Save a single micro-observation (< 200ms target)
export async function POST(request: NextRequest) {
  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      sessionId, childId, observationType, observationId,
      wordText, wordStatus, noteText, minutesIntoSession,
      // Activity tracking fields (unified MicroNotePanel)
      captureMode, activityName, activityIndex, durationSeconds, skillId,
    } = body;

    const coachId = auth.coachId || auth.userId;
    if (!sessionId || !childId || !observationType || !coachId) {
      return NextResponse.json({ error: 'sessionId, childId, observationType required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('micro_observations')
      .insert({
        session_id: sessionId,
        child_id: childId,
        coach_id: coachId,
        observation_type: observationType,
        observation_id: observationId || null,
        word_text: wordText || null,
        word_status: wordStatus || null,
        note_text: noteText || null,
        minutes_into_session: minutesIntoSession || null,
        // Activity tracking (nullable — legacy rows won't have these)
        capture_mode: captureMode || null,
        activity_name: activityName || null,
        activity_index: activityIndex != null ? activityIndex : null,
        duration_seconds: durationSeconds || null,
        skill_id: skillId || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[micro-obs] Insert failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (err: any) {
    console.error('[micro-obs] Error:', err.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET: Fetch all micro-observations for a session (used by capture form pre-fill)
export async function GET(request: NextRequest) {
  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('micro_observations')
    .select('id, observation_type, observation_id, word_text, word_status, note_text, minutes_into_session, captured_at, capture_mode, activity_name, activity_index, duration_seconds, skill_id')
    .eq('session_id', sessionId)
    .order('captured_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}
