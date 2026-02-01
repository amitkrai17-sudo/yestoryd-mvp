/**
 * UNIFIED BOOKING PREFERENCE COMPONENTS
 *
 * Brand consistent:
 * - Primary: #FF0099
 * - Rounded: rounded-xl (buttons), rounded-2xl (cards)
 * - Touch targets: min 44px (h-11 or h-12)
 * - Icons: Lucide only
 * - Dark theme support via existing design tokens
 */

'use client';

import { Sun, CloudSun, Moon, Calendar, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';

// Types
export interface BookingPreferences {
  timeBucket: 'morning' | 'afternoon' | 'evening' | 'any';
  preferredDays: number[];
  startType: 'immediate' | 'later';
  startDate?: string;
}

// Day of Week Selector
interface DayOfWeekSelectorProps {
  selectedDays: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
  className?: string;
}

const DAYS = [
  { id: 0, short: 'Sun', full: 'Sunday' },
  { id: 1, short: 'Mon', full: 'Monday' },
  { id: 2, short: 'Tue', full: 'Tuesday' },
  { id: 3, short: 'Wed', full: 'Wednesday' },
  { id: 4, short: 'Thu', full: 'Thursday' },
  { id: 5, short: 'Fri', full: 'Friday' },
  { id: 6, short: 'Sat', full: 'Saturday' },
];

export function DayOfWeekSelector({ selectedDays, onChange, disabled, className }: DayOfWeekSelectorProps) {
  const toggle = (id: number) => {
    if (disabled) return;
    const newDays = selectedDays.includes(id)
      ? selectedDays.filter(d => d !== id)
      : [...selectedDays, id].sort((a, b) => a - b);
    onChange(newDays);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-text-secondary flex items-center gap-1.5">
        <Calendar className="w-4 h-4 text-purple-400" />
        Preferred Days <span className="text-text-tertiary font-normal">(optional)</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {DAYS.map((day) => (
          <button
            key={day.id}
            type="button"
            onClick={() => toggle(day.id)}
            disabled={disabled}
            aria-pressed={selectedDays.includes(day.id)}
            className={cn(
              'min-w-[48px] h-11 px-3 rounded-xl border-2 font-medium transition-all text-sm',
              selectedDays.includes(day.id)
                ? 'border-[#FF0099] bg-[#FF0099] text-white'
                : 'border-border hover:border-[#FF0099]/50 bg-surface-1 text-text-secondary',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {day.short}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-tertiary">Leave unselected for any day</p>
    </div>
  );
}

// Time Bucket Selector (Morning/Afternoon/Evening)
interface TimeBucketSelectorProps {
  selected: 'morning' | 'afternoon' | 'evening' | 'any';
  onChange: (value: 'morning' | 'afternoon' | 'evening' | 'any') => void;
  disabled?: boolean;
  className?: string;
  showAnyOption?: boolean;
}

const TIME_BUCKETS = [
  { id: 'morning' as const, label: 'Morning', time: '9 AM - 12 PM', Icon: Sun, color: 'text-yellow-400' },
  { id: 'afternoon' as const, label: 'Afternoon', time: '12 PM - 4 PM', Icon: CloudSun, color: 'text-orange-400' },
  { id: 'evening' as const, label: 'Evening', time: '4 PM - 8 PM', Icon: Moon, color: 'text-indigo-400' },
];

export function TimeBucketSelector({
  selected,
  onChange,
  disabled,
  className,
  showAnyOption = true
}: TimeBucketSelectorProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-text-secondary flex items-center gap-1.5">
        <Clock className="w-4 h-4 text-purple-400" />
        Preferred Time
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {TIME_BUCKETS.map(({ id, label, time, Icon, color }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            disabled={disabled}
            className={cn(
              'p-3 rounded-xl border-2 transition-all text-left',
              selected === id
                ? 'border-[#FF0099] bg-[#FF0099]/10'
                : 'border-border hover:border-[#FF0099]/50 bg-surface-1',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                'p-1.5 rounded-lg',
                selected === id ? 'bg-[#FF0099]/20' : 'bg-surface-2'
              )}>
                <Icon className={cn('w-4 h-4', selected === id ? 'text-[#FF0099]' : color)} />
              </div>
              <div>
                <div className={cn('font-semibold text-sm', selected === id ? 'text-[#FF0099]' : 'text-white')}>
                  {label}
                </div>
                <div className="text-xs text-text-tertiary">{time}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
      {showAnyOption && (
        <button
          type="button"
          onClick={() => onChange('any')}
          disabled={disabled}
          className={cn(
            'w-full p-2 rounded-xl border-2 transition-all text-sm font-medium',
            selected === 'any'
              ? 'border-[#FF0099] bg-[#FF0099]/10 text-[#FF0099]'
              : 'border-border hover:border-[#FF0099]/50 bg-surface-1 text-text-secondary',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          Any time works for me
        </button>
      )}
    </div>
  );
}

// Start Date Selector (replaces existing StartDateSelector with unified styling)
interface StartDateSelectorProps {
  startType: 'immediate' | 'later';
  startDate?: string;
  onStartTypeChange: (type: 'immediate' | 'later') => void;
  onStartDateChange: (date: string) => void;
  disabled?: boolean;
  className?: string;
}

export function StartDateSelector({
  startType,
  startDate,
  onStartTypeChange,
  onStartDateChange,
  disabled,
  className,
}: StartDateSelectorProps) {
  const minDate = format(addDays(new Date(), 2), 'yyyy-MM-dd');
  const maxDate = format(addDays(new Date(), 60), 'yyyy-MM-dd');

  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium text-text-secondary flex items-center gap-1.5">
        <Calendar className="w-4 h-4 text-purple-400" />
        When would you like to start?
      </label>

      {/* Option 1: Start Immediately */}
      <label
        className={cn(
          'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
          startType === 'immediate'
            ? 'border-[#FF0099] bg-[#FF0099]/10'
            : 'border-border hover:border-[#FF0099]/50 bg-surface-1',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          type="radio"
          name="startType"
          value="immediate"
          checked={startType === 'immediate'}
          onChange={() => onStartTypeChange('immediate')}
          disabled={disabled}
          className="mt-0.5 w-4 h-4 text-[#FF0099] border-border focus:ring-[#FF0099]"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">Start Immediately</span>
            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full">
              RECOMMENDED
            </span>
          </div>
          <p className="text-text-tertiary text-xs mt-0.5">Sessions scheduled within 48-72 hours</p>
        </div>
      </label>

      {/* Option 2: Choose a Date */}
      <label
        className={cn(
          'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
          startType === 'later'
            ? 'border-[#FF0099] bg-[#FF0099]/10'
            : 'border-border hover:border-[#FF0099]/50 bg-surface-1',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          type="radio"
          name="startType"
          value="later"
          checked={startType === 'later'}
          onChange={() => onStartTypeChange('later')}
          disabled={disabled}
          className="mt-0.5 w-4 h-4 text-[#FF0099] border-border focus:ring-[#FF0099]"
        />
        <div className="flex-1">
          <div className="font-semibold text-white text-sm">Choose a Start Date</div>
          <p className="text-text-tertiary text-xs mt-0.5">
            Perfect for after exams, holidays, or travel
          </p>

          {startType === 'later' && (
            <div className="mt-2 space-y-2">
              <input
                type="date"
                value={startDate || ''}
                onChange={(e) => onStartDateChange(e.target.value)}
                min={minDate}
                max={maxDate}
                disabled={disabled}
                className="w-full px-3 py-2 border border-border rounded-lg text-white bg-surface-2 text-sm focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099]"
              />
              {startDate && (
                <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/20 p-2 rounded-lg">
                  <Calendar className="w-3 h-3" />
                  <span>
                    Program starts:{' '}
                    <strong>
                      {new Date(startDate).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </label>
    </div>
  );
}

// Full Booking Preferences Component
interface BookingPreferenceSelectorProps {
  value: BookingPreferences;
  onChange: (prefs: BookingPreferences) => void;
  disabled?: boolean;
  className?: string;
  showInfoBanner?: boolean;
}

export function BookingPreferenceSelector({
  value,
  onChange,
  disabled,
  className,
  showInfoBanner = true
}: BookingPreferenceSelectorProps) {
  const update = (partial: Partial<BookingPreferences>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Info Banner */}
      {showInfoBanner && (
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-300">
            We&apos;ll match your preferences with coach availability.
            If your exact slot isn&apos;t available, we&apos;ll find the closest alternative.
          </p>
        </div>
      )}

      {/* Time Preference */}
      <TimeBucketSelector
        selected={value.timeBucket}
        onChange={(timeBucket) => update({ timeBucket })}
        disabled={disabled}
      />

      {/* Day Preference */}
      <DayOfWeekSelector
        selectedDays={value.preferredDays}
        onChange={(preferredDays) => update({ preferredDays })}
        disabled={disabled}
      />

      {/* Start Date */}
      <StartDateSelector
        startType={value.startType}
        startDate={value.startDate}
        onStartTypeChange={(startType) => update({ startType, startDate: startType === 'immediate' ? undefined : value.startDate })}
        onStartDateChange={(startDate) => update({ startDate })}
        disabled={disabled}
      />
    </div>
  );
}

export default BookingPreferenceSelector;
