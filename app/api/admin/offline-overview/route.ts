// ============================================================
// FILE: app/api/admin/offline-overview/route.ts
// PURPOSE: Platform-wide in-person session stats for dashboard widget
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface CoachOfflineInfo {
  coach_id: string;
  coach_name: string;
  offline_count: number;
  total_count: number;
  offline_ratio: number;
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const supabase = getServiceSupabase();
    const nowISO = new Date().toISOString();

    // Run all queries in parallel
    const [
      offlineCountResult,
      onlineCountResult,
      pendingResult,
      overdueResult,
      clipResult,
      totalOfflineResult,
    ] = await Promise.all([
      // Total offline completed sessions
      supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('session_mode', 'offline')
        .eq('status', 'completed'),

      // Total online completed sessions
      supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .neq('session_mode', 'offline')
        .eq('status', 'completed'),

      // Pending requests
      supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('offline_request_status', 'pending'),

      // Overdue reports (offline, approved, past deadline, no report)
      supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('session_mode', 'offline')
        .in('offline_request_status', ['approved', 'auto_approved'])
        .is('report_submitted_at', null)
        .lt('report_deadline', nowISO)
        .neq('status', 'completed')
        .neq('status', 'cancelled'),

      // Offline sessions with reading clips
      supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('session_mode', 'offline')
        .eq('status', 'completed')
        .not('child_reading_clip_path', 'is', null),

      // All offline completed (for clip rate denominator)
      supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('session_mode', 'offline')
        .eq('status', 'completed'),
    ]);

    const totalOffline = offlineCountResult.count ?? 0;
    const totalOnline = onlineCountResult.count ?? 0;
    const totalAll = totalOffline + totalOnline;
    const overallOfflineRatio = totalAll > 0 ? Math.round((totalOffline / totalAll) * 100) : 0;
    const pendingRequestsCount = pendingResult.count ?? 0;
    const overdueReportsCount = overdueResult.count ?? 0;
    const clipsProvided = clipResult.count ?? 0;
    const totalOfflineCompleted = totalOfflineResult.count ?? 0;
    const readingClipRate = totalOfflineCompleted > 0
      ? Math.round((clipsProvided / totalOfflineCompleted) * 100)
      : 0;

    // Coaches with high offline ratio (> 50%)
    // Fetch completed sessions grouped by coach
    const { data: coachSessions } = await supabase
      .from('scheduled_sessions')
      .select(`
        coach_id, session_mode,
        coaches!scheduled_sessions_coach_id_fkey (name)
      `)
      .eq('status', 'completed')
      .not('coach_id', 'is', null);

    const coachMap = new Map<string, { name: string; offline: number; total: number }>();

    if (coachSessions) {
      for (const s of coachSessions) {
        const coachId = s.coach_id as string;
        const coachData = s.coaches as unknown as { name: string | null } | null;
        if (!coachMap.has(coachId)) {
          coachMap.set(coachId, { name: coachData?.name || 'Unknown', offline: 0, total: 0 });
        }
        const entry = coachMap.get(coachId)!;
        entry.total++;
        if (s.session_mode === 'offline') {
          entry.offline++;
        }
      }
    }

    const coachesWithHighOfflineRatio: CoachOfflineInfo[] = [];
    const coachIds = Array.from(coachMap.keys());
    for (const coachId of coachIds) {
      const data = coachMap.get(coachId)!;
      if (data.total >= 3 && data.offline / data.total > 0.5) {
        coachesWithHighOfflineRatio.push({
          coach_id: coachId,
          coach_name: data.name,
          offline_count: data.offline,
          total_count: data.total,
          offline_ratio: Math.round((data.offline / data.total) * 100) / 100,
        });
      }
    }

    coachesWithHighOfflineRatio.sort((a, b) => b.offline_ratio - a.offline_ratio);

    console.log(JSON.stringify({
      requestId,
      event: 'offline_overview_fetched',
      totalOffline,
      totalOnline,
      pendingRequestsCount,
      overdueReportsCount,
    }));

    return NextResponse.json({
      total_offline_sessions: totalOffline,
      total_online_sessions: totalOnline,
      overall_offline_ratio: overallOfflineRatio,
      pending_requests_count: pendingRequestsCount,
      overdue_reports_count: overdueReportsCount,
      reading_clip_rate: readingClipRate,
      coaches_with_high_offline_ratio: coachesWithHighOfflineRatio,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error(JSON.stringify({ requestId, event: 'offline_overview_error', error: message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
