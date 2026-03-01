'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Target, BookOpen, BarChart3, TrendingUp,
  MessageSquare, ChevronDown, Loader2, Award,
  Sparkles, ChevronRight, FileText,
} from 'lucide-react';

// ─── Types ───

interface TimelineEvent {
  id: string;
  event_type: string;
  event_date: string | null;
  title: string;
  summary: string | null;
  details: Record<string, unknown>;
  created_at: string | null;
}

interface TimelineData {
  events: TimelineEvent[];
  total_count: number;
  has_more: boolean;
}

// ─── Event config ───

const EVENT_CONFIG: Record<string, { icon: typeof Target; color: string; borderColor: string }> = {
  session: { icon: Target, color: 'text-blue-400', borderColor: 'border-l-blue-500' },
  diagnostic_assessment: { icon: BarChart3, color: 'text-green-400', borderColor: 'border-l-green-500' },
  assessment: { icon: BarChart3, color: 'text-green-400', borderColor: 'border-l-green-500' },
  group_class_observation: { icon: BookOpen, color: 'text-purple-400', borderColor: 'border-l-purple-500' },
  group_class_micro_insight: { icon: Sparkles, color: 'text-purple-400', borderColor: 'border-l-purple-500' },
  group_class_response: { icon: MessageSquare, color: 'text-purple-400', borderColor: 'border-l-purple-500' },
  progress_pulse: { icon: TrendingUp, color: 'text-orange-400', borderColor: 'border-l-orange-500' },
  parent_session_summary: { icon: FileText, color: 'text-blue-400', borderColor: 'border-l-blue-500' },
  nps_feedback: { icon: MessageSquare, color: 'text-teal-400', borderColor: 'border-l-teal-500' },
};

// ─── Helpers ───

function getDateGroup(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Today';
    if (diffDays <= 7) return 'This Week';
    if (diffDays <= 14) return 'Last Week';

    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

function formatEventDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ─── Event renderer ───

function EventCard({ event }: { event: TimelineEvent }) {
  const config = EVENT_CONFIG[event.event_type] || { icon: Target, color: 'text-gray-400', borderColor: 'border-l-gray-500' };
  const Icon = config.icon;
  const d = event.details;

  return (
    <div className={`bg-gray-50 rounded-xl p-4 border-l-[3px] ${config.borderColor}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 ${config.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{event.title}</p>
            <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
              {formatEventDate(event.event_date)}
            </span>
          </div>

          {/* Event-specific content */}
          {event.event_type === 'session' && (
            <div className="mt-1.5 space-y-1">
              {!!d.focus_area && (
                <p className="text-xs text-gray-600">
                  Focus: <span className="text-gray-900">{String(d.focus_area).replace(/_/g, ' ')}</span>
                </p>
              )}
              {!!d.engagement_level && (
                <p className="text-xs text-gray-600">
                  Engagement: <span className="text-gray-900">{String(d.engagement_level)}</span>
                </p>
              )}
              {!!d.breakthrough_moment && (
                <p className="text-xs text-green-400 mt-1">
                  ✨ {String(d.breakthrough_moment)}
                </p>
              )}
              {Array.isArray(d.key_observations) && d.key_observations.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {(d.key_observations as string[]).slice(0, 2).join(' · ')}
                </p>
              )}
            </div>
          )}

          {event.event_type === 'group_class_observation' && (
            <div className="mt-1.5 space-y-1">
              {!!d.engagement_level && (
                <p className="text-xs text-gray-600">
                  Engagement: <span className="text-gray-900">{String(d.engagement_level)}</span>
                </p>
              )}
              {Array.isArray(d.skill_tags) && d.skill_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {(d.skill_tags as string[]).slice(0, 4).map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {event.event_type === 'group_class_micro_insight' && (
            <div className="mt-1.5">
              {!!d.insight_text && (
                <p className="text-xs text-gray-600 leading-relaxed">
                  {String(d.insight_text)}
                </p>
              )}
              {Array.isArray(d.badges_earned) && d.badges_earned.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs text-amber-700 font-medium">
                    {(d.badges_earned as string[]).join(', ')}
                  </span>
                </div>
              )}
              {!!d.cta_type && d.cta_type !== 'none' && (
                <Link
                  href={d.cta_type === 'portal' ? '#' : '/assessment'}
                  className="inline-flex items-center gap-1 mt-2 text-xs text-[#FF0099] font-medium hover:underline"
                >
                  {d.cta_type === 'assessment' || d.cta_type === 'soft_assessment'
                    ? 'Take Free Assessment'
                    : d.cta_type === 'coaching'
                    ? 'Explore Coaching'
                    : 'View Journey'}
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )}

          {event.event_type === 'group_class_response' && !!d.response_text && (
            <div className="mt-1.5">
              <p className="text-xs text-gray-600 italic">
                &ldquo;{String(d.response_text).substring(0, 200)}&rdquo;
              </p>
            </div>
          )}

          {(event.event_type === 'assessment' || event.event_type === 'diagnostic_assessment') && (
            <div className="mt-1.5 flex flex-wrap gap-3">
              {d.score !== null && d.score !== undefined && (
                <span className="text-xs text-gray-600">
                  Score: <span className="text-gray-900 font-semibold">{String(d.score)}/10</span>
                </span>
              )}
              {!!d.wpm && (
                <span className="text-xs text-gray-600">
                  WPM: <span className="text-gray-900 font-semibold">{String(d.wpm)}</span>
                </span>
              )}
              {!!d.fluency && (
                <span className="text-xs text-gray-600">
                  Fluency: <span className="text-gray-900">{String(d.fluency)}</span>
                </span>
              )}
            </div>
          )}

          {event.event_type === 'progress_pulse' && (
            <div className="mt-1.5">
              {!!d.headline && (
                <p className="text-xs text-gray-900 font-medium">{String(d.headline)}</p>
              )}
              {!!d.parent_summary && (
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  {String(d.parent_summary).substring(0, 200)}
                </p>
              )}
            </div>
          )}

          {event.event_type === 'parent_session_summary' && event.summary && (
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
              {event.summary.substring(0, 200)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───

export default function ChildTimeline({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchData = useCallback(async (appendOffset = 0) => {
    try {
      if (appendOffset === 0) setLoading(true);
      else setLoadingMore(true);

      const res = await fetch(`/api/parent/child/${childId}/timeline?limit=15&offset=${appendOffset}`);
      if (res.ok) {
        const json: TimelineData = await res.json();
        if (appendOffset > 0 && data) {
          setData({
            ...json,
            events: [...data.events, ...json.events],
          });
        } else {
          setData(json);
        }
        setOffset(appendOffset + json.events.length);
      }
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [childId, data]);

  useEffect(() => {
    setOffset(0);
    setData(null);
    fetchData(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{childName}&apos;s Learning Journey</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-[#7b008b] animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{childName}&apos;s Learning Journey</h2>
        </div>
        <div className="text-center py-6">
          <Sparkles className="w-12 h-12 text-[#7b008b]/30 mx-auto mb-3" />
          <p className="text-gray-600 text-sm mb-4">
            Start {childName}&apos;s learning journey
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/assessment"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white rounded-xl text-sm font-semibold min-h-[44px]"
            >
              Take Assessment <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/classes"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-900 rounded-xl text-sm font-semibold border border-gray-200 min-h-[44px]"
            >
              Join a Class <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Group events by date
  const groupedEvents: Array<{ label: string; events: TimelineEvent[] }> = [];
  let currentGroup = '';

  for (const event of data.events) {
    const group = getDateGroup(event.event_date);
    if (group !== currentGroup) {
      currentGroup = group;
      groupedEvents.push({ label: group, events: [event] });
    } else {
      groupedEvents[groupedEvents.length - 1].events.push(event);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{childName}&apos;s Journey</h2>
          <p className="text-xs text-gray-500">{data.total_count} events</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-5">
        {groupedEvents.map((group, gi) => (
          <div key={gi}>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2.5">
              {group.label}
            </p>
            <div className="space-y-2.5">
              {group.events.map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {data.has_more && (
        <div className="mt-4 text-center">
          <button
            onClick={() => fetchData(offset)}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors min-h-[44px] border border-gray-200"
          >
            {loadingMore ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
