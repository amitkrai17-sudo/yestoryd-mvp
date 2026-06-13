// ============================================================
// FILE: components/shared/SessionModeBadge.tsx
// PURPOSE: Canonical parent/admin/coach-facing session mode + link badge.
//          DISPLAY ONLY — reads session_mode + google_meet_link, renders a pill.
//          SSOT: this is the single mode-badge component. Do NOT add a second
//          inline mode pattern. No write paths, no setSessionMode calls.
// THEME: tone-driven (no Tailwind dark: variants — darkMode is 'media' here and
//        the portal theme is JS-driven, not class-driven). Parent (light) passes
//        nothing; coach/admin (dark) pass tone="dark".
// ============================================================

import { MapPin, Monitor, AlertTriangle } from 'lucide-react';

type Tone = 'light' | 'dark';
type State = 'offline' | 'online' | 'pending';

interface SessionModeBadgeProps {
  sessionMode?: string | null;
  meetLink?: string | null;
  tone?: Tone;
  className?: string;
}

const BASE =
  'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border';

// One source of truth for tokens, keyed by [state][tone].
const TOKENS: Record<State, Record<Tone, string>> = {
  offline: {
    light: 'bg-amber-50 text-amber-700 border-amber-200',
    dark: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  },
  online: {
    light: 'bg-blue-50 text-blue-700 border-blue-200',
    dark: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  },
  pending: {
    light: 'bg-slate-100 text-slate-700 border-slate-300',
    dark: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  },
};

export default function SessionModeBadge({
  sessionMode,
  meetLink,
  tone = 'light',
  className = '',
}: SessionModeBadgeProps) {
  // null/undefined mode → render nothing
  if (!sessionMode) return null;

  if (sessionMode === 'offline') {
    return (
      <span className={`${BASE} ${TOKENS.offline[tone]} ${className}`}>
        <MapPin className="w-3 h-3" /> In-person
      </span>
    );
  }

  if (sessionMode === 'online') {
    const hasLink = !!meetLink && meetLink.trim().length > 0;
    if (hasLink) {
      return (
        <span className={`${BASE} ${TOKENS.online[tone]} ${className}`}>
          <Monitor className="w-3 h-3" /> Online
        </span>
      );
    }
    // online but no link yet → distinct caution pill
    return (
      <span className={`${BASE} ${TOKENS.pending[tone]} ${className}`}>
        <AlertTriangle className="w-3 h-3" /> Link pending
      </span>
    );
  }

  // unknown mode value → render nothing
  return null;
}
