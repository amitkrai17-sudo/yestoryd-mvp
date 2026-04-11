// app/coach/students/page.tsx
// Coach Students Page — Compact cards, sticky stats, filters+sort, accordion expand
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  UserCheck,
  BookOpen,
  GraduationCap,
  X,
  Calendar,
  Clock,
  MapPin,
  Video,
  Check,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import StudentCard, { type StudentData } from '@/components/coach/StudentCard';
import { EmptyState } from '@/components/shared/EmptyState';
import RecordPaymentSheet from '@/components/coach/RecordPaymentSheet';

// ============================================================
// CONSTANTS
// ============================================================

const PROGRAM_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'coaching', label: '1:1 Coaching' },
  { value: 'tuition', label: 'English Classes' },
] as const;

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'not_scheduled', label: 'Not Scheduled' },
  { value: 'report_due', label: 'Report Due' },
  { value: 'complete', label: 'Complete' },
  { value: 'inactive', label: 'Inactive' },
] as const;

const SORT_OPTIONS = [
  { value: 'next_session', label: 'Next Session' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'remaining', label: 'Sessions Left' },
  { value: 'last_active', label: 'Last Active' },
] as const;

type ProgramFilterValue = typeof PROGRAM_FILTER_OPTIONS[number]['value'];
type StatusFilterValue = typeof STATUS_FILTER_OPTIONS[number]['value'];
type SortValue = typeof SORT_OPTIONS[number]['value'];

// 6:00 AM to 9:00 PM in 15-min intervals
const TIME_SLOTS = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 21 && m > 0) break;
      const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const hour12 = h % 12 || 12;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const label = `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
      slots.push({ value, label });
    }
  }
  return slots;
})();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function daysSinceLastSession(student: StudentData): number {
  if (!student.last_session_date) return 999;
  return Math.floor((Date.now() - new Date(student.last_session_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
}

function hasSessionsRemaining(student: StudentData): boolean {
  if (student.enrollment_type === 'tuition') return (student.sessions_remaining ?? 0) > 0;
  return student.sessions_completed < student.total_sessions;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function CoachStudentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filter + sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [programFilter, setProgramFilter] = useState<ProgramFilterValue>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [sortBy, setSortBy] = useState<SortValue>('next_session');

  // Accordion state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Record Payment
  const [paymentTarget, setPaymentTarget] = useState<StudentData | null>(null);

  // Schedule bottom sheet
  const [scheduleTarget, setScheduleTarget] = useState<StudentData | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState(45);
  const [scheduleMode, setScheduleMode] = useState<'offline' | 'online'>('offline');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // ============================================================
  // DATA LOADING
  // ============================================================

  const loadStudents = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/coach/students');
      if (!res.ok) {
        if (res.status === 401) { router.push('/coach/login'); return; }
        throw new Error('Failed to load students');
      }
      const data = await res.json();
      setStudents(data.students || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  // Stats — always from unfiltered data
  const stats = useMemo(() => ({
    total: students.length,
    active: students.filter(s => s.status === 'active').length,
    coaching: students.filter(s => s.enrollment_type !== 'tuition').length,
    tuition: students.filter(s => s.enrollment_type === 'tuition').length,
  }), [students]);

  const hasActiveFilter = programFilter !== 'all' || statusFilter !== 'all' || !!searchTerm;

  const clearFilters = () => {
    setProgramFilter('all');
    setStatusFilter('all');
    setSearchTerm('');
  };

  const filteredStudents = useMemo(() => {
    let result = students.filter(s => {
      // Search
      if (searchTerm && !s.child_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      // Program filter
      if (programFilter === 'coaching' && s.enrollment_type === 'tuition') return false;
      if (programFilter === 'tuition' && s.enrollment_type !== 'tuition') return false;

      // Status filter
      if (statusFilter === 'active') return s.status === 'active';
      if (statusFilter === 'not_scheduled') return hasSessionsRemaining(s) && !s.next_session_date;
      if (statusFilter === 'complete') return !hasSessionsRemaining(s);
      if (statusFilter === 'inactive') return daysSinceLastSession(s) > 14 && hasSessionsRemaining(s);
      // report_due: placeholder — would need pending capture data from API
      if (statusFilter === 'report_due') return false;

      return true;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.child_name.localeCompare(b.child_name);
        case 'next_session': {
          // Not scheduled goes to top (needs attention)
          if (!a.next_session_date && b.next_session_date) return -1;
          if (a.next_session_date && !b.next_session_date) return 1;
          if (!a.next_session_date && !b.next_session_date) return a.child_name.localeCompare(b.child_name);
          return new Date(a.next_session_date!).getTime() - new Date(b.next_session_date!).getTime();
        }
        case 'remaining': {
          const aRem = a.enrollment_type === 'tuition' ? (a.sessions_remaining ?? 0) : (a.total_sessions - a.sessions_completed);
          const bRem = b.enrollment_type === 'tuition' ? (b.sessions_remaining ?? 0) : (b.total_sessions - b.sessions_completed);
          return aRem - bRem;
        }
        case 'last_active':
          return daysSinceLastSession(a) - daysSinceLastSession(b);
        default:
          return 0;
      }
    });

    return result;
  }, [students, searchTerm, programFilter, statusFilter, sortBy]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const openSchedule = useCallback((student: StudentData) => {
    setScheduleTarget(student);
    setScheduleDate('');
    const now = new Date();
    const mins = now.getMinutes();
    const nextSlotMin = Math.ceil(mins / 15) * 15;
    const slotDate = new Date(now);
    slotDate.setMinutes(nextSlotMin, 0, 0);
    if (nextSlotMin >= 60) slotDate.setHours(slotDate.getHours() + 1, 0, 0, 0);
    const hh = slotDate.getHours().toString().padStart(2, '0');
    const mm = slotDate.getMinutes().toString().padStart(2, '0');
    const defaultTime = `${hh}:${mm}`;
    const validSlot = TIME_SLOTS.find(s => s.value >= defaultTime) || TIME_SLOTS[0];
    setScheduleTime(validSlot.value);
    setScheduleDuration(student.default_duration_minutes || 45);
    setScheduleMode((student.default_session_mode as 'offline' | 'online') || 'offline');
    setScheduling(false);
    setScheduleSuccess(false);
    setScheduleError(null);
  }, []);

  const closeSchedule = useCallback(() => {
    if (!scheduling) {
      setScheduleTarget(null);
      setScheduleSuccess(false);
    }
  }, [scheduling]);

  const handleSchedule = async () => {
    if (!scheduleTarget || !scheduleDate || !scheduleTime) return;
    setScheduling(true);
    setScheduleError(null);
    try {
      const res = await fetch('/api/tuition/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: scheduleTarget.enrollment_id,
          date: scheduleDate,
          time: scheduleTime,
          durationMinutes: scheduleDuration,
          mode: scheduleMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setScheduleError(data.error || 'Failed to schedule'); return; }
      setScheduleSuccess(true);
      loadStudents();
      setTimeout(() => { setScheduleTarget(null); setScheduleSuccess(false); }, 2000);
    } catch {
      setScheduleError('Network error. Please try again.');
    } finally {
      setScheduling(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" className="text-[#00ABFF]" />
      </div>
    );
  }

  return (
    <div className="pb-24 lg:pb-6">
      {/* Page Header (scrolls away) */}
      <div className="px-4 lg:px-0 pt-4 lg:pt-0 mb-4">
        <h1 className="text-lg lg:text-2xl font-bold text-white flex items-center gap-2">
          <div className="w-8 h-8 lg:w-10 lg:h-10 bg-[#00ABFF]/20 rounded-xl flex items-center justify-center">
            <Users className="w-4 h-4 lg:w-5 lg:h-5 text-[#00ABFF]" />
          </div>
          My Students
        </h1>
        <p className="text-xs lg:text-sm text-text-tertiary mt-0.5">Coaching and tuition students</p>
      </div>

      {/* Sticky: Stats + Filters */}
      <div className="sticky top-0 z-30 bg-surface-0/95 backdrop-blur-sm border-b border-gray-800 -mx-4 lg:mx-0 px-4 lg:px-0">
        {/* Stats Ribbon */}
        <div className="grid grid-cols-4 gap-2 py-3">
          {([
            { icon: Users, label: 'Total', value: stats.total, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { icon: UserCheck, label: 'Active', value: stats.active, color: 'text-green-400', bg: 'bg-green-500/10' },
            { icon: GraduationCap, label: 'Coaching', value: stats.coaching, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { icon: BookOpen, label: 'Classes', value: stats.tuition, color: 'text-pink-400', bg: 'bg-pink-500/10' },
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

        {/* Search + Filters */}
        <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide">
          {/* Search */}
          <div className="relative flex-shrink-0 w-40 lg:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full h-8 pl-8 pr-3 bg-surface-1 border border-border rounded-xl text-xs text-white placeholder-text-tertiary focus:outline-none focus:border-[#00ABFF]/50"
            />
          </div>

          <div className="w-px h-6 bg-gray-700 flex-shrink-0" />

          {/* Program filter */}
          <div className="relative flex-shrink-0">
            <select
              value={programFilter}
              onChange={e => setProgramFilter(e.target.value as ProgramFilterValue)}
              className={`appearance-none px-3 py-1.5 pr-7 rounded-xl text-xs font-medium cursor-pointer transition-colors outline-none ${
                programFilter !== 'all'
                  ? 'bg-[#00ABFF] text-white'
                  : 'bg-surface-1 text-text-tertiary border border-border'
              }`}
            >
              {PROGRAM_FILTER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-current absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
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

          {/* Sort */}
          <div className="relative flex-shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortValue)}
              className="appearance-none px-3 py-1.5 pr-7 rounded-xl text-xs font-medium cursor-pointer transition-colors outline-none bg-surface-1 text-text-tertiary border border-border"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ArrowUpDown className="w-3 h-3 text-text-tertiary absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
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

      {/* Error */}
      {error && (
        <div className="mx-4 lg:mx-0 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Student Cards */}
      <div className="space-y-2 mt-4 px-4 lg:px-0">
        {filteredStudents.length === 0 ? (
          <div className="bg-surface-1 border border-border rounded-2xl p-8 lg:p-12 max-w-3xl mx-auto">
            <EmptyState
              icon={Users}
              title="No students found"
              description={hasActiveFilter ? 'Try adjusting your filters' : 'No students assigned yet'}
            />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-2">
            {filteredStudents.map((student) => (
              <StudentCard
                key={student.enrollment_id}
                student={student}
                isExpanded={expandedId === student.enrollment_id}
                onToggleExpand={() => setExpandedId(expandedId === student.enrollment_id ? null : student.enrollment_id)}
                onSchedule={openSchedule}
                onRecordPayment={setPaymentTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────── */}
      {/* Record Payment Bottom Sheet                 */}
      {/* ──────────────────────────────────────────── */}
      <RecordPaymentSheet
        enrollment={paymentTarget ? {
          id: paymentTarget.enrollment_id,
          child_name: paymentTarget.child_name,
          session_rate: paymentTarget.session_rate || 0,
          sessions_remaining: paymentTarget.sessions_remaining ?? 0,
          parent_name: paymentTarget.parent_name,
        } : null}
        onClose={() => setPaymentTarget(null)}
        onSuccess={() => { setPaymentTarget(null); loadStudents(); }}
      />

      {/* ──────────────────────────────────────────── */}
      {/* Schedule Session Bottom Sheet               */}
      {/* ──────────────────────────────────────────── */}

      {scheduleTarget && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={closeSchedule} />
      )}

      {scheduleTarget && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-600" />
          </div>

          <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">
              {scheduleSuccess ? 'Session Scheduled' : 'Schedule Session'}
            </h3>
            <button onClick={closeSchedule} className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-gray-800 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {scheduleSuccess && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20">
                  <Check className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-sm text-green-400 font-medium">Session scheduled successfully</p>
              </div>
            )}

            {!scheduleSuccess && (
              <>
                <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{scheduleTarget.child_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{scheduleTarget.age}y</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Balance</p>
                      <p className="text-sm font-semibold text-white">
                        {scheduleTarget.sessions_remaining}/{scheduleTarget.sessions_purchased} sessions
                      </p>
                    </div>
                  </div>
                </div>

                {scheduleError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {scheduleError}
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Date
                  </label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={today}
                    className="w-full h-11 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#00ABFF] [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Time
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 max-h-[180px] overflow-y-auto rounded-xl p-1">
                    {TIME_SLOTS.map(slot => (
                      <button
                        key={slot.value}
                        onClick={() => setScheduleTime(slot.value)}
                        className={`h-11 rounded-xl text-xs font-medium transition-colors ${
                          scheduleTime === slot.value
                            ? 'bg-[#FF0099] text-white'
                            : 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Duration</label>
                  <div className="flex gap-2">
                    {[30, 45, 60, 90, 120].map(d => (
                      <button
                        key={d}
                        onClick={() => setScheduleDuration(d)}
                        className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors ${
                          scheduleDuration === d
                            ? 'bg-[#FF0099] text-white'
                            : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        {d} min
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Mode</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setScheduleMode('offline')}
                      className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-medium transition-colors ${
                        scheduleMode === 'offline'
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <MapPin className="w-4 h-4" /> Offline
                    </button>
                    <button
                      onClick={() => setScheduleMode('online')}
                      className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-medium transition-colors ${
                        scheduleMode === 'online'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <Video className="w-4 h-4" /> Online
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSchedule}
                  disabled={scheduling || !scheduleDate || !scheduleTime}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                >
                  {scheduling ? <Spinner /> : <><Calendar className="w-4 h-4" /> Schedule</>}
                </button>
              </>
            )}
          </div>

          <div className="h-6" />
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
