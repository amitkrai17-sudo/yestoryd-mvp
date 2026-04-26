// app/coach/sessions/page.tsx
// Coach Sessions Page — Redesigned with sticky stats, filters, IST dates
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { PreSessionBrief, SessionCard } from '@/components/coach';
import StructuredCaptureForm from '@/components/coach/structured-capture';
import { RescheduleModal } from '@/components/shared';
import type { RescheduleSession } from '@/components/shared';
import { RequestOfflineModal } from '@/components/coach/RequestOfflineModal';
import { MicroNotePanel } from '@/components/coach/MicroNotePanel';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Users,
  CheckCircle,
  Clock,
  CalendarDays,
  X,
  Search,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Spinner } from '@/components/ui/spinner';
import { getStatusConfig } from '@/components/coach/StatusBadge';
import { formatDateShort, formatDateRelative, formatTime12 } from '@/lib/utils/date-format';

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

const DATE_FILTER_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: '7days', label: 'Last 7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All' },
] as const;

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'missed', label: 'Missed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'report_due', label: 'Report Due' },
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
  session_mode?: string;
  offline_request_status?: string | null;
  report_submitted_at?: string | null;
  report_deadline?: string | null;
  enrollment_id?: string | null;
  enrollment_type?: string | null;
  capture_id?: string | null;
  pending_capture?: { id: string; ai_prefilled: boolean } | null;
}

type DateFilterValue = typeof DATE_FILTER_OPTIONS[number]['value'];
type StatusFilterValue = typeof STATUS_FILTER_OPTIONS[number]['value'];
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
  if (!session.session_number) return { allowed: true, blockedBy: null };
  const childSessions = allSessions.filter((s) => s.child_id === session.child_id);
  const previousUnresolved = childSessions.find(
    (s) =>
      s.session_number !== null &&
      s.session_number < session.session_number! &&
      isUnresolvedStatus(s.status)
  );
  if (previousUnresolved) return { allowed: false, blockedBy: previousUnresolved.session_number };
  return { allowed: true, blockedBy: null };
}

function isUpcoming(dateStr: string): boolean {
  const sessionDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sessionDate >= today;
}

function isTodayDate(dateStr: string): boolean {
  const sessionDate = new Date(dateStr);
  const today = new Date();
  return (
    sessionDate.getDate() === today.getDate() &&
    sessionDate.getMonth() === today.getMonth() &&
    sessionDate.getFullYear() === today.getFullYear()
  );
}

function isYesterday(dateStr: string): boolean {
  const sessionDate = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    sessionDate.getDate() === yesterday.getDate() &&
    sessionDate.getMonth() === yesterday.getMonth() &&
    sessionDate.getFullYear() === yesterday.getFullYear()
  );
}

function isSessionPast(dateStr: string, timeStr?: string, durationMinutes?: number | null): boolean {
  const sessionDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // If date is before today, definitely past
  if (sessionDate < today) return true;
  // If date is today and we have time info, check if session has ended
  if (timeStr && sessionDate.getTime() === today.getTime()) {
    try {
      const start = new Date(`${dateStr}T${timeStr}`);
      const endMs = start.getTime() + (durationMinutes || 45) * 60_000;
      return Date.now() > endMs;
    } catch { return false; }
  }
  return false;
}

function isWithinDays(dateStr: string, days: number): boolean {
  const sessionDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  return sessionDate >= today && sessionDate <= end;
}

function isThisMonth(dateStr: string): boolean {
  const sessionDate = new Date(dateStr);
  const today = new Date();
  return sessionDate.getMonth() === today.getMonth() && sessionDate.getFullYear() === today.getFullYear();
}

function getDaysInMonth(date: Date): number[] {
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const days: number[] = [];
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
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
  const searchParams = useSearchParams();

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  // UI state
  const [view, setView] = useState<ViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Filter state
  const [dateFilter, setDateFilter] = useState<DateFilterValue>('week');
  const [childFilter, setChildFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [childSearch, setChildSearch] = useState('');
  const [showChildDropdown, setShowChildDropdown] = useState(false);

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

  // MicroNotes state
  const [microNotesOpen, setMicroNotesOpen] = useState(false);
  const [quickStrengths, setQuickStrengths] = useState<{ id: string; text: string }[]>([]);
  const [quickStruggles, setQuickStruggles] = useState<{ id: string; text: string }[]>([]);
  const [microNoteCount, setMicroNoteCount] = useState(0);

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

      const sessionsWithCaptures = data.sessions || [];
      if (data.coach?.id) {
        try {
          const { supabase: clientSb } = await import('@/lib/supabase/client');
          const { data: pendingCaptures } = await clientSb
            .from('structured_capture_responses')
            .select('id, session_id, ai_prefilled')
            .eq('coach_id', data.coach.id)
            .eq('coach_confirmed', false)
            .not('session_id', 'is', null);

          if (pendingCaptures?.length) {
            const captureMap = new Map(pendingCaptures.map(c => [c.session_id, c]));
            for (const s of sessionsWithCaptures) {
              const pc = captureMap.get(s.id);
              if (pc) s.pending_capture = { id: pc.id, ai_prefilled: !!pc.ai_prefilled };
            }
          }
        } catch { /* Non-fatal */ }
      }

      setSessions(sessionsWithCaptures);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Deep link: ?openCapture=sessionId
  useEffect(() => {
    const openCaptureId = searchParams.get('openCapture');
    if (openCaptureId && sessions.length > 0 && !showCompleteModal) {
      const target = sessions.find(s => s.id === openCaptureId);
      if (target) {
        setSelectedSession(target);
        setShowCompleteModal(true);
      }
    }
  }, [searchParams, sessions, showCompleteModal]);

  // Detect currently active session
  const activeSession = useMemo(() => {
    const now = Date.now();
    return sessions.find(s => {
      if (s.status === 'cancelled' || s.status === 'completed') return false;
      const start = new Date(`${s.scheduled_date}T${s.scheduled_time}`).getTime();
      const end = start + 60 * 60 * 1000;
      return now >= start && now <= end;
    }) || null;
  }, [sessions]);

  // Deep link: ?openNotes=sessionId
  useEffect(() => {
    const openNotesId = searchParams.get('openNotes');
    if (openNotesId && activeSession?.id === openNotesId) setMicroNotesOpen(true);
  }, [searchParams, activeSession?.id]);

  // Fetch observation chips for active session
  useEffect(() => {
    if (!activeSession) {
      setQuickStrengths([]);
      setQuickStruggles([]);
      setMicroNoteCount(0);
      return;
    }
    const ac = new AbortController();
    fetch(`/api/intelligence/session-observations?sessionId=${activeSession.id}`, { signal: ac.signal })
      .then(r => r.json())
      .then(data => {
        setQuickStrengths(data.strengths || []);
        setQuickStruggles(data.struggles || []);
      })
      .catch(() => {});
    fetch(`/api/intelligence/micro-observation?sessionId=${activeSession.id}`, { signal: ac.signal })
      .then(r => r.json())
      .then(data => { setMicroNoteCount(Array.isArray(data.data) ? data.data.length : 0); })
      .catch(() => {});
    return () => ac.abort();
  }, [activeSession?.id]);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  // Unique children for child filter dropdown
  const uniqueChildren = useMemo(() => {
    const childMap = new Map<string, string>();
    for (const s of sessions) {
      if (!childMap.has(s.child_id)) childMap.set(s.child_id, s.child_name);
    }
    return Array.from(childMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const filteredChildren = useMemo(() => {
    if (!childSearch) return uniqueChildren;
    const q = childSearch.toLowerCase();
    return uniqueChildren.filter(c => c.name.toLowerCase().includes(q));
  }, [uniqueChildren, childSearch]);

  const hasActiveFilter = dateFilter !== 'week' || childFilter !== 'all' || statusFilter !== 'all' || !!childSearch;

  const clearFilters = () => {
    setDateFilter('week');
    setChildFilter('all');
    setStatusFilter('all');
    setChildSearch('');
  };

  const filteredSessions = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    return sessions.filter((s) => {
      // Date filter
      if (dateFilter === 'today' && !isTodayDate(s.scheduled_date)) return false;
      if (dateFilter === 'week' && !isWithinDays(s.scheduled_date, 7)) return false;
      if (dateFilter === '7days') {
        const d = new Date(s.scheduled_date);
        if (d < sevenDaysAgo || d > now) return false;
      }
      if (dateFilter === 'month' && !isThisMonth(s.scheduled_date)) return false;

      // Child filter (dropdown selection OR text search)
      if (childFilter !== 'all' && s.child_id !== childFilter) return false;
      if (childFilter === 'all' && childSearch) {
        if (!s.child_name.toLowerCase().includes(childSearch.toLowerCase())) return false;
      }

      // Status filter
      if (statusFilter === 'scheduled') return isUnresolvedStatus(s.status);
      if (statusFilter === 'completed') return s.status === SESSION_STATUS.COMPLETED;
      if (statusFilter === 'missed') return s.status === SESSION_STATUS.MISSED;
      if (statusFilter === 'cancelled') return s.status === SESSION_STATUS.CANCELLED;
      if (statusFilter === 'report_due') {
        // A capture is confirmed when capture_id is set AND no pending (unconfirmed) capture remains
        const hasConfirmedCapture = !!s.capture_id && !s.pending_capture;
        if (hasConfirmedCapture) return false; // Already has a confirmed report — never "due"
        // Case 1: past session still scheduled/pending with no confirmed capture
        const isPastUnresolved = isSessionPast(s.scheduled_date, s.scheduled_time, s.duration_minutes) && isUnresolvedStatus(s.status);
        // Case 2: completed but capture not yet confirmed by coach
        const completedNeedsCapture = s.status === SESSION_STATUS.COMPLETED;
        return isPastUnresolved || completedNeedsCapture;
      }

      return true;
    });
  }, [sessions, dateFilter, childFilter, statusFilter, childSearch]);

  const groupedSessions = useMemo(() => {
    return filteredSessions.reduce((groups: Record<string, Session[]>, session) => {
      const date = session.scheduled_date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(session);
      return groups;
    }, {});
  }, [filteredSessions]);

  // Stats — always computed from ALL sessions (unfiltered) so numbers stay stable
  const stats = useMemo(() => ({
    today: sessions.filter((s) => isTodayDate(s.scheduled_date) && isUnresolvedStatus(s.status)).length,
    thisWeek: sessions.filter((s) => isWithinDays(s.scheduled_date, 7) && isUnresolvedStatus(s.status)).length,
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

  const handleSwitchToOnline = useCallback(async (session: Session) => {
    if (!confirm(`Switch "${session.child_name}" session to online? A Google Meet link will be created.`)) return;
    try {
      const res = await fetch(`/api/coach/sessions/${session.id}/switch-to-online`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to switch to online'); return; }
      alert(data.message || 'Switched to online');
      loadSessions();
    } catch { alert('Network error. Please try again.'); }
  }, [loadSessions]);

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
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const getSessionsForDay = (day: number): Session[] => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return sessions.filter((s) => s.scheduled_date === dateStr);
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="text-[#00ABFF] mx-auto mb-4" />
          <p className="text-text-tertiary">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-white text-lg mb-4">{error}</p>
          <button onClick={loadSessions} className="px-4 py-2 bg-[#00ABFF] text-white rounded-xl hover:bg-[#00ABFF]/90 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 lg:pb-6">
      {/* Page Header (scrolls away) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:gap-4 px-4 lg:px-0 pt-4 lg:pt-0 mb-4">
        <div>
          <h1 className="text-lg lg:text-2xl font-bold text-white flex items-center gap-2 lg:gap-3">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-purple-400" />
            </div>
            Sessions
          </h1>
          <p className="text-xs lg:text-sm text-text-tertiary mt-0.5">Manage your coaching sessions</p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-surface-1 rounded-xl p-0.5">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === 'list' ? 'bg-[#00ABFF] text-white' : 'text-text-tertiary hover:text-white'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              view === 'calendar' ? 'bg-[#00ABFF] text-white' : 'text-text-tertiary hover:text-white'
            }`}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* Sticky: Stats Ribbon + Filter Bar */}
      <div className="sticky top-0 z-30 bg-surface-0/95 backdrop-blur-sm border-b border-gray-800 -mx-4 lg:mx-0 px-4 lg:px-0">
        {/* Stats Ribbon */}
        <div className="grid grid-cols-4 gap-2 py-3">
          {([
            { icon: Clock, label: 'Today', value: stats.today, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { icon: CalendarDays, label: 'Week', value: stats.thisWeek, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { icon: CheckCircle, label: 'Done', value: stats.completed, color: 'text-green-400', bg: 'bg-green-500/10' },
            { icon: Users, label: 'Upcoming', value: stats.upcoming, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          ] as const).map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-white leading-tight">{value}</p>
                <p className="text-text-tertiary text-[10px]">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide">
          {/* Date filter chips */}
          <div className="flex gap-1.5 flex-shrink-0">
            {DATE_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDateFilter(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                  dateFilter === opt.value
                    ? 'bg-[#00ABFF] text-white'
                    : 'bg-surface-1 text-text-tertiary hover:text-white border border-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-700 flex-shrink-0" />

          {/* Child filter */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowChildDropdown(!showChildDropdown)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                childFilter !== 'all'
                  ? 'bg-[#00ABFF] text-white'
                  : 'bg-surface-1 text-text-tertiary hover:text-white border border-border'
              }`}
            >
              {childFilter === 'all' ? 'All Kids' : uniqueChildren.find(c => c.id === childFilter)?.name || 'Child'}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showChildDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowChildDropdown(false)} />
                <div className="absolute top-full mt-1 left-0 z-50 bg-surface-1 border border-border rounded-xl shadow-xl min-w-[200px] max-h-[280px] overflow-hidden">
                  {uniqueChildren.length > 5 && (
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={childSearch}
                          onChange={e => setChildSearch(e.target.value)}
                          placeholder="Search..."
                          className="w-full bg-surface-0 text-white text-xs pl-8 pr-3 py-2 rounded-lg border border-border outline-none focus:border-[#00ABFF]/50"
                          autoFocus
                        />
                      </div>
                    </div>
                  )}
                  <div className="overflow-y-auto max-h-[220px]">
                    <button
                      onClick={() => { setChildFilter('all'); setShowChildDropdown(false); setChildSearch(''); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-2 transition-colors ${childFilter === 'all' ? 'text-[#00ABFF] font-medium' : 'text-white'}`}
                    >
                      All Kids
                    </button>
                    {filteredChildren.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setChildFilter(c.id); setShowChildDropdown(false); setChildSearch(''); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-2 transition-colors ${childFilter === c.id ? 'text-[#00ABFF] font-medium' : 'text-white'}`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Status filter */}
          <div className="relative flex-shrink-0">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilterValue)}
              className={`appearance-none px-3 py-1.5 pr-7 rounded-xl text-xs font-medium cursor-pointer transition-colors outline-none ${
                statusFilter !== 'all'
                  ? 'bg-[#00ABFF] text-white'
                  : 'bg-surface-1 text-text-tertiary border border-border'
              }`}
            >
              {STATUS_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-current absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Clear filters */}
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-text-tertiary hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-4 lg:space-y-6 mt-4 px-4 lg:px-0">
          {Object.keys(groupedSessions).length === 0 ? (
            <div className="bg-surface-1 border border-border rounded-2xl p-8 lg:p-12 max-w-3xl mx-auto">
              <EmptyState
                icon={Calendar}
                title="No sessions found"
                description={hasActiveFilter ? 'Try adjusting your filters' : 'No sessions scheduled'}
                action={{ label: 'View Students', href: '/coach/students' }}
              />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {Object.entries(groupedSessions)
                .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                .map(([date, daySessions]) => (
                  <div key={date} className="mb-4">
                    {/* Date Header */}
                    <div className="flex items-center gap-3 py-2 mb-2">
                      <span className="text-sm font-medium text-gray-300">
                        {isTodayDate(date) ? 'Today' : isYesterday(date) ? 'Yesterday' : formatDateShort(date)}
                      </span>
                      <span className="text-xs text-gray-500">({daySessions.length})</span>
                      <div className="flex-1 h-px bg-gray-800" />
                    </div>

                    {/* Sessions */}
                    <div className="space-y-2">
                      {daySessions
                        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                        .map((session) => (
                          <SessionCard
                            key={session.id}
                            session={session}
                            isPast={isSessionPast(session.scheduled_date, session.scheduled_time, session.duration_minutes)}
                            isToday={isTodayDate(session.scheduled_date)}
                            canComplete={canCompleteSession(session, sessions)}
                            onPrep={() => openPrepModal(session)}
                            onComplete={() => openCompleteModal(session)}
                            onReschedule={() => openRescheduleModal(session)}
                            onCancel={() => openCancelConfirm(session)}
                            onMissed={() => openMissedConfirm(session)}
                            onRequestOffline={() => openOfflineModal(session)}
                            onSwitchToOnline={() => handleSwitchToOnline(session)}
                            coachEmail={coach?.email}
                            isActiveSession={activeSession?.id === session.id}
                            onOpenNotes={activeSession?.id === session.id ? () => setMicroNotesOpen(true) : undefined}
                            microNoteCount={activeSession?.id === session.id ? microNoteCount : undefined}
                          />
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden mt-4 mx-4 lg:mx-0">
          <div className="flex items-center justify-between p-3 lg:p-4 border-b border-border">
            <button onClick={prevMonth} className="p-2 hover:bg-surface-2 rounded-xl transition-colors">
              <ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5 text-text-tertiary" />
            </button>
            <h3 className="text-white text-sm lg:text-base font-semibold">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button onClick={nextMonth} className="p-2 hover:bg-surface-2 rounded-xl transition-colors">
              <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-text-tertiary" />
            </button>
          </div>

          <div className="p-2 lg:p-4">
            <div className="grid grid-cols-7 gap-0.5 lg:gap-1 mb-1 lg:mb-2">
              {DAYS_OF_WEEK.map((day, index) => (
                <div key={day} className="text-center text-text-tertiary text-[10px] lg:text-sm font-medium py-1 lg:py-2">
                  <span className="lg:hidden">{DAYS_OF_WEEK_SHORT[index]}</span>
                  <span className="hidden lg:inline">{day}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5 lg:gap-1">
              {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {getDaysInMonth(currentMonth).map((day) => {
                const daySessions = getSessionsForDay(day);
                const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isCurrentDay = isTodayDate(dateStr);

                return (
                  <div
                    key={day}
                    className={`aspect-square p-0.5 lg:p-1 rounded-lg border transition-colors ${
                      isCurrentDay
                        ? 'border-[#00ABFF] bg-[#00ABFF]/10'
                        : daySessions.length > 0
                        ? 'border-border bg-surface-1/30 hover:bg-surface-1/50'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="text-[10px] lg:text-xs text-text-tertiary mb-0.5">{day}</div>
                    <div className="lg:hidden flex flex-wrap gap-0.5 justify-center">
                      {daySessions.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-[#00ABFF]" />}
                      {daySessions.length > 1 && <span className="text-[8px] text-text-tertiary">+{daySessions.length - 1}</span>}
                    </div>
                    <div className="hidden lg:block space-y-0.5 overflow-y-auto max-h-16">
                      {daySessions.slice(0, 3).map((session) => {
                        const config = getStatusConfig(session.status);
                        return (
                          <div
                            key={session.id}
                            className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${config.bg} ${config.text}`}
                            onClick={() => isUnresolvedStatus(session.status) && openCompleteModal(session)}
                          >
                            {formatTime12(session.scheduled_time)} {session.child_name}
                          </div>
                        );
                      })}
                      {daySessions.length > 3 && (
                        <div className="text-xs text-text-tertiary text-center">+{daySessions.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODALS                                                       */}
      {/* ============================================================ */}

      {/* MicroNotePanel — full-screen during active session */}
      {activeSession && coach && microNotesOpen && (
        <MicroNotePanel
          layout="fullscreen"
          sessionId={activeSession.id}
          childId={activeSession.child_id}
          childName={activeSession.child_name}
          coachId={coach.id}
          sessionStartTime={new Date(`${activeSession.scheduled_date}T${activeSession.scheduled_time}`)}
          quickStrengths={quickStrengths}
          quickStruggles={quickStruggles}
          onClose={() => setMicroNotesOpen(false)}
          onNoteAdded={() => setMicroNoteCount(prev => prev + 1)}
          onEndSession={() => {
            setMicroNotesOpen(false);
            setSelectedSession(activeSession);
            setShowCompleteModal(true);
          }}
        />
      )}

      {/* Persistent bottom bar during active session */}
      {activeSession && !microNotesOpen && !showCompleteModal && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-30 bg-[#121217]/95 backdrop-blur-md border-t border-green-500/20 px-4 py-2.5 lg:ml-64">
          <div className="flex items-center gap-3 max-w-3xl mx-auto">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{activeSession.child_name} session</p>
              <p className="text-white/40 text-[10px]">{microNoteCount > 0 ? `${microNoteCount} notes captured` : 'No notes yet'}</p>
            </div>
            <button
              onClick={() => setMicroNotesOpen(true)}
              className="bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-medium min-h-[40px] active:bg-green-600"
            >
              Open
            </button>
          </div>
        </div>
      )}

      {showCompleteModal && selectedSession && coach && (
        <StructuredCaptureForm
          sessionId={selectedSession.id}
          childId={selectedSession.child_id}
          childName={selectedSession.child_name}
          childAge={selectedSession.child_age}
          coachId={coach.id}
          sessionNumber={selectedSession.session_number || 1}
          modality={selectedSession.session_mode === 'offline' ? 'in_person_1on1' : 'online_1on1'}
          captureId={selectedSession.pending_capture?.id}
          isAiPrefilled={selectedSession.pending_capture?.ai_prefilled}
          onClose={() => { setShowCompleteModal(false); setSelectedSession(null); }}
          onComplete={async (result) => {
            try {
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

              if (res.ok) {
                handleCompleteSuccess();
                return;
              }

              // Failure path — DO NOT close the modal. Surface the actual error so
              // the coach knows the session is still incomplete and can retry.
              // (Pre-fix: success was reported regardless of res.ok, leaving 14+
              //  sessions stuck in 'scheduled' while the coach believed they were done.)
              let errBody: { error?: string; message?: string; captureId?: string } = {};
              try { errBody = await res.json(); } catch { /* non-JSON body */ }
              const errCode = errBody.error || `http_${res.status}`;
              const errMsg = errBody.message || errBody.error || `Failed to complete session (HTTP ${res.status}).`;

              console.error('Session complete failed:', { status: res.status, body: errBody });

              if (errCode === 'pending_capture') {
                // Capture wasn't marked coach_confirmed before /complete fired
                // (stale modal state or race). Keep the SCF modal open so the
                // coach can re-submit it.
                alert('Please review and confirm the session capture before completing.');
                return;
              }

              alert(errMsg);
            } catch (err) {
              console.error('Network error completing session:', err);
              alert(err instanceof Error ? err.message : 'Network error. Please try again.');
            }
          }}
        />
      )}

      {showPrepModal && selectedSession && (
        <PreSessionBrief
          session={selectedSession}
          onClose={() => { setShowPrepModal(false); setSelectedSession(null); }}
        />
      )}

      {showRescheduleModal && selectedSession && (
        <RescheduleModal
          isOpen={showRescheduleModal}
          session={sessionToRescheduleSession(selectedSession)}
          coachId={coach?.id}
          onClose={() => { setShowRescheduleModal(false); setSelectedSession(null); }}
          onSuccess={handleRescheduleComplete}
        />
      )}

      {/* Missed Confirmation Modal */}
      {showMissedConfirm && selectedSession && (
        <div className="fixed inset-0 bg-black/70 flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
          <div className="bg-surface-1 rounded-t-2xl lg:rounded-2xl max-w-md w-full p-4 lg:p-6 border border-border">
            <h3 className="text-lg font-bold text-white mb-3">Mark as Missed?</h3>
            <p className="text-text-tertiary text-sm mb-3">
              Mark {selectedSession.child_name}&apos;s Session #{selectedSession.session_number} as missed?
            </p>
            <div className="mb-4">
              <label className="block text-text-tertiary text-xs mb-2">Reason (optional)</label>
              <select
                value={missedReason}
                onChange={(e) => setMissedReason(e.target.value)}
                className="w-full bg-surface-0 text-white border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                onClick={() => { setShowMissedConfirm(false); setSelectedSession(null); setMissedReason(''); }}
                className="flex-1 px-4 py-2.5 bg-surface-2 text-white text-sm rounded-xl hover:bg-surface-3 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkMissed}
                disabled={markingMissed === selectedSession.id}
                className="flex-1 px-4 py-2.5 bg-orange-500 text-white text-sm rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {markingMissed === selectedSession.id ? <Spinner size="sm" /> : 'Mark Missed'}
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
          onClose={() => { setShowOfflineModal(false); setSelectedSession(null); }}
          onSuccess={() => { setShowOfflineModal(false); setSelectedSession(null); loadSessions(); }}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && selectedSession && (
        <div className="fixed inset-0 bg-black/70 flex items-end lg:items-center justify-center z-50 p-0 lg:p-4">
          <div className="bg-surface-1 rounded-t-2xl lg:rounded-2xl max-w-md w-full p-4 lg:p-6 border border-border">
            <h3 className="text-lg font-bold text-white mb-3">Cancel Session?</h3>
            <p className="text-text-tertiary text-sm mb-3">
              Cancel {selectedSession.child_name}&apos;s Session #{selectedSession.session_number}? This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-text-tertiary text-xs mb-2">Reason (required)</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-surface-0 text-white border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
                onClick={() => { setShowCancelConfirm(false); setSelectedSession(null); setCancelReason(''); }}
                className="flex-1 px-4 py-2.5 bg-surface-2 text-white text-sm rounded-xl hover:bg-surface-3 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleCancelSession}
                disabled={cancelling === selectedSession.id || !cancelReason}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white text-sm rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling === selectedSession.id ? <Spinner size="sm" /> : 'Cancel Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
