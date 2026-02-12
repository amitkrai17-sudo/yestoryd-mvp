'use client';

import { useState } from 'react';
import { Check, AlertTriangle, SkipForward, CircleX, Clock, Film, Gamepad2, FileText, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import ProgressBar from './ProgressBar';
import type { TrackedActivity, ActivityStatus, ResolvedContent } from './types';

interface ActivityTabProps {
  activities: TrackedActivity[];
  currentIndex: number;
  materials: string[] | null;
}

const STATUS_ICON: Record<ActivityStatus, React.ReactNode> = {
  completed: <Check className="w-4 h-4 text-green-400" />,
  partial: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  skipped: <SkipForward className="w-4 h-4 text-white/30" />,
  struggled: <CircleX className="w-4 h-4 text-red-400" />,
};

function formatSeconds(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const CONTENT_ICON: Record<string, React.ReactNode> = {
  video: <Film className="w-3.5 h-3.5 text-blue-400" />,
  game: <Gamepad2 className="w-3.5 h-3.5 text-purple-400" />,
  worksheet: <FileText className="w-3.5 h-3.5 text-emerald-400" />,
};

const CONTENT_BG: Record<string, string> = {
  video: 'bg-blue-500/5 border-blue-500/20',
  game: 'bg-purple-500/5 border-purple-500/20',
  worksheet: 'bg-emerald-500/5 border-emerald-500/20',
};

function ContentCard({ item }: { item: ResolvedContent }) {
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const hasGuidance = item.coach_guidance && Object.keys(item.coach_guidance).length > 0;

  return (
    <div className={`border rounded-lg p-3 ${CONTENT_BG[item.type]}`}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5">{CONTENT_ICON[item.type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium truncate">{item.title}</p>
          {item.duration_seconds && (
            <p className="text-white/30 text-[10px]">{Math.round(item.duration_seconds / 60)} min</p>
          )}
          {item.asset_format && (
            <p className="text-white/30 text-[10px] uppercase">{item.asset_format}</p>
          )}
        </div>
        {item.asset_url && (
          <a
            href={item.asset_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-white/10 hover:bg-white/20 rounded text-white transition-colors shrink-0"
          >
            <ExternalLink className="w-3 h-3" />
            Open
          </a>
        )}
      </div>
      {hasGuidance && (
        <div className="mt-2">
          <button
            onClick={() => setGuidanceOpen(!guidanceOpen)}
            className="flex items-center gap-1 text-[10px] text-amber-400/70 hover:text-amber-400 transition-colors"
          >
            {guidanceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Coach Guidance
          </button>
          {guidanceOpen && (
            <div className="mt-1.5 pl-4 space-y-1 text-[10px] text-white/50">
              {Object.entries(item.coach_guidance!).map(([key, val]) => (
                <div key={key}>
                  <span className="text-amber-400/60 font-medium">{key.replace(/_/g, ' ')}:</span>{' '}
                  {Array.isArray(val) ? val.join(', ') : String(val)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActivityTab({ activities, currentIndex, materials }: ActivityTabProps) {
  const current = activities[currentIndex];

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Progress bar */}
      <ProgressBar activities={activities} currentIndex={currentIndex} />

      {/* Current activity hero */}
      {current && (
        <div className="bg-[#FF0099]/10 border border-[#FF0099]/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#FF0099] text-xs font-medium">
              Activity {currentIndex + 1} of {activities.length}
            </span>
            <span className="flex items-center gap-1 text-xs text-white/50">
              <Clock className="w-3 h-3" />
              {current.time}
            </span>
          </div>
          <h2 className="text-white text-lg font-bold leading-tight mb-1">
            {current.activity}
          </h2>
          <p className="text-white/60 text-sm">{current.purpose}</p>
        </div>
      )}

      {/* Content cards for current activity (V2 templates only) */}
      {current?.resolved_content && current.resolved_content.length > 0 && (
        <div>
          <p className="text-xs text-white/40 font-medium mb-1.5">Content</p>
          <div className="space-y-2">
            {current.resolved_content.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Materials for current activity */}
      {materials && materials.length > 0 && currentIndex < activities.length && (
        <div>
          <p className="text-xs text-white/40 font-medium mb-1.5">Materials</p>
          <div className="flex flex-wrap gap-1.5">
            {materials.map((m) => (
              <span key={m} className="text-xs px-2.5 py-1 bg-white/5 rounded-full text-white/70 border border-white/10">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* All activities list */}
      <div>
        <p className="text-xs text-white/40 font-medium mb-2">All Activities</p>
        <div className="space-y-1">
          {activities.map((a, i) => {
            const isCurrent = i === currentIndex;
            const isDone = a.status !== null;
            const isFuture = i > currentIndex && !isDone;

            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-[#FF0099]/10 border border-[#FF0099]/20'
                    : isDone
                    ? 'bg-white/[0.02]'
                    : 'opacity-40'
                }`}
              >
                {/* Status icon or index */}
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-mono">
                  {isDone ? (
                    STATUS_ICON[a.status!]
                  ) : isCurrent ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF0099] animate-pulse" />
                  ) : (
                    <span className="text-white/30">{i + 1}</span>
                  )}
                </div>

                {/* Activity name */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isCurrent ? 'text-white font-medium' : isDone ? 'text-white/70' : 'text-white/40'}`}>
                    {a.activity}
                  </p>
                  {isDone && a.actualSeconds != null && (
                    <p className="text-[10px] text-white/30">{formatSeconds(a.actualSeconds)}</p>
                  )}
                </div>

                {/* Time badge */}
                <span className={`text-[10px] font-mono flex-shrink-0 ${isCurrent ? 'text-[#00ABFF]' : 'text-white/20'}`}>
                  {a.time}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
