'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SessionCompleteForm, PreSessionBrief } from '@/components/coach';
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
  FileText,
} from 'lucide-react';

interface Session {
  id: string;
  child_id: string;
  child_name: string;
  child_age: number;
  parent_name: string;
  scheduled_date: string;
  scheduled_time: string;
  session_type: string;
  session_number?: number;
  status: string;
  google_meet_link: string;
  has_notes: boolean;
  // Pre-Session Brief data
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

export default function CoachSessionsPage() {
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showPrepModal, setShowPrepModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
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
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCompleteModal = (session: Session) => {
    setSelectedSession(session);
    setShowCompleteModal(true);
  };

  const openPrepModal = (session: Session) => {
    setSelectedSession(session);
    setShowPrepModal(true);
  };

  const handleSessionCompleted = () => {
    loadSessions();
    setShowCompleteModal(false);
    setSelectedSession(null);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-medium">Completed</span>;
      case 'cancelled':
        return <span className="bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full text-xs font-medium">Cancelled</span>;
      case 'scheduled':
        return <span className="bg-[#00ABFF]/20 text-[#00ABFF] px-2.5 py-1 rounded-full text-xs font-medium">Scheduled</span>;
      default:
        return <span className="bg-yellow-500/20 text-yellow-400 px-2.5 py-1 rounded-full text-xs font-medium">Pending</span>;
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
    if (filterStatus === 'upcoming') return isUpcoming(s.scheduled_date) && (s.status === 'scheduled' || s.status === 'pending');
    if (filterStatus === 'completed') return s.status === 'completed';
    if (filterStatus === 'today') return isToday(s.scheduled_date);
    return s.status === filterStatus;
  });

  const groupedSessions = filteredSessions.reduce((groups: Record<string, Session[]>, session) => {
    const date = session.scheduled_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(session);
    return groups;
  }, {});

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
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF0099] animate-spin" />
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
                view === 'list' 
                  ? 'bg-[#FF0099] text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'calendar' 
                  ? 'bg-[#FF0099] text-white' 
                  : 'text-gray-400 hover:text-white'
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
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-[#FF0099] focus:ring-1 focus:ring-[#FF0099]/50"
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
        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm mb-1">Today</p>
          <p className="text-3xl font-bold text-white">
            {sessions.filter((s) => isToday(s.scheduled_date)).length}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm mb-1">This Week</p>
          <p className="text-3xl font-bold text-[#00ABFF]">
            {sessions.filter((s) => {
              const date = new Date(s.scheduled_date);
              const today = new Date();
              const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
              return date >= today && date <= weekEnd;
            }).length}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm mb-1">Completed</p>
          <p className="text-3xl font-bold text-emerald-400">
            {sessions.filter((s) => s.status === 'completed').length}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-sm mb-1">Upcoming</p>
          <p className="text-3xl font-bold text-purple-400">
            {sessions.filter((s) => isUpcoming(s.scheduled_date) && (s.status === 'scheduled' || s.status === 'pending')).length}
          </p>
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
                  {/* Date Header */}
                  <div className={`px-5 py-3 ${isToday(date) ? 'bg-[#FF0099]/10' : 'bg-gray-700/30'}`}>
                    <p className={`font-semibold ${isToday(date) ? 'text-[#FF0099]' : 'text-gray-300'}`}>
                      {isToday(date) ? '📅 Today - ' : ''}{formatDate(date)}
                    </p>
                  </div>
                  {/* Sessions for this date */}
                  {dateSessions.map((session) => (
                    <div key={session.id} className="p-5 hover:bg-gray-700/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        {/* Session Info */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="text-center min-w-[60px]">
                            <p className="text-white font-semibold">{formatTime(session.scheduled_time)}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white font-medium text-lg">{session.child_name}</p>
                              {getStatusBadge(session.status)}
                              {session.has_notes && (
                                <span title="Has notes">
                                  <FileText className="w-4 h-4 text-yellow-400" />
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-sm mt-0.5">{session.session_type}</p>
                          </div>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 ml-[60px] sm:ml-0">
                          {/* Prep Button */}
                          {(session.status === 'scheduled' || session.status === 'pending') && (
                            <button
                              onClick={() => openPrepModal(session)}
                              className="flex items-center gap-2 bg-[#00ABFF] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#00ABFF]/80 transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                              Prep
                            </button>
                          )}
                          {/* Complete Session Button */}
                          {(session.status === 'scheduled' || session.status === 'pending') && (
                            <button
                              onClick={() => openCompleteModal(session)}
                              className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-600 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Complete
                            </button>
                          )}
                          {/* Join Meeting Button */}
                          {session.google_meet_link && (session.status === 'scheduled' || session.status === 'pending') && (
                            <a
                              href={session.google_meet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#25D366]/90 transition-colors"
                            >
                              <Video className="w-4 h-4" />
                              Join
                            </a>
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
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden">
          {/* Calendar Header */}
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

          {/* Calendar Grid */}
          <div className="p-4">
            {/* Day Names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-gray-500 text-sm py-2 font-medium">
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
                    className={`h-24 border rounded-xl p-1.5 ${
                      isCurrentDay ? 'border-[#FF0099] bg-[#FF0099]/10' : 'border-gray-700'
                    }`}
                  >
                    <p className={`text-sm ${isCurrentDay ? 'text-[#FF0099] font-bold' : 'text-gray-400'}`}>
                      {day}
                    </p>
                    <div className="space-y-1 mt-1 overflow-y-auto max-h-16">
                      {daySessions.slice(0, 2).map((session) => (
                        <div
                          key={session.id}
                          className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${
                            session.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-[#00ABFF]/20 text-[#00ABFF]'
                          }`}
                          onClick={() => (session.status === 'scheduled' || session.status === 'pending') && openCompleteModal(session)}
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
    </div>
  );
}
