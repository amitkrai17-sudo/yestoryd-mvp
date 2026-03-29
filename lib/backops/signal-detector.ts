// ============================================================
// FILE: lib/backops/signal-detector.ts
// PURPOSE: Scans ops_events for anomaly patterns and produces
//          structured alerts. Phase 1 is observe-only.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getPolicy } from './policy-loader';

export interface DetectedSignal {
  pattern: string;
  severity: 'warning' | 'error' | 'critical';
  title: string;
  detail: string;
  entity_type?: string;
  entity_id?: string;
  suggested_commands: string[];
  raw_events: Array<{ id: string; source: string; created_at: string }>;
}

/**
 * Run all signal detection patterns against recent ops_events.
 * Returns detected signals sorted by severity (critical first).
 * Each pattern has its own try/catch — one failure never kills the scan.
 */
export async function detectSignals(): Promise<DetectedSignal[]> {
  const supabase = createAdminClient();
  const signals: DetectedSignal[] = [];

  const policy = await getPolicy('backops_signal_detector', {
    scan_interval_minutes: 15,
    severity_escalation: { warning_repeat_threshold: 3 },
  });

  const policyObj = policy as Record<string, unknown>;
  const scanWindow = (policyObj.scan_interval_minutes as number) || 15;
  const cutoff = new Date(Date.now() - scanWindow * 60 * 1000).toISOString();
  const escalation = (policyObj.severity_escalation as Record<string, unknown>) || {};

  // ── Pattern 1: Cron Failures ──
  try {
    const { data: failures } = await supabase
      .from('ops_events')
      .select('id, source, severity, metadata, created_at')
      .eq('event_type', 'cron_failure')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    if (failures && failures.length > 0) {
      const bySource = new Map<string, typeof failures>();
      for (const f of failures) {
        const key = f.source || 'unknown';
        if (!bySource.has(key)) bySource.set(key, []);
        bySource.get(key)!.push(f);
      }

      for (const [source, events] of Array.from(bySource.entries())) {
        const cronName = source.replace('cron:', '');
        const meta = events[0].metadata as Record<string, unknown> | null;
        const errorMsg = (meta?.error as string) || 'unknown';
        signals.push({
          pattern: 'cron_failure',
          severity: events.length >= 3 ? 'critical' : 'error',
          title: `Cron failed: ${cronName}`,
          detail: `${cronName} failed ${events.length}x in last ${scanWindow}min. Error: ${errorMsg}`,
          entity_type: 'cron',
          suggested_commands: [
            `/query cron_status`,
            `/health`,
          ],
          raw_events: events.map((e: { id: string; source: string | null; created_at: string | null }) => ({ id: e.id, source: e.source || '', created_at: e.created_at || '' })),
        });
      }
    }
  } catch (err) {
    console.error('[SignalDetector] Pattern cron_failure error:', err instanceof Error ? err.message : err);
  }

  // ── Pattern 2: Repeated Warnings (escalation) ──
  try {
    const { data: warnings } = await supabase
      .from('ops_events')
      .select('id, source, entity_type, entity_id, created_at')
      .eq('severity', 'warning')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(100);

    if (warnings && warnings.length > 0) {
      const threshold = (escalation.warning_repeat_threshold as number) || 3;
      const bySource = new Map<string, typeof warnings>();
      for (const w of warnings) {
        const key = w.source || 'unknown';
        if (!bySource.has(key)) bySource.set(key, []);
        bySource.get(key)!.push(w);
      }

      for (const [source, events] of Array.from(bySource.entries())) {
        if (events.length >= threshold) {
          signals.push({
            pattern: 'repeated_warnings',
            severity: 'error',
            title: `Repeated warnings: ${source}`,
            detail: `${source} generated ${events.length} warnings in last ${scanWindow}min (threshold: ${threshold}).`,
            entity_type: events[0].entity_type || undefined,
            entity_id: events[0].entity_id || undefined,
            suggested_commands: [
              `/query recent_events ${source}`,
              `/health`,
            ],
            raw_events: events.map((e: { id: string; source: string | null; created_at: string | null }) => ({ id: e.id, source: e.source || '', created_at: e.created_at || '' })),
          });
        }
      }
    }
  } catch (err) {
    console.error('[SignalDetector] Pattern repeated_warnings error:', err instanceof Error ? err.message : err);
  }

  // ── Pattern 3: Stale Pending Actions (>1 hour) ──
  try {
    const staleThreshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: stale } = await supabase
      .from('ops_events')
      .select('id, source, entity_type, entity_id, action_taken, decision_made, created_at')
      .eq('action_outcome', 'pending')
      .lt('created_at', staleThreshold)
      .order('created_at', { ascending: true })
      .limit(10);

    if (stale && stale.length > 0) {
      signals.push({
        pattern: 'stale_pending_actions',
        severity: 'warning',
        title: `${stale.length} stale pending action(s)`,
        detail: `${stale.length} actions pending >1h. Oldest: ${stale[0].action_taken || stale[0].decision_made || 'unknown'} from ${stale[0].source || 'unknown'}.`,
        suggested_commands: [
          `/query pending_actions`,
          `/command resolve_pending ${stale[0].id}`,
        ],
        raw_events: stale.map(e => ({ id: e.id, source: e.source || '', created_at: e.created_at || '' })),
      });
    }
  } catch (err) {
    console.error('[SignalDetector] Pattern stale_pending error:', err instanceof Error ? err.message : err);
  }

  // ── Pattern 4: Communication Failures ──
  try {
    const { data: commFails } = await supabase
      .from('communication_logs')
      .select('id, recipient_phone, template_code, error_message, created_at')
      .eq('wa_sent', false)
      .not('error_message', 'is', null)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(10);

    if (commFails && commFails.length > 0) {
      const templates = Array.from(new Set(commFails.map(c => c.template_code))).join(', ');
      signals.push({
        pattern: 'communication_failures',
        severity: commFails.length >= 5 ? 'error' : 'warning',
        title: `${commFails.length} message delivery failure(s)`,
        detail: `${commFails.length} WhatsApp messages failed. Templates: ${templates}. Error: ${commFails[0].error_message}`,
        entity_type: 'communication',
        suggested_commands: [
          `/query communication_log`,
          `/health`,
        ],
        raw_events: commFails.map(c => ({ id: c.id, source: `aisensy:${c.template_code}`, created_at: c.created_at || '' })),
      });
    }
  } catch (err) {
    console.error('[SignalDetector] Pattern communication_failures error:', err instanceof Error ? err.message : err);
  }

  // ── Pattern 5: Dispatcher Silent (no heartbeat in 20 min) ──
  try {
    const dispatcherCutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data: recentDispatch } = await supabase
      .from('ops_events')
      .select('id, created_at')
      .eq('source', 'cron:dispatcher')
      .gte('created_at', dispatcherCutoff)
      .limit(1);

    if (!recentDispatch || recentDispatch.length === 0) {
      // Only alert if dispatcher has run before
      const { count } = await supabase
        .from('ops_events')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'cron:dispatcher');

      if (count && count > 0) {
        signals.push({
          pattern: 'dispatcher_silent',
          severity: 'critical',
          title: 'Dispatcher not running',
          detail: 'No dispatcher heartbeat in 20+ minutes. All crons may be stalled.',
          entity_type: 'system',
          suggested_commands: [
            `/health`,
            `/query cron_status`,
          ],
          raw_events: [],
        });
      }
    }
  } catch (err) {
    console.error('[SignalDetector] Pattern dispatcher_silent error:', err instanceof Error ? err.message : err);
  }

  // ── Pattern 6: Critical Events (unacknowledged pass-through) ──
  try {
    const { data: criticals } = await supabase
      .from('ops_events')
      .select('id, source, event_type, entity_type, entity_id, metadata, created_at')
      .eq('severity', 'critical')
      .gte('created_at', cutoff)
      .is('resolved_by', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (criticals && criticals.length > 0) {
      const alreadyDetectedArr = signals.flatMap(s => s.raw_events.map(e => e.id));
      const alreadyDetectedIds: Record<string, true> = {};
      for (const id of alreadyDetectedArr) { alreadyDetectedIds[id] = true; }

      for (const critical of criticals) {
        if (alreadyDetectedIds[critical.id]) continue;

        const meta = critical.metadata as Record<string, unknown> | null;
        const detail = meta ? JSON.stringify(meta).slice(0, 200) : 'No details';

        signals.push({
          pattern: 'critical_event',
          severity: 'critical',
          title: `Critical: ${critical.source || critical.event_type}`,
          detail: `Critical event from ${critical.source}: ${detail}`,
          entity_type: critical.entity_type || undefined,
          entity_id: critical.entity_id || undefined,
          suggested_commands: [
            `/query entity_status ${critical.entity_type || 'system'} ${critical.entity_id || ''}`.trim(),
            `/health`,
          ],
          raw_events: [{ id: critical.id, source: critical.source || '', created_at: critical.created_at || '' }],
        });
      }
    }
  } catch (err) {
    console.error('[SignalDetector] Pattern critical_events error:', err instanceof Error ? err.message : err);
  }

  // Sort: critical > error > warning
  const severityOrder: Record<string, number> = { critical: 0, error: 1, warning: 2 };
  signals.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  return signals;
}

/**
 * Dedup: filter out signals already alerted in the last 2 hours.
 */
export async function deduplicateSignals(signals: DetectedSignal[]): Promise<DetectedSignal[]> {
  if (signals.length === 0) return signals;

  try {
    const supabase = createAdminClient();
    const dedupWindow = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: recentAlerts } = await supabase
      .from('ops_events')
      .select('metadata')
      .eq('event_type', 'anomaly_detected')
      .eq('source', 'cron:backops-signal-detector')
      .gte('created_at', dedupWindow);

    if (!recentAlerts || recentAlerts.length === 0) return signals;

    const alertedPatterns = new Set<string>();
    for (const alert of recentAlerts) {
      const meta = alert.metadata as Record<string, unknown> | null;
      if (meta?.pattern && meta?.title) {
        alertedPatterns.add(`${meta.pattern}:${meta.title}`);
      }
    }

    return signals.filter(s => !alertedPatterns.has(`${s.pattern}:${s.title}`));
  } catch (err) {
    console.error('[SignalDetector] Dedup error, returning all signals:', err instanceof Error ? err.message : err);
    return signals;
  }
}
