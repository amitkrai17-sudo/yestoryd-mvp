// ============================================================
// FILE: app/api/backops/health/route.ts
// PURPOSE: BackOps health pulse — quick operational status
// AUTH: x-backops-key header
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyBackOpsAuth } from '@/lib/backops/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = verifyBackOpsAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const supabase = createAdminClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    // Run all queries in parallel
    const [eventsResult, sessionsResult, enrollmentsResult, pendingResult] = await Promise.all([
      // 1. ops_events aggregates (last 24h)
      supabase
        .from('ops_events')
        .select('event_type, severity')
        .gte('created_at', since24h),

      // 2. Today's sessions
      supabase
        .from('scheduled_sessions')
        .select('id, status')
        .gte('scheduled_date', todayStart.toISOString())
        .lt('scheduled_date', new Date(todayStart.getTime() + 24 * 60 * 60 * 1000).toISOString()),

      // 3. Active enrollments
      supabase
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),

      // 4. Pending actions
      supabase
        .from('ops_events')
        .select('id', { count: 'exact', head: true })
        .eq('action_outcome', 'pending'),
    ]);

    const events = eventsResult.data || [];
    const sessions = sessionsResult.data || [];

    // Aggregate events by severity
    const bySeverity = { info: 0, warning: 0, error: 0, critical: 0 };
    for (const e of events) {
      const sev = e.severity as keyof typeof bySeverity;
      if (sev in bySeverity) bySeverity[sev]++;
    }

    // Cron success rate
    const cronRuns = events.filter((e) => e.event_type === 'cron_run').length;
    const cronFailures = events.filter((e) => e.event_type === 'cron_failure').length;
    const cronTotal = cronRuns + cronFailures;
    const cronSuccessRate = cronTotal > 0 ? (cronRuns / cronTotal) : 1;

    // Session stats
    const sessionStats = {
      total: sessions.length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      in_progress: sessions.filter((s) => s.status === 'in_progress').length,
      scheduled: sessions.filter((s) => s.status === 'confirmed' || s.status === 'scheduled').length,
    };

    // Determine status
    let status: 'healthy' | 'degraded' | 'critical';
    if (bySeverity.critical > 0 || cronSuccessRate < 0.8) {
      status = 'critical';
    } else if (bySeverity.warning > 5 || bySeverity.error > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    const activeEnrollments = enrollmentsResult.count || 0;
    const pendingActions = pendingResult.count || 0;

    const summary = [
      `Status: ${status.toUpperCase()}`,
      `Events 24h: ${events.length} (${bySeverity.critical}C ${bySeverity.error}E ${bySeverity.warning}W)`,
      `Crons: ${cronSuccessRate === 1 ? '100' : Math.round(cronSuccessRate * 100)}% success (${cronTotal} runs)`,
      `Sessions today: ${sessionStats.total} (${sessionStats.completed} done, ${sessionStats.in_progress} active)`,
      `Active enrollments: ${activeEnrollments}`,
      pendingActions > 0 ? `Pending actions: ${pendingActions}` : null,
    ].filter(Boolean).join(' | ');

    return NextResponse.json({
      data: {
        status,
        events_24h: {
          total: events.length,
          by_severity: bySeverity,
        },
        crons: {
          total_runs: cronTotal,
          success_rate: Math.round(cronSuccessRate * 100),
          failures: cronFailures,
        },
        sessions_today: sessionStats,
        active_enrollments: activeEnrollments,
        pending_actions: pendingActions,
        checked_at: new Date().toISOString(),
      },
      summary,
    });
  } catch (err) {
    console.error('[BackOps Health] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
