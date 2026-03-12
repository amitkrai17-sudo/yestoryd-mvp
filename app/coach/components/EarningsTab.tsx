'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';

interface EarningsData {
  currentMonth: {
    earned: number;
    completedSessionsCount: number;
    pendingSessions: number;
    projectedEarnings: number;
    leadBonuses: number;
  };
  totalPaid: number;
  totalPending: number;
  nextPayoutDate: string;
  recentPayouts: Array<{
    month: string;
    amount: number;
    grossAmount: number;
    sessions: number;
    tds: number;
    status: string;
    paidAt: string | null;
  }>;
  enrollmentBreakdown: Array<{
    enrollmentId: string;
    childName: string;
    planName: string;
    totalAmount: number;
    totalSessions: number;
    sessionsCompleted: number;
    perSessionRate: number;
    earnedToDate: number;
    status: string;
  }>;
  successfulReferrals: number;
}

function formatINR(amount: number) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatMonthLabel(label: string) {
  if (!label) return '';
  const [y, m] = label.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1] || m} ${y}`;
}

export default function EarningsTab({ coachId }: { coachId: string }) {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/coach/earnings?coach_id=${coachId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); })
      .finally(() => setLoading(false));
  }, [coachId]);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Spinner size="lg" className="text-blue-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-slate-400">
        Unable to load earnings data.
      </div>
    );
  }

  const nextPayoutFormatted = data.nextPayoutDate
    ? new Date(data.nextPayoutDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '—';

  return (
    <div className="space-y-4">
      {/* ── Current Month Summary ── */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <h2 className="text-sm font-medium text-slate-400 mb-3">
          {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} Earnings
        </h2>
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1">
          {/* Earned */}
          <div className="min-w-[130px] snap-start bg-slate-800/50 rounded-xl p-3 flex-1">
            <p className="text-2xl font-bold text-blue-400">{formatINR(data.currentMonth.earned)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Earned</p>
            <p className="text-[10px] text-slate-500">({data.currentMonth.completedSessionsCount} sessions)</p>
          </div>
          {/* Projected */}
          <div className="min-w-[130px] snap-start bg-slate-800/50 rounded-xl p-3 flex-1">
            <p className="text-2xl font-bold text-slate-300">{formatINR(data.currentMonth.projectedEarnings)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Projected</p>
            <p className="text-[10px] text-slate-500">({data.currentMonth.pendingSessions} pending)</p>
          </div>
          {/* Next Payout */}
          <div className="min-w-[130px] snap-start bg-slate-800/50 rounded-xl p-3 flex-1">
            <p className="text-2xl font-bold text-emerald-400">{nextPayoutFormatted}</p>
            <p className="text-xs text-slate-400 mt-0.5">Next Payout</p>
          </div>
        </div>
        {data.currentMonth.leadBonuses > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-slate-400">Lead Bonuses:</span>
            <span className="text-blue-400 font-medium">{formatINR(data.currentMonth.leadBonuses)}</span>
            {data.successfulReferrals > 0 && (
              <span className="text-slate-500 text-xs">
                ({data.successfulReferrals} referral{data.successfulReferrals !== 1 ? 's' : ''} enrolled)
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Enrollment Breakdown ── */}
      {data.enrollmentBreakdown.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Active Enrollments</h3>
          <div className="space-y-3">
            {data.enrollmentBreakdown.map(e => {
              const progress = e.totalSessions > 0 ? (e.sessionsCompleted / e.totalSessions) * 100 : 0;
              return (
                <div key={e.enrollmentId} className="bg-slate-800/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <span className="text-white font-medium text-sm">{e.childName}</span>
                      <span className="text-slate-500 text-xs ml-2">
                        {e.planName}{e.totalAmount > 0 ? `, ${formatINR(e.totalAmount)}` : ''}
                      </span>
                    </div>
                    <span className="text-blue-400 font-semibold text-sm ml-2 flex-shrink-0">
                      {formatINR(e.earnedToDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-blue-500/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {e.sessionsCompleted}/{e.totalSessions}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Payout History ── */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-400">Recent Payouts</h3>
          <div className="flex gap-3 text-xs">
            <span className="text-slate-500">
              Paid: <span className="text-emerald-400">{formatINR(data.totalPaid)}</span>
            </span>
            {data.totalPending > 0 && (
              <span className="text-slate-500">
                Pending: <span className="text-amber-400">{formatINR(data.totalPending)}</span>
              </span>
            )}
          </div>
        </div>

        {data.recentPayouts.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No payouts yet</p>
        ) : (
          <div className="space-y-1">
            {data.recentPayouts.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
                <div>
                  <span className="text-white text-sm">{formatMonthLabel(p.month)}</span>
                  {p.sessions > 0 && (
                    <span className="text-slate-500 text-xs ml-2">{p.sessions} sessions</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white font-medium text-sm">{formatINR(p.amount)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    p.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                    p.status === 'processing' ? 'bg-amber-500/20 text-amber-400' :
                    p.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {p.status === 'paid' ? 'Paid' :
                     p.status === 'processing' ? 'Processing' :
                     p.status === 'failed' ? 'Failed' :
                     p.status}
                  </span>
                  {p.paidAt && (
                    <span className="text-slate-500 text-xs">
                      {new Date(p.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
