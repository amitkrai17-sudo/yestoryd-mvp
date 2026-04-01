// app/coach/students/page.tsx
// Coach Students Page — Coaching + Tuition unified view
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
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import StudentCard, { type StudentData } from '@/components/coach/StudentCard';
import { EmptyState } from '@/components/shared/EmptyState';
import RecordPaymentSheet from '@/components/coach/RecordPaymentSheet';

type FilterType = 'all' | 'coaching' | 'tuition' | 'active';

// 6:00 AM to 9:00 PM in 15-min intervals
const TIME_SLOTS = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 21 && m > 0) break; // stop at 9:00 PM
      const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const hour12 = h % 12 || 12;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const label = `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
      slots.push({ value, label });
    }
  }
  return slots;
})();

export default function CoachStudentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [error, setError] = useState<string | null>(null);

  // Record Payment bottom sheet state
  const [paymentTarget, setPaymentTarget] = useState<StudentData | null>(null);

  // Schedule bottom sheet state
  const [scheduleTarget, setScheduleTarget] = useState<StudentData | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState(45);
  const [scheduleMode, setScheduleMode] = useState<'offline' | 'online'>('offline');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/coach/students');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/coach/login');
          return;
        }
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

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Stats
  const stats = useMemo(() => ({
    total: students.length,
    active: students.filter(s => s.status === 'active').length,
    coaching: students.filter(s => s.enrollment_type !== 'tuition').length,
    tuition: students.filter(s => s.enrollment_type === 'tuition').length,
  }), [students]);

  // Filter
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = !searchTerm ||
        s.child_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        filterType === 'all' ||
        (filterType === 'active' && s.status === 'active') ||
        (filterType === 'coaching' && s.enrollment_type !== 'tuition') ||
        (filterType === 'tuition' && s.enrollment_type === 'tuition');

      return matchesSearch && matchesFilter;
    });
  }, [students, searchTerm, filterType]);

  // Open schedule bottom sheet
  const openSchedule = useCallback((student: StudentData) => {
    setScheduleTarget(student);
    setScheduleDate('');
    // Default to nearest future 15-min slot
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

  // Submit schedule
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

      if (!res.ok) {
        setScheduleError(data.error || 'Failed to schedule session');
        return;
      }

      setScheduleSuccess(true);
      // Refresh student data
      loadStudents();
      // Auto-close after 2s
      setTimeout(() => {
        setScheduleTarget(null);
        setScheduleSuccess(false);
      }, 2000);
    } catch {
      setScheduleError('Network error. Please try again.');
    } finally {
      setScheduling(false);
    }
  };

  // Min date for date picker
  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" className="text-[#00ABFF]" />
      </div>
    );
  }

  return (
    <div className="px-3 py-4 lg:px-6 lg:py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg lg:text-xl font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-[#00ABFF]" />
          My Students
        </h1>
        <p className="text-xs lg:text-sm text-text-tertiary">Coaching and tuition students</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { icon: Users, value: stats.total, label: 'Total', color: 'text-white', bg: 'bg-surface-2' },
          { icon: UserCheck, value: stats.active, label: 'Active', color: 'text-green-400', bg: 'bg-green-500/20' },
          { icon: GraduationCap, value: stats.coaching, label: 'Coaching', color: 'text-blue-400', bg: 'bg-blue-500/20' },
          { icon: BookOpen, value: stats.tuition, label: 'Tuition', color: 'text-amber-400', bg: 'bg-amber-500/20' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-1 rounded-lg p-2 lg:p-3 text-center border border-border">
            <div className={`w-6 h-6 lg:w-8 lg:h-8 ${stat.bg} rounded-md flex items-center justify-center mx-auto mb-1`}>
              <stat.icon className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${stat.color}`} />
            </div>
            <div className={`text-base lg:text-lg font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-[9px] lg:text-[10px] text-text-tertiary">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            className="w-full h-10 pl-9 pr-3 bg-surface-1 border border-border rounded-xl text-sm text-white placeholder-text-tertiary focus:outline-none focus:border-[#00ABFF]"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          className="h-10 px-3 bg-surface-1 border border-border rounded-xl text-sm text-white focus:outline-none focus:border-[#00ABFF] appearance-none cursor-pointer"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="coaching">Coaching</option>
          <option value="tuition">Tuition</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Student Cards */}
      <div className="space-y-3">
        {filteredStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students found"
            description="Try adjusting your search or filters"
          />
        ) : (
          filteredStudents.map((student) => (
            <StudentCard
              key={student.enrollment_id}
              student={student}
              onSchedule={openSchedule}
              onRecordPayment={setPaymentTarget}
            />
          ))
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
        onSuccess={() => {
          setPaymentTarget(null);
          loadStudents();
        }}
      />

      {/* ──────────────────────────────────────────── */}
      {/* Schedule Session Bottom Sheet               */}
      {/* ──────────────────────────────────────────── */}

      {/* Backdrop */}
      {scheduleTarget && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={closeSchedule}
        />
      )}

      {/* Sheet */}
      {scheduleTarget && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-600" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">
              {scheduleSuccess ? 'Session Scheduled' : 'Schedule Session'}
            </h3>
            <button
              onClick={closeSchedule}
              className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-gray-800 text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Success */}
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
                {/* Child info */}
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

                {/* Error */}
                {scheduleError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {scheduleError}
                  </div>
                )}

                {/* Date */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduleDate}
                    min={today}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full h-11 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#00ABFF] [color-scheme:dark]"
                  />
                </div>

                {/* Time — 15-min interval grid */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Time
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

                {/* Duration toggle */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Duration</label>
                  <div className="flex gap-2">
                    {[30, 45, 60].map(d => (
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

                {/* Mode toggle */}
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
                      <MapPin className="w-4 h-4" />
                      Offline
                    </button>
                    <button
                      onClick={() => setScheduleMode('online')}
                      className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-medium transition-colors ${
                        scheduleMode === 'online'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <Video className="w-4 h-4" />
                      Online
                    </button>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={handleSchedule}
                  disabled={scheduling || !scheduleDate || !scheduleTime}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                >
                  {scheduling ? (
                    <Spinner />
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      Schedule
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Safe area */}
          <div className="h-6" />
        </div>
      )}

      {/* Slide-up animation */}
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
