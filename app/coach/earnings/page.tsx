'use client';

import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase/client';
import {
  IndianRupee,
  TrendingUp,
  Calendar,
  Users,
  Filter,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { StatCard } from '@/components/shared/StatCard';
import { PageHeader } from '@/components/shared/PageHeader';

interface Earning {
  id: string;
  child_name: string;
  parent_name: string;
  enrollment_date: string;
  program_fee: number;
  coach_amount: number;
  yestoryd_amount: number;
  coach_percent: number;
  split_type: string;
  lead_source: string;
  status: string;
}

interface EarningsSummary {
  totalEarnings: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  pendingEarnings: number;
  totalStudents: number;
  yestorydLeads: number;
  coachLeads: number;
}

interface SplitsInfo {
  coachCostPercent: number;
  leadReferralPercent: number;
  effectivePercent: number;
  effectivePercentWithLead: number;
  groupName: string;
}

export default function CoachEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState<EarningsSummary>({
    totalEarnings: 0,
    thisMonthEarnings: 0,
    lastMonthEarnings: 0,
    pendingEarnings: 0,
    totalStudents: 0,
    yestorydLeads: 0,
    coachLeads: 0,
  });
  const [splits, setSplits] = useState<SplitsInfo | null>(null);
  const [filterPeriod, setFilterPeriod] = useState('all');

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/coach/login';
        return;
      }

      // Use the earnings-summary API (single source of truth for V2 splits)
      const res = await fetch(`/api/coach/earnings-summary?email=${encodeURIComponent(user.email!)}`);
      if (!res.ok) {
        if (res.status === 404) {
          window.location.href = '/coach/login';
          return;
        }
        throw new Error('Failed to load earnings');
      }

      const data = await res.json();
      setEarnings(data.earnings);
      setSummary(data.summary);
      setSplits(data.splits);
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getSplitBadge = (earning: Earning) => {
    const pct = Math.round(earning.coach_percent);
    if (earning.split_type === 'custom') {
      return <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs">Custom {pct}%</span>;
    }
    if (earning.lead_source === 'coach') {
      return <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">{pct}%</span>;
    }
    return <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">{pct}%</span>;
  };

  const getMonthChange = () => {
    if (summary.lastMonthEarnings === 0) return null;
    const change = ((summary.thisMonthEarnings - summary.lastMonthEarnings) / summary.lastMonthEarnings) * 100;
    return change;
  };

  const monthChange = getMonthChange();

  const filteredEarnings = earnings.filter((e) => {
    if (filterPeriod === 'all') return true;
    const date = new Date(e.enrollment_date);
    const now = new Date();
    if (filterPeriod === 'this_month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (filterPeriod === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" className="text-[#00ABFF]" />
      </div>
    );
  }

  return (
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Earnings"
          subtitle="Track your coaching income"
          action={
            <div className="flex items-center gap-2 text-sm">
              <span className="text-text-tertiary">Your split:</span>
              <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-medium">
                {splits?.effectivePercent ?? 58}% (Yestoryd leads)
              </span>
              <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-medium">
                {splits?.effectivePercentWithLead ?? 68}% (Your leads)
              </span>
            </div>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            value={formatCurrency(summary.totalEarnings)}
            label="Total Earned"
            icon={IndianRupee}
            color="yellow"
          />
          <StatCard
            value={formatCurrency(summary.thisMonthEarnings)}
            label="This Month"
            icon={Calendar}
            color="green"
            trend={monthChange !== null ? { value: Math.round(Math.abs(monthChange)), positive: monthChange >= 0 } : undefined}
          />
          <StatCard
            value={summary.totalStudents}
            label="Total Students"
            icon={Users}
            color="blue"
            subtitle={`${summary.yestorydLeads} platform \u2022 ${summary.coachLeads} yours`}
          />
          <StatCard
            value={summary.totalStudents > 0 ? formatCurrency(summary.totalEarnings / summary.totalStudents) : '\u20B90'}
            label="Avg per Student"
            icon={TrendingUp}
            color="orange"
          />
        </div>

        {/* Earnings Table */}
        <div className="bg-surface-1 rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-white">Earnings Breakdown</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-text-tertiary" />
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value)}
                  className="bg-surface-2 border border-border rounded-lg py-1.5 px-3 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Time</option>
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                </select>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-2/50">
                <tr>
                  <th className="text-left text-text-tertiary text-sm font-medium px-4 py-3">Student</th>
                  <th className="text-left text-text-tertiary text-sm font-medium px-4 py-3">Enrolled</th>
                  <th className="text-left text-text-tertiary text-sm font-medium px-4 py-3">Split</th>
                  <th className="text-right text-text-tertiary text-sm font-medium px-4 py-3">Program Fee</th>
                  <th className="text-right text-text-tertiary text-sm font-medium px-4 py-3">Your Earnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEarnings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text-tertiary">
                      No earnings found for this period
                    </td>
                  </tr>
                ) : (
                  filteredEarnings.map((earning) => (
                    <tr key={earning.id} className="hover:bg-surface-2/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white font-medium">{earning.child_name}</p>
                          <p className="text-text-tertiary text-sm">{earning.parent_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-tertiary">{formatDate(earning.enrollment_date)}</td>
                      <td className="px-4 py-3">{getSplitBadge(earning)}</td>
                      <td className="px-4 py-3 text-right text-text-tertiary">{formatCurrency(earning.program_fee)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-green-400 font-semibold">{formatCurrency(earning.coach_amount)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredEarnings.length > 0 && (
                <tfoot className="bg-surface-2/30">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right text-text-tertiary font-medium">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-green-400 font-bold text-lg">
                        {formatCurrency(filteredEarnings.reduce((sum, e) => sum + e.coach_amount, 0))}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-border">
            {filteredEarnings.length === 0 ? (
              <div className="p-8 text-center text-text-tertiary">No earnings found</div>
            ) : (
              filteredEarnings.map((earning) => (
                <div key={earning.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-medium">{earning.child_name}</p>
                      <p className="text-text-tertiary text-sm">{earning.parent_name}</p>
                    </div>
                    <span className="text-green-400 font-bold">{formatCurrency(earning.coach_amount)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-text-tertiary">{formatDate(earning.enrollment_date)}</span>
                    {getSplitBadge(earning)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
  );
}
