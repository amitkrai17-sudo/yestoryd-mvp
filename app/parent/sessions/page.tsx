'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
      <ParentLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#7b008b] border-t-transparent rounded-full animate-spin" />
        </div>
      </ParentLayout>
    );
  }

  if (sessions.length === 0) {
    return (
      <ParentLayout>
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
      </ParentLayout>
    );
  }

  return (
    <ParentLayout>
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

        <div className="space-y-4">
          {filteredSessions().map((session, index) => {
            const upcoming = isUpcoming(session);
            const canJoin = canJoinSession(session);

            return (
              <div
                key={session.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  upcoming ? 'border-[#7b008b]/30' : 'border-gray-100'
                }`}
              >
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    session.status === 'completed' 
                      ? 'bg-green-100' 
                      : upcoming 
                        ? 'bg-gradient-to-br from-[#7b008b]/10 to-[#ff0099]/10' 
                        : 'bg-gray-100'
                  }`}>
                    {session.status === 'completed' ? (
                      <Check className="w-7 h-7 text-green-600" />
                    ) : (
                      <span className={`text-xl font-bold ${upcoming ? 'text-[#7b008b]' : 'text-gray-400'}`}>
                        {session.session_number}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800">
                        {session.title || (session.session_type === 'coaching' ? '📚 Coaching Session' : '👨‍👩‍👧 Parent Check-in')}
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
                      <span>{session.duration_minutes || 45} min</span>
                    </div>
                  </div>

                  {session.google_meet_link && session.status !== 'cancelled' && session.status !== 'completed' && (
                    <a
                      href={session.google_meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                        canJoin
                          ? 'bg-[#7b008b] text-white hover:bg-[#6a0078] shadow-lg shadow-[#7b008b]/30'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <Video className="w-5 h-5" />
                      {canJoin ? 'Join Now' : 'Join'}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>

                {upcoming && index === 0 && session.status === 'scheduled' && (
                  <div className="px-5 py-3 bg-[#7b008b]/5 border-t border-[#7b008b]/10">
                    <p className="text-sm text-[#7b008b]">
                      ✨ <strong>Next session!</strong> Join link will activate 10 minutes before the scheduled time.
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
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span>📚</span>
              <span><strong>Coaching Session</strong> - 45 min 1:1 with coach</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <span>👨‍👩‍👧</span>
              <span><strong>Parent Check-in</strong> - 15 min progress review</span>
            </div>
          </div>
        </div>
      </div>
    </ParentLayout>
  );
}