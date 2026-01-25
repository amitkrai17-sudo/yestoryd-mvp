'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Video,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Zap,
  Loader2,
  BookOpen,
  Users,
  Sparkles,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Session {
  id: string;
  session_type: string;
  session_number: number;
  scheduled_date: string;
  scheduled_time: string;
  google_meet_link: string;
  status: string;
  duration_minutes: number;
  title: string;
  focus_area?: string;
}

export default function ParentSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [childName, setChildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const router = useRouter();

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/parent/login');
        return;
      }

      // Find parent record
      const { data: parentData } = await supabase
        .from('parents')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();

      let enrolledChild = null;

      // Find enrolled child by parent_id first
      if (parentData?.id) {
        const { data: childByParentId } = await supabase
          .from('children')
          .select('id, name')
          .eq('parent_id', parentData.id)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (childByParentId) {
          enrolledChild = childByParentId;
        }
      }

      // Fallback: try by parent_email
      if (!enrolledChild) {
        const { data: childByEmail } = await supabase
          .from('children')
          .select('id, name')
          .eq('parent_email', user.email)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (childByEmail) {
          enrolledChild = childByEmail;
        }
      }

      if (enrolledChild) {
        setChildName(enrolledChild.name || 'Your Child');

        const { data: sessionsData } = await supabase
          .from('scheduled_sessions')
          .select('*')
          .eq('child_id', enrolledChild.id)
          .order('scheduled_date', { ascending: true })
          .order('scheduled_time', { ascending: true });

        setSessions(sessionsData || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setLoading(false);
    }
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
    if (!time) return '';
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
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#7b008b]/10 text-[#7b008b] rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Scheduled
          </span>
        );
    }
  }

  function getSessionTitle(session: Session): string {
    if (session.title) return session.title;

    if (session.session_type === 'remedial') {
      return 'Skill Booster Session';
    }
    if (session.session_type === 'coaching') {
      return 'Coaching Session';
    }
    if (session.session_type === 'parent_checkin') {
      return 'Parent Check-in';
    }
    return 'Session';
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
    return minutesDiff <= 10 && minutesDiff >= -(session.duration_minutes || 45);
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-[#7b008b] animate-spin" />
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Sessions</h1>
            <p className="text-gray-500">View and join your scheduled sessions</p>
          </div>
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Calendar className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No Sessions Scheduled</h2>
            <p className="text-gray-500 mb-6">Sessions will appear here once your enrollment is confirmed.</p>
            <Link
              href="/parent/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#7b008b] text-white rounded-xl font-semibold hover:bg-[#6a0078] transition-all"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Sessions</h1>
            <p className="text-gray-500">{childName}'s scheduled sessions</p>
          </div>

          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="appearance-none px-4 py-2 pr-10 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium focus:ring-2 focus:ring-[#7b008b] focus:border-transparent cursor-pointer"
            >
              <option value="all">All Sessions ({sessions.length})</option>
              <option value="upcoming">Upcoming ({sessions.filter(isUpcoming).length})</option>
              <option value="completed">Completed ({sessions.filter(s => s.status === 'completed').length})</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-3">
          {filteredSessions().map((session, index) => {
            const upcoming = isUpcoming(session);
            const canJoin = canJoinSession(session);
            const isSkillBooster = session.session_type === 'remedial';

            return (
              <div
                key={session.id}
                className={`bg-white rounded-xl border shadow-sm transition-all ${
                  isSkillBooster
                    ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50'
                    : session.status === 'completed'
                      ? 'border-gray-100'
                      : upcoming && index === 0
                        ? 'border-[#FF0099]/40 ring-1 ring-[#FF0099]/20'
                        : 'border-gray-100'
                }`}
              >
                <div className="p-4 flex items-center gap-4">
                  {/* Left: Status Icon */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                    session.status === 'completed'
                      ? 'bg-green-100'
                      : session.status === 'cancelled'
                        ? 'bg-red-100'
                        : isSkillBooster
                          ? 'bg-amber-200'
                          : upcoming
                            ? 'bg-[#FF0099]/10'
                            : 'bg-gray-100'
                  }`}>
                    {session.status === 'completed' ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : session.status === 'cancelled' ? (
                      <X className="w-5 h-5 text-red-600" />
                    ) : isSkillBooster ? (
                      <Zap className="w-5 h-5 text-amber-700" />
                    ) : (
                      <span className={`text-sm font-bold ${upcoming ? 'text-[#FF0099]' : 'text-gray-400'}`}>
                        {session.session_number}
                      </span>
                    )}
                  </div>

                  {/* Middle: Session Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">
                        {getSessionTitle(session)}
                      </span>
                      {isSkillBooster && (
                        <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-xs font-medium">
                          Bonus
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                        session.status === 'completed' ? 'bg-green-100 text-green-700' :
                        session.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        session.status === 'rescheduled' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {session.status === 'completed' ? 'Done' :
                         session.status === 'cancelled' ? 'Cancelled' :
                         session.status === 'rescheduled' ? 'Rescheduled' :
                         'Upcoming'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatDate(session.scheduled_date)} · {formatTime(session.scheduled_time)} · {session.duration_minutes || 45} min
                      {isSkillBooster && session.focus_area && ` · ${session.focus_area.replace(/_/g, ' ')}`}
                    </p>
                  </div>

                  {/* Right: Action */}
                  {session.google_meet_link && session.status !== 'cancelled' && session.status !== 'completed' && (
                    <a
                      href={session.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-all min-h-[40px] flex-shrink-0 ${
                        canJoin
                          ? 'bg-[#FF0099] text-white hover:bg-[#CC007A] shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Video className="w-4 h-4" />
                      <span className="text-sm">{canJoin ? 'Join Now' : 'Join'}</span>
                    </a>
                  )}
                </div>

                {/* Next Session Highlight */}
                {upcoming && index === 0 && session.status === 'scheduled' && (
                  <div className={`px-4 py-2.5 border-t ${
                    isSkillBooster
                      ? 'bg-amber-100/50 border-amber-200'
                      : 'bg-[#FF0099]/5 border-[#FF0099]/10'
                  }`}>
                    <p className={`text-sm flex items-center gap-2 ${isSkillBooster ? 'text-amber-700' : 'text-[#FF0099]'}`}>
                      <Sparkles className="w-4 h-4 flex-shrink-0" />
                      <span><strong>Next session!</strong> Join link activates 10 min before.</span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {filteredSessions().length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">No {filter === 'all' ? '' : filter} sessions found</p>
            </div>
          )}
        </div>

        {/* Session Types Info */}
        <div className="mt-8 p-4 bg-[#7b008b]/5 rounded-xl border border-[#7b008b]/10">
          <h3 className="font-medium text-[#7b008b] mb-3">Session Types</h3>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <BookOpen className="w-4 h-4 text-[#7b008b]" />
              <span><strong>Coaching</strong> - 45 min 1:1</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="w-4 h-4 text-[#7b008b]" />
              <span><strong>Parent Check-in</strong> - 15 min</span>
            </div>
            <div className="flex items-center gap-2 text-yellow-700">
              <Zap className="w-4 h-4" />
              <span><strong>Skill Booster</strong> - Bonus session</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
