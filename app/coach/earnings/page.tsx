'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import CoachLayout from '@/components/layouts/CoachLayout';
import {
  IndianRupee,
  TrendingUp,
  Calendar,
  Users,
  Loader2,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Earning {
  id: string;
  child_name: string;
  parent_name: string;
  enrollment_date: string;
  program_fee: number;
  coach_amount: number;
  yestoryd_amount: number;
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

export default function CoachEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<any>(null);
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

      const { data: coachData } = await supabase
        .from('coaches')
        .select('*')
        .eq('email', user.email)
        .single();

      if (!coachData) {
        window.location.href = '/coach/login';
        return;
      }

      setCoach(coachData);

      // Get all enrolled children through ENROLLMENTS (single source of truth)
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
          id,
          status,
          amount,
          lead_source,
          created_at,
          child:children (
            id,
            child_name,
            parent_name,
            custom_coach_split
          )
        `)
        .eq('coach_id', coachData.id)
        .in('status', ['active', 'pending_start', 'completed'])
        .order('created_at', { ascending: false });

      const defaultCoachSplit = coachData.coach_split_percentage / 100;
      const coachLeadSplit = 0.70; // 70% for coach leads

      // Calculate earnings for each enrollment
      const earningsData: Earning[] = (enrollments || []).map((enrollment) => {
        const child = enrollment.child as any;
        if (!child) return null;

        // TODO: Fetch from pricing_plans table instead of hardcoding
        const programFee = enrollment.amount || 5999;
        const isCoachLead = enrollment.lead_source === 'coach';
        const splitPercentage = child.custom_coach_split
          ? child.custom_coach_split / 100
          : isCoachLead
          ? coachLeadSplit
          : defaultCoachSplit;

        const coachAmount = programFee * splitPercentage;
        const yestorydAmount = programFee - coachAmount;

        return {
          id: child.id,
          child_name: child.child_name,
          parent_name: child.parent_name,
          enrollment_date: enrollment.created_at,
          program_fee: programFee,
          coach_amount: coachAmount,
          yestoryd_amount: yestorydAmount,
          split_type: child.custom_coach_split ? 'custom' : isCoachLead ? 'coach_lead' : 'default',
          lead_source: enrollment.lead_source || 'yestoryd',
          status: enrollment.status === 'active' ? 'paid' : 'pending',
        };
      }).filter(Boolean) as Earning[];

      setEarnings(earningsData);

      // Calculate summary
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      const totalEarnings = earningsData.reduce((sum, e) => sum + e.coach_amount, 0);
      const thisMonthEarnings = earningsData
        .filter((e) => new Date(e.enrollment_date) >= startOfMonth)
        .reduce((sum, e) => sum + e.coach_amount, 0);
      const lastMonthEarnings = earningsData
        .filter((e) => {
          const date = new Date(e.enrollment_date);
          return date >= startOfLastMonth && date <= endOfLastMonth;
        })
        .reduce((sum, e) => sum + e.coach_amount, 0);
      const pendingEarnings = earningsData
        .filter((e) => e.status === 'pending')
        .reduce((sum, e) => sum + e.coach_amount, 0);

      const yestorydLeads = earningsData.filter((e) => e.lead_source === 'yestoryd').length;
      const coachLeads = earningsData.filter((e) => e.lead_source === 'coach').length;

      setSummary({
        totalEarnings,
        thisMonthEarnings,
        lastMonthEarnings,
        pendingEarnings,
        totalStudents: earningsData.length,
        yestorydLeads,
        coachLeads,
      });
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

  const getSplitBadge = (splitType: string, leadSource: string) => {
    if (splitType === 'custom') {
      return <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs">Custom</span>;
    }
    if (leadSource === 'coach') {
      return <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">70-30</span>;
    }
    return <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">50-50</span>;
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
      <CoachLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#FF0099] animate-spin" />
        </div>
      </CoachLayout>
    );
  }

  if (!coach) return null;

  return (
    <CoachLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <IndianRupee className="w-7 h-7 text-yellow-400" />
              Earnings
            </h1>
            <p className="text-text-tertiary">Track your coaching income</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-tertiary">Your split:</span>
            <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-medium">
              {coach.coach_split_percentage}% (Yestoryd leads)
            </span>
            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-medium">
              70% (Your leads)
            </span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-1 rounded-xl p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-text-tertiary text-sm">Total Earned</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatCurrency(summary.totalEarnings)}</p>
          </div>

          <div className="bg-surface-1 rounded-xl p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-text-tertiary text-sm">This Month</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatCurrency(summary.thisMonthEarnings)}</p>
            {monthChange !== null && (
              <div className={`flex items-center gap-1 mt-1 text-sm ${monthChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {monthChange >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {Math.abs(monthChange).toFixed(0)}% vs last month
              </div>
            )}
          </div>

          <div className="bg-surface-1 rounded-xl p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-text-tertiary text-sm">Total Students</span>
            </div>
            <p className="text-3xl font-bold text-white">{summary.totalStudents}</p>
            <p className="text-text-tertiary text-sm mt-1">
              {summary.yestorydLeads} platform • {summary.coachLeads} yours
            </p>
          </div>

          <div className="bg-surface-1 rounded-xl p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-text-tertiary text-sm">Avg per Student</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {summary.totalStudents > 0
                ? formatCurrency(summary.totalEarnings / summary.totalStudents)
                : '₹0'}
            </p>
          </div>
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
                  className="bg-surface-2 border border-border rounded-lg py-1.5 px-3 text-white text-sm focus:outline-none focus:border-pink-500"
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
                      <td className="px-4 py-3">{getSplitBadge(earning.split_type, earning.lead_source)}</td>
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
                    {getSplitBadge(earning.split_type, earning.lead_source)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </CoachLayout>
  );
}
