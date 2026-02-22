// ============================================================
// FILE: app/api/admin/coaches/[id]/offline-stats/route.ts
// PURPOSE: In-person session analytics for a specific coach
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { id: coachId } = await params;
    const supabase = getServiceSupabase();

    // Verify coach exists
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    // Fetch all completed/scheduled sessions for this coach
    const { data: sessions, error: sessionsError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, session_mode, status,
        report_submitted_at, report_late, report_deadline,
        scheduled_date, scheduled_time,
        child_reading_clip_path, coach_voice_note_path
      `)
      .eq('coach_id', coachId)
      .in('status', ['completed', 'scheduled', 'confirmed']);

    if (sessionsError) {
      console.error(JSON.stringify({ requestId, event: 'coach_stats_query_error', error: sessionsError.message }));
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    const allSessions = sessions || [];
    const completedSessions = allSessions.filter(s => s.status === 'completed');

    const totalSessions = completedSessions.length;
    const onlineCount = completedSessions.filter(s => s.session_mode !== 'offline').length;
    const offlineSessions = completedSessions.filter(s => s.session_mode === 'offline');
    const offlineCount = offlineSessions.length;
    const offlineRatio = totalSessions > 0 ? offlineCount / totalSessions : 0;

    // Reading clips provided (offline sessions with child_reading_clip_path)
    const readingClipsProvided = offlineSessions.filter(s => s.child_reading_clip_path).length;

    // Voice notes provided (offline sessions with coach_voice_note_path)
    const voiceNotesProvided = offlineSessions.filter(s => s.coach_voice_note_path).length;

    // Late reports
    const lateReports = offlineSessions.filter(s => s.report_late === true).length;

    // Average report time (minutes from session scheduled end to report_submitted_at)
    let avgReportTimeMinutes: number | null = null;
    const reportTimes: number[] = [];

    for (const s of offlineSessions) {
      if (s.report_submitted_at && s.scheduled_date && s.scheduled_time) {
        const sessionEnd = new Date(`${s.scheduled_date}T${s.scheduled_time}`);
        // Assume 45min session duration for end time
        sessionEnd.setMinutes(sessionEnd.getMinutes() + 45);
        const submittedAt = new Date(s.report_submitted_at);
        const diffMinutes = (submittedAt.getTime() - sessionEnd.getTime()) / (1000 * 60);
        if (diffMinutes >= 0) {
          reportTimes.push(diffMinutes);
        }
      }
    }

    if (reportTimes.length > 0) {
      avgReportTimeMinutes = Math.round(reportTimes.reduce((a, b) => a + b, 0) / reportTimes.length);
    }

    console.log(JSON.stringify({
      requestId,
      event: 'coach_offline_stats_fetched',
      coachId,
      totalSessions,
      offlineCount,
    }));

    return NextResponse.json({
      coach: {
        id: coach.id,
        name: coach.name,
        email: coach.email,
      },
      stats: {
        total_sessions: totalSessions,
        online_count: onlineCount,
        offline_count: offlineCount,
        offline_ratio: Math.round(offlineRatio * 100) / 100,
        reading_clips_provided: readingClipsProvided,
        voice_notes_provided: voiceNotesProvided,
        late_reports: lateReports,
        avg_report_time_minutes: avgReportTimeMinutes,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error(JSON.stringify({ requestId, event: 'coach_offline_stats_error', error: message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
