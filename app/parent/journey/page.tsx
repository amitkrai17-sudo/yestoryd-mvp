'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MapPin, CheckCircle, Circle, Video, Clock,
  ChevronDown, ChevronUp, Target, Sparkles, Lock,
  Calendar, Star, FileText, Film, ExternalLink,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { AgeBandBadge } from '@/components/AgeBandBadge';
import { useParentContext } from '@/app/parent/context';
import { supabase } from '@/lib/supabase/client';

interface PlanItem {
  id: string;
  session_number: number;
  title: string;
  template_code: string | null;
  skills: string[];
  duration_minutes: number | null;
  is_finale: boolean;
  status: string;
  completed_at: string | null;
}

interface SessionSummary {
  id: string;
  session_number: number | null;
  focus: string;
  highlights: string[];
  progress: string | null;
  summary: string | null;
  date: string;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatTime(time: string): string {
  if (!time) return '';
  try {
    const [h, m] = time.split(':').map(Number);
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  } catch {
    return time;
  }
}

export default function ParentJourneyPage() {
  const { selectedChildId, selectedChild } = useParentContext();
  const childName = selectedChild?.child_name || selectedChild?.name || 'Your Child';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);
  const [practiceEvents, setPracticeEvents] = useState<any[]>([]);
  const [enrollmentType, setEnrollmentType] = useState<string | null>(null);

  const fetchData = useCallback(async (childId: string) => {
    try {
      // Fetch enrollment type
      const { data: activeEnrollment } = await supabase
        .from('enrollments')
        .select('enrollment_type')
        .eq('child_id', childId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeEnrollment) setEnrollmentType(activeEnrollment.enrollment_type);

      const res = await fetch(`/api/parent/roadmap/${childId}`);
      const result = await res.json();
      if (result.success) {
        setData(result);
      }

      // Fetch practice materials assigned in last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: practiceData } = await supabase
        .from('learning_events')
        .select('id, event_data, created_at')
        .eq('child_id', childId)
        .eq('event_type', 'parent_practice_assigned')
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);
      setPracticeEvents(practiceData || []);
    } catch (err) {
      console.error('Journey fetch error:', err);
    }
  }, []);

  useEffect(() => {
    if (!selectedChildId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchData(selectedChildId).finally(() => setLoading(false));

    const handleChildChange = () => {
      setLoading(true);
      fetchData(selectedChildId).finally(() => setLoading(false));
    };
    window.addEventListener('childChanged', handleChildChange);
    return () => window.removeEventListener('childChanged', handleChildChange);
  }, [selectedChildId, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data || !data.roadmap) {
    const isTuition = enrollmentType === 'tuition';
    return (
      <div className="p-4 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-5">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Journey</h1>
            <p className="text-gray-500 text-sm mt-0.5">{childName}&apos;s learning roadmap</p>
          </div>
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h2 className="text-base font-medium text-gray-900 mb-1">Learning Journey</h2>
            <p className="text-gray-500 text-sm px-6">
              {isTuition
                ? `${childName}'s learning journey will grow with each session. Check back after your next tuition session.`
                : `${childName}'s personalized roadmap will appear here after the diagnostic session.`
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { child, roadmap, plan_items: planItems, completed_count: completedCount, total_sessions: totalSessions, next_session: nextSession, recent_summaries: recentSummaries, future_seasons: futureSeasons } = data;
  const progressPct = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;

  // Find current session index (first non-completed)
  const currentIdx = planItems.findIndex((p: PlanItem) => p.status !== 'completed');

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-medium text-gray-900">Journey</h1>
          <p className="text-gray-500 text-sm mt-0.5">{childName}&apos;s learning roadmap</p>
        </div>

        {/* Season Header — white card with pink accent */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                Season {roadmap.season_number}
              </p>
              <h2 className="text-lg font-medium text-gray-900 mt-0.5">
                {roadmap.season_name}
              </h2>
            </div>
            <AgeBandBadge ageBand={roadmap.age_band} />
          </div>

          {/* Focus Areas */}
          {roadmap.focus_areas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {roadmap.focus_areas.map((area: string) => (
                <span key={area} className="text-xs px-2.5 py-0.5 rounded-full bg-[#FFF5F9] text-[#993556] border border-[#FFD6E8]">
                  {area}
                </span>
              ))}
            </div>
          )}

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Session {completedCount} of {totalSessions}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF0099] rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Milestone */}
          {roadmap.milestone_description && (
            <p className="text-xs text-[#FF0099] mt-2 font-medium flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              {roadmap.milestone_description}
            </p>
          )}
        </div>

        {/* Next Session Card */}
        {nextSession && (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#FFD6E8] p-4">
            <p className="text-xs uppercase tracking-wider text-[#FF0099] font-medium mb-2">Next Session</p>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-gray-900 font-medium text-base">
                  {nextSession.is_diagnostic ? 'Diagnostic Session' : (nextSession.template_title || `Session ${nextSession.session_number}`)}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-gray-500 text-sm">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(nextSession.date)}
                  </span>
                  <span>{formatTime(nextSession.time)}</span>
                  {nextSession.duration_minutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {nextSession.duration_minutes}m
                    </span>
                  )}
                </div>
                {nextSession.coach_name && (
                  <p className="text-gray-500 text-xs mt-1">with Coach {nextSession.coach_name}</p>
                )}
              </div>
              {nextSession.google_meet_link && (
                <a
                  href={nextSession.google_meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#FF0099] text-white rounded-xl text-sm font-semibold hover:bg-[#E6008A] transition-colors min-h-[44px]"
                >
                  <Video className="w-4 h-4" />
                  Join
                </a>
              )}
            </div>
          </div>
        )}

        {/* Practice This Week */}
        {practiceEvents.length > 0 && (() => {
          const allItems = practiceEvents.flatMap((evt: any) =>
            ((evt.event_data as any)?.items || []).map((item: any) => ({
              ...item,
              eventId: evt.id,
            }))
          );
          if (allItems.length === 0) return null;

          const handleContentClick = async (eventId: string, contentId: string) => {
            try {
              const { data: { session: authSession } } = await supabase.auth.getSession();
              await fetch('/api/parent/content-viewed', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authSession?.access_token || ''}`,
                },
                body: JSON.stringify({ event_id: eventId, content_ref_id: contentId }),
              });
            } catch {}
          };

          return (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-[#FF0099]" />
                  Practice This Week
                  <span className="ml-auto text-[10px] text-gray-400 font-normal normal-case">
                    {allItems.filter((i: any) => i.viewed_at).length}/{allItems.length} opened
                  </span>
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {allItems.map((item: any) => (
                  <a
                    key={item.id}
                    href={item.asset_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleContentClick(item.eventId, item.id)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      item.type === 'video' ? 'bg-blue-50' : 'bg-emerald-50'
                    }`}>
                      {item.type === 'video'
                        ? <Film className="w-4 h-4 text-blue-600" />
                        : <FileText className="w-4 h-4 text-emerald-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500">
                        {item.type === 'video' ? 'Video' : 'Worksheet'}
                        {item.viewed_at && ' · Opened'}
                      </p>
                    </div>
                    {item.asset_url && (
                      <ExternalLink className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Session Timeline */}
        {planItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#FF0099]" />
                Session Timeline
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Diagnostic (always first) */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-[#E8FCF1] flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Diagnostic Session</p>
                </div>
                <span className="text-xs text-emerald-600">Done</span>
              </div>

              {planItems.map((item: PlanItem, idx: number) => {
                const isCompleted = item.status === 'completed';
                const isCurrent = idx === currentIdx;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-3 ${isCurrent ? 'bg-[#FFF5F9]' : ''}`}
                  >
                    {/* Status icon */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted
                        ? 'bg-[#E8FCF1]'
                        : isCurrent
                        ? 'bg-[#FFF5F9]'
                        : 'bg-gray-100'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      ) : isCurrent ? (
                        <span className="w-2 h-2 bg-[#FF0099] rounded-full animate-pulse" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-300" />
                      )}
                    </div>

                    {/* Session info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isCompleted ? 'text-gray-400' : 'text-gray-900'}`}>
                        {item.title}
                      </p>
                      {item.skills.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.skills.join(' + ')}
                        </p>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.is_finale && (
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 bg-[#FFF5F9] text-[#FF0099] border border-[#FFD6E8] rounded-full font-medium">
                          Next
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-xs text-emerald-600">Done</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Session Summaries */}
        {recentSummaries && recentSummaries.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#FF0099]" />
                Recent Sessions
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {recentSummaries.map((s: SessionSummary) => (
                <div key={s.id} className="px-4 py-3">
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandedSummary(expandedSummary === s.id ? null : s.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 font-medium">
                          {s.session_number ? `Session ${s.session_number}: ` : ''}{s.focus}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          {s.progress && ` — ${s.progress.replace(/_/g, ' ')}`}
                        </p>
                      </div>
                      {expandedSummary === s.id
                        ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      }
                    </div>
                  </button>
                  {expandedSummary === s.id && (
                    <div className="mt-2 space-y-2">
                      {s.summary && (
                        <p className="text-xs text-gray-600">{s.summary}</p>
                      )}
                      {s.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {s.highlights.map((h: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-[#E8FCF1] text-emerald-700 rounded-full border border-emerald-200">
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Future Seasons (Locked) */}
        {futureSeasons && futureSeasons.length > 0 && (
          <div className="space-y-2">
            {futureSeasons.map((season: any) => (
              <div
                key={season.season_number}
                className="bg-white rounded-2xl border border-gray-100 p-4 opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 text-sm font-medium">{season.season_name}</p>
                    <p className="text-gray-500 text-xs">
                      Unlocks after Season {season.season_number - 1}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
