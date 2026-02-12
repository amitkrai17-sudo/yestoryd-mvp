'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Loader2, MapPin, CheckCircle, Circle, Video, Clock,
  ChevronDown, ChevronUp, Target, Sparkles, Lock,
  Calendar, Star, ArrowRight, FileText, Film, ExternalLink,
} from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [childId, setChildId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);
  const [practiceEvents, setPracticeEvents] = useState<any[]>([]);

  const fetchChildId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/parent/login');
      return null;
    }

    const { data: parentData } = await supabase
      .from('parents')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    let child = null;

    if (parentData?.id) {
      let storedChildId: string | null = null;
      try {
        storedChildId = localStorage.getItem(`yestoryd_selected_child_${parentData.id}`);
      } catch {}

      if (storedChildId) {
        const { data: c } = await supabase
          .from('children')
          .select('id, child_name, name')
          .eq('id', storedChildId)
          .eq('parent_id', parentData.id)
          .maybeSingle();
        if (c) child = c;
      }

      if (!child) {
        const { data: c } = await supabase
          .from('children')
          .select('id, child_name, name')
          .eq('parent_id', parentData.id)
          .eq('lead_status', 'enrolled')
          .order('enrolled_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (c) child = c;
      }
    }

    if (!child && user.email) {
      const { data: c } = await supabase
        .from('children')
        .select('id, child_name, name')
        .eq('parent_email', user.email)
        .eq('lead_status', 'enrolled')
        .limit(1)
        .maybeSingle();
      if (c) child = c;
    }

    return child;
  }, [router]);

  useEffect(() => {
    const init = async () => {
      const child = await fetchChildId();
      if (child) {
        setChildId(child.id);
        const res = await fetch(`/api/parent/roadmap/${child.id}`);
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
          .eq('child_id', child.id)
          .eq('event_type', 'parent_practice_assigned')
          .gte('created_at', weekAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(5);
        setPracticeEvents(practiceData || []);
      }
      setLoading(false);
    };
    init();

    const handleChildChange = () => {
      setLoading(true);
      init();
    };
    window.addEventListener('childChanged', handleChildChange);
    return () => window.removeEventListener('childChanged', handleChildChange);
  }, [fetchChildId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF0099]" />
      </div>
    );
  }

  if (!data || !data.roadmap) {
    return (
      <div className="p-4 lg:p-8">
        <div className="max-w-2xl mx-auto text-center py-12 bg-surface-1 rounded-2xl border border-border">
          <MapPin className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-1">Learning Journey</h2>
          <p className="text-text-tertiary text-sm mb-4">
            {data?.child?.name || 'Your child'}&apos;s personalized roadmap will appear here after the diagnostic session.
          </p>
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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Season Header */}
        <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-2xl p-5 text-white">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-white/60 text-[10px] uppercase tracking-wider font-medium">
                Season {roadmap.season_number}
              </p>
              <h1 className="text-xl font-bold mt-0.5">
                {roadmap.season_name}
              </h1>
            </div>
            <AgeBandBadge ageBand={roadmap.age_band} />
          </div>

          {/* Focus Areas */}
          {roadmap.focus_areas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {roadmap.focus_areas.map((area: string) => (
                <span key={area} className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/20">
                  {area}
                </span>
              ))}
            </div>
          )}

          {/* Progress Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Session {completedCount} of {totalSessions}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Milestone */}
          {roadmap.milestone_description && (
            <p className="text-white/70 text-xs mt-3">
              <Target className="w-3.5 h-3.5 inline mr-1" />
              {roadmap.milestone_description}
            </p>
          )}
        </div>

        {/* Next Session Card */}
        {nextSession && (
          <div className="bg-surface-1 rounded-2xl border-2 border-[#FF0099]/30 p-5">
            <p className="text-[10px] uppercase tracking-wider text-[#FF0099] font-medium mb-2">Next Session</p>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium text-base">
                  {nextSession.is_diagnostic ? 'Diagnostic Session' : (nextSession.template_title || `Session ${nextSession.session_number}`)}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-text-tertiary text-sm">
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
                  <p className="text-text-tertiary text-xs mt-1">with Coach {nextSession.coach_name}</p>
                )}
              </div>
              {nextSession.google_meet_link && (
                <a
                  href={nextSession.google_meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#FF0099] text-white rounded-xl text-sm font-semibold hover:bg-[#FF0099]/90 transition-all min-h-[44px]"
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
            <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#FF0099]" />
                  Practice This Week
                  <span className="ml-auto text-[10px] text-text-tertiary font-normal">
                    {allItems.filter((i: any) => i.viewed_at).length}/{allItems.length} opened
                  </span>
                </h3>
              </div>
              <div className="divide-y divide-border">
                {allItems.map((item: any) => (
                  <a
                    key={item.id}
                    href={item.asset_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleContentClick(item.eventId, item.id)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.type === 'video' ? 'bg-blue-500/10' : 'bg-emerald-500/10'
                    }`}>
                      {item.type === 'video'
                        ? <Film className="w-4 h-4 text-blue-400" />
                        : <FileText className="w-4 h-4 text-emerald-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.title}</p>
                      <p className="text-[10px] text-text-tertiary">
                        {item.type === 'video' ? 'Video' : 'Worksheet'}
                        {item.viewed_at && ' · Opened'}
                      </p>
                    </div>
                    {item.asset_url && (
                      <ExternalLink className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                    )}
                  </a>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Session Timeline */}
        {planItems.length > 0 && (
          <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#FF0099]" />
                Session Timeline
              </h3>
            </div>
            <div className="divide-y divide-border">
              {/* Diagnostic (always first) */}
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-tertiary">Diagnostic Session</p>
                </div>
                <span className="text-[10px] text-green-400">Complete</span>
              </div>

              {planItems.map((item: PlanItem, idx: number) => {
                const isCompleted = item.status === 'completed';
                const isCurrent = idx === currentIdx;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-5 py-3 ${isCurrent ? 'bg-[#FF0099]/5' : ''}`}
                  >
                    {/* Status icon */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-500/20'
                        : isCurrent
                        ? 'bg-[#FF0099]/20'
                        : 'bg-surface-2'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : isCurrent ? (
                        <span className="w-2 h-2 bg-[#FF0099] rounded-full animate-pulse" />
                      ) : (
                        <Circle className="w-4 h-4 text-text-tertiary/40" />
                      )}
                    </div>

                    {/* Session info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isCompleted ? 'text-text-tertiary' : 'text-white'}`}>
                        {item.title}
                      </p>
                      {item.skills.length > 0 && (
                        <p className="text-[10px] text-text-tertiary mt-0.5 truncate">
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
                        <span className="text-[9px] px-1.5 py-0.5 bg-[#FF0099]/20 text-[#FF0099] rounded font-medium">
                          Up Next
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-[9px] text-green-400">Done</span>
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
          <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF0099]" />
                Recent Sessions
              </h3>
            </div>
            <div className="divide-y divide-border">
              {recentSummaries.map((s: SessionSummary) => (
                <div key={s.id} className="px-5 py-3">
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandedSummary(expandedSummary === s.id ? null : s.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {s.session_number ? `Session ${s.session_number}: ` : ''}{s.focus}
                        </p>
                        <p className="text-[10px] text-text-tertiary mt-0.5">
                          {new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          {s.progress && ` — ${s.progress.replace(/_/g, ' ')}`}
                        </p>
                      </div>
                      {expandedSummary === s.id
                        ? <ChevronUp className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                      }
                    </div>
                  </button>
                  {expandedSummary === s.id && (
                    <div className="mt-2 space-y-2">
                      {s.summary && (
                        <p className="text-xs text-text-secondary">{s.summary}</p>
                      )}
                      {s.highlights.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {s.highlights.map((h: string, i: number) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full border border-green-500/20">
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
          <div className="space-y-3">
            {futureSeasons.map((season: any) => (
              <div
                key={season.season_number}
                className="bg-surface-1 rounded-2xl border border-border p-4 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-text-tertiary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{season.season_name}</p>
                    <p className="text-text-tertiary text-xs">
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
