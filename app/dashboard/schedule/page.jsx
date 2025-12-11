'use client';

// app/dashboard/schedule/page.jsx
// Parent Dashboard - View child's schedule

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const SESSION_TYPES = {
  coaching: { label: '1:1 Coaching', color: 'bg-purple-100 text-purple-800', icon: '👨‍🏫' },
  parent_checkin: { label: 'Parent Check-in', color: 'bg-blue-100 text-blue-800', icon: '👨‍👩‍👧' },
};

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function SchedulePage() {
  const searchParams = useSearchParams();
  const childId = searchParams.get('child');
  const email = searchParams.get('email');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('upcoming');

  useEffect(() => {
    fetchSchedule();
  }, [childId, email, filter]);

  async function fetchSchedule() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ filter });
      if (childId) params.append('childId', childId);
      if (email) params.append('email', email);

      const res = await fetch(`/api/schedule?${params}`);
      const result = await res.json();
      
      if (res.ok) {
        setData(result);
      } else {
        setError(result.error || 'Failed to load schedule');
      }
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
      setError('Failed to connect to server');
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error: {error}</p>
          <p className="text-gray-600">Please check the link or try again.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No schedule found. Please check the link.</p>
        </div>
      </div>
    );
  }

  const { child, coach, sessions } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {child.name}'s Schedule
          </h1>
          <p className="text-gray-600 mt-1">
            Coach: {coach?.name || 'Assigned'} • {child.programStart} to {child.programEnd}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['upcoming', 'all', 'past'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-purple-700">{sessions.length}</div>
            <div className="text-sm text-purple-600">Total Sessions</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-700">
              {sessions.filter(s => s.status === 'completed').length}
            </div>
            <div className="text-sm text-green-600">Completed</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">
              {sessions.filter(s => s.status === 'scheduled').length}
            </div>
            <div className="text-sm text-blue-600">Upcoming</div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No sessions found
            </div>
          ) : (
            sessions.map((session, idx) => (
              <SessionRow 
                key={session.id} 
                session={session} 
                isLast={idx === sessions.length - 1} 
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function SessionRow({ session, isLast }) {
  const type = SESSION_TYPES[session.type] || { 
    label: session.type, 
    color: 'bg-gray-100 text-gray-800', 
    icon: '📅' 
  };
  
  const sessionDate = new Date(session.date);
  const isPast = sessionDate < new Date();
  const isToday = sessionDate.toDateString() === new Date().toDateString();

  return (
    <div className={`flex items-center gap-4 p-4 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      {/* Date */}
      <div className="w-16 text-center">
        <div className="text-xs text-gray-500 uppercase">
          {sessionDate.toLocaleDateString('en-US', { weekday: 'short' })}
        </div>
        <div className={`text-2xl font-bold ${isToday ? 'text-purple-600' : 'text-gray-900'}`}>
          {sessionDate.getDate()}
        </div>
        <div className="text-xs text-gray-500">
          {sessionDate.toLocaleDateString('en-US', { month: 'short' })}
        </div>
      </div>

      {/* Session Info */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xl">{type.icon}</span>
          <span className="font-medium text-gray-900">{session.title}</span>
          {isToday && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Today
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {session.time?.slice(0, 5)} • {session.duration} min • Week {session.week}
        </div>
      </div>

      {/* Status */}
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[session.status] || 'bg-gray-100'}`}>
        {session.status}
      </span>

      {/* Join Button */}
      {session.meetLink && !isPast && (
        <a
          href={session.meetLink}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
        >
          Join
        </a>
      )}
    </div>
  );
}
