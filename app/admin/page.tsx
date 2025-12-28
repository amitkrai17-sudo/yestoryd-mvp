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
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-slate-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-600">{error || 'No data available'}</p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
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
      case 'no_show': return 'bg-amber-100 text-amber-700';
      case 'coach_no_show': return 'bg-red-100 text-red-700';
      case 'bot_error': return 'bg-purple-100 text-purple-700';
      case 'partial': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
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
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Session Intelligence</h2>
              <p className="text-sm text-slate-500">{data.period}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(parseInt(e.target.value))}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={fetchStats}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Completion Rate */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-600">Completion Rate</span>
            </div>
            <p className="text-3xl font-bold text-emerald-700">{stats.completionRate}%</p>
            <p className="text-xs text-emerald-600 mt-1">{stats.completed} of {stats.total - stats.scheduled} sessions</p>
          </div>

          {/* Completed */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-600">Completed</span>
            </div>
            <p className="text-3xl font-bold text-blue-700">{stats.completed}</p>
            <p className="text-xs text-blue-600 mt-1">Avg {stats.avgDuration} min</p>
          </div>

          {/* No-Shows */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <UserX className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">No-Shows</span>
            </div>
            <p className="text-3xl font-bold text-amber-700">{stats.noShows}</p>
            <p className="text-xs text-amber-600 mt-1">Child/parent missing</p>
          </div>

          {/* Coach No-Shows */}
          <div className={`rounded-xl p-4 border ${
            stats.coachNoShows > 0 
              ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200' 
              : 'bg-gradient-to-br from-slate-50 to-gray-50 border-slate-100'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className={`w-4 h-4 ${stats.coachNoShows > 0 ? 'text-red-600' : 'text-slate-400'}`} />
              <span className={`text-xs font-medium ${stats.coachNoShows > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                Coach No-Shows
              </span>
            </div>
            <p className={`text-3xl font-bold ${stats.coachNoShows > 0 ? 'text-red-700' : 'text-slate-400'}`}>
              {stats.coachNoShows}
            </p>
            <p className={`text-xs mt-1 ${stats.coachNoShows > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {stats.coachNoShows > 0 ? '⚠️ Needs attention' : 'All good'}
            </p>
          </div>
        </div>

        {/* Secondary Stats Row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-lg font-semibold text-slate-700">{stats.scheduled}</p>
            <p className="text-xs text-slate-500">Upcoming</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-lg font-semibold text-slate-700">{stats.partial}</p>
            <p className="text-xs text-slate-500">Partial</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-lg font-semibold text-slate-700">{stats.botErrors}</p>
            <p className="text-xs text-slate-500">Bot Errors</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-lg font-semibold text-slate-700">{stats.flagged}</p>
            <p className="text-xs text-slate-500">Flagged</p>
          </div>
        </div>

        {/* Weekly Trend Chart */}
        {weeklyData.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Weekly Completion Trend</h3>
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
                        className="w-full bg-blue-300 rounded-b transition-all"
                        style={{ height: `${(week.partial / maxTotal) * 100}%` }}
                        title={`${week.partial} partial`}
                      />
                    </div>
                    <span className="text-xs text-slate-500 mt-2">{week.weekLabel}</span>
                    <span className="text-xs font-medium text-slate-700">{week.completionRate}%</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-3 h-3 bg-emerald-500 rounded"></span> Completed
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-3 h-3 bg-amber-400 rounded"></span> No-Shows
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-3 h-3 bg-blue-300 rounded"></span> Partial
              </span>
            </div>
          </div>
        )}

        {/* Recent Issues */}
        {recentIssues.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">Recent Issues</h3>
            <div className="space-y-2">
              {recentIssues.slice(0, 5).map((issue) => (
                <div
                  key={issue.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(issue.status)}`}>
                    {getStatusLabel(issue.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {issue.childName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(issue.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • Coach: {issue.coachName}
                    </p>
                  </div>
                  <p className="text-xs text-slate-400 hidden sm:block max-w-[150px] truncate">
                    {issue.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State for Issues */}
        {recentIssues.length === 0 && (
          <div className="text-center py-6 bg-emerald-50 rounded-xl">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-emerald-700 font-medium">All sessions running smoothly!</p>
            <p className="text-sm text-emerald-600">No issues in the selected period</p>
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="text-slate-500 mt-1">Welcome back! Here's what's happening.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
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
              blue: 'bg-blue-100 text-blue-600',
              emerald: 'bg-emerald-100 text-emerald-600',
              violet: 'bg-violet-100 text-violet-600',
              amber: 'bg-amber-100 text-amber-600',
            };

            return (
              <div
                key={index}
                className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[stat.color]}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    stat.trendUp ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {stat.trendUp ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    {stat.trend}
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 mb-1">
                  {loading ? '...' : stat.value}
                </p>
                <p className="text-sm text-slate-500">{stat.label}</p>
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
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
                <p className="text-sm text-slate-500 mt-1">Common tasks</p>
              </div>
              <div className="p-4 space-y-2">
                {quickActions.map((action, index) => {
                  const colorClasses: Record<string, string> = {
                    blue: 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
                    emerald: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
                    violet: 'bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white',
                    amber: 'bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
                  };

                  return (
                    <Link
                      key={index}
                      href={action.href}
                      className="group flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-all"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${colorClasses[action.color]}`}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="flex-1 font-medium text-slate-700 group-hover:text-slate-900">
                        {action.label}
                      </span>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Session Stats */}
            <div className="bg-white rounded-2xl border border-slate-200 mt-6 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
                <p className="text-sm text-slate-500 mt-1">Coaching overview</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Upcoming</p>
                      <p className="text-xs text-slate-500">Next 7 days</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-slate-900">
                    {loading ? '...' : stats.upcomingSessions}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Target className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Completed</p>
                      <p className="text-xs text-slate-500">This month</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-slate-900">
                    {loading ? '...' : stats.completedSessions}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Enrollments */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Recent Enrollments</h2>
                  <p className="text-sm text-slate-500 mt-1">Latest program enrollments</p>
                </div>
                <Link
                  href="/admin/enrollments"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              
              {loading ? (
                <div className="p-12 text-center text-slate-500">
                  Loading...
                </div>
              ) : recentEnrollments.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <GraduationCap className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500">No enrollments yet</p>
                  <p className="text-sm text-slate-400 mt-1">New enrollments will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentEnrollments.map((enrollment, index) => (
                    <div key={index} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {enrollment.childName?.charAt(0) || 'C'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{enrollment.childName}</p>
                          <p className="text-sm text-slate-500 truncate">
                            Parent: {enrollment.parentName} • {enrollment.parentEmail}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">₹{enrollment.amount}</p>
                          <p className="text-xs text-slate-400">
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