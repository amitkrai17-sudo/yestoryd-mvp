'use client';

// ============================================================
// FILE: components/shared/TimePicker.tsx
// PURPOSE: Time entry as PRESET CHIPS (coach's real slots) + three compact
//          native dropdowns (Hour 1-12 / Minute 00-15-30-45 / AM-PM).
//          INPUT WIDGET ONLY — it emits the identical canonical "HH:MM" 24h
//          string the old TimeInput did, so conflict-check / resolveSessionTime
//          / generation / storage are all unchanged.
// TONE: mirrors ScheduleCapture's dark/light token split so it themes on every
//       surface (admin grey / coach blue live on the dark tone).
// ============================================================

import { formatTime12 } from '@/lib/utils/date-format';

type Tone = 'light' | 'dark';

interface TimePickerProps {
  /** Canonical "HH:MM" 24h, or "" when nothing is chosen yet. */
  value: string;
  /** Called with the new canonical "HH:MM" 24h string. */
  onChange: (value: string) => void;
  /** admin + coach surfaces are dark; default 'dark'. */
  tone?: Tone;
  /** Chip slots as "HH:MM" 24h. Defaults to the coach's live weekly slots. */
  presets?: string[];
  className?: string;
}

// Rucha's real weekly slots (2G-time). Values "HH:MM" 24h; chips render 12h.
const DEFAULT_PRESETS = ['09:30', '11:00', '12:45', '14:30', '16:00', '17:30', '18:00'];

// 2G-6: natural reading order 1→12 (to24 is order-independent: 12→00, 12 PM→12:00, 12 AM→00:00).
const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = ['00', '15', '30', '45'];
const MERIDIEMS = ['AM', 'PM'] as const;

const TOKENS: Record<Tone, { label: string; chipActive: string; chipIdle: string; select: string }> = {
  dark: {
    label: 'text-text-tertiary',
    chipActive: 'bg-white text-[#0a0a0f]',
    chipIdle: 'bg-surface-2 text-text-tertiary border border-border hover:text-white',
    select: 'bg-surface-2 border border-border text-white',
  },
  light: {
    label: 'text-gray-500',
    chipActive: 'bg-gray-900 text-white',
    chipIdle: 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300',
    select: 'bg-white border border-gray-200 text-gray-900',
  },
};

/** Parse "HH:MM" 24h → its 12h parts, or nulls when empty/off-grid-unparseable. */
function parse(value: string): { h12: number | null; min: string | null; ampm: 'AM' | 'PM' | null } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return { h12: null, min: null, ampm: null };
  const h24 = parseInt(m[1], 10);
  return {
    h12: h24 % 12 || 12,
    min: m[2],
    ampm: h24 >= 12 ? 'PM' : 'AM',
  };
}

/** Combine 12h parts → canonical "HH:MM" 24h. e.g. (4,'15','PM') → "16:15". */
function to24(h12: number, min: string, ampm: 'AM' | 'PM'): string {
  let h = h12 % 12;              // 12 → 0
  if (ampm === 'PM') h += 12;    // PM adds 12 (12 PM → 12:00, 12 AM → 00:00)
  return `${String(h).padStart(2, '0')}:${min}`;
}

export default function TimePicker({
  value,
  onChange,
  tone = 'dark',
  presets = DEFAULT_PRESETS,
  className = '',
}: TimePickerProps) {
  const t = TOKENS[tone];
  const cur = parse(value);

  // Emit from the three dropdowns. Any field the user hasn't set yet falls back to
  // a deterministic default (12 / 00 / AM) so a partial pick still yields a valid time.
  function emit(next: { h12?: number; min?: string; ampm?: 'AM' | 'PM' }) {
    const h12 = next.h12 ?? cur.h12 ?? 12;
    const min = next.min ?? cur.min ?? '00';
    const ampm = next.ampm ?? cur.ampm ?? 'AM';
    onChange(to24(h12, min, ampm));
  }

  // The minute select can only show a grid value; off-grid parsed minutes show blank.
  const minSelected = cur.min && MINUTES.includes(cur.min) ? cur.min : '';

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Preset chips — the fast path for the coach's recurring slots. */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = value === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-pressed={active}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-medium transition-colors ${active ? t.chipActive : t.chipIdle}`}
            >
              {formatTime12(p)}
            </button>
          );
        })}
      </div>

      {/* Custom time — three native dropdowns (OS picker on mobile). */}
      <div className="flex items-center gap-2">
        <select
          aria-label="Hour"
          value={cur.h12 ?? ''}
          onChange={(e) => emit({ h12: parseInt(e.target.value, 10) })}
          className={`min-h-[44px] rounded-xl px-2.5 text-sm ${t.select}`}
        >
          <option value="" disabled>Hr</option>
          {HOURS_12.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className={`text-sm ${t.label}`}>:</span>
        <select
          aria-label="Minute"
          value={minSelected}
          onChange={(e) => emit({ min: e.target.value })}
          className={`min-h-[44px] rounded-xl px-2.5 text-sm ${t.select}`}
        >
          <option value="" disabled>Min</option>
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          aria-label="AM or PM"
          value={cur.ampm ?? ''}
          onChange={(e) => emit({ ampm: e.target.value as 'AM' | 'PM' })}
          className={`min-h-[44px] rounded-xl px-2.5 text-sm ${t.select}`}
        >
          <option value="" disabled>AM/PM</option>
          {MERIDIEMS.map((mer) => <option key={mer} value={mer}>{mer}</option>)}
        </select>
      </div>
    </div>
  );
}
