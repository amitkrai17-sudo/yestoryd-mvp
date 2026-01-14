// app/coach/sessions/page.tsx
// Coach Sessions Page - HARDENED VERSION
// Full TypeScript, proper types, constants, error handling
'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { SessionCompleteForm, PreSessionBrief } from '@/components/coach';
import { ParentUpdateButton } from '@/components/coach/ParentUpdateButton';
import { RescheduleModal } from '@/components/shared';
import type { RescheduleSession } from '@/components/shared';
import {
  Calendar,
  Clock,
  Video,
  User,
  Filter,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  Ban,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
// ============================================================
// CONSTANTS
// ============================================================
const SESSION_STATUS = {
  SCHEDULED: 'scheduled',
  PENDING: 'pending',
  COMPLETED: 'completed',
  MISSED: 'missed',
  RESCHEDULED: 'rescheduled',
  CANCELLED: 'cancelled',
} as const;
const UNRESOLVED_STATUSES = [SESSION_STATUS.SCHEDULED, SESSION_STATUS.PENDING] as const;
const FILTER_OPTIONS = [
  { value: 'all', label: 'All Sessions' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'missed', label: 'Missed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
// ============================================================
// TYPES
// ============================================================
interface Coach {
  id: string;
  name: string;
  email: string;
  photo_url: string | null;
  specialization: string | null;
}
interface Session {
  id: string;
  child_id: string;
  child_name: string;
  child_age: number;
  parent_name: string;
  parent_phone?: string;
  scheduled_date: string;
  scheduled_time: string;
  session_type: string;
  session_number: number | null;
  status: string;
  google_meet_link: string | null;
  has_notes: boolean;
  assessment_score: number | null;
  last_session_summary: string | null;
  last_session_date: string | null;
  last_session_focus: string | null;
  favorite_topics: string[];
  learning_style: string | null;
  challenges: string[];
  motivators: string[];
  sessions_completed: number;
  total_sessions: number;
  parent_update_sent_at?: string | null;
}
type FilterValue = typeof FILTER_OPTIONS[number]['value'];
type ViewMode = 'list' | 'calendar';
// ============================================================
// HELPER FUNCTIONS
// ============================================================
function isUnresolvedStatus(status: string): boolean {
  return UNRESOLVED_STATUSES.includes(status as typeof UNRESOLVED_STATUSES[number]);
}
function canCompleteSession(
  session: Session,
  allSessions: Session[]
): { allowed: boolean; blockedBy: number | null } {
  if (!session.session_number) {
    return { allowed: true, blockedBy: null };
  }
  const childSessions = allSessions.filter((s) => s.child_id === session.child_id);
  const previousUnresolved = childSessions.find(
    (s) =>
      s.session_number !== null &&
      s.session_number < session.session_number! &&
      isUnresolvedStatus(s.status)
  );
  if (previousUnresolved) {
    return { allowed: false, blockedBy: previousUnresolved.session_number };
  }
  return { allowed: true, blockedBy: null };
}
function isUpcoming(dateStr: string): boolean {
  const sessionDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sessionDate >= today;
}
function isToday(dateStr: string): boolean {
  const sessionDate = new Date(dateStr);
  const today = new Date();
  return (
    sessionDate.getDate() === today.getDate() &&
    sessionDate.getMonth() === today.getMonth() &&
    sessionDate.getFullYear() === today.getFullYear()
  );
}
function isSessionPast(dateStr: string): boolean {
  const sessionDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sessionDate < today;
}
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}
function getStatusBadgeConfig(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case SESSION_STATUS.COMPLETED:
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Completed' };
    case SESSION_STATUS.CANCELLED:
      return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelled' };
    case SESSION_STATUS.MISSED:
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Missed' };
    case SESSION_STATUS.RESCHEDULED:
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Rescheduled' };
    case SESSION_STATUS.PENDING:
    case SESSION_STATUS.SCHEDULED:
    default:
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Scheduled' };
  }
}
function getDaysInMonth(date: Date): number[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: number[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  return days;
}
function sessionToRescheduleSession(session: Session): RescheduleSession {
  return {
    id: session.id,
    child_name: session.child_name,
    session_number: session.session_number,
    scheduled_date: session.scheduled_date,
    scheduled_time: session.scheduled_time,
  };
}
// ============================================================
// STATUS BADGE COMPONENT
// ============================================================
function StatusBadge({ status }: { status: string }) {
  const config = getStatusBadgeConfig(status);
  return (
    <span className={`${config.bg} ${config.text} px-2.5 py-1 rounded-full text-xs font-medium`}>
      {config.label}
    </span>
  );
}
// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CoachSessionsPage() {
  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  // UI state
  const [view, setView] = useState<ViewMode>('list');
  const [filterStatus, setFilterStatus] = useState<FilterValue>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // Modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showPrepModal, setShowPrepModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showMissedConfirm, setShowMissedConfirm] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  // Action state
  const [markingMissed, setMarkingMissed] = useState<string | null>(null);
  const [missedReason, setMissedReason] = useState('');
  // Cancel state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  // ============================================================
  // DATA LOADING
  // ============================================================
  const loadSessions = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/coach/sessions');
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/coach/login';
          return;
        }
        throw new Error('Failed to fetch sessions');
      }
      const data = await response.json();
      if (!data.coach) {
        window.location.href = '/coach/login';
        return;
      }
      setCoach(data.coach);
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);
  // ============================================================
  // COMPUTED VALUES
  // ============================================================
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'upcoming') return isUpcoming(s.scheduled_date) && isUnresolvedStatus(s.status);
      if (filterStatus === 'completed') return s.status === SESSION_STATUS.COMPLETED;
      if (filterStatus === 'missed') return s.status === SESSION_STATUS.MISSED;
      if (filterStatus === 'today') return isToday(s.scheduled_date);
      return s.status === filterStatus;
    });
  }, [sessions, filterStatus]);
  const groupedSessions = useMemo(() => {
    return filteredSessions.reduce((groups: Record<string, Session[]>, session) => {
      const date = session.scheduled_date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(session);
      return groups;
    }, {});
  }, [filteredSessions]);
  const stats = useMemo(() => ({
    today: sessions.filter((s) => isToday(s.scheduled_date)).length,
    thisWeek: sessions.filter((s) => {
      const date = new Date(s.scheduled_date);
      const today = new Date();
      const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      return date >= today && date <= weekEnd;
    }).length,
    completed: sessions.filter((s) => s.status === SESSION_STATUS.COMPLETED).length,
    missed: sessions.filter((s) => s.status === SESSION_STATUS.MISSED).length,
    upcoming: sessions.filter((s) => isUpcoming(s.scheduled_date) && isUnresolvedStatus(s.status)).length,
  }), [sessions]);
  // ============================================================
  // HANDLERS
  // ============================================================
  const openCompleteModal = useCallback((session: Session) => {
    const canComplete = canCompleteSession(session, sessions);
    if (!canComplete.allowed) {
      alert(`Please resolve Session ${canComplete.blockedBy} first (mark as completed, missed, or reschedule).`);
      return;
    }
    setSelectedSession(session);
    setShowCompleteModal(true);
  }, [sessions]);
  const openPrepModal = useCallback((session: Session) => {
    setSelectedSession(session);
    setShowPrepModal(true);
  }, []);
  const openRescheduleModal = useCallback((session: Session) => {
    setSelectedSession(session);
    setShowRescheduleModal(true);
  }, []);
  const openMissedConfirm = useCallback((session: Session) => {
    setSelectedSession(session);
    setMissedReason('');
    setShowMissedConfirm(true);
  }, []);
  const openCancelConfirm = useCallback((session: Session) => {
    setSelectedSession(session);
    setCancelReason('');
    setShowCancelConfirm(true);
  }, []);
  const handleMarkMissed = useCallback(async () => {
    if (!selectedSession) return;
    setMarkingMissed(selectedSession.id);
    try {
      const response = await fetch(`/api/sessions/${selectedSession.id}/missed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: missedReason || 'No-show',
          missedBy: 'parent',
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to mark session as missed');
      }
      await loadSessions();
      setShowMissedConfirm(false);
      setSelectedSession(null);
      setMissedReason('');
    } catch (err) {
      console.error('Error marking missed:', err);
      alert(err instanceof Error ? err.message : 'Failed to mark session as missed');
    } finally {
      setMarkingMissed(null);
    }
  }, [selectedSession, missedReason, loadSessions]);
  const handleCancelSession = useCallback(async () => {
    if (!selectedSession) return;
    setCancelling(selectedSession.id);
    try {
      const response = await fetch(`/api/sessions/${selectedSession.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason || 'Cancelled by coach',
          cancelledBy: 'coach',
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel session');
      }
      await loadSessions();
      setShowCancelConfirm(false);
      setSelectedSession(null);
      setCancelReason('');
    } catch (err) {
      console.error('Error cancelling:', err);
      alert(err instanceof Error ? err.message : 'Failed to cancel session');
    } finally {
      setCancelling(null);
    }
  }, [selectedSession, cancelReason, loadSessions]);
  const handleRescheduleComplete = useCallback(() => {
    setShowRescheduleModal(false);
    setSelectedSession(null);
    loadSessions();
  }, [loadSessions]);
  const handleCompleteSuccess = useCallback(() => {
    setShowCompleteModal(false);
    setSelectedSession(null);
    loadSessions();
  }, [loadSessions]);
  // ============================================================
  // CALENDAR NAVIGATION
  // ============================================================
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  const getSessionsForDay = (day: number): Session[] => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return sessions.filter((s) => s.scheduled_date === dateStr);
  };
  // ============================================================
  // RENDER
  // ============================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF0099]" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg mb-4">{error}</p>
          <button
            onClick={loadSessions}
            className="px-4 py-2 bg-[#FF0099] text-white rounded-xl hover:bg-[#FF0099]/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Sessions</h1>
              <p className="text-gray-400 text-sm mt-1">
                {stats.today} today â€¢ {stats.upcoming} upcoming â€¢ {stats.completed} completed
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-800 rounded-xl p-1">
                <button
                  onClick={() => setView('list')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    view === 'list' ? 'bg-[#00ABFF] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setView('calendar')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    view === 'calendar' ? 'bg-[#00ABFF] text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Calendar
                </button>
              </div>
              {/* Filter */}
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterValue)}
                  className="appearance-none bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#00ABFF]"
                >
                  {FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Filter className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* List View */}
        {view === 'list' && (
          <div className="space-y-6">
            {Object.keys(groupedSessions).length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No sessions found</p>
              </div>
            ) : (
              Object.entries(groupedSessions)
                .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                .map(([date, daySessions]) => (
                  <div key={date} className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden">
                    <div className="bg-gray-800 px-5 py-3 border-b border-gray-700">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#FF0099]" />
                        <span className="text-white font-medium">{formatDate(date)}</span>
                        <span className="text-gray-500 text-sm">
                          ({daySessions.length} session{daySessions.length !== 1 ? 's' : ''})
                        </span>
                        {isToday(date) && (
                          <span className="bg-[#00ABFF] text-white text-xs px-2 py-0.5 rounded-full">
                            Today
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="divide-y divide-gray-700/50">
                      {daySessions
                        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                        .map((session) => {
                          const canComplete = canCompleteSession(session, sessions);
                          const isPast = isSessionPast(session.scheduled_date);
                          const isPending = isUnresolvedStatus(session.status);
                          return (
                            <div key={session.id} className="p-5 hover:bg-gray-700/30 transition-colors">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  <div className="text-center min-w-[60px]">
                                    <p className="text-white font-semibold">{formatTime(session.scheduled_time)}</p>
                                    {session.session_number && (
                                      <p className="text-gray-500 text-xs">#{session.session_number}</p>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-white font-medium text-lg">{session.child_name}</p>
                                      <StatusBadge status={session.status} />
                                      {session.has_notes && (
                                        <span title="Has notes">
                                          <FileText className="w-4 h-4 text-yellow-400" />
                                        </span>
                                      )}
                                      {isPending && !canComplete.allowed && (
                                        <span title={`Complete Session ${canComplete.blockedBy} first`}>
                                          <Lock className="w-4 h-4 text-gray-500" />
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-gray-400 text-sm mt-0.5">{session.session_type}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-[60px] sm:ml-0 flex-wrap">
                                  {isPending && (
                                    <>
                                      <button
                                        onClick={() => openPrepModal(session)}
                                        className="flex items-center gap-1.5 bg-[#00ABFF] text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-[#00ABFF]/80 transition-colors"
                                      >
                                        <FileText className="w-4 h-4" />
                                        Prep
                                      </button>
                                      {isPast && (
                                        <button
                                          onClick={() => openMissedConfirm(session)}
                                          disabled={markingMissed === session.id}
                                          className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                                        >
                                          <Ban className="w-4 h-4" />
                                          Missed
                                        </button>
                                      )}
                                      <button
                                        onClick={() => openRescheduleModal(session)}
                                        className="flex items-center gap-1.5 bg-yellow-500 text-black px-3 py-2 rounded-xl text-sm font-medium hover:bg-yellow-400 transition-colors"
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                        Reschedule
                                      </button>
                                      <button
                                        onClick={() => openCancelConfirm(session)}
                                        disabled={cancelling === session.id}
                                        className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                                      >
                                        <XCircle className="w-4 h-4" />
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => openCompleteModal(session)}
                                        disabled={!canComplete.allowed}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                                          canComplete.allowed
                                            ? 'bg-purple-500 text-white hover:bg-purple-600'
                                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                        }`}
                                        title={canComplete.allowed ? 'Complete session' : `Complete Session ${canComplete.blockedBy} first`}
                                      >
                                        {canComplete.allowed ? <CheckCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                        Complete
                                      </button>
                                      {session.google_meet_link && (
                                        <a
                                          href={session.google_meet_link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-[#25D366]/90 transition-colors"
                                        >
                                          <Video className="w-4 h-4" />
                                          Join
                                        </a>
                                      )}
                                    </>
                                  )}
                                  {session.status === 'completed' && coach && (
                                    <ParentUpdateButton
                                      session={{
                                        id: session.id,
                                        scheduled_time: `${session.scheduled_date}T${session.scheduled_time}`,
                                        status: session.status,
                                        parent_update_sent_at: session.parent_update_sent_at || null,
                                        child: {
                                          id: session.child_id,
                                          child_name: session.child_name,
                                          parent_phone: session.parent_phone || '',
                                          parent_name: session.parent_name,
                                        }
                                      }}
                                      coachEmail={coach.email}
                                    />
                                  )}
                                  <Link
                                    href={`/coach/students/${session.child_id}`}
                                    className="p-2 bg-gray-700 text-gray-400 rounded-xl hover:bg-gray-600 hover:text-white transition-colors"
                                    title="View Student"
                                  >
                                    <User className="w-5 h-5" />
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
        {/* Calendar View */}
        {view === 'calendar' && (
          <div className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
              <h3 className="text-white font-semibold">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {/* Calendar Grid */}
            <div className="p-4">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div key={day} className="text-center text-gray-500 text-sm font-medium py-2">
                    {day}
                  </div>
                ))}
              </div>
              {/* Days */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for days before the first of the month */}
                {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {/* Days of the month */}
                {getDaysInMonth(currentMonth).map((day) => {
                  const daySessions = getSessionsForDay(day);
                  const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isCurrentDay = isToday(dateStr);
                  return (
                    <div
                      key={day}
                      className={`aspect-square p-1 rounded-lg border transition-colors ${
                        isCurrentDay
                          ? 'border-[#00ABFF] bg-[#00ABFF]/10'
                          : daySessions.length > 0
                          ? 'border-gray-600 bg-gray-700/30 hover:bg-gray-700/50'
                          : 'border-transparent'
                      }`}
                    >
                      <div className="text-xs text-gray-400 mb-0.5">{day}</div>
                      <div className="space-y-0.5 overflow-y-auto max-h-16">
                        {daySessions.slice(0, 3).map((session) => {
                          const config = getStatusBadgeConfig(session.status);
                          return (
                            <div
                              key={session.id}
                              className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${config.bg} ${config.text}`}
                              onClick={() => isUnresolvedStatus(session.status) && openCompleteModal(session)}
                            >
                              {formatTime(session.scheduled_time)} {session.child_name}
                            </div>
                          );
                        })}
                        {daySessions.length > 3 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{daySessions.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Modals */}
      {showCompleteModal && selectedSession && (
        <SessionCompleteForm
          sessionId={selectedSession.id}
          childId={selectedSession.child_id}
          childName={selectedSession.child_name}
          childAge={selectedSession.child_age}
          sessionTitle={`Session ${selectedSession.session_number || ''} - ${selectedSession.session_type}`}
          coachId={coach?.id || ''}
          onClose={() => {
            setShowCompleteModal(false);
            setSelectedSession(null);
          }}
          onComplete={handleCompleteSuccess}
        />
      )}
      {showPrepModal && selectedSession && (
        <PreSessionBrief
          session={selectedSession}
          onClose={() => {
            setShowPrepModal(false);
            setSelectedSession(null);
          }}
        />
      )}
      {showRescheduleModal && selectedSession && (
        <RescheduleModal
          isOpen={showRescheduleModal}
          session={sessionToRescheduleSession(selectedSession)}
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedSession(null);
          }}
          onSuccess={handleRescheduleComplete}
        />
      )}
      {/* Missed Confirmation Modal */}
      {showMissedConfirm && selectedSession && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">Mark as Missed?</h3>
            <p className="text-gray-400 mb-4">
              Mark {selectedSession.child_name}&apos;s Session #{selectedSession.session_number} as missed?
            </p>
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Reason (optional)</label>
              <select
                value={missedReason}
                onChange={(e) => setMissedReason(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Select reason...</option>
                <option value="Parent no-show">Parent no-show</option>
                <option value="Child unwell">Child unwell</option>
                <option value="Technical issues">Technical issues</option>
                <option value="Last-minute cancellation">Last-minute cancellation</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMissedConfirm(false);
                  setSelectedSession(null);
                  setMissedReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkMissed}
                disabled={markingMissed === selectedSession.id}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {markingMissed === selectedSession.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    Mark Missed
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && selectedSession && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">Cancel Session?</h3>
            <p className="text-gray-400 mb-4">
              Cancel {selectedSession.child_name}&apos;s Session #{selectedSession.session_number}? This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Reason (required)</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select reason...</option>
                <option value="Parent requested">Parent requested</option>
                <option value="Coach unavailable">Coach unavailable</option>
                <option value="Child dropped out">Child dropped out</option>
                <option value="Schedule conflict">Schedule conflict</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  setSelectedSession(null);
                  setCancelReason('');
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleCancelSession}
                disabled={cancelling === selectedSession.id || !cancelReason}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling === selectedSession.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Cancel Session
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



