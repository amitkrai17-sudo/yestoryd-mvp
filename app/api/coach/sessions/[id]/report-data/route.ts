// ============================================================
// FILE: app/api/coach/sessions/[id]/report-data/route.ts
// PURPOSE: Fetch session data for the offline report form
//          Returns session info, template activities, and access checks
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

interface ActivityStep {
  time: string;
  activity: string;
  purpose: string;
  activity_id?: string;
  activity_name?: string;
  planned_duration_minutes?: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Auth check
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const supabase = getServiceSupabase();
    const coachId = auth.coachId;

    if (!coachId) {
      return NextResponse.json({ error: 'Coach identity required' }, { status: 403 });
    }

    // 2. Fetch session with child details
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, child_id, coach_id, session_number,
        scheduled_date, scheduled_time,
        session_mode, offline_request_status,
        report_submitted_at, report_deadline,
        coach_voice_note_path, child_reading_clip_path,
        session_template_id, status,
        children!scheduled_sessions_child_id_fkey (
          child_name, age
        )
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 3. Access control checks
    if (session.coach_id !== coachId && auth.role !== 'admin') {
      return NextResponse.json({ error: 'Session does not belong to this coach' }, { status: 403 });
    }

    if (session.session_mode !== 'offline') {
      return NextResponse.json({ error: 'This form is only for in-person sessions' }, { status: 400 });
    }

    const approvedStatuses = ['approved', 'auto_approved'];
    if (!session.offline_request_status || !approvedStatuses.includes(session.offline_request_status)) {
      return NextResponse.json({ error: 'In-person session must be approved before submitting a report' }, { status: 400 });
    }

    // Check if session time is in the past
    const scheduledDateTime = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
    const now = new Date();
    if (scheduledDateTime > now) {
      return NextResponse.json({ error: 'Cannot submit a report before the session is scheduled to happen' }, { status: 400 });
    }

    // 4. Fetch template activities if template exists
    let activities: ActivityStep[] = [];
    if (session.session_template_id) {
      const { data: template } = await supabase
        .from('session_templates')
        .select('activity_flow, title')
        .eq('id', session.session_template_id)
        .single();

      if (template?.activity_flow) {
        const flow = template.activity_flow as unknown as ActivityStep[];
        activities = Array.isArray(flow) ? flow : [];
      }
    }

    // 5. Build response
    const child = session.children as { child_name: string | null; age: number | null } | null;

    return NextResponse.json({
      session: {
        id: session.id,
        child_id: session.child_id,
        child_name: child?.child_name || 'Unknown',
        child_age: child?.age || 0,
        session_number: session.session_number,
        scheduled_date: session.scheduled_date,
        scheduled_time: session.scheduled_time,
        session_mode: session.session_mode,
        offline_request_status: session.offline_request_status,
        report_submitted_at: session.report_submitted_at,
        report_deadline: session.report_deadline,
        coach_voice_note_path: session.coach_voice_note_path,
        child_reading_clip_path: session.child_reading_clip_path,
        session_template_id: session.session_template_id,
        status: session.status,
        activities,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[report-data] Error:', message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
