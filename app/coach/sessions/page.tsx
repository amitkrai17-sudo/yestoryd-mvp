'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CoachLayout } from '@/components/coach/CoachLayout';
import {
  Calendar,
  Clock,
  Video,
  User,
  Filter,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Session {
  id: string;
  child_id: string;
  child_name: string;
  parent_name: string;
  scheduled_date: string;
  scheduled_time: string;
  session_type: string;
  status: string;
  google_meet_link: string;
  has_notes: boolean;
}

export default function CoachSessionsPage() {
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/coach/login';
        return;
      }

      const { data: coachData } = await supabase
        .from('coaches')
        .select('*')
        .eq('email', user.email)
        .single();

      if (!coachData) {
        window.location.href = '/coach/login';
        return;
      }

      setCoach(coachData);

      // Get all sessions with child details
      const { data: sessionsData } = await supabase
        .from('scheduled_sessions')
        .select(`
          id,
          child_id,
          scheduled_date,
          scheduled_time,
          session_type,
          status,
          google_meet_link,
          children (
            child_name,
            parent_name
          )
        `)
        .eq('coach_id', coachData.id)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true });

      // Get session notes to check which sessions have notes
      const { data: notesData } = await supabase
        .from('session_notes')
        .select('session_id')
        .eq('coach_id', coachData.id);

      const notesSessionIds = new Set(notesData?.map((n) => n.session_id) || []);

      const formattedSessions: Session[] = (sessionsData || []).map((s: any) => ({
        id: s.id,
        child_id: s.child_id,
        child_name: s.children?.child_name || 'Unknown',
        parent_name: s.children?.parent_name || '',
        scheduled_date: s.scheduled_date,
        scheduled_time: s.scheduled_time,
        session_type: s.session_type,
        status: s.status,
        google_meet_link: s.google_meet_link,
        has_notes: notesSessionIds.has(s.id),
      }));

      setSessions(formattedSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'scheduled':
        return <Clock className="w-4 h-4 text-blue-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">Completed</span>;
      case 'cancelled':
        return <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs">Cancelled</span>;
      case 'scheduled':
        return <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">Scheduled</span>;
      default:
        return <span className="bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded text-xs">Pending</span>;
    }
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const isUpcoming = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr >= today;
  };

  const filteredSessions = sessions.filter((s) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'upcoming') return isUpcoming(s.scheduled_date) && s.status === 'scheduled';
    if (filterStatus === 'completed') return s.status === 'completed';
    if (filterStatus === 'today') return isToday(s.scheduled_date);
    return s.status === filterStatus;
  });

  // Group sessions by date for list view
  const groupedSessions = filteredSessions.reduce((groups: Record<string, Session[]>, session) => {
    const date = session.scheduled_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(session);
    return groups;
  }, {});

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getSessionsForDay = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return sessions.filter((s) => s.scheduled_date === dateStr);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
      </div>
    );
  }

  if (!coach) return null;

  return (
    <CoachLayout coach={coach}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-7 h-7 text-blue-400" />
              Sessions
            </h1>
            <p className="text-gray-400">{sessions.length} total sessions</p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'list' ? 'bg-pink-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'calendar' ? 'bg-pink-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Calendar
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-pink-500"
              >
                <option value="all">All Sessions</option>
                <option value="today">Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Today</p>
            <p className="text-2xl font-bold text-white">
              {sessions.filter((s) => isToday(s.scheduled_date)).length}
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">This Week</p>
            <p className="text-2xl font-bold text-white">
              {sessions.filter((s) => {
                const date = new Date(s.scheduled_date);
                const today = new Date();
                const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                return date >= today && date <= weekEnd;
              }).length}
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Completed</p>
            <p className="text-2xl font-bold text-green-400">
              {sessions.filter((s) => s.status === 'completed').length}
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Upcoming</p>
            <p className="text-2xl font-bold text-blue-400">
              {sessions.filter((s) => isUpcoming(s.scheduled_date) && s.status === 'scheduled').length}
            </p>
          </div>
        </div>

        {/* List View */}
        {view === 'list' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {Object.keys(groupedSessions).length === 0 ? (
              <div className="p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No sessions found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {Object.entries(groupedSessions).map(([date, dateSessions]) => (
                  <div key={date}>
                    {/* Date Header */}
                    <div className={`px-4 py-2 ${isToday(date) ? 'bg-pink-500/20' : 'bg-gray-700/50'}`}>
                      <p className={`font-medium ${isToday(date) ? 'text-pink-400' : 'text-gray-300'}`}>
                        {isToday(date) ? '📍 Today - ' : ''}{formatDate(date)}
                      </p>
                    </div>
                    {/* Sessions for this date */}
                    {dateSessions.map((session) => (
                      <div key={session.id} className="p-4 hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="text-center min-w-[60px]">
                              <p className="text-white font-medium">{formatTime(session.scheduled_time)}</p>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-white font-medium">{session.child_name}</p>
                                {getStatusBadge(session.status)}
                                {session.has_notes && (
                                  <FileText className="w-4 h-4 text-yellow-400" title="Has notes" />
                                )}
                              </div>
                              <p className="text-gray-400 text-sm">{session.session_type}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {session.google_meet_link && session.status === 'scheduled' && (
                              <a
                                href={session.google_meet_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                              >
                                <Video className="w-4 h-4" />
                                Join
                              </a>
                            )}
                            <a
                              href={`/coach/students/${session.child_id}`}
                              className="p-2 bg-gray-700 text-gray-400 rounded-lg hover:bg-gray-600 hover:text-white transition-colors"
                              title="View Student"
                            >
                              <User className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Calendar View */}
        {view === 'calendar' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            {/* Calendar Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
              </button>
              <h3 className="text-white font-semibold">
                {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
              {/* Day Names */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-gray-500 text-sm py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
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
                      className={`h-24 border rounded-lg p-1 ${
                        isCurrentDay ? 'border-pink-500 bg-pink-500/10' : 'border-gray-700'
                      }`}
                    >
                      <p className={`text-sm ${isCurrentDay ? 'text-pink-400 font-bold' : 'text-gray-400'}`}>
                        {day}
                      </p>
                      <div className="space-y-1 mt-1 overflow-y-auto max-h-16">
                        {daySessions.slice(0, 2).map((session) => (
                          <div
                            key={session.id}
                            className={`text-xs px-1 py-0.5 rounded truncate ${
                              session.status === 'completed'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {formatTime(session.scheduled_time)} {session.child_name}
                          </div>
                        ))}
                        {daySessions.length > 2 && (
                          <p className="text-xs text-gray-500">+{daySessions.length - 2} more</p>
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
    </CoachLayout>
  );
}
