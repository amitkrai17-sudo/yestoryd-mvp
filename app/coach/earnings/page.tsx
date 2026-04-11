// app/coach/earnings/page.tsx
// Coach earnings detail — actual payouts from coach_payouts, month picker, per-session log
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  IndianRupee, Calendar, ChevronLeft, ChevronRight, Clock,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProductBadge } from '@/components/shared/RevenueCalculator';

// ============================================================
// TYPES
// ============================================================

interface SessionRow {
  id: string;
  date: string;
  childName: string;
  productType: 'coaching' | 'tuition' | 'workshop';
  payoutType: string;
  grossAmount: number;
  tdsAmount: number;
  netAmount: number;
  status: string;
  sessionType: string | null;
  description: string | null;
}

interface PayoutRow {
  date: string;
  status: string;
  total: number;
  paidAt: string | null;
  utr: string | null;
}

interface EarningsData {
  month: string;
  summary: {
    totalGross: number;
    totalTds: number;
    totalNet: number;
    sessionCount: number;
    byProduct: Record<string, { gross: number; tds: number; net: number; sessions: number }>;
  };
  sessions: SessionRow[];
  payouts: PayoutRow[];
  availableMonths: string[];
}

// ============================================================
// HELPERS
// ============================================================

function formatRupees(amount: number): string {
  return `\u20B9${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function statusDot(status: string): string {
  switch (status) {
    case 'paid': return 'bg-green-400';
    case 'scheduled': return 'bg-yellow-400';
    case 'processing': return 'bg-blue-400';
    case 'failed': return 'bg-red-400';
    default: return 'bg-gray-400';
  }
}

// ============================================================
// COMPONENT
// ============================================================

export default function CoachEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EarningsData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    loadEarnings();
  }, [selectedMonth]);

  const loadEarnings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.set('month', selectedMonth);

      const res = await fetch(`/api/coach/earnings?${params}`);
      if (!res.ok) throw new Error('Failed to load');

      const json = await res.json();
      setData(json);
      if (!selectedMonth && json.month) setSelectedMonth(json.month);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: -1 | 1) => {
    if (!data?.availableMonths?.length) return;
    const idx = data.availableMonths.indexOf(selectedMonth);
    const newIdx = idx + (direction === -1 ? 1 : -1); // months are DESC sorted
    if (newIdx >= 0 && newIdx < data.availableMonths.length) {
      setSelectedMonth(data.availableMonths[newIdx]);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" className="text-[#00ABFF]" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-center text-text-tertiary">No earnings data found.</div>;
  }

  const { summary, sessions, payouts } = data;
  const avgPerSession = summary.sessionCount > 0 ? Math.round(summary.totalNet / summary.sessionCount) : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Earnings" subtitle="Actual payouts from completed sessions" />

      {/* SECTION 1 — Month picker + metrics */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => navigateMonth(-1)}
          disabled={!data.availableMonths?.length || data.availableMonths.indexOf(selectedMonth) >= data.availableMonths.length - 1}
          className="h-8 w-8 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 flex items-center justify-center disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold text-white min-w-[160px] text-center">
          {formatMonthLabel(selectedMonth || data.month)}
        </h2>
        <button
          onClick={() => navigateMonth(1)}
          disabled={!data.availableMonths?.length || data.availableMonths.indexOf(selectedMonth) <= 0}
          className="h-8 w-8 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 flex items-center justify-center disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-1/50 rounded-xl border border-border p-3 text-center">
          <p className="text-[22px] font-bold text-green-400">{formatRupees(summary.totalNet)}</p>
          <p className="text-[13px] text-text-tertiary">Total earned</p>
        </div>
        <div className="bg-surface-1/50 rounded-xl border border-border p-3 text-center">
          <p className="text-[22px] font-bold text-white">{summary.sessionCount}</p>
          <p className="text-[13px] text-text-tertiary">Sessions</p>
        </div>
        <div className="bg-surface-1/50 rounded-xl border border-border p-3 text-center">
          <p className="text-[22px] font-bold text-white">{formatRupees(avgPerSession)}</p>
          <p className="text-[13px] text-text-tertiary">Avg/session</p>
        </div>
      </div>

      {/* SECTION 2 — Product breakdown */}
      {summary.totalNet > 0 && (
        <div className="bg-surface-1/50 rounded-xl border border-border p-4 space-y-2">
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden flex">
            {(summary.byProduct.tuition?.net ?? 0) > 0 && (
              <div className="bg-blue-500" style={{ width: `${(summary.byProduct.tuition.net / summary.totalNet) * 100}%` }} />
            )}
            {(summary.byProduct.coaching?.net ?? 0) > 0 && (
              <div className="bg-purple-500" style={{ width: `${(summary.byProduct.coaching.net / summary.totalNet) * 100}%` }} />
            )}
            {(summary.byProduct.workshop?.net ?? 0) > 0 && (
              <div className="bg-teal-500" style={{ width: `${(summary.byProduct.workshop.net / summary.totalNet) * 100}%` }} />
            )}
          </div>
          {[
            { key: 'tuition', label: 'English Classes', dot: 'bg-blue-500' },
            { key: 'coaching', label: 'Coaching', dot: 'bg-purple-500' },
            { key: 'workshop', label: 'Workshops', dot: 'bg-teal-500' },
          ].map(row => {
            const prod = summary.byProduct[row.key];
            if (!prod) return null;
            return (
              <div key={row.key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${row.dot}`} />
                  <span className="text-text-secondary">{row.label}</span>
                </div>
                <span className="text-text-tertiary">{formatRupees(prod.net)} &middot; {prod.sessions} sessions</span>
              </div>
            );
          })}
        </div>
      )}

      {/* SECTION 3 — Session log */}
      <div>
        <h2 className="text-[13px] uppercase tracking-wide text-text-tertiary font-medium mb-3">
          Session Details ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <div className="bg-surface-1/50 rounded-xl border border-border p-6 text-center text-sm text-text-tertiary">
            No sessions this month
          </div>
        ) : (
          <div className="space-y-1.5">
            {sessions.map(session => (
              <div key={session.id} className="bg-surface-1/50 rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-text-tertiary w-14 flex-shrink-0">
                      {formatDateShort(session.date)}
                    </span>
                    <span className="text-sm text-white font-medium truncate">{session.childName}</span>
                    <ProductBadge product={session.productType} />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm text-green-400 font-medium">{formatRupees(session.netAmount)}</span>
                    <div className={`w-2 h-2 rounded-full ${statusDot(session.status)}`} title={session.status} />
                  </div>
                </div>
                {session.tdsAmount > 0 && (
                  <div className="text-xs text-text-tertiary mt-1 pl-16">
                    Gross: {formatRupees(session.grossAmount)} &middot; TDS: {formatRupees(session.tdsAmount)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 4 — Payout history */}
      {payouts.length > 0 && (
        <div>
          <h2 className="text-[13px] uppercase tracking-wide text-text-tertiary font-medium mb-3">
            Payout Schedule
          </h2>
          <div className="space-y-1.5">
            {payouts.map((p, i) => (
              <div key={i} className="bg-surface-1/50 rounded-xl border border-border p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-text-tertiary" />
                  <span className="text-sm text-white">{formatDateShort(p.date)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">{formatRupees(p.total)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    p.status === 'paid' ? 'bg-green-500/10 text-green-400' :
                    p.status === 'scheduled' ? 'bg-yellow-500/10 text-yellow-400' :
                    p.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5 — Footer */}
      <p className="text-xs text-text-tertiary text-center">
        Earnings are calculated per completed session and paid monthly on the 7th.
      </p>
    </div>
  );
}
