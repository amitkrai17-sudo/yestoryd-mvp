'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, Video, Check, ChevronRight, BookOpen,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useParentContext } from '@/app/parent/context';

// ============================================================
// Types
// ============================================================

interface Session {
  id: string;
  session_number: number;
  session_type: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  google_meet_link: string | null;
  focus_area: string | null;
  is_diagnostic: boolean;
  title: string | null;
  template_title: string | null;
  insight: string | null;
}

// ============================================================
// Helpers
// ============================================================

function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n !== 1 ? 's' : ''}`;
}

function getMonthYear(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toUpperCase();
}

function getDateBlock(dateStr: string): { day: string; date: string; month: string } {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day: d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase(),
    date: d.getDate().toString(),
    month: d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
  };
}

function isUpcoming(session: Session): boolean {
  const sessionDate = new Date(session.scheduled_date + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sessionDate >= today && session.status !== 'completed' && session.status !== 'cancelled';
}

function canJoinSession(session: Session): boolean {
  const now = new Date();
  const sessionDateTime = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
  const timeDiff = sessionDateTime.getTime() - now.getTime();
  const minutesDiff = timeDiff / (1000 * 60);
  return minutesDiff <= 10 && minutesDiff >= -(session.duration_minutes || 45);
}

// ============================================================
// Page
// ============================================================

export default function ParentSessionsPage() {
  const { selectedChildId, selectedChild } = useParentContext();
  const childName = selectedChild?.child_name || selectedChild?.name || 'Your Child';

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [enrollmentType, setEnrollmentType] = useState<string | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const fetchSessions = useCallback(async (childId: string) => {
    try {
      const res = await fetch(`/api/parent/sessions/${childId}`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
        setCoachName(data.coach_name);
        setEnrollmentType(data.enrollment_type);
        setTotalSessions(data.total_sessions || 0);
        setCompletedCount(data.completed_count || 0);
      }
    } catch (err) {
      console.error('Fetch sessions error:', err);
    }
  }, []);

  useEffect(() => {
    if (!selectedChildId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchSessions(selectedChildId).finally(() => setLoading(false));

    const handleChildChange = () => {
      setLoading(true);
      fetchSessions(selectedChildId).finally(() => setLoading(false));
    };
    window.addEventListener('childChanged', handleChildChange);
    return () => window.removeEventListener('childChanged', handleChildChange);
  }, [selectedChildId, fetchSessions]);

  // Derived data
  const progressPercent = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

  // Sessions are returned newest-first from API. Split into upcoming and completed.
  const upcomingSessions = sessions
    .filter(isUpcoming)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.scheduled_time.localeCompare(b.scheduled_time))
    .slice(0, 3);

  const completedSessions = sessions.filter(s => s.status === 'completed');

  // Group completed by month
  const completedByMonth: Record<string, Session[]> = {};
  for (const s of completedSessions) {
    const key = getMonthYear(s.scheduled_date);
    if (!completedByMonth[key]) completedByMonth[key] = [];
    completedByMonth[key].push(s);
  }
  const monthKeys = Object.keys(completedByMonth);

  // Pagination: show first 2 months, then "show earlier"
  const visibleMonths = showAll ? monthKeys : monthKeys.slice(0, 2);
  const hasMoreMonths = monthKeys.length > 2 && !showAll;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!selectedChildId) {
    return (
      <div className="p-4 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 py-8">
            <EmptyState
              icon={Calendar}
              title="No Sessions Found"
              description="Sessions will appear here once enrollment is confirmed."
              action={{ label: 'Go to Dashboard', href: '/parent/dashboard' }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-5">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Sessions</h1>
            <p className="text-gray-500 text-sm mt-0.5">{childName}&apos;s sessions</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 py-8">
            <EmptyState
              icon={Calendar}
              title="No Sessions Scheduled"
              description="Sessions will appear here once your enrollment is confirmed."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* ============ HEADER ============ */}
        <div>
          <h1 className="text-xl font-medium text-gray-900">Sessions</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {childName}&apos;s {enrollmentType === 'tuition' ? 'tuition' : 'coaching'} sessions
          </p>
        </div>

        {/* ============ SECTION 1: PROGRESS SUMMARY ============ */}
        {totalSessions > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                {completedCount} of {pluralize(totalSessions, 'session')} completed
              </span>
              <span className="text-sm font-medium text-gray-900">{progressPercent}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF0099] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* ============ SECTION 2: UPCOMING ============ */}
        {upcomingSessions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Upcoming</p>
            <div className="space-y-2">
              {upcomingSessions.map((session, i) => {
                const dateBlock = getDateBlock(session.scheduled_date);
                const isNext = i === 0;
                const joinable = canJoinSession(session);

                return (
                  <div
                    key={session.id}
                    className={`bg-white rounded-2xl p-4 flex items-center gap-3 ${
                      isNext
                        ? 'border-[1.5px] border-[#FFD6E8]'
                        : 'border border-gray-100'
                    }`}
                  >
                    {/* Date block */}
                    <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                      isNext ? 'bg-[#FFF5F9]' : 'bg-gray-50'
                    }`}>
                      <span className={`text-[10px] font-medium ${isNext ? 'text-[#993556]' : 'text-gray-400'}`}>
                        {dateBlock.day}
                      </span>
                      <span className={`text-lg font-bold leading-tight ${isNext ? 'text-[#993556]' : 'text-gray-700'}`}>
                        {dateBlock.date}
                      </span>
                      <span className={`text-[10px] font-medium ${isNext ? 'text-[#993556]' : 'text-gray-400'}`}>
                        {dateBlock.month}
                      </span>
                    </div>

                    {/* Session info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          Session #{session.session_number}
                        </span>
                        {isNext && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFF5F9] text-[#993556] font-medium">
                            Next
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatTime(session.scheduled_time)} · {session.duration_minutes || 45} min
                        {coachName && ` · with ${coachName}`}
                      </p>
                    </div>

                    {/* Join button */}
                    {session.google_meet_link && (
                      <a
                        href={session.google_meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium min-h-[40px] flex-shrink-0 transition-colors ${
                          joinable
                            ? 'bg-[#FF0099] text-white hover:bg-[#E6008A]'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <Video className="w-4 h-4" />
                        {joinable ? 'Join' : 'Link'}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============ SECTION 3: COMPLETED SESSIONS (grouped by month) ============ */}
        {completedSessions.length > 0 && (
          <div>
            {visibleMonths.map(monthKey => (
              <div key={monthKey} className="mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                  {monthKey}
                </p>
                <div className="space-y-2">
                  {completedByMonth[monthKey].map(session => {
                    const dateBlock = getDateBlock(session.scheduled_date);

                    return (
                      <div
                        key={session.id}
                        className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3"
                      >
                        {/* Date block */}
                        <div className="w-14 h-14 rounded-xl bg-gray-50 flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-medium text-gray-400">
                            {dateBlock.day}
                          </span>
                          <span className="text-lg font-bold leading-tight text-gray-700">
                            {dateBlock.date}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400">
                            {dateBlock.month}
                          </span>
                        </div>

                        {/* Session info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-900">
                              Session #{session.session_number}
                            </span>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatTime(session.scheduled_time)} · {session.duration_minutes || 45} min
                            {coachName && ` · with ${coachName}`}
                          </p>
                          {/* Insight line */}
                          {session.insight && (
                            <p className="text-xs text-[#FF0099] mt-1 font-medium">
                              {session.insight}
                            </p>
                          )}
                        </div>

                        {/* Chevron */}
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Show earlier */}
            {hasMoreMonths && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full text-center text-sm text-[#FF0099] font-medium py-2 hover:underline"
              >
                Show earlier sessions
              </button>
            )}
          </div>
        )}

        {/* No upcoming, no completed */}
        {upcomingSessions.length === 0 && completedSessions.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 py-8">
            <EmptyState
              icon={Calendar}
              title="No sessions yet"
              description={`Sessions will appear here as ${childName}'s program progresses.`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
