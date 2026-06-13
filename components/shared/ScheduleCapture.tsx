'use client';

// ============================================================
// FILE: components/shared/ScheduleCapture.tsx
// PURPOSE: Selection-based structured schedule capture. Emits the canonical
//          SchedulePreference (lib/scheduling/schedule-time.ts). NO free-text
//          time; uses the shared TimeInput picker only (CLAUDE.md).
// SSOT: times are written as canonical "HH:MM" via normalizeTime(); never store
//       a non-canonical value. Controlled (value/onChange) — no DB, no
//       JSON.stringify here (the host form serializes at submit in 2D-d-3/4).
// ============================================================

import { useState } from 'react';
import { TimeInput } from '@/components/ui/time-input';
import {
  normalizeTime,
  DAY_KEYS,
  type DayKey,
  type SchedulePreference,
} from '@/lib/scheduling/schedule-time';

type Tone = 'light' | 'dark';

interface ScheduleCaptureProps {
  value: SchedulePreference;
  onChange: (next: SchedulePreference) => void;
  /** admin + coach surfaces are dark; default 'dark'. */
  tone?: Tone;
}

// Mon-first display order; storage stays DayKey.
const DISPLAY_ORDER: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Legacy/display bucket options (kept optional, never parsed by readers).
const TIME_SLOTS = [
  'Morning (9-12)',
  'Afternoon (12-3)',
  'Evening (3-6)',
  'Late Evening (6-9)',
];

const TOKENS: Record<Tone, {
  label: string;
  dayActive: string;
  dayIdle: string;
  toggleActive: string;
  toggleIdle: string;
  select: string;
}> = {
  dark: {
    label: 'text-text-tertiary',
    dayActive: 'bg-white text-[#0a0a0f]',
    dayIdle: 'bg-surface-2 text-text-tertiary border border-border hover:text-white',
    toggleActive: 'bg-white text-[#0a0a0f]',
    toggleIdle: 'bg-surface-2 text-text-tertiary border border-border hover:text-white',
    select: 'bg-surface-2 border border-border text-white',
  },
  light: {
    label: 'text-gray-500',
    dayActive: 'bg-gray-900 text-white',
    dayIdle: 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300',
    toggleActive: 'bg-gray-900 text-white',
    toggleIdle: 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300',
    select: 'bg-white border border-gray-200 text-gray-900',
  },
};

export default function ScheduleCapture({
  value,
  onChange,
  tone = 'dark',
}: ScheduleCaptureProps) {
  const t = TOKENS[tone];

  // Per-day mode is UI state (not part of SchedulePreference). Seed it from
  // whether any per-day times already exist.
  const [perDay, setPerDay] = useState<boolean>(
    () => Object.keys(value.times || {}).length > 0,
  );

  const selectedInOrder = DISPLAY_ORDER.filter((d) => value.days.includes(d));

  function toggleDay(day: DayKey) {
    const has = value.days.includes(day);
    const days = has ? value.days.filter((d) => d !== day) : [...value.days, day];
    // Drop the per-day time when a day is removed.
    const times = { ...value.times };
    if (has) delete times[day];
    onChange({ ...value, days, times });
  }

  function setSameTime(on: boolean) {
    setPerDay(!on);
    if (on) {
      // All days fall back to defaultTime — clear per-day overrides.
      onChange({ ...value, times: {} });
    }
  }

  function setDefaultTime(raw: string) {
    const canonical = normalizeTime(raw);
    if (!canonical) return; // reject non-canonical; never store
    onChange({ ...value, defaultTime: canonical, times: {} });
  }

  function setDayTime(day: DayKey, raw: string) {
    const canonical = normalizeTime(raw);
    if (!canonical) return;
    onChange({ ...value, times: { ...value.times, [day]: canonical } });
  }

  return (
    <div className="space-y-4">
      {/* Days */}
      <div>
        <label className={`text-xs ${t.label} block mb-1.5`}>Preferred Days</label>
        <div className="flex flex-wrap gap-1.5">
          {DISPLAY_ORDER.map((day) => {
            const selected = value.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  selected ? t.dayActive : t.dayIdle
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Same-time toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSameTime(true)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
            !perDay ? t.toggleActive : t.toggleIdle
          }`}
        >
          Same time every day
        </button>
        <button
          type="button"
          onClick={() => setSameTime(false)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
            perDay ? t.toggleActive : t.toggleIdle
          }`}
        >
          Different time per day
        </button>
      </div>

      {/* Time picker(s) */}
      {!perDay ? (
        <div>
          <label className={`text-xs ${t.label} block mb-1.5`}>Time</label>
          <TimeInput
            value={value.defaultTime || ''}
            onChange={setDefaultTime}
            className="max-w-[12rem]"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <label className={`text-xs ${t.label} block`}>Time per day</label>
          {selectedInOrder.length === 0 ? (
            <p className={`text-xs ${t.label}`}>Select a day above to set its time.</p>
          ) : (
            selectedInOrder.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className={`text-xs w-10 ${t.label}`}>{day}</span>
                <TimeInput
                  value={value.times[day] || ''}
                  onChange={(raw) => setDayTime(day, raw)}
                  className="max-w-[12rem]"
                  placeholder={value.defaultTime ? value.defaultTime : 'Select time'}
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* Optional legacy bucket (display only) */}
      <div>
        <label className={`text-xs ${t.label} block mb-1.5`}>Time slot (optional)</label>
        <select
          value={value.timeSlot || ''}
          onChange={(e) => onChange({ ...value, timeSlot: e.target.value || undefined })}
          className={`rounded-xl px-3 py-2 text-sm ${t.select}`}
        >
          <option value="">None</option>
          {TIME_SLOTS.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
