'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import ParentLayout from '@/components/parent/ParentLayout';
import {
  Calendar,
  Clock,
  Video,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';

interface Session {
  id: string;
  session_type: string;
  session_number: number;
  scheduled_date: string;
  scheduled_time: string;
  google_meet_link: string;
  status: string;
  duration_minutes: number;
}

export default function ParentSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/parent/login');
      return;
    }

    // Get child
    const { data: child } = await supabase
      .from('children')
      .select('id')
      .eq('parent_email', user.email)
      .eq('enrollment_status', 'active')
      .single();

    if (child) {
      const { data: sessionsData } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('child_id', child.id)
        .order('scheduled_date', { ascending: true });

      setSessions(sessionsData || []);
    }

    setLoading(false);
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  function formatTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <Check className="w-4 h-4" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
            <X className="w-4 h-4" />
            Cancelled
          </span>
        );
      case 'rescheduled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Rescheduled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Scheduled
          </span>
        );
    }
  }

  function isUpcoming(session: Session): boolean {
    const sessionDate = new Date(session.scheduled_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessionDate >= today && session.status !== 'completed' && session.status !== 'cancelled';
  }

  function filteredSessions(): Session[] {
    switch (filter) {
      case 'upcoming':
        return sessions.filter(isUpcoming);
      case 'completed':
        return sessions.filter(s => s.status === 'completed');
      default:
        return sessions;
    }
  }

  function canJoinSession(session: Session): boolean {
    const now = new Date();
    const sessionDateTime = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
    const timeDiff = sessionDateTime.getTime() - now.getTime();
    const minutesDiff = timeDiff / (1000 * 60);
    // Can join 10 minutes before
    return minutesDiff <= 10 && minutesDiff >= -session.duration_minutes;
  }

  if (loading) {
    return (
      <ParentLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Sessions</h1>
            <p className="text-gray-500">View and join your scheduled sessions</p>
          </div>

          {/* Filter */}
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="appearance-none px-4 py-2 pr-10 bg-white border border-amber-200 rounded-xl text-gray-700 font-medium focus:ring-2 focus:ring-amber-500 focus:border-transparent cursor-pointer"
            >
              <option value="all">All Sessions</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Sessions List */}
        <div className="space-y-4">
          {filteredSessions().map((session, index) => {
            const upcoming = isUpcoming(session);
            const canJoin = canJoinSession(session);

            return (
              <div
                key={session.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  upcoming ? 'border-amber-200' : 'border-gray-100'
                }`}
              >
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Session Number */}
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    session.status === 'completed' 
                      ? 'bg-green-100' 
                      : upcoming 
                        ? 'bg-gradient-to-br from-amber-100 to-orange-100' 
                        : 'bg-gray-100'
                  }`}>
                    {session.status === 'completed' ? (
                      <Check className="w-7 h-7 text-green-600" />
                    ) : (
                      <span className={`text-xl font-bold ${upcoming ? 'text-amber-600' : 'text-gray-400'}`}>
                        {session.session_number}
                      </span>
                    )}
                  </div>

                  {/* Session Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800">
                        {session.session_type === 'coaching' ? '📚 Coaching Session' : '👨‍👩‍👧 Parent Check-in'}
                      </h3>
                      {getStatusBadge(session.status)}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(session.scheduled_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(session.scheduled_time)}
                      </span>
                      <span>{session.duration_minutes} min</span>
                    </div>
                  </div>

                  {/* Join Button */}
                  {session.google_meet_link && session.status !== 'cancelled' && session.status !== 'completed' && (
                    <a
                      href={session.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                        canJoin
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <Video className="w-5 h-5" />
                      {canJoin ? 'Join Now' : 'Join'}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                {/* Upcoming Session Banner */}
                {upcoming && index === 0 && session.status === 'scheduled' && (
                  <div className="px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-t border-amber-100">
                    <p className="text-sm text-amber-700">
                      ✨ <strong>Next session!</strong> Join link will activate 10 minutes before the scheduled time.
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {filteredSessions().length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-amber-100">
              <Calendar className="w-12 h-12 text-amber-200 mx-auto mb-3" />
              <p className="text-gray-500">No sessions found</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-8 p-4 bg-amber-50 rounded-xl">
          <h3 className="font-medium text-amber-800 mb-3">Session Types</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span>📚</span>
              <span><strong>Coaching Session</strong> - 45 min 1:1 with coach</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span>👨‍👩‍👧</span>
              <span><strong>Parent Check-in</strong> - 30 min progress review</span>
            </div>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}
