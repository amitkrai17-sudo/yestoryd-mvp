'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, EyeOff, Eye } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/shared/EmptyState';

interface MetricValue {
  value: number | null;
  platform_avg: number;
  trend: 'up' | 'down' | 'stable';
}

interface LeaderboardData {
  empty?: boolean;
  message?: string;
  top3: Array<{
    rank: number;
    name: string;
    photo_url: string | null;
    composite_score: number;
    active_children: number;
    avg_nps: number | null;
    featured_badge?: boolean;
  }>;
  allRanks: Array<{
    rank: number;
    composite_score: number;
    active_children: number;
    avg_nps: number | null;
    is_self: boolean;
  }>;
  myStats: {
    rank: number;
    total_coaches: number;
    composite_score: number;
    metrics: Record<string, MetricValue>;
  } | null;
  myOptedOut: boolean;
  month: string | null;
}

const METRIC_CONFIG: Record<string, { label: string; suffix: string; decimals?: number }> = {
  avg_nps: { label: 'NPS', suffix: '', decimals: 1 },
  completion_rate: { label: 'Completion', suffix: '%' },
  re_enrollment_rate: { label: 'Re-enroll', suffix: '%' },
  intelligence_score: { label: 'Intelligence', suffix: '' },
  referral_count: { label: 'Referrals', suffix: '' },
  platform_hours: { label: 'Hours', suffix: 'h', decimals: 1 },
};

const MEDAL_STYLES = [
  { bg: 'from-yellow-500/20 to-amber-600/20', border: 'border-yellow-500/40', text: 'text-yellow-400', medalColor: 'text-yellow-400' },
  { bg: 'from-slate-300/20 to-slate-400/20', border: 'border-slate-400/40', text: 'text-slate-300', medalColor: 'text-slate-300' },
  { bg: 'from-orange-600/20 to-orange-700/20', border: 'border-orange-600/40', text: 'text-orange-400', medalColor: 'text-orange-400' },
];

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function formatMetricValue(value: number | null, decimals?: number): string {
  if (value === null) return '—';
  return decimals ? value.toFixed(decimals) : String(Math.round(value));
}

export default function LeaderboardTab({ coachId }: { coachId: string }) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [optedOut, setOptedOut] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch(`/api/coach/leaderboard?coach_id=${coachId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setData(d);
          setOptedOut(d.myOptedOut || false);
        }
      })
      .finally(() => setLoading(false));
  }, [coachId]);

  const handleOptOut = async () => {
    setToggling(true);
    try {
      const res = await fetch('/api/coach/leaderboard/opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach_id: coachId, optOut: !optedOut }),
      });
      const result = await res.json();
      if (result.success) setOptedOut(!optedOut);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Spinner size="lg" className="text-blue-400" />
      </div>
    );
  }

  // Empty state
  if (!data || data.empty) {
    return (
      <div className="bg-slate-900 rounded-2xl border border-slate-800">
        <EmptyState
          icon={Trophy}
          title="No leaderboard data yet"
          description={data?.message || 'Leaderboard updates on the 1st of each month. Check back soon!'}
        />
      </div>
    );
  }

  const maxScore = data.allRanks.length > 0
    ? Math.max(...data.allRanks.map(r => r.composite_score))
    : 100;

  // Reorder for podium: [2nd, 1st, 3rd]
  const podiumOrder = data.top3.length === 3
    ? [data.top3[1], data.top3[0], data.top3[2]]
    : data.top3;

  return (
    <div className="space-y-4">
      {/* ── Podium — Top 3 ── */}
      {data.top3.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <h2 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            Top Coaches
          </h2>
          <div className="flex gap-3 justify-center items-end">
            {podiumOrder.map(coach => {
              const style = MEDAL_STYLES[coach.rank - 1] || MEDAL_STYLES[2];
              const isFirst = coach.rank === 1;
              const nameParts = coach.name.split(' ');
              const displayName = `${nameParts[0]} ${nameParts[1]?.[0] ? nameParts[1][0] + '.' : ''}`;

              return (
                <div
                  key={coach.rank}
                  className={`flex-1 max-w-[140px] bg-gradient-to-b ${style.bg} border ${style.border} rounded-2xl p-3 text-center ${isFirst ? 'pb-4 -mt-2' : ''}`}
                >
                  <div className="mb-1 flex justify-center"><Trophy className={`w-6 h-6 ${style.medalColor}`} /></div>
                  <div className={`${isFirst ? 'w-12 h-12' : 'w-10 h-10'} rounded-full bg-slate-700 mx-auto mb-2 flex items-center justify-center text-sm font-bold ${style.text}`}>
                    {getInitials(coach.name)}
                  </div>
                  <p className={`font-semibold text-sm ${style.text} truncate`}>{displayName}</p>
                  <p className="text-white font-bold text-lg">{Math.round(coach.composite_score)}</p>
                  <div className="text-[10px] text-slate-400 space-y-0.5 mt-1">
                    <p>{coach.active_children} kids</p>
                    {coach.avg_nps !== null && <p>{coach.avg_nps.toFixed(1)}★</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Your Rank ── */}
      {data.myStats && (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="mb-4">
            <p className="text-white font-semibold">
              You are ranked <span className="text-blue-400">#{data.myStats.rank}</span> of {data.myStats.total_coaches} coaches
            </p>
            <p className="text-slate-400 text-sm">Score: {Math.round(data.myStats.composite_score)}</p>
          </div>
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1">
            {Object.entries(data.myStats.metrics).map(([key, m]) => {
              const config = METRIC_CONFIG[key];
              if (!config) return null;
              const isAboveAvg = m.value !== null && m.value > m.platform_avg;

              return (
                <div key={key} className="min-w-[110px] snap-start bg-slate-800/50 rounded-xl p-3 flex-shrink-0">
                  <p className="text-[10px] text-slate-500 mb-1">{config.label}</p>
                  <div className="flex items-end gap-0.5">
                    <span className={`text-lg font-bold ${isAboveAvg ? 'text-emerald-400' : 'text-white'}`}>
                      {formatMetricValue(m.value, config.decimals)}
                    </span>
                    <span className="text-[10px] text-slate-500 mb-0.5">{config.suffix}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    avg {formatMetricValue(m.platform_avg, config.decimals)}{config.suffix}
                  </p>
                  <div className="mt-1">
                    {m.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                    {m.trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                    {m.trend === 'stable' && <Minus className="w-3.5 h-3.5 text-slate-500" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Full Rankings (bar chart) ── */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <h3 className="text-sm font-medium text-slate-400 mb-3">All Rankings</h3>
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {data.allRanks.map(r => {
            const barWidth = maxScore > 0 ? (r.composite_score / maxScore) * 100 : 0;
            return (
              <div
                key={r.rank}
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${
                  r.is_self ? 'bg-blue-500/10 border border-blue-500/30' : ''
                }`}
              >
                <span className="text-xs text-slate-500 w-7 text-right font-mono">#{r.rank}</span>
                <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${r.is_self ? 'bg-blue-500' : 'bg-slate-600'}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-8 text-right ${r.is_self ? 'text-blue-400' : 'text-slate-400'}`}>
                  {Math.round(r.composite_score)}
                </span>
                {r.is_self && (
                  <span className="text-[10px] text-blue-400 font-medium whitespace-nowrap">You</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Opt-out Toggle ── */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <button
          onClick={handleOptOut}
          disabled={toggling}
          className="flex items-center gap-3 w-full text-left"
        >
          {optedOut
            ? <EyeOff className="w-4 h-4 text-slate-500 flex-shrink-0" />
            : <Eye className="w-4 h-4 text-blue-400 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">Hide me from the public leaderboard</p>
            <p className="text-xs text-slate-500">You&apos;ll still see your own stats</p>
          </div>
          <div className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative ${
            optedOut ? 'bg-blue-500' : 'bg-slate-700'
          }`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              optedOut ? 'left-5' : 'left-1'
            }`} />
          </div>
        </button>
      </div>
    </div>
  );
}
