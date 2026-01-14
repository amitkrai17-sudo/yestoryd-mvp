// app/coach/sessions/page.tsx
// Coach Sessions Page - HARDENED VERSION
// Full TypeScript, proper types, constants, error handling

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { SessionCompleteForm, PreSessionBrief } from '@/components/coach';
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

function isSessionPast(scheduledDate: string): boolean {
  const sessionDate = new Date(scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sessionDate < today;
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr >= today;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  try {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    if (isNaN(hour)) return timeStr;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
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
    case SESSION_STATUS.SCHEDULED:
      return { bg: 'bg-[#00ABFF]/20', text: 'text-[#00ABFF]', label: 'Scheduled' };
    default:
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending' };
  }
}

function getDaysInMonth(date: Date): (number | null)[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }
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

  const handleSessionCompleted = useCallback(() => {
    loadSessions();
    setShowCompleteModal(false);
    setSelectedSession(null);
  }, [loadSessions]);

  const handleRescheduleSuccess = useCallback(() => {
    loadSessions();
  }, [loadSessions]);

  const handleMarkMissed = useCallback(async () => {
    if (!selectedSession) return;

    setMarkingMissed(selectedSession.id);
    try {
      const response = await fetch('/api/sessions/missed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          reason: missedReason || 'No-show',
          notifyParent: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to mark session as missed');
        return;
      }

      loadSessions();
      setShowMissedConfirm(false);
      setSelectedSession(null);
      setMissedReason('');
    } catch (err) {
      console.error('Error marking missed:', err);
      alert('Failed to mark session as missed');
    } finally {
      setMarkingMissed(null);
    }
  }, [selectedSession, missedReason, loadSessions]);

  const handleCancel = useCallback(async () => {
    if (!selectedSession) return;

    setCancelling(selectedSession.id);
    try {
      const response = await fetch(`/api/sessions?sessionId=${selectedSession.id}&reason=${encodeURIComponent(cancelReason || 'Parent requested cancellation')}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to cancel session');
        return;
      }

      loadSessions();
      setShowCancelConfirm(false);
      setSelectedSession(null);
      setCancelReason('');
    } catch (err) {
      console.error('Error cancelling:', err);
      alert('Failed to cancel session');
    } finally {
      setCancelling(null);
    }
  }, [selectedSession, cancelReason, loadSessions]);

  const closeAllModals = useCallback(() => {
    setShowCompleteModal(false);
    setShowPrepModal(false);
    setShowRescheduleModal(false);
    setShowMissedConfirm(false);
    setShowCancelConfirm(false);
    setSelectedSession(null);
    setMissedReason('');
    setCancelReason('');
  }, []);

  // Calendar navigation
  const prevMonth = useCallback(() => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const getSessionsForDay = useCallback((day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return sessions.filter((s) => s.scheduled_date === dateStr);
  }, [currentMonth, sessions]);

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF0099] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button
            onClick={loadSessions}
            className="px-6 py-3 bg-[#FF0099] text-white rounded-xl font-medium hover:bg-[#FF0099]/80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!coach) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00ABFF]/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#00ABFF]" />
            </div>
            Sessions
          </h1>
          <p className="text-gray-400 mt-1">{sessions.length} total sessions</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-gray-800 rounded-xl p-1 border border-gray-700">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'list' ? 'bg-[#FF0099] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'calendar' ? 'bg-[#FF0099] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Calendar
            </button>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterValue)}
              className="bg-gray-800 border border-gray-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-[#FF0099]"
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm mb-1">Today</p>
          <p className="text-3xl font-bold text-white">{stats.today}</p>
        </div>
        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm mb-1">This Week</p>
          <p className="text-3xl font-bold text-[#00ABFF]">{stats.thisWeek}</p>
        </div>
        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm mb-1">Completed</p>
          <p className="text-3xl font-bold text-emerald-400">{stats.completed}</p>
        </div>
        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm mb-1">Missed</p>
          <p className="text-3xl font-bold text-orange-400">{stats.missed}</p>
        </div>
        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm mb-1">Upcoming</p>
          <p className="text-3xl font-bold text-purple-400">{stats.upcoming}</p>
        </div>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden">
          {Object.keys(groupedSessions).length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-400 text-lg">No sessions found</p>
              <p className="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50">
              {Object.entries(groupedSessions).map(([date, dateSessions]) => (
                <div key={date}>
                  <div className={`px-5 py-3 ${isToday(date) ? 'bg-[#FF0099]/10' : 'bg-gray-700/30'}`}>
                    <p className={`font-semibold ${isToday(date) ? 'text-[#FF0099]' : 'text-gray-300'}`}>
                      {isToday(date) ? '📅 Today - ' : ''}{formatDate(date)}
                    </p>
                  </div>
                  {dateSessions.map((session) => {
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
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-700 rounded-xl transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <h3 className="text-white font-semibold text-lg">
              {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-700 rounded-xl transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="text-center text-gray-500 text-sm py-2 font-medium">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentMonth).map((day, index) => {
                if (day === null) {
                  return <div key={index} className="h-24" />;
                }

                const daySessions = getSessionsForDay(day);
                const isCurrentDay =
                  day === new Date().getDate() &&
                  currentMonth.getMonth() === new Date().getMonth() &&
                  currentMonth.getFullYear() === new Date().getFullYear();

                return (
                  <div
                    key={index}
                    className={`h-24 border border-gray-700 rounded-lg p-1 ${
                      isCurrentDay ? 'bg-[#FF0099]/10 border-[#FF0099]' : ''
                    }`}
                  >
                    <p className={`text-xs font-medium mb-1 ${isCurrentDay ? 'text-[#FF0099]' : 'text-gray-400'}`}>
                      {day}
                    </p>
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
                        <p className="text-xs text-gray-500">+{daySessions.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Session Complete Modal */}
      {showCompleteModal && selectedSession && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <SessionCompleteForm
            sessionId={selectedSession.id}
            childId={selectedSession.child_id}
            childName={selectedSession.child_name}
            childAge={selectedSession.child_age}
            sessionTitle={selectedSession.session_type}
            coachId={coach.id}
            onComplete={handleSessionCompleted}
            onClose={() => {
              setShowCompleteModal(false);
              setSelectedSession(null);
            }}
          />
        </div>
      )}

      {/* Pre-Session Brief Modal */}
      {showPrepModal && selectedSession && (
        <PreSessionBrief
          session={selectedSession}
          onClose={() => {
            setShowPrepModal(false);
            setSelectedSession(null);
          }}
        />
      )}

      {/* Reschedule Modal (Shared Component) */}
      {selectedSession && (
        <RescheduleModal
          session={sessionToRescheduleSession(selectedSession)}
          isOpen={showRescheduleModal}
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedSession(null);
          }}
          onSuccess={handleRescheduleSuccess}
        />
      )}

      {/* Mark as Missed Confirmation Modal */}
      {showMissedConfirm && selectedSession && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#1a1f2e] rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-white mb-2">Mark Session as Missed?</h3>
            <p className="text-gray-400 mb-4">
              This will mark {selectedSession.child_name}&apos;s Session #{selectedSession.session_number || '?'} as missed (no-show).
            </p>

            <div className="mb-4">
              <label htmlFor="missed-reason" className="block text-sm text-gray-400 mb-2">
                Reason (optional)
              </label>
              <input
                id="missed-reason"
                type="text"
                value={missedReason}
                onChange={(e) => setMissedReason(e.target.value)}
                placeholder="e.g., No-show, Parent cancelled last minute"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FF0099]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeAllModals}
                className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleMarkMissed}
                disabled={markingMissed === selectedSession.id}
                className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {markingMissed === selectedSession.id ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Marking...
                  </>
                ) : (
                  'Mark as Missed'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Session Confirmation Modal */}
      {showCancelConfirm && selectedSession && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#1a1f2e] rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-white mb-2">Cancel Session?</h3>
            <p className="text-gray-400 mb-4">
              This will cancel {selectedSession.child_name}&apos;s Session #{selectedSession.session_number || '?'} and remove it from the calendar.
            </p>

            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
              <p className="text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                This action cannot be undone. The time slot will be freed up.
              </p>
            </div>

            <div className="mb-4">
              <label htmlFor="cancel-reason" className="block text-sm text-gray-400 mb-2">
                Reason for cancellation
              </label>
              <input
                id="cancel-reason"
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Parent requested, Schedule conflict"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FF0099]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeAllModals}
                className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling === selectedSession.id}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling === selectedSession.id ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Cancel Session'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}