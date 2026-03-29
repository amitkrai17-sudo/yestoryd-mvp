'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────

interface BackOpsSummary {
  status: 'healthy' | 'degraded' | 'critical';
  last_24h: {
    total: number;
    cron_runs: number;
    cron_failures: number;
    decisions_made: number;
    nudges_sent: number;
    nudges_suppressed: number;
    warnings: number;
    errors: number;
    criticals: number;
  };
  recent_signals: Array<{ severity: string; title: string; time: string }>;
  recent_decisions: Array<{ source: string; decision: string; entity: string; time: string }>;
  cron_health: {
    total: number;
    healthy: number;
    failed: number;
    success_rate: number;
  };
  outcome_stats: {
    pending: number;
    success: number;
    failed: number;
    success_rate: number;
  };
}

// ── Helpers ─────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const statusConfig = {
  healthy: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Healthy' },
  degraded: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Degraded' },
  critical: { dot: 'bg-red-400', text: 'text-red-400', label: 'Critical' },
};

const severityConfig: Record<string, { tag: string; color: string }> = {
  critical: { tag: 'CRIT', color: 'text-red-400' },
  error: { tag: 'ERR', color: 'text-orange-400' },
  warning: { tag: 'WARN', color: 'text-amber-400' },
};

// ── Component ───────────────────────────────────────────────

export default function BackOpsWidget() {
  const [data, setData] = useState<BackOpsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/backops-summary');
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result);
      setError(null);
    } catch {
      setError('Failed to load BackOps data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-surface-3 rounded w-48 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-surface-2 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !data) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-sm text-text-secondary">{error || 'No data'}</span>
          </div>
          <button onClick={fetchData} className="p-2 hover:bg-surface-2 rounded-xl transition-colors">
            <RefreshCw className="w-4 h-4 text-text-tertiary" />
          </button>
        </div>
      </div>
    );
  }

  const sc = statusConfig[data.status];
  const stats = data.last_24h;

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 lg:p-6 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#121217] border border-white/[0.08] rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">BackOps Health</h2>
              <p className="text-[10px] sm:text-xs text-text-tertiary">Auto-refreshes every 60s</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium ${sc.text} bg-white/[0.05]`}>
              <span className={`w-2 h-2 rounded-full ${sc.dot} animate-pulse`} />
              {sc.label}
            </div>
            <button onClick={fetchData} className="p-1.5 hover:bg-surface-2 rounded-lg transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-text-tertiary" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <StatMini icon={CheckCircle} label="Cron Runs" value={stats.cron_runs} sub={`${data.cron_health.success_rate}% success`} />
          <StatMini icon={Send} label="Nudges" value={stats.nudges_sent} sub={stats.nudges_suppressed > 0 ? `${stats.nudges_suppressed} suppressed` : 'none suppressed'} />
          <StatMini icon={Activity} label="Decisions" value={stats.decisions_made} sub={`${stats.total || 0} total events`} />
          <StatMini
            icon={data.outcome_stats.success_rate > 0 ? CheckCircle : Clock}
            label="Outcomes"
            value={data.outcome_stats.success_rate > 0 ? `${data.outcome_stats.success_rate}%` : `${data.outcome_stats.pending}`}
            sub={data.outcome_stats.success_rate > 0 ? 'success rate' : 'pending'}
          />
        </div>

        {/* Recent Signals */}
        {data.recent_signals.length > 0 && (
          <div className="mt-3 sm:mt-4 space-y-1.5">
            <p className="text-[10px] sm:text-xs text-text-tertiary uppercase tracking-wider font-medium">Recent Signals</p>
            {data.recent_signals.slice(0, 3).map((signal, i) => {
              const sev = severityConfig[signal.severity] || { tag: 'INFO', color: 'text-text-tertiary' };
              return (
                <div key={i} className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className={`font-mono text-[10px] ${sev.color}`}>[{sev.tag}]</span>
                  <span className="text-text-secondary truncate">{signal.title}</span>
                  <span className="text-text-tertiary text-[10px] flex-shrink-0 ml-auto">{timeAgo(signal.time)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Expandable Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 sm:mt-4 w-full flex items-center justify-center gap-1 py-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Hide Details' : 'View Details'}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
            {/* Severity Breakdown */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-text-tertiary">24h:</span>
              {stats.criticals > 0 && <span className="text-red-400">{stats.criticals} critical</span>}
              {stats.errors > 0 && <span className="text-orange-400">{stats.errors} errors</span>}
              <span className="text-amber-400">{stats.warnings} warnings</span>
              <span className="text-text-tertiary">{stats.cron_failures} cron failures</span>
            </div>

            {/* Recent Decisions */}
            {data.recent_decisions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">Recent Decisions</p>
                {data.recent_decisions.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-text-tertiary font-mono">{d.source.replace('cron:', '')}</span>
                    <span className="text-text-secondary truncate">{d.decision}</span>
                    <span className="text-text-tertiary text-[10px] ml-auto flex-shrink-0">{timeAgo(d.time)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Outcome Stats */}
            {(data.outcome_stats.success + data.outcome_stats.failed) > 0 && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-text-tertiary">Outcomes:</span>
                <span className="text-emerald-400">{data.outcome_stats.success} success</span>
                <span className="text-red-400">{data.outcome_stats.failed} failed</span>
                <span className="text-amber-400">{data.outcome_stats.pending} pending</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Mini Stat Card ──────────────────────────────────────────

function StatMini({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="bg-surface-2/50 rounded-xl p-2.5 sm:p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-text-tertiary" />
        <span className="text-[10px] sm:text-xs text-text-tertiary">{label}</span>
      </div>
      <p className="text-base sm:text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] text-text-tertiary">{sub}</p>
    </div>
  );
}
