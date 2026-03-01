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
  MapPin,
  FileText,
  Mic,
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
            className="mt-4 px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-xl text-sm font-medium transition-colors"
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
      <div className="p-3 sm:p-4 lg:p-6 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#121217] border border-white/[0.08] rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">Session Intelligence</h2>
              <p className="text-xs text-text-tertiary">{data.period}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(parseInt(e.target.value))}
              className="text-xs sm:text-sm border border-border rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 bg-surface-1 text-white"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
            <button
              onClick={fetchStats}
              className="p-1.5 sm:p-2 hover:bg-surface-2 rounded-xl transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-text-tertiary" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
          {/* Completion Rate */}
          <div className="bg-emerald-500/10 rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 border border-emerald-500/30">
            <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              <span className="text-[10px] sm:text-xs font-medium text-emerald-400">Completion</span>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-emerald-400">{stats.completionRate}%</p>
            <p className="text-[10px] sm:text-xs text-emerald-400/70 mt-0.5">{stats.completed}/{stats.total - stats.scheduled}</p>
          </div>

          {/* Completed */}
          <div className="bg-white/[0.08] rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 border border-white/[0.08]">
            <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" />
              <span className="text-[10px] sm:text-xs font-medium text-gray-300">Completed</span>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-300">{stats.completed}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Avg {stats.avgDuration} min</p>
          </div>

          {/* No-Shows */}
          <div className="bg-amber-500/10 rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 border border-amber-500/30">
            <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
              <UserX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              <span className="text-[10px] sm:text-xs font-medium text-amber-400">No-Shows</span>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-amber-400">{stats.noShows}</p>
            <p className="text-[10px] sm:text-xs text-amber-400/70 mt-0.5">Child/parent</p>
          </div>

          {/* Coach No-Shows */}
          <div className={`rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 border ${
            stats.coachNoShows > 0
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-surface-2 border-border'
          }`}>
            <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
              <AlertTriangle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stats.coachNoShows > 0 ? 'text-red-400' : 'text-text-tertiary'}`} />
              <span className={`text-[10px] sm:text-xs font-medium ${stats.coachNoShows > 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
                Coach No-Show
              </span>
            </div>
            <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${stats.coachNoShows > 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
              {stats.coachNoShows}
            </p>
            <p className={`text-[10px] sm:text-xs mt-0.5 ${stats.coachNoShows > 0 ? 'text-red-400/70' : 'text-text-tertiary'}`}>
              {stats.coachNoShows > 0 ? 'Needs attention' : 'All good'}
            </p>
          </div>
        </div>

        {/* Secondary Stats Row */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 lg:gap-3 mb-4 sm:mb-6">
          <div className="bg-surface-2 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-sm sm:text-base lg:text-lg font-semibold text-white">{stats.scheduled}</p>
            <p className="text-[10px] sm:text-xs text-text-tertiary">Upcoming</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-sm sm:text-base lg:text-lg font-semibold text-white">{stats.partial}</p>
            <p className="text-[10px] sm:text-xs text-text-tertiary">Partial</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-sm sm:text-base lg:text-lg font-semibold text-white">{stats.botErrors}</p>
            <p className="text-[10px] sm:text-xs text-text-tertiary">Bot Errors</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-2 sm:p-3 text-center">
            <p className="text-sm sm:text-base lg:text-lg font-semibold text-white">{stats.flagged}</p>
            <p className="text-[10px] sm:text-xs text-text-tertiary">Flagged</p>
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
// IN-PERSON SESSIONS WIDGET
// ============================================================

interface OfflineOverview {
  total_offline_sessions: number;
  total_online_sessions: number;
  overall_offline_ratio: number;
  pending_requests_count: number;
  overdue_reports_count: number;
  reading_clip_rate: number;
  coaches_with_high_offline_ratio: { coach_id: string; coach_name: string; offline_ratio: number }[];
}

function InPersonSessionsCard() {
  const [data, setData] = useState<OfflineOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/offline-overview');
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch {
      // Silent fail — widget is secondary
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-surface-1 rounded-2xl border border-border p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-surface-3 rounded w-40 mb-4" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-surface-2 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasIssues = data.pending_requests_count > 0 || data.overdue_reports_count > 0;

  return (
    <div className={`bg-surface-1 rounded-2xl border overflow-hidden ${
      hasIssues ? 'border-amber-500/30' : 'border-border'
    }`}>
      <div className="p-3 sm:p-4 lg:p-6 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#121217] border border-white/[0.08] rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">In-Person Sessions</h2>
              <p className="text-xs text-text-tertiary">Offline session monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {data.pending_requests_count > 0 && (
              <Link
                href="/admin/in-person-requests"
                className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                {data.pending_requests_count} pending
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
            <button onClick={fetchData} className="p-1.5 sm:p-2 hover:bg-surface-2 rounded-xl transition-colors">
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-text-tertiary" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {/* Pending Requests */}
          <Link
            href="/admin/in-person-requests"
            className={`rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 border transition-colors hover:opacity-80 ${
              data.pending_requests_count > 0
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-surface-2 border-border'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
              <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${data.pending_requests_count > 0 ? 'text-amber-400' : 'text-text-tertiary'}`} />
              <span className={`text-[10px] sm:text-xs font-medium ${data.pending_requests_count > 0 ? 'text-amber-400' : 'text-text-tertiary'}`}>
                Pending
              </span>
            </div>
            <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${data.pending_requests_count > 0 ? 'text-amber-400' : 'text-text-tertiary'}`}>
              {data.pending_requests_count}
            </p>
            <p className={`text-[10px] sm:text-xs mt-0.5 ${data.pending_requests_count > 0 ? 'text-amber-400/70' : 'text-text-tertiary'}`}>
              {data.pending_requests_count > 0 ? 'Needs review' : 'All clear'}
            </p>
          </Link>

          {/* Overdue Reports */}
          <div className={`rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 border ${
            data.overdue_reports_count > 0
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-surface-2 border-border'
          }`}>
            <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
              <FileText className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${data.overdue_reports_count > 0 ? 'text-red-400' : 'text-text-tertiary'}`} />
              <span className={`text-[10px] sm:text-xs font-medium ${data.overdue_reports_count > 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
                Overdue
              </span>
            </div>
            <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${data.overdue_reports_count > 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
              {data.overdue_reports_count}
            </p>
            <p className={`text-[10px] sm:text-xs mt-0.5 ${data.overdue_reports_count > 0 ? 'text-red-400/70' : 'text-text-tertiary'}`}>
              {data.overdue_reports_count > 0 ? 'Reports missing' : 'All submitted'}
            </p>
          </div>

          {/* In-Person Ratio */}
          <div className="bg-white/[0.08] rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 border border-white/[0.08]">
            <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" />
              <span className="text-[10px] sm:text-xs font-medium text-gray-300">In-Person</span>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-300">{data.overall_offline_ratio}%</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
              {data.total_offline_sessions} of {data.total_offline_sessions + data.total_online_sessions}
            </p>
          </div>

          {/* Reading Clip Rate */}
          <div className="bg-white/[0.08] rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 border border-white/[0.08]">
            <div className="flex items-center gap-1.5 mb-1 sm:mb-2">
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-300" />
              <span className="text-[10px] sm:text-xs font-medium text-gray-300">Clips</span>
            </div>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-300">{data.reading_clip_rate}%</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Reading clip rate</p>
          </div>
        </div>

        {/* High offline ratio coaches warning */}
        {data.coaches_with_high_offline_ratio.length > 0 && (
          <div className="mt-3 sm:mt-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-xs font-medium text-amber-400 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              Coaches with high in-person ratio (&gt;50%)
            </p>
            <div className="flex flex-wrap gap-2">
              {data.coaches_with_high_offline_ratio.map((c) => (
                <span key={c.coach_id} className="text-xs text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded">
                  {c.coach_name} ({Math.round(c.offline_ratio * 100)}%)
                </span>
              ))}
            </div>
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
    <div className="bg-surface-0">
      {/* Header */}
      <div className="bg-surface-1 border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate">Dashboard</h1>
              <p className="text-xs sm:text-sm text-text-tertiary mt-0.5 sm:mt-1">Welcome back! Here&apos;s what&apos;s happening.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-text-tertiary flex-shrink-0">
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

      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          {statCards.map((stat, index) => {
            const colorClasses: Record<string, string> = {
              blue: 'bg-white/[0.08] text-gray-300',
              emerald: 'bg-white/[0.08] text-gray-300',
              violet: 'bg-white/[0.08] text-gray-300',
              amber: 'bg-white/[0.08] text-gray-300',
            };

            return (
              <div
                key={index}
                className="bg-surface-1 rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 lg:p-6 hover:border-border transition-all"
              >
                <div className="flex items-start justify-between mb-2 sm:mb-4">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg sm:rounded-xl flex items-center justify-center ${colorClasses[stat.color]}`}>
                    <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                  </div>
                  <div className={`flex items-center gap-0.5 text-xs sm:text-sm font-medium ${
                    stat.trendUp ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {stat.trendUp ? (
                      <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                    {stat.trend}
                  </div>
                </div>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-0.5 sm:mb-1">
                  {loading ? '...' : stat.value}
                </p>
                <p className="text-[10px] sm:text-xs lg:text-sm text-text-tertiary">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* SESSION INTELLIGENCE CARD */}
        <SessionIntelligenceCard />

        {/* IN-PERSON SESSIONS MONITORING */}
        <InPersonSessionsCard />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
              <div className="p-3 sm:p-4 lg:p-6 border-b border-border/50">
                <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-white">Quick Actions</h2>
                <p className="text-xs text-text-tertiary mt-0.5">Common tasks</p>
              </div>
              <div className="p-2 sm:p-3 lg:p-4 space-y-1 sm:space-y-2">
                {quickActions.map((action, index) => {
                  const colorClasses: Record<string, string> = {
                    blue: 'bg-white/[0.08] text-gray-300 group-hover:bg-white/[0.12] group-hover:text-white',
                    emerald: 'bg-white/[0.08] text-gray-300 group-hover:bg-white/[0.12] group-hover:text-white',
                    violet: 'bg-white/[0.08] text-gray-300 group-hover:bg-white/[0.12] group-hover:text-white',
                    amber: 'bg-white/[0.08] text-gray-300 group-hover:bg-white/[0.12] group-hover:text-white',
                  };

                  return (
                    <Link
                      key={index}
                      href={action.href}
                      className="group flex items-center gap-2.5 sm:gap-3 lg:gap-4 p-2.5 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl hover:bg-surface-2 transition-all"
                    >
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${colorClasses[action.color]}`}>
                        <action.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <span className="flex-1 text-sm sm:text-base font-medium text-text-secondary group-hover:text-white truncate">
                        {action.label}
                      </span>
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-text-tertiary group-hover:text-text-secondary group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Session Stats */}
            <div className="bg-surface-1 rounded-xl sm:rounded-2xl border border-border mt-3 sm:mt-4 lg:mt-6 overflow-hidden">
              <div className="p-3 sm:p-4 lg:p-6 border-b border-border/50">
                <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-white">Sessions</h2>
                <p className="text-xs text-text-tertiary mt-0.5">Coaching overview</p>
              </div>
              <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/[0.08] rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-medium text-white">Upcoming</p>
                      <p className="text-[10px] sm:text-xs text-text-tertiary">Next 7 days</p>
                    </div>
                  </div>
                  <span className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                    {loading ? '...' : stats.upcomingSessions}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                      <Target className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-medium text-white">Completed</p>
                      <p className="text-[10px] sm:text-xs text-text-tertiary">This month</p>
                    </div>
                  </div>
                  <span className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                    {loading ? '...' : stats.completedSessions}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Enrollments */}
          <div className="lg:col-span-2">
            <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden h-full">
              <div className="p-3 sm:p-4 lg:p-6 border-b border-border/50 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-white">Recent Enrollments</h2>
                  <p className="text-xs text-text-tertiary mt-0.5">Latest enrollments</p>
                </div>
                <Link
                  href="/admin/enrollments"
                  className="text-xs sm:text-sm font-medium text-gray-300 hover:text-white flex items-center gap-1 flex-shrink-0"
                >
                  View All
                  <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
                    <div key={index} className="p-3 sm:p-4 hover:bg-surface-2 transition-colors">
                      <div className="flex items-center gap-2.5 sm:gap-4">
                        <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white/[0.08] rounded-full flex items-center justify-center text-white text-sm sm:text-base font-semibold flex-shrink-0">
                          {enrollment.childName?.charAt(0) || 'C'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:text-base font-medium text-white truncate">{enrollment.childName}</p>
                          <p className="text-xs text-text-tertiary truncate">
                            {enrollment.parentName} <span className="hidden sm:inline">• {enrollment.parentEmail}</span>
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm sm:text-base font-semibold text-white">₹{enrollment.amount}</p>
                          <p className="text-[10px] sm:text-xs text-text-tertiary">
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
