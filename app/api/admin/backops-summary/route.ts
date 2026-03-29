// ============================================================
// FILE: app/api/admin/backops-summary/route.ts
// PURPOSE: Dashboard data endpoint for BackOps widget
// AUTH: Admin auth (same as other /api/admin/ routes)
// ============================================================

import { NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  const supabase = getServiceSupabase();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // All queries in parallel
    const [eventsResult, signalsResult, decisionsResult, outcomeResult] = await Promise.all([
      // 1. All ops_events last 24h
      supabase
        .from('ops_events')
        .select('event_type, severity, action_outcome')
        .gte('created_at', since24h),

      // 2. Recent signals (anomaly_detected)
      supabase
        .from('ops_events')
        .select('severity, metadata, created_at')
        .eq('event_type', 'anomaly_detected')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(5),

      // 3. Recent decisions
      supabase
        .from('ops_events')
        .select('source, decision_made, entity_type, entity_id, created_at')
        .eq('event_type', 'decision_made')
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(5),

      // 4. Outcome stats (all time with outcomes)
      supabase
        .from('ops_events')
        .select('action_outcome')
        .not('action_outcome', 'is', null)
        .in('action_outcome', ['pending', 'success', 'failed', 'expired']),
    ]);

    const events = eventsResult.data || [];

    // Aggregate event counts
    const counts = {
      total: events.length,
      cron_runs: 0,
      cron_failures: 0,
      decisions_made: 0,
      nudges_sent: 0,
      nudges_suppressed: 0,
      warnings: 0,
      errors: 0,
      criticals: 0,
    };

    for (const e of events) {
      if (e.event_type === 'cron_run') counts.cron_runs++;
      if (e.event_type === 'cron_failure') counts.cron_failures++;
      if (e.event_type === 'decision_made') counts.decisions_made++;
      if (e.event_type === 'nudge_sent') counts.nudges_sent++;
      if (e.event_type === 'nudge_suppressed') counts.nudges_suppressed++;
      if (e.severity === 'warning') counts.warnings++;
      if (e.severity === 'error') counts.errors++;
      if (e.severity === 'critical') counts.criticals++;
    }

    // Cron health
    const cronTotal = counts.cron_runs + counts.cron_failures;
    const cronSuccessRate = cronTotal > 0 ? counts.cron_runs / cronTotal : 1;

    // Status determination
    let status: 'healthy' | 'degraded' | 'critical';
    if (counts.criticals > 0 || cronSuccessRate < 0.8) {
      status = 'critical';
    } else if (counts.warnings > 5 || counts.errors > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    // Recent signals
    const recent_signals = (signalsResult.data || []).map(s => {
      const meta = s.metadata as Record<string, unknown> | null;
      return {
        severity: s.severity || 'info',
        title: (meta?.title as string) || 'Signal',
        time: s.created_at || '',
      };
    });

    // Recent decisions
    const recent_decisions = (decisionsResult.data || []).map(d => ({
      source: d.source || '',
      decision: d.decision_made || '',
      entity: d.entity_type ? `${d.entity_type}:${(d.entity_id || '').slice(0, 8)}` : '',
      time: d.created_at || '',
    }));

    // Outcome stats
    const outcomes = outcomeResult.data || [];
    const outcome_stats = {
      pending: outcomes.filter(o => o.action_outcome === 'pending').length,
      success: outcomes.filter(o => o.action_outcome === 'success').length,
      failed: outcomes.filter(o => o.action_outcome === 'failed' || o.action_outcome === 'expired').length,
      success_rate: 0,
    };
    const outcomeTotal = outcome_stats.success + outcome_stats.failed;
    outcome_stats.success_rate = outcomeTotal > 0 ? Math.round((outcome_stats.success / outcomeTotal) * 100) : 0;

    return NextResponse.json({
      status,
      last_24h: counts,
      recent_signals,
      recent_decisions,
      cron_health: {
        total: cronTotal,
        healthy: counts.cron_runs,
        failed: counts.cron_failures,
        success_rate: Math.round(cronSuccessRate * 100),
      },
      outcome_stats,
    });
  } catch (err) {
    console.error('[BackOps Summary] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to load summary' }, { status: 500 });
  }
}
