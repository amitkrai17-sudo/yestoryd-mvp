// app/coach/sessions/page.tsx
// Coach Sessions Page - Clean, Professional Design
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import CoachLayout from '@/components/layouts/CoachLayout';
import { PreSessionBrief, SessionCard } from '@/components/coach';
import { ParentUpdateButton } from '@/components/coach/ParentUpdateButton';
// Structured capture form (v3.0) with intelligence scoring
import StructuredCaptureForm from '@/components/coach/structured-capture';
import { RescheduleModal } from '@/components/shared';
import type { RescheduleSession } from '@/components/shared';
import { RequestOfflineModal } from '@/components/coach/RequestOfflineModal';
import {
  Calendar,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Users,
  CheckCircle,
  Clock,
  CalendarDays,
} from 'lucide-react';
import { getStatusConfig } from '@/components/coach/StatusBadge';

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
] as const;

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAYS_OF_WEEK_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

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
  duration_minutes: number | null;
  is_diagnostic: boolean;
  parent_update_sent_at?: string | null;
  // Offline fields
  session_mode?: string;
  offline_request_status?: string | null;
  report_submitted_at?: string | null;
  report_deadline?: string | null;
  enrollment_id?: string | null;
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
  const [filterStatus, setFilterStatus] = useState<FilterValue>('upcoming');
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

  // Offline request state
  const [showOfflineModal, setShowOfflineModal] = useState(false);

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
    today: sessions.filter((s) => isToday(s.scheduled_date) && isUnresolvedStatus(s.status)).length,
    thisWeek: sessions.filter((s) => {
      const date = new Date(s.scheduled_date);
      const today = new Date();
      const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      return date >= today && date <= weekEnd && isUnresolvedStatus(s.status);
    }).length,
    completed: sessions.filter((s) => s.status === SESSION_STATUS.COMPLETED).length,
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

  const openOfflineModal = useCallback((session: Session) => {
    setSelectedSession(session);
    setShowOfflineModal(true);
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
      <CoachLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00ABFF] mx-auto mb-4" />
            <p className="text-text-tertiary">Loading sessions...</p>
          </div>
        </div>
      </CoachLayout>
    );
  }

  if (error) {
    return (
      <CoachLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-white text-lg mb-4">{error}</p>
            <button
              onClick={loadSessions}
              className="px-4 py-2 bg-[#00ABFF] text-white rounded-lg hover:bg-[#00ABFF]/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </CoachLayout>
    );
  }

  return (
    <CoachLayout>
      <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:gap-4">
        <div>
          <h1 className="text-lg lg:text-2xl font-bold text-white flex items-center gap-2 lg:gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-500/20 rounded-lg lg:rounded-xl flex items-center justify-center">
              <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-purple-400" />
            </div>
            Sessions
          </h1>
          <p className="text-xs lg:text-sm text-text-tertiary mt-0.5 lg:mt-1">Manage your coaching sessions</p>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-surface-1 rounded-lg p-0.5 lg:p-1">
            <button
              onClick={() => setView('list')}
              className={`px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-md text-xs lg:text-sm font-medium transition-colors ${
                view === 'list' ? 'bg-[#00ABFF] text-white' : 'text-text-tertiary hover:text-white'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-md text-xs lg:text-sm font-medium transition-colors ${
                view === 'calendar' ? 'bg-[#00ABFF] text-white' : 'text-text-tertiary hover:text-white'
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
              className="appearance-none bg-surface-1 text-white border border-border rounded-lg px-2.5 lg:px-4 py-1.5 lg:py-2 pr-7 lg:pr-8 text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-[#00ABFF] focus:border-transparent"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-text-tertiary absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
        <div className="bg-surface-1 border border-border rounded-xl p-2.5 lg:p-4">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-[#00ABFF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 lg:w-5 lg:h-5 text-[#00ABFF]" />
            </div>
            <div className="min-w-0">
              <p className="text-lg lg:text-2xl font-bold text-white">{stats.today}</p>
              <p className="text-text-tertiary text-[10px] lg:text-sm">Today</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-xl p-2.5 lg:p-4">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-[#00ABFF]/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-4 h-4 lg:w-5 lg:h-5 text-[#00ABFF]" />
            </div>
            <div className="min-w-0">
              <p className="text-lg lg:text-2xl font-bold text-white">{stats.thisWeek}</p>
              <p className="text-text-tertiary text-[10px] lg:text-sm">This Week</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-xl p-2.5 lg:p-4">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 lg:w-5 lg:h-5 text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg lg:text-2xl font-bold text-white">{stats.completed}</p>
              <p className="text-text-tertiary text-[10px] lg:text-sm">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-xl p-2.5 lg:p-4">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 lg:w-5 lg:h-5 text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg lg:text-2xl font-bold text-white">{stats.upcoming}</p>
              <p className="text-text-tertiary text-[10px] lg:text-sm">Upcoming</p>
            </div>
          </div>
        </div>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-4 lg:space-y-6">
          {Object.keys(groupedSessions).length === 0 ? (
            <div className="bg-surface-1 border border-border rounded-xl p-8 lg:p-12 text-center">
              <div className="w-12 h-12 lg:w-16 lg:h-16 bg-surface-2 rounded-xl lg:rounded-2xl flex items-center justify-center mx-auto mb-3 lg:mb-4">
                <Calendar className="w-6 h-6 lg:w-8 lg:h-8 text-text-tertiary" />
              </div>
              <h3 className="text-white text-base lg:text-lg font-medium mb-2">No sessions found</h3>
              <p className="text-text-tertiary text-sm mb-4">
                {filterStatus === 'upcoming'
                  ? 'No upcoming sessions scheduled'
                  : 'Try adjusting your filters'}
              </p>
              <Link
                href="/coach/students"
                className="inline-flex items-center gap-2 text-[#00ABFF] text-sm hover:underline"
              >
                <Users className="w-4 h-4" />
                View Students
              </Link>
            </div>
          ) : (
            Object.entries(groupedSessions)
              .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
              .map(([date, daySessions]) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="sticky top-0 z-10 bg-surface-0 py-2 mb-2 lg:mb-3">
                    <div className="flex items-center gap-2 lg:gap-3">
                      <h2 className="text-white text-sm lg:text-base font-semibold">{formatDate(date)}</h2>
                      <span className="text-text-tertiary text-xs lg:text-sm">
                        ({daySessions.length})
                      </span>
                      {isToday(date) && (
                        <span className="bg-[#00ABFF]/20 text-[#00ABFF] text-[10px] lg:text-xs px-1.5 lg:px-2 py-0.5 rounded-full border border-[#00ABFF]/30">
                          Today
                        </span>
                      )}
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  </div>

                  {/* Sessions */}
                  <div className="space-y-2 lg:space-y-3">
                    {daySessions
                      .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                      .map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          isPast={isSessionPast(session.scheduled_date)}
                          isToday={isToday(session.scheduled_date)}
                          canComplete={canCompleteSession(session, sessions)}
                          onPrep={() => openPrepModal(session)}
                          onComplete={() => openCompleteModal(session)}
                          onReschedule={() => openRescheduleModal(session)}
                          onCancel={() => openCancelConfirm(session)}
                          onMissed={() => openMissedConfirm(session)}
                          onRequestOffline={() => openOfflineModal(session)}
                          coachEmail={coach?.email}
                        />
                      ))}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-3 lg:p-4 border-b border-border">
            <button
              onClick={prevMonth}
              className="p-1.5 lg:p-2 hover:bg-surface-2 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5 text-text-tertiary" />
            </button>
            <h3 className="text-white text-sm lg:text-base font-semibold">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={nextMonth}
              className="p-1.5 lg:p-2 hover:bg-surface-2 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-text-tertiary" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="p-2 lg:p-4">
            {/* Day Headers - Single letters on mobile, full on desktop */}
            <div className="grid grid-cols-7 gap-0.5 lg:gap-1 mb-1 lg:mb-2">
              {DAYS_OF_WEEK.map((day, index) => (
                <div key={day} className="text-center text-text-tertiary text-[10px] lg:text-sm font-medium py-1 lg:py-2">
                  <span className="lg:hidden">{DAYS_OF_WEEK_SHORT[index]}</span>
                  <span className="hidden lg:inline">{day}</span>
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-0.5 lg:gap-1">
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
                    className={`aspect-square p-0.5 lg:p-1 rounded-md lg:rounded-lg border transition-colors ${
                      isCurrentDay
                        ? 'border-[#00ABFF] bg-[#00ABFF]/10'
                        : daySessions.length > 0
                        ? 'border-border bg-surface-1/30 hover:bg-surface-1/50'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="text-[10px] lg:text-xs text-text-tertiary mb-0.5">{day}</div>
                    {/* Mobile: just show dot indicators */}
                    <div className="lg:hidden flex flex-wrap gap-0.5 justify-center">
                      {daySessions.length > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00ABFF]" />
                      )}
                      {daySessions.length > 1 && (
                        <span className="text-[8px] text-text-tertiary">+{daySessions.length - 1}</span>
                      )}
                    </div>
                    {/* Desktop: show session details */}
                    <div className="hidden lg:block space-y-0.5 overflow-y-auto max-h-16">
                      {daySessions.slice(0, 3).map((session) => {
                        const config = getStatusConfig(session.status);
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
                        <div className="text-xs text-text-tertiary text-center">
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

      {/* Modals */}
      {showCompleteModal && selectedSession && coach && (
        <StructuredCaptureForm
          sessionId={selectedSession.id}
          childId={selectedSession.child_id}
          childName={selectedSession.child_name}
          childAge={selectedSession.child_age}
          coachId={coach.id}
          sessionNumber={selectedSession.session_number || 1}
          modality="online_1on1"
          onClose={() => {
            setShowCompleteModal(false);
            setSelectedSession(null);
          }}
          onComplete={async (result) => {
            try {
              // Mark session as completed
              const res = await fetch(`/api/coach/sessions/${selectedSession.id}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  status: 'completed',
                  completedAt: new Date().toISOString(),
                  captureId: result.captureId,
                  intelligenceScore: result.intelligenceScore,
                }),
              });
              if (!res.ok) {
                console.error('Failed to complete session:', await res.text());
              }
            } catch (err) {
              console.error('Error completing session:', err);
            }
            handleCompleteSuccess();
          }}
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
          coachId={coach?.id}
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedSession(null);
          }}
          onSuccess={handleRescheduleComplete}
        />
      )}

      {/* Missed Confirmation Modal */}
      {showMissedConfirm && selectedSession && (
        <div className="fixed inset-0 bg-black/70 flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
          <div className="bg-surface-1 rounded-t-2xl lg:rounded-xl max-w-md w-full p-4 lg:p-6 border border-border">
            <h3 className="text-lg lg:text-xl font-bold text-white mb-3 lg:mb-4">Mark as Missed?</h3>
            <p className="text-text-tertiary text-sm lg:text-base mb-3 lg:mb-4">
              Mark {selectedSession.child_name}&apos;s Session #{selectedSession.session_number} as missed?
            </p>
            <div className="mb-4">
              <label className="block text-text-tertiary text-xs lg:text-sm mb-2">Reason (optional)</label>
              <select
                value={missedReason}
                onChange={(e) => setMissedReason(e.target.value)}
                className="w-full bg-surface-0 text-white border border-border rounded-lg px-3 lg:px-4 py-2 lg:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">Select reason...</option>
                <option value="Parent no-show">Parent no-show</option>
                <option value="Child unwell">Child unwell</option>
                <option value="Technical issues">Technical issues</option>
                <option value="Last-minute cancellation">Last-minute cancellation</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex gap-2 lg:gap-3">
              <button
                onClick={() => {
                  setShowMissedConfirm(false);
                  setSelectedSession(null);
                  setMissedReason('');
                }}
                className="flex-1 px-3 lg:px-4 py-2.5 bg-surface-2 text-white text-sm rounded-lg hover:bg-surface-3 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkMissed}
                disabled={markingMissed === selectedSession.id}
                className="flex-1 px-3 lg:px-4 py-2.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {markingMissed === selectedSession.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Mark Missed'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Offline Modal */}
      {showOfflineModal && selectedSession && (
        <RequestOfflineModal
          isOpen={showOfflineModal}
          session={{
            id: selectedSession.id,
            child_name: selectedSession.child_name,
            session_number: selectedSession.session_number,
            scheduled_date: selectedSession.scheduled_date,
            scheduled_time: selectedSession.scheduled_time,
            enrollment_id: selectedSession.enrollment_id ?? null,
          }}
          onClose={() => {
            setShowOfflineModal(false);
            setSelectedSession(null);
          }}
          onSuccess={() => {
            setShowOfflineModal(false);
            setSelectedSession(null);
            loadSessions();
          }}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && selectedSession && (
        <div className="fixed inset-0 bg-black/70 flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
          <div className="bg-surface-1 rounded-t-2xl lg:rounded-xl max-w-md w-full p-4 lg:p-6 border border-border">
            <h3 className="text-lg lg:text-xl font-bold text-white mb-3 lg:mb-4">Cancel Session?</h3>
            <p className="text-text-tertiary text-sm lg:text-base mb-3 lg:mb-4">
              Cancel {selectedSession.child_name}&apos;s Session #{selectedSession.session_number}? This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-text-tertiary text-xs lg:text-sm mb-2">Reason (required)</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-surface-0 text-white border border-border rounded-lg px-3 lg:px-4 py-2 lg:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">Select reason...</option>
                <option value="Parent requested">Parent requested</option>
                <option value="Coach unavailable">Coach unavailable</option>
                <option value="Child dropped out">Child dropped out</option>
                <option value="Schedule conflict">Schedule conflict</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex gap-2 lg:gap-3">
              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  setSelectedSession(null);
                  setCancelReason('');
                }}
                className="flex-1 px-3 lg:px-4 py-2.5 bg-surface-2 text-white text-sm rounded-lg hover:bg-surface-3 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleCancelSession}
                disabled={cancelling === selectedSession.id || !cancelReason}
                className="flex-1 px-3 lg:px-4 py-2.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling === selectedSession.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </CoachLayout>
  );
}
