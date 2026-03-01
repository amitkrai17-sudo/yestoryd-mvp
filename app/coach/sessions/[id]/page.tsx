'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, Video, Clock, BookOpen, ClipboardCheck,
  ChevronDown, ChevronUp, Users, Calendar, ExternalLink,
  AlertCircle, Play, Check, AlertTriangle, SkipForward, CircleX,
  MessageSquare, ArrowRight, User,
} from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';

interface ActivityStep {
  time: string;
  activity: string;
  purpose: string;
}

interface ActivityLog {
  activity_index: number;
  activity_name: string;
  activity_purpose: string | null;
  status: string;
  coach_note: string | null;
  actual_duration_seconds: number | null;
}

const STATUS_ICON: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  completed: { icon: <Check className="w-3.5 h-3.5" />, label: 'Done', color: 'text-green-400' },
  partial: { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Partial', color: 'text-amber-400' },
  skipped: { icon: <SkipForward className="w-3.5 h-3.5" />, label: 'Skipped', color: 'text-white/40' },
  struggled: { icon: <CircleX className="w-3.5 h-3.5" />, label: 'Struggled', color: 'text-red-400' },
};

export default function SessionBriefPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [showActivities, setShowActivities] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        const res = await fetch(`/api/coach/sessions/${sessionId}/brief`);
        const result = await res.json();
        if (result.success) {
          setData(result);
        } else {
          setError(result.error || 'Failed to load');
        }
      } catch {
        setError('Failed to load session brief');
      } finally {
        setLoading(false);
      }
    };
    fetchBrief();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00ABFF]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-white mb-2">{error}</p>
          <button onClick={() => router.back()} className="text-[#00ABFF] font-medium">Go Back</button>
        </div>
      </div>
    );
  }

  const { session, child, template, recent_sessions, diagnostic_completed, activity_logs, companion_log_notes, next_session_id, group_class_activity } = data;

  const isCompleted = session.status === 'completed' && session.companion_panel_completed;
  const isInProgress = session.status === 'in_progress';

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  };

  // Status counts for completed session summary
  const statusCounts = activity_logs ? {
    completed: activity_logs.filter((a: ActivityLog) => a.status === 'completed').length,
    partial: activity_logs.filter((a: ActivityLog) => a.status === 'partial').length,
    skipped: activity_logs.filter((a: ActivityLog) => a.status === 'skipped').length,
    struggled: activity_logs.filter((a: ActivityLog) => a.status === 'struggled').length,
  } : null;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-1 border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-surface-2 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-text-tertiary" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white text-sm lg:text-base">
              Session {session.session_number || ''} of {session.total_sessions}
            </h1>
            <p className="text-xs text-text-tertiary">
              {formatDate(session.scheduled_date)} at {formatTime(session.scheduled_time)}
            </p>
          </div>
          {/* Status badge for completed/in_progress */}
          {isCompleted && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
              Completed
            </span>
          )}
          {isInProgress && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
              In Progress
            </span>
          )}
          {session.google_meet_link && !isCompleted && (
            <a
              href={session.google_meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-[#00ABFF] text-white px-3 py-1.5 rounded-xl text-xs font-medium"
            >
              <Video className="w-3.5 h-3.5" />
              Join
            </a>
          )}
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {/* Diagnostic Banner */}
        {session.is_diagnostic && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ClipboardCheck className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">Diagnostic Session</p>
                <p className="text-text-tertiary text-xs mt-0.5">
                  {diagnostic_completed
                    ? 'Diagnostic assessment completed.'
                    : 'Complete the diagnostic assessment after this session.'}
                </p>
              </div>
              <a
                href={`/coach/sessions/${sessionId}/diagnostic`}
                className="text-xs text-red-400 hover:text-red-300 font-medium whitespace-nowrap"
              >
                {diagnostic_completed ? 'View' : 'Fill Form'} →
              </a>
            </div>
          </div>
        )}

        {/* ========== COMPLETED SESSION SUMMARY ========== */}
        {isCompleted && activity_logs && activity_logs.length > 0 && (
          <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                <h2 className="text-white text-sm font-semibold">Session Summary</h2>
              </div>
            </div>

            {/* Status counts row */}
            {statusCounts && (
              <div className="grid grid-cols-4 gap-0 border-b border-border">
                {(Object.entries(statusCounts) as [string, number][]).map(([status, count]) => {
                  const config = STATUS_ICON[status];
                  return (
                    <div key={status} className="flex flex-col items-center py-3">
                      <div className={`flex items-center gap-1 ${config.color}`}>
                        {config.icon}
                        <span className="font-bold text-sm">{count}</span>
                      </div>
                      <span className="text-[10px] text-text-tertiary mt-0.5">{config.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Activity list */}
            <div className="divide-y divide-border">
              {activity_logs.map((a: ActivityLog) => {
                const config = STATUS_ICON[a.status] || STATUS_ICON.skipped;
                return (
                  <div key={a.activity_index} className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={config.color}>{config.icon}</span>
                      <span className="flex-1 text-xs text-white truncate">{a.activity_name}</span>
                      {a.actual_duration_seconds != null && a.actual_duration_seconds > 0 && (
                        <span className="text-[10px] text-text-tertiary font-mono">
                          {Math.floor(a.actual_duration_seconds / 60)}m {a.actual_duration_seconds % 60}s
                        </span>
                      )}
                    </div>
                    {a.coach_note && (
                      <div className="ml-6 mt-1 flex items-start gap-1">
                        <MessageSquare className="w-3 h-3 text-[#00ABFF] flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-text-tertiary italic">{a.coach_note}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Overall coach notes */}
            {companion_log_notes && (
              <div className="px-4 py-3 border-t border-border bg-surface-2/50">
                <p className="text-[10px] text-text-tertiary font-medium uppercase tracking-wider mb-1">Coach Notes</p>
                <p className="text-xs text-white leading-relaxed">{companion_log_notes}</p>
              </div>
            )}

            {/* Parent summary */}
            {session.parent_summary && (
              <div className="px-4 py-3 border-t border-border bg-surface-2/50">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] text-text-tertiary font-medium uppercase tracking-wider">Parent Summary</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    Sent to parent
                  </span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">{session.parent_summary}</p>
              </div>
            )}
          </div>
        )}

        {/* ========== CONTEXT-AWARE CTA BUTTONS ========== */}

        {/* Scheduled: Start Live Session (existing behavior) */}
        {session.status === 'scheduled' && template && (
          <a
            href={`/coach/sessions/${sessionId}/live`}
            className="block w-full py-3.5 bg-[#00ABFF] hover:bg-[#00ABFF]/90 text-white rounded-xl font-semibold text-center text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
          >
            <Play className="w-4 h-4" />
            Start Live Session
          </a>
        )}

        {/* In Progress: Resume Live Session */}
        {isInProgress && (
          <a
            href={`/coach/sessions/${sessionId}/live`}
            className="block w-full py-3.5 bg-amber-500 hover:bg-amber-500/90 text-white rounded-xl font-semibold text-center text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
          >
            <Play className="w-4 h-4" />
            Resume Live Session
          </a>
        )}

        {/* Completed: hide Start button, show navigation CTAs at bottom */}

        {/* Child Info */}
        {child && (
          <div className="bg-surface-1 border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00ABFF] to-[#0066CC] flex items-center justify-center text-white font-bold text-sm">
                {child.child_name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{child.child_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-text-tertiary">{child.age}y</span>
                  <AgeBandBadge ageBand={child.age_band} age={child.age} />
                  {child.latest_assessment_score && (
                    <span className="text-xs text-text-tertiary">Score: {child.latest_assessment_score}/10</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-white text-sm font-medium flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-text-tertiary" />
                  {session.duration_minutes || 45}m
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Template Info */}
        {template && (
          <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowActivities(!showActivities)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#00ABFF]" />
                <span className="text-white text-sm font-medium">
                  {template.template_code}: {template.title}
                </span>
                {template.difficulty_level && (
                  <span className="text-[10px] text-text-tertiary bg-surface-2 px-1.5 py-0.5 rounded">
                    L{template.difficulty_level}
                  </span>
                )}
              </div>
              {showActivities
                ? <ChevronUp className="w-4 h-4 text-text-tertiary" />
                : <ChevronDown className="w-4 h-4 text-text-tertiary" />
              }
            </button>

            {showActivities && (
              <div className="px-4 pb-4 space-y-3">
                {template.description && (
                  <p className="text-text-tertiary text-xs">{template.description}</p>
                )}

                {/* Skills */}
                {template.skill_dimensions?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {template.skill_dimensions.map((s: string) => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-[#00ABFF]/10 text-[#00ABFF] border border-[#00ABFF]/20">
                        {s.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Activity Flow Table */}
                {template.activity_flow?.length > 0 && (
                  <div>
                    <p className="text-xs text-text-tertiary font-medium mb-2">Activity Flow</p>
                    <div className="space-y-1">
                      <div className="grid grid-cols-[60px_1fr_1fr] gap-2 text-[10px] text-text-tertiary font-medium pb-1 border-b border-border">
                        <span>Time</span><span>Activity</span><span>Purpose</span>
                      </div>
                      {template.activity_flow.map((step: ActivityStep, i: number) => (
                        <div key={i} className="grid grid-cols-[60px_1fr_1fr] gap-2 text-xs py-1">
                          <span className="text-[#00ABFF] font-mono">{step.time}</span>
                          <span className="text-white">{step.activity}</span>
                          <span className="text-text-tertiary">{step.purpose}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Materials */}
                {template.materials_needed?.length > 0 && (
                  <div>
                    <p className="text-xs text-text-tertiary font-medium mb-1">Materials</p>
                    <div className="flex flex-wrap gap-1">
                      {template.materials_needed.map((m: string) => (
                        <span key={m} className="text-xs px-2 py-0.5 bg-surface-2 rounded-full text-white border border-border">{m}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coach Prep Notes */}
                {template.coach_prep_notes && (
                  <div>
                    <p className="text-xs text-text-tertiary font-medium mb-1">Coach Prep Notes</p>
                    <p className="text-xs text-white bg-surface-2 rounded-lg p-3 border border-border">
                      {template.coach_prep_notes}
                    </p>
                  </div>
                )}

                {/* Parent Involvement */}
                {template.parent_involvement && (
                  <div>
                    <p className="text-xs text-text-tertiary font-medium mb-1">Parent Involvement</p>
                    <p className="text-xs text-white">{template.parent_involvement}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Previous Sessions */}
        {recent_sessions?.length > 0 && (
          <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span className="text-white text-sm font-medium">Previous Sessions</span>
                <span className="text-[10px] text-text-tertiary bg-surface-2 px-1.5 py-0.5 rounded">
                  {recent_sessions.length}
                </span>
              </div>
              {showHistory
                ? <ChevronUp className="w-4 h-4 text-text-tertiary" />
                : <ChevronDown className="w-4 h-4 text-text-tertiary" />
              }
            </button>
            {showHistory && (
              <div className="px-4 pb-4 space-y-3">
                {recent_sessions.map((evt: any) => (
                  <div key={evt.id} className="bg-surface-2 rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">
                        {evt.event_type === 'diagnostic_assessment' ? 'Diagnostic' : 'Session'}
                      </span>
                      <span className="text-[10px] text-text-tertiary">
                        {new Date(evt.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    {evt.summary && (
                      <p className="text-xs text-white">{evt.summary}</p>
                    )}
                    {!evt.summary && evt.data?.focus_area && (
                      <p className="text-xs text-text-tertiary">Focus: {evt.data.focus_area}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Group Class Activity */}
        {group_class_activity?.length > 0 && (
          <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span className="text-white text-sm font-medium">Group Class Activity</span>
                <span className="text-[10px] text-text-tertiary bg-surface-2 px-1.5 py-0.5 rounded">
                  {group_class_activity.length}
                </span>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3">
              {group_class_activity.map((evt: any) => {
                const d = evt.data || {};
                const isInsight = evt.event_type === 'group_class_micro_insight';
                return (
                  <div key={evt.id} className="bg-surface-2 rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isInsight
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {isInsight ? 'Insight' : 'Observation'}
                      </span>
                      {d.class_type_name && (
                        <span className="text-[10px] text-text-tertiary">{d.class_type_name}</span>
                      )}
                      {evt.event_date && (
                        <span className="text-[10px] text-text-tertiary ml-auto">
                          {new Date(evt.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    {isInsight && d.insight_text && (
                      <p className="text-xs text-white leading-relaxed">{d.insight_text}</p>
                    )}
                    {!isInsight && d.engagement_level && (
                      <p className="text-xs text-text-tertiary">
                        Engagement: <span className="text-white">{d.engagement_level}</span>
                      </p>
                    )}
                    {Array.isArray(d.skill_tags) && d.skill_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {d.skill_tags.slice(0, 4).map((tag: string, i: number) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {Array.isArray(d.badges_earned) && d.badges_earned.length > 0 && (
                      <p className="text-[10px] text-amber-300 mt-1">
                        Badges: {d.badges_earned.join(', ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========== COMPLETED SESSION BOTTOM CTAs ========== */}
        {isCompleted && (
          <div className="space-y-2 pt-2">
            {next_session_id && (
              <a
                href={`/coach/sessions/${next_session_id}`}
                className="block w-full py-3.5 bg-[#00ABFF] hover:bg-[#00ABFF]/90 text-white rounded-xl font-semibold text-center text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                Next Session
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
            {child && (
              <a
                href={`/coach/students/${child.id}`}
                className="block w-full py-3 bg-surface-1 hover:bg-surface-2 text-white rounded-xl font-medium text-center text-sm flex items-center justify-center gap-2 transition-colors border border-border"
              >
                <User className="w-4 h-4 text-text-tertiary" />
                View Student Profile
              </a>
            )}
            <a
              href="/coach/sessions"
              className="block w-full py-3 text-text-tertiary text-center text-sm font-medium hover:text-white transition-colors"
            >
              Back to Sessions
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
