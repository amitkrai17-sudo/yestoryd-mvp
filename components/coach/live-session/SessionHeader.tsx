'use client';

import { Video, Flame, BarChart3 } from 'lucide-react';
import { AgeBandBadge } from '@/components/AgeBandBadge';
import type { SessionData, ChildData } from './types';

interface SessionHeaderProps {
  session: SessionData;
  child: ChildData;
  elapsedSeconds: number;
  isLive: boolean;
  coachSessionsLogged?: number;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionHeader({ session, child, elapsedSeconds, isLive, coachSessionsLogged }: SessionHeaderProps) {
  const plannedSeconds = (session.duration_minutes || 45) * 60;
  const progress = Math.min(elapsedSeconds / plannedSeconds, 1.5);

  let timerColor = 'text-green-400';
  if (progress >= 1) timerColor = 'text-red-400';
  else if (progress >= 0.8) timerColor = 'text-amber-400';

  let barColor = 'bg-green-500';
  if (progress >= 1) barColor = 'bg-red-500';
  else if (progress >= 0.8) barColor = 'bg-amber-500';

  return (
    <div className="sticky top-0 z-20 bg-[#1a1f26] border-b border-white/10">
      <div className="px-4 py-3">
        {/* Row 1: Child info + Meet button */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00ABFF] to-[#7B008B] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {child.child_name.charAt(0)}
          </div>

          {/* Name + session info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-white font-semibold text-sm truncate">{child.child_name}</h1>
              {child.current_streak > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-amber-400">
                  <Flame className="w-3 h-3" />
                  {child.current_streak}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-white/50">
                Session {session.session_number || '—'} of {session.total_sessions}
              </span>
              <AgeBandBadge ageBand={child.age_band} size="sm" />
            </div>
          </div>

          {/* Coach sessions logged badge */}
          {coachSessionsLogged != null && coachSessionsLogged > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-white/30 bg-white/5 px-2 py-1 rounded-lg">
              <BarChart3 className="w-3 h-3" />
              {coachSessionsLogged}
            </span>
          )}

          {/* Meet button */}
          {session.google_meet_link && (
            <button
              onClick={() => window.open(session.google_meet_link!, '_blank')}
              className="flex items-center gap-1.5 bg-[#00ABFF] text-white px-3 py-2 rounded-lg text-xs font-medium active:scale-95 transition-transform min-h-[44px]"
            >
              <Video className="w-4 h-4" />
              Meet
            </button>
          )}
        </div>

        {/* Row 2: Timer bar (only when live) */}
        {isLive && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-mono font-medium ${timerColor}`}>
                {formatTimer(elapsedSeconds)}
              </span>
              <span className="text-xs text-white/30 font-mono">
                {formatTimer(plannedSeconds)}
              </span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                style={{ width: `${Math.min(progress * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
