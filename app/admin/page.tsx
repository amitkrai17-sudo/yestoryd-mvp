'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  GraduationCap,
  IndianRupee,
  TrendingUp,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Activity,
  Target,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  UserX,
  Bot,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface DashboardStats {
  totalEnrollments: number;
  activeChildren: number;
  totalRevenue: number;
  thisMonthRevenue: number;
  upcomingSessions: number;
  completedSessions: number;
  conversionRate: number;
  assessmentsTaken: number;
}

interface SessionStats {
  total: number;
  completed: number;
  noShows: number;
  coachNoShows: number;
  partial: number;
  botErrors: number;
  scheduled: number;
  flagged: number;
  avgDuration: number;
  completionRate: number;
}

interface WeeklyData {
  weekStart: string;
  weekLabel: string;
  completed: number;
  noShow: number;
  partial: number;
  total: number;
  completionRate: number;
}

interface RecentIssue {
  id: string;
  status: string;
  date: string;
  time: string;
  childName: string;
  coachName: string;
  reason: string;
}

interface SessionIntelligenceData {
  stats: SessionStats;
  weeklyData: WeeklyData[];
  recentIssues: RecentIssue[];
  period: string;
}

// ============================================================
// SESSION INTELLIGENCE COMPONENT (Inline)
// ============================================================

function SessionIntelligenceCard() {
  const [data, setData] = useState<SessionIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysBack, setDaysBack] = useState(30);

  useEffect(() => {
    fetchStats();
  }, [daysBack]);

  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/session-stats?days=${daysBack}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError('Failed to load session stats');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-surface-3 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-surface-2 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border p-6">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-text-secondary">{error || 'No data available'}</p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const { stats, weeklyData, recentIssues } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'no_show': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'coach_no_show': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'bot_error': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      case 'partial': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      default: return 'bg-surface-2 text-text-secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'no_show': return 'No-Show';
      case 'coach_no_show': return 'Coach Missing';
      case 'bot_error': return 'Bot Error';
      case 'partial': return 'Partial';
      default: return status;
    }
  };

  return (
    <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Session Intelligence</h2>
              <p className="text-sm text-text-tertiary">{data.period}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(parseInt(e.target.value))}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface-1 text-white"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={fetchStats}
              className="p-2 hover:bg-surface-2 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-text-tertiary" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Completion Rate */}
          <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Completion Rate</span>
            </div>
            <p className="text-3xl font-bold text-emerald-400">{stats.completionRate}%</p>
            <p className="text-xs text-emerald-400/70 mt-1">{stats.completed} of {stats.total - stats.scheduled} sessions</p>
          </div>

          {/* Completed */}
          <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-blue-400">Completed</span>
            </div>
            <p className="text-3xl font-bold text-blue-400">{stats.completed}</p>
            <p className="text-xs text-blue-400/70 mt-1">Avg {stats.avgDuration} min</p>
          </div>

          {/* No-Shows */}
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
            <div className="flex items-center gap-2 mb-2">
              <UserX className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">No-Shows</span>
            </div>
            <p className="text-3xl font-bold text-amber-400">{stats.noShows}</p>
            <p className="text-xs text-amber-400/70 mt-1">Child/parent missing</p>
          </div>

          {/* Coach No-Shows */}
          <div className={`rounded-xl p-4 border ${
            stats.coachNoShows > 0
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-surface-2 border-border'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`w-4 h-4 ${stats.coachNoShows > 0 ? 'text-red-400' : 'text-text-tertiary'}`} />
              <span className={`text-xs font-medium ${stats.coachNoShows > 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
                Coach No-Shows
              </span>
            </div>
            <p className={`text-3xl font-bold ${stats.coachNoShows > 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
              {stats.coachNoShows}
            </p>
            <p className={`text-xs mt-1 ${stats.coachNoShows > 0 ? 'text-red-400/70' : 'text-text-tertiary'}`}>
              {stats.coachNoShows > 0 ? 'Needs attention' : 'All good'}
            </p>
          </div>
        </div>

        {/* Secondary Stats Row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <p className="text-lg font-semibold text-white">{stats.scheduled}</p>
            <p className="text-xs text-text-tertiary">Upcoming</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <p className="text-lg font-semibold text-white">{stats.partial}</p>
            <p className="text-xs text-text-tertiary">Partial</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <p className="text-lg font-semibold text-white">{stats.botErrors}</p>
            <p className="text-xs text-text-tertiary">Bot Errors</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 text-center">
            <p className="text-lg font-semibold text-white">{stats.flagged}</p>
            <p className="text-xs text-text-tertiary">Flagged</p>
          </div>
        </div>

        {/* Weekly Trend Chart */}
        {weeklyData.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-text-secondary mb-3">Weekly Completion Trend</h3>
            <div className="flex items-end gap-2 h-32">
              {weeklyData.map((week) => {
                const maxTotal = Math.max(...weeklyData.map(w => w.total), 1);
                return (
                  <div key={week.weekStart} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col gap-0.5" style={{ height: '100px' }}>
                      <div
                        className="w-full bg-emerald-500 rounded-t transition-all"
                        style={{ height: `${(week.completed / maxTotal) * 100}%` }}
                        title={`${week.completed} completed`}
                      />
                      <div
                        className="w-full bg-amber-400 transition-all"
                        style={{ height: `${(week.noShow / maxTotal) * 100}%` }}
                        title={`${week.noShow} no-shows`}
                      />
                      <div
                        className="w-full bg-blue-400 rounded-b transition-all"
                        style={{ height: `${(week.partial / maxTotal) * 100}%` }}
                        title={`${week.partial} partial`}
                      />
                    </div>
                    <span className="text-xs text-text-tertiary mt-2">{week.weekLabel}</span>
                    <span className="text-xs font-medium text-white">{week.completionRate}%</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="w-3 h-3 bg-emerald-500 rounded"></span> Completed
              </span>
              <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="w-3 h-3 bg-amber-400 rounded"></span> No-Shows
              </span>
              <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="w-3 h-3 bg-blue-400 rounded"></span> Partial
              </span>
            </div>
          </div>
        )}

        {/* Recent Issues */}
        {recentIssues.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">Recent Issues</h3>
            <div className="space-y-2">
              {recentIssues.slice(0, 5).map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl hover:bg-surface-3 transition-colors"
                >
                  <div className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(issue.status)}`}>
                    {getStatusLabel(issue.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {issue.childName}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {new Date(issue.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • Coach: {issue.coachName}
                    </p>
                  </div>
                  <p className="text-xs text-text-tertiary hidden sm:block max-w-[150px] truncate">
                    {issue.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State for Issues */}
        {recentIssues.length === 0 && (
          <div className="text-center py-6 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-emerald-400 font-medium">All sessions running smoothly!</p>
            <p className="text-sm text-emerald-400/70">No issues in the selected period</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MAIN ADMIN DASHBOARD PAGE
// ============================================================

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEnrollments: 0,
    activeChildren: 0,
    totalRevenue: 0,
    thisMonthRevenue: 0,
    upcomingSessions: 0,
    completedSessions: 0,
    conversionRate: 0,
    assessmentsTaken: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentEnrollments, setRecentEnrollments] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || stats);
        setRecentEnrollments(data.recentEnrollments || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Enrollments',
      value: stats.totalEnrollments,
      icon: GraduationCap,
      color: 'blue',
      trend: '+12%',
      trendUp: true,
    },
    {
      label: 'Active Children',
      value: stats.activeChildren,
      icon: Users,
      color: 'emerald',
      trend: '+8%',
      trendUp: true,
    },
    {
      label: 'Total Revenue',
      value: `₹${(stats.totalRevenue / 1000).toFixed(1)}K`,
      icon: IndianRupee,
      color: 'violet',
      trend: '+23%',
      trendUp: true,
    },
    {
      label: 'This Month',
      value: `₹${(stats.thisMonthRevenue / 1000).toFixed(1)}K`,
      icon: TrendingUp,
      color: 'amber',
      trend: '+15%',
      trendUp: true,
    },
  ];

  const quickActions = [
    { label: 'Site Settings', href: '/admin/settings', icon: Zap, color: 'blue' },
    { label: 'View Enrollments', href: '/admin/enrollments', icon: GraduationCap, color: 'emerald' },
    { label: 'Manage Coaches', href: '/admin/coaches', icon: Users, color: 'violet' },
    { label: 'View Analytics', href: '/admin/analytics', icon: Activity, color: 'amber' },
  ];

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <div className="bg-surface-1 border-b border-border">
        <div className="px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              <p className="text-text-tertiary mt-1">Welcome back! Here's what's happening.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-text-tertiary">
              <Clock className="w-4 h-4" />
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => {
            const colorClasses: Record<string, string> = {
              blue: 'bg-blue-500/20 text-blue-400',
              emerald: 'bg-emerald-500/20 text-emerald-400',
              violet: 'bg-violet-500/20 text-violet-400',
              amber: 'bg-amber-500/20 text-amber-400',
            };

            return (
              <div
                key={index}
                className="bg-surface-1 rounded-2xl border border-border p-6 hover:shadow-lg hover:border-border transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[stat.color]}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    stat.trendUp ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {stat.trendUp ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {stat.trend}
                  </div>
                </div>
                <p className="text-3xl font-bold text-white mb-1">
                  {loading ? '...' : stat.value}
                </p>
                <p className="text-sm text-text-tertiary">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* ============================================================ */}
        {/* SESSION INTELLIGENCE CARD - NEW! */}
        {/* ============================================================ */}
        <div className="mb-8">
          <SessionIntelligenceCard />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
              <div className="p-6 border-b border-border/50">
                <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
                <p className="text-sm text-text-tertiary mt-1">Common tasks</p>
              </div>
              <div className="p-4 space-y-2">
                {quickActions.map((action, index) => {
                  const colorClasses: Record<string, string> = {
                    blue: 'bg-blue-500/20 text-blue-400 group-hover:bg-blue-600 group-hover:text-white',
                    emerald: 'bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white',
                    violet: 'bg-violet-500/20 text-violet-400 group-hover:bg-violet-600 group-hover:text-white',
                    amber: 'bg-amber-500/20 text-amber-400 group-hover:bg-amber-600 group-hover:text-white',
                  };

                  return (
                    <Link
                      key={index}
                      href={action.href}
                      className="group flex items-center gap-4 p-4 rounded-xl hover:bg-surface-2 transition-all"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${colorClasses[action.color]}`}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="flex-1 font-medium text-text-secondary group-hover:text-white">
                        {action.label}
                      </span>
                      <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-text-secondary group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Session Stats */}
            <div className="bg-surface-1 rounded-2xl border border-border mt-6 overflow-hidden">
              <div className="p-6 border-b border-border/50">
                <h2 className="text-lg font-semibold text-white">Sessions</h2>
                <p className="text-sm text-text-tertiary mt-1">Coaching overview</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Upcoming</p>
                      <p className="text-xs text-text-tertiary">Next 7 days</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-white">
                    {loading ? '...' : stats.upcomingSessions}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                      <Target className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">Completed</p>
                      <p className="text-xs text-text-tertiary">This month</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-white">
                    {loading ? '...' : stats.completedSessions}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Enrollments */}
          <div className="lg:col-span-2">
            <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden h-full">
              <div className="p-6 border-b border-border/50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Recent Enrollments</h2>
                  <p className="text-sm text-text-tertiary mt-1">Latest program enrollments</p>
                </div>
                <Link
                  href="/admin/enrollments"
                  className="text-sm font-medium text-blue-400 hover:text-blue-500 flex items-center gap-1"
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {loading ? (
                <div className="p-12 text-center text-text-secondary">
                  Loading...
                </div>
              ) : recentEnrollments.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
                    <GraduationCap className="w-8 h-8 text-text-tertiary" />
                  </div>
                  <p className="text-text-secondary">No enrollments yet</p>
                  <p className="text-sm text-text-tertiary mt-1">New enrollments will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentEnrollments.map((enrollment, index) => (
                    <div key={index} className="p-4 hover:bg-surface-2 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {enrollment.childName?.charAt(0) || 'C'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white">{enrollment.childName}</p>
                          <p className="text-sm text-text-tertiary truncate">
                            Parent: {enrollment.parentName} • {enrollment.parentEmail}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-white">₹{enrollment.amount}</p>
                          <p className="text-xs text-text-tertiary">
                            {new Date(enrollment.createdAt).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
