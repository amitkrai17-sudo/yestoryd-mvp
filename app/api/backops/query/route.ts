// ============================================================
// FILE: app/api/backops/query/route.ts
// PURPOSE: BackOps Query API — read-only operational intelligence
// AUTH: x-backops-key header
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyBackOpsAuth } from '@/lib/backops/auth';

export const dynamic = 'force-dynamic';

type QueryType =
  | 'entity_status'
  | 'recent_events'
  | 'decision_log'
  | 'pending_actions'
  | 'cron_status'
  | 'communication_log';

interface QueryRequest {
  type: QueryType;
  entity_type?: string;
  entity_id?: string;
  source?: string;
  hours?: number;
  limit?: number;
}

export async function POST(request: NextRequest) {
  const auth = verifyBackOpsAuth(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: QueryRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.type) {
    return NextResponse.json({ error: 'Missing query type' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const hours = body.hours || 24;
  const limit = Math.min(body.limit || 50, 200);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    switch (body.type) {
      case 'entity_status':
        return await queryEntityStatus(supabase, body, since, limit);
      case 'recent_events':
        return await queryRecentEvents(supabase, body, since, limit);
      case 'decision_log':
        return await queryDecisionLog(supabase, body, since, limit);
      case 'pending_actions':
        return await queryPendingActions(supabase, limit);
      case 'cron_status':
        return await queryCronStatus(supabase, since);
      case 'communication_log':
        return await queryCommunicationLog(supabase, body, since, limit);
      default:
        return NextResponse.json(
          { error: `Unknown query type: ${body.type}` },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error('[BackOps Query] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal query error' }, { status: 500 });
  }
}

// ── entity_status: Get all ops_events for a specific entity ──

async function queryEntityStatus(
  supabase: ReturnType<typeof createAdminClient>,
  body: QueryRequest,
  since: string,
  limit: number,
) {
  if (!body.entity_type || !body.entity_id) {
    return NextResponse.json(
      { error: 'entity_status requires entity_type and entity_id' },
      { status: 400 },
    );
  }

  const { data: events } = await supabase
    .from('ops_events')
    .select('id, event_type, source, severity, decision_made, action_taken, action_outcome, metadata, created_at')
    .eq('entity_type', body.entity_type)
    .eq('entity_id', body.entity_id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  const rows = events || [];
  const errors = rows.filter((e) => e.severity === 'error' || e.severity === 'critical');
  const pending = rows.filter((e) => e.action_outcome === 'pending');

  const summary = `${body.entity_type} ${body.entity_id.slice(0, 8)}: ${rows.length} events, ${errors.length} errors, ${pending.length} pending`;

  return NextResponse.json({ data: { events: rows, total: rows.length, errors: errors.length, pending: pending.length }, summary });
}

// ── recent_events: Filtered event stream ──

async function queryRecentEvents(
  supabase: ReturnType<typeof createAdminClient>,
  body: QueryRequest,
  since: string,
  limit: number,
) {
  let query = supabase
    .from('ops_events')
    .select('id, event_type, source, severity, entity_type, entity_id, decision_made, action_outcome, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (body.source) {
    query = query.like('source', `%${body.source}%`);
  }

  const { data: events } = await query;
  const rows = events || [];

  const bySeverity = { info: 0, warning: 0, error: 0, critical: 0 };
  for (const e of rows) {
    const sev = e.severity as keyof typeof bySeverity;
    if (sev in bySeverity) bySeverity[sev]++;
  }

  const summary = `Last ${body.hours || 24}h: ${rows.length} events — ${bySeverity.critical} critical, ${bySeverity.error} errors, ${bySeverity.warning} warnings`;

  return NextResponse.json({ data: { events: rows, by_severity: bySeverity }, summary });
}

// ── decision_log: All decisions for audit trail ──

async function queryDecisionLog(
  supabase: ReturnType<typeof createAdminClient>,
  body: QueryRequest,
  since: string,
  limit: number,
) {
  let query = supabase
    .from('ops_events')
    .select('id, source, entity_type, entity_id, decision_made, decision_reason, action_taken, action_outcome, resolved_by, created_at')
    .eq('event_type', 'decision_made')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (body.entity_type) {
    query = query.eq('entity_type', body.entity_type);
  }
  if (body.entity_id) {
    query = query.eq('entity_id', body.entity_id);
  }

  const { data: decisions } = await query;
  const rows = decisions || [];

  const suppressed = rows.filter((d) => d.action_outcome === 'suppressed').length;
  const acted = rows.filter((d) => d.action_outcome === 'pending' || d.action_outcome === 'success').length;

  const summary = `${rows.length} decisions in ${body.hours || 24}h: ${acted} acted, ${suppressed} suppressed`;

  return NextResponse.json({ data: { decisions: rows, total: rows.length, acted, suppressed }, summary });
}

// ── pending_actions: Unresolved items ──

async function queryPendingActions(
  supabase: ReturnType<typeof createAdminClient>,
  limit: number,
) {
  const { data: pending } = await supabase
    .from('ops_events')
    .select('id, event_type, source, entity_type, entity_id, action_taken, metadata, created_at')
    .eq('action_outcome', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);

  const rows = pending || [];
  const summary = `${rows.length} pending actions awaiting resolution`;

  return NextResponse.json({ data: { pending: rows, total: rows.length }, summary });
}

// ── cron_status: Aggregated cron health ──

async function queryCronStatus(
  supabase: ReturnType<typeof createAdminClient>,
  since: string,
) {
  const { data: cronEvents } = await supabase
    .from('ops_events')
    .select('source, event_type, severity, metadata, created_at')
    .in('event_type', ['cron_run', 'cron_failure'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);

  const rows = cronEvents || [];

  // Aggregate by cron name
  const cronMap = new Map<string, { runs: number; failures: number; last_run: string; last_duration_ms?: number }>();

  for (const e of rows) {
    const name = e.source || 'unknown';
    const entry = cronMap.get(name) || { runs: 0, failures: 0, last_run: e.created_at || '' };
    entry.runs++;
    if (e.event_type === 'cron_failure') entry.failures++;
    if (!cronMap.has(name)) {
      const meta = e.metadata as Record<string, unknown> | null;
      entry.last_duration_ms = typeof meta?.duration_ms === 'number' ? meta.duration_ms : undefined;
    }
    cronMap.set(name, entry);
  }

  const crons = Array.from(cronMap.entries()).map(([name, stats]) => ({
    name,
    ...stats,
    success_rate: stats.runs > 0 ? Math.round(((stats.runs - stats.failures) / stats.runs) * 100) : 0,
  }));

  const totalRuns = rows.length;
  const totalFailures = rows.filter((e) => e.event_type === 'cron_failure').length;
  const overallRate = totalRuns > 0 ? Math.round(((totalRuns - totalFailures) / totalRuns) * 100) : 100;

  const summary = `${crons.length} crons, ${totalRuns} runs, ${overallRate}% success rate`;

  return NextResponse.json({
    data: { crons, total_runs: totalRuns, total_failures: totalFailures, success_rate_pct: overallRate },
    summary,
  });
}

// ── communication_log: Recent comms for an entity ──

async function queryCommunicationLog(
  supabase: ReturnType<typeof createAdminClient>,
  body: QueryRequest,
  since: string,
  limit: number,
) {
  let query = supabase
    .from('communication_logs')
    .select('id, template_code, recipient_type, recipient_phone, wa_sent, email_sent, error_message, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (body.entity_id) {
    query = query.eq('recipient_id', body.entity_id);
  }
  if (body.entity_type) {
    query = query.eq('recipient_type', body.entity_type);
  }

  const { data: logs } = await query;
  const rows = logs || [];

  const sent = rows.filter((l) => l.wa_sent || l.email_sent).length;
  const failed = rows.filter((l) => l.error_message).length;

  const summary = `${rows.length} communications: ${sent} delivered, ${failed} failed`;

  return NextResponse.json({ data: { communications: rows, total: rows.length, sent, failed }, summary });
}
