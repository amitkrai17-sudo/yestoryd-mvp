'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen, Calendar, Clock, ChevronRight,
  Video, Trophy, Flame, Award, Sparkles,
  CheckCircle, Loader2, ExternalLink,
} from 'lucide-react';

// ─── Types ───

interface UpcomingSession {
  registration_id: string;
  session_id: string;
  child_id: string;
  child_name: string;
  title: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  google_meet_link: string | null;
  class_type_name: string;
  class_type_slug: string;
  icon_emoji: string | null;
  color_hex: string | null;
  is_enrolled_free: boolean;
  has_blueprint: boolean;
}

interface PastSession {
  registration_id: string;
  session_id: string;
  child_id: string;
  child_name: string;
  title: string;
  scheduled_date: string;
  scheduled_time: string;
  class_type_name: string;
  class_type_slug: string;
  icon_emoji: string | null;
  color_hex: string | null;
  attendance_status: string | null;
  participation_rating: number | null;
  micro_insight: string | null;
  badges_earned: string[];
}

interface GroupClassBadge {
  id: string;
  name: string;
  icon: string;
  slug: string;
  description: string;
  earned_at: string | null;
}

interface GroupClassesData {
  upcoming: UpcomingSession[];
  past: PastSession[];
  stats: { total_attended: number; current_streak: number; badges_earned: number };
  badges: GroupClassBadge[];
}

// ─── Helpers ───

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';

    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatTime(time: string): string {
  if (!time) return '';
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch {
    return time;
  }
}

function isWithin30Min(dateStr: string, timeStr: string): boolean {
  try {
    const sessionTime = new Date(`${dateStr}T${timeStr}`);
    const now = Date.now();
    const diff = sessionTime.getTime() - now;
    return diff <= 30 * 60 * 1000 && diff >= -60 * 60 * 1000; // 30 min before to 60 min after
  } catch {
    return false;
  }
}

function engagementLabel(rating: number | null): { text: string; color: string } {
  if (!rating) return { text: '', color: '' };
  if (rating >= 5) return { text: 'High', color: 'text-green-600' };
  if (rating >= 3) return { text: 'Medium', color: 'text-yellow-600' };
  return { text: 'Low', color: 'text-orange-600' };
}

// ─── Main Component ───

export default function GroupClassesSection({
  childId,
}: {
  childId: string | null;
}) {
  const [data, setData] = useState<GroupClassesData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const url = childId
        ? `/api/parent/group-classes?child_id=${childId}`
        : '/api/parent/group-classes';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch group classes:', err);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for child changes
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('childChanged', handler);
    return () => window.removeEventListener('childChanged', handler);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Group Classes</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-[#7b008b] animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || (data.upcoming.length === 0 && data.past.length === 0)) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Group Classes</h2>
        </div>
        <div className="text-center py-6">
          <Sparkles className="w-12 h-12 text-[#7b008b]/30 mx-auto mb-3" />
          <p className="text-gray-600 text-sm mb-1">Join a fun learning class</p>
          <p className="text-gray-500 text-xs mb-4">Starting from ₹199</p>
          <Link
            href="/classes"
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white rounded-xl font-semibold hover:opacity-90 transition-all text-sm min-h-[44px]"
          >
            Browse Classes
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-purple-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Group Classes</h2>
        </div>
        <Link
          href="/classes"
          className="text-xs text-[#FF0099] font-medium flex items-center gap-1 hover:underline"
        >
          Browse More <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{data.stats.total_attended}</p>
          <p className="text-xs text-gray-500 mt-0.5">Attended</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-gray-900 flex items-center justify-center gap-1">
            {data.stats.current_streak}
            {data.stats.current_streak > 0 && <Flame className="w-4 h-4 text-orange-500" />}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Streak</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-gray-900 flex items-center justify-center gap-1">
            {data.stats.badges_earned}
            {data.stats.badges_earned > 0 && <Trophy className="w-4 h-4 text-amber-500" />}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Badges</p>
        </div>
      </div>

      {/* Badges ribbon */}
      {data.badges.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide snap-x snap-mandatory">
          {data.badges.slice(0, 5).map(badge => (
            <div
              key={badge.id}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full whitespace-nowrap flex-shrink-0 snap-start"
              title={badge.description}
            >
              <span className="text-sm">{badge.icon || '🏆'}</span>
              <span className="text-xs font-medium text-amber-700">{badge.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming Sessions */}
      {data.upcoming.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Upcoming
          </h3>
          <div className="space-y-3">
            {data.upcoming.map(session => {
              const showJoin = session.google_meet_link && isWithin30Min(session.scheduled_date, session.scheduled_time);
              return (
                <div
                  key={session.registration_id}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                      style={{ backgroundColor: (session.color_hex || '#7b008b') + '20' }}
                    >
                      {session.icon_emoji || '📖'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{session.class_type_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(session.scheduled_date)} · {formatTime(session.scheduled_time)} · {session.duration_minutes}min
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        For {session.child_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {session.is_enrolled_free && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            FREE
                          </span>
                        )}
                        {showJoin && (
                          <a
                            href={session.google_meet_link || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors min-h-[32px]"
                          >
                            <Video className="w-3 h-3" />
                            Join Meet
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past Sessions */}
      {data.past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
            Recent
          </h3>
          <div className="space-y-3">
            {data.past.map(session => {
              const engagement = engagementLabel(session.participation_rating);
              return (
                <div
                  key={session.registration_id}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                      style={{ backgroundColor: (session.color_hex || '#7b008b') + '20' }}
                    >
                      {session.icon_emoji || '📖'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{session.class_type_name}</p>
                        {session.attendance_status === 'present' && (
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(session.scheduled_date)} · {session.child_name}
                        {engagement.text && (
                          <span className={`ml-2 ${engagement.color}`}>· {engagement.text} engagement</span>
                        )}
                      </p>

                      {/* Micro-insight */}
                      {session.micro_insight ? (
                        <div className="mt-2 bg-white rounded-lg p-3 border-l-2 border-purple-500">
                          <p className="text-xs text-gray-600 leading-relaxed">{session.micro_insight}</p>
                          {session.badges_earned.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <Award className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-xs text-amber-700 font-medium">
                                {session.badges_earned.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : session.attendance_status === 'present' ? (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Insight generating...
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
