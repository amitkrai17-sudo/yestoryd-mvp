'use client';

import { Calendar, Users, Flame, MessageSquare, Package, Zap, Film, Gamepad2, FileText, ExternalLink } from 'lucide-react';
import type { LiveSessionData, ResolvedContent } from './types';

interface InfoTabProps {
  data: LiveSessionData;
}

const CONTENT_ICON: Record<string, React.ReactNode> = {
  video: <Film className="w-3 h-3 text-blue-400" />,
  game: <Gamepad2 className="w-3 h-3 text-purple-400" />,
  worksheet: <FileText className="w-3 h-3 text-emerald-400" />,
};

export default function InfoTab({ data }: InfoTabProps) {
  const { session, child, template, recent_sessions, parent_tasks, parent_content_engagement, recent_struggles, resolved_content } = data;

  const lastSession = recent_sessions?.[0];

  // Collect all resolved content across all activities for pre-review
  const allContent: (ResolvedContent & { activityIndex: number })[] = [];
  if (resolved_content) {
    for (const [indexStr, items] of Object.entries(resolved_content)) {
      for (const item of items) {
        allContent.push({ ...item, activityIndex: parseInt(indexStr) });
      }
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {/* Child stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-white text-lg font-bold">{child.age}y</p>
          <p className="text-white/40 text-[10px] mt-0.5">Age</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-white text-lg font-bold">
            S{session.session_number || '—'}
          </p>
          <p className="text-white/40 text-[10px] mt-0.5">of {session.total_sessions}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-amber-400 text-lg font-bold flex items-center justify-center gap-1">
            <Flame className="w-4 h-4" />
            {child.current_streak}
          </p>
          <p className="text-white/40 text-[10px] mt-0.5">Streak</p>
        </div>
      </div>

      {/* Areas to Revisit (struggle flags) */}
      {recent_struggles && recent_struggles.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-amber-400 text-sm font-medium">Areas to Revisit</h3>
          </div>
          <div className="space-y-2">
            {recent_struggles.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-white/70 text-xs">{s.activity_name}</p>
                  <p className="text-white/30 text-[10px]">
                    Session {s.session_number || '?'}
                    {s.coach_note && ` — ${s.coach_note}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Materials (all content for pre-review) */}
      {allContent.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-[#00ABFF]" />
            <h3 className="text-white text-sm font-medium">Session Materials</h3>
            <span className="text-[10px] text-white/30 ml-auto">{allContent.length} items</span>
          </div>
          <div className="space-y-1.5">
            {allContent.map((item) => (
              <div key={item.id} className="flex items-center gap-2 py-1">
                {CONTENT_ICON[item.type]}
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-xs truncate">{item.title}</p>
                  <p className="text-white/30 text-[10px]">
                    Activity {item.activityIndex + 1}
                    {item.duration_seconds ? ` · ${Math.round(item.duration_seconds / 60)}m` : ''}
                    {item.asset_format ? ` · ${item.asset_format.toUpperCase()}` : ''}
                  </p>
                </div>
                {item.asset_url && (
                  <a
                    href={item.asset_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last session notes */}
      {lastSession && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            <h3 className="text-white text-sm font-medium">Last Session</h3>
            <span className="text-[10px] text-white/30 ml-auto">
              {new Date(lastSession.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          {lastSession.summary ? (
            <p className="text-white/70 text-xs leading-relaxed">{lastSession.summary}</p>
          ) : lastSession.data?.focus_area ? (
            <p className="text-white/50 text-xs">Focus: {lastSession.data.focus_area}</p>
          ) : (
            <p className="text-white/30 text-xs italic">No summary available</p>
          )}
          {lastSession.data?.skills_worked_on && (
            <div className="flex flex-wrap gap-1 mt-2">
              {(lastSession.data.skills_worked_on as string[]).slice(0, 4).map((s: string) => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Parent activity */}
      {parent_tasks && parent_tasks.total > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#00ABFF]" />
            <h3 className="text-white text-sm font-medium">Parent Activity</h3>
            <span className="text-[10px] text-white/30 ml-auto">This week</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00ABFF] rounded-full transition-all"
                  style={{ width: `${Math.round((parent_tasks.completed / parent_tasks.total) * 100)}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-white/60 font-medium whitespace-nowrap">
              {parent_tasks.completed}/{parent_tasks.total} tasks
            </span>
          </div>
        </div>
      )}

      {/* Parent Content Engagement */}
      {parent_content_engagement && parent_content_engagement.materials_assigned > 0 && (() => {
        const rate = parent_content_engagement.completion_rate;
        const colorClass = rate >= 0.75 ? 'text-green-400' : rate >= 0.25 ? 'text-amber-400' : 'text-red-400';
        const barColor = rate >= 0.75 ? 'bg-green-400' : rate >= 0.25 ? 'bg-amber-400' : 'bg-red-400';
        return (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Film className="w-4 h-4 text-[#00ABFF]" />
              <h3 className="text-white text-sm font-medium">Practice Materials</h3>
              <span className={`text-xs font-medium ml-auto ${colorClass}`}>
                {parent_content_engagement.materials_viewed}/{parent_content_engagement.materials_assigned} viewed
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-full transition-all`}
                style={{ width: `${Math.round(rate * 100)}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* Focus / Coach prep notes */}
      {template?.coach_prep_notes && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <h3 className="text-white text-sm font-medium">Focus Today</h3>
          </div>
          <p className="text-white/70 text-xs leading-relaxed">{template.coach_prep_notes}</p>
        </div>
      )}

      {/* Materials */}
      {template?.materials_needed && template.materials_needed.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-green-400" />
            <h3 className="text-white text-sm font-medium">Materials</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {template.materials_needed.map((m) => (
              <span key={m} className="text-xs px-2.5 py-1 bg-white/5 rounded-full text-white/70 border border-white/10">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Parent involvement */}
      {template?.parent_involvement && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#00ABFF]" />
            <h3 className="text-white text-sm font-medium">Parent Involvement</h3>
          </div>
          <p className="text-white/70 text-xs leading-relaxed">{template.parent_involvement}</p>
        </div>
      )}
    </div>
  );
}
