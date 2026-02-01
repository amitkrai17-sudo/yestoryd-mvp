// ============================================================================
// UNIFIED DATE/TIME PICKER COMPONENTS
// components/ui/DateTimePicker.tsx
// ============================================================================
//
// Single source of truth for all date/time selection UI in Yestoryd
//
// Components:
// - DayOfWeekSelector: Multi-select day picker (Mon-Sun)
// - TimeSlotSelector: Time slot selection within buckets
// - DatePicker: Calendar-style date picker
// - SimpleDateInput: Basic native date input with styling
// - TimePreferenceSelector: Morning/Afternoon/Evening preference
// - BookingPreferenceSelector: Combined date + time preference for enrollment
//
// Usage:
// import { DayOfWeekSelector, TimeSlotSelector } from '@/components/ui/DateTimePicker';
//
// ============================================================================

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Calendar, Clock, ChevronLeft, ChevronRight,
  Check, X, Sun, Sunrise, Sunset, Moon
} from 'lucide-react';

// ============================================================================
// SHARED CONSTANTS
// ============================================================================

export const DAYS_OF_WEEK = [
  { value: 0, short: 'Sun', full: 'Sunday' },
  { value: 1, short: 'Mon', full: 'Monday' },
  { value: 2, short: 'Tue', full: 'Tuesday' },
  { value: 3, short: 'Wed', full: 'Wednesday' },
  { value: 4, short: 'Thu', full: 'Thursday' },
  { value: 5, short: 'Fri', full: 'Friday' },
  { value: 6, short: 'Sat', full: 'Saturday' },
] as const;

export const TIME_BUCKETS = [
  { name: 'early_morning', label: 'Early Morning', emoji: '🌅', startHour: 6, endHour: 9 },
  { name: 'morning', label: 'Morning', emoji: '☀️', startHour: 9, endHour: 12 },
  { name: 'afternoon', label: 'Afternoon', emoji: '🌤️', startHour: 12, endHour: 17 },
  { name: 'evening', label: 'Evening', emoji: '🌆', startHour: 17, endHour: 21 },
] as const;

export const TIME_OPTIONS = [
  { value: '06:00', label: '6:00 AM' },
  { value: '06:30', label: '6:30 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '07:30', label: '7:30 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '08:30', label: '8:30 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '09:30', label: '9:30 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '10:30', label: '10:30 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '11:30', label: '11:30 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '12:30', label: '12:30 PM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '13:30', label: '1:30 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '14:30', label: '2:30 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '15:30', label: '3:30 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '16:30', label: '4:30 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '17:30', label: '5:30 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '18:30', label: '6:30 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '19:30', label: '7:30 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '20:30', label: '8:30 PM' },
  { value: '21:00', label: '9:00 PM' },
] as const;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

// Brand colors
const COLORS = {
  primary: '#FF0099',     // Yestoryd pink
  primaryHover: '#e6008a',
  secondary: '#00ABFF',   // Accent blue
  success: '#10b981',     // Emerald
  error: '#ef4444',       // Red
} as const;

// ============================================================================
// SHARED UTILITIES
// ============================================================================

export function formatTime12(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOnly = new Date(dateStr + 'T00:00:00');
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';

  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function isPastDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

export function isTodayDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function getTimeBucket(timeStr: string): string {
  const hour = parseInt(timeStr.split(':')[0]);
  for (const bucket of TIME_BUCKETS) {
    if (hour >= bucket.startHour && hour < bucket.endHour) {
      return bucket.name;
    }
  }
  return 'evening';
}

// ============================================================================
// COMPONENT: DayOfWeekSelector
// ============================================================================
// Multi-select day picker for coach availability

interface DayOfWeekSelectorProps {
  selectedDays: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
  showFullNames?: boolean;
  compact?: boolean;
}

export function DayOfWeekSelector({
  selectedDays,
  onChange,
  disabled = false,
  showFullNames = false,
  compact = false,
}: DayOfWeekSelectorProps) {
  const toggleDay = (day: number) => {
    if (disabled) return;
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter(d => d !== day));
    } else {
      onChange([...selectedDays, day]);
    }
  };

  return (
    <div className={`flex ${compact ? 'gap-1' : 'gap-2'} flex-wrap`}>
      {DAYS_OF_WEEK.map(day => {
        const isSelected = selectedDays.includes(day.value);
        return (
          <button
            key={day.value}
            type="button"
            onClick={() => toggleDay(day.value)}
            disabled={disabled}
            className={`
              ${compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}
              rounded-lg font-medium transition-colors
              ${isSelected
                ? `bg-[${COLORS.primary}] text-white`
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            style={isSelected ? { backgroundColor: COLORS.primary } : {}}
          >
            {showFullNames ? day.full : day.short}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// COMPONENT: TimeRangeSelector
// ============================================================================
// Start/end time dropdowns for coach availability

interface TimeRangeSelectorProps {
  startTime: string;
  endTime: string;
  onStartChange: (time: string) => void;
  onEndChange: (time: string) => void;
  disabled?: boolean;
}

export function TimeRangeSelector({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  disabled = false,
}: TimeRangeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Start Time</label>
        <select
          value={startTime}
          onChange={(e) => onStartChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-[#FF0099] focus:outline-none disabled:opacity-50"
        >
          {TIME_OPTIONS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">End Time</label>
        <select
          value={endTime}
          onChange={(e) => onEndChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-[#FF0099] focus:outline-none disabled:opacity-50"
        >
          {TIME_OPTIONS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT: TimePreferenceSelector
// ============================================================================
// Morning/Afternoon/Evening preference cards for parents

export type TimePreference = 'morning' | 'afternoon' | 'evening' | 'any';

interface TimePreferenceSelectorProps {
  value: TimePreference;
  onChange: (preference: TimePreference) => void;
  disabled?: boolean;
  showAnyOption?: boolean;
}

export function TimePreferenceSelector({
  value,
  onChange,
  disabled = false,
  showAnyOption = true,
}: TimePreferenceSelectorProps) {
  const options: { value: TimePreference; label: string; icon: React.ReactNode; description: string }[] = [
    { value: 'morning', label: 'Morning', icon: <Sunrise className="w-5 h-5" />, description: '9 AM - 12 PM' },
    { value: 'afternoon', label: 'Afternoon', icon: <Sun className="w-5 h-5" />, description: '12 PM - 5 PM' },
    { value: 'evening', label: 'Evening', icon: <Sunset className="w-5 h-5" />, description: '5 PM - 9 PM' },
  ];

  if (showAnyOption) {
    options.push({ value: 'any', label: 'Any Time', icon: <Clock className="w-5 h-5" />, description: 'Flexible' });
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(option => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={`
              p-3 rounded-xl border-2 transition-all text-left
              ${isSelected
                ? 'border-[#FF0099] bg-[#FF0099]/10'
                : 'border-gray-700 hover:border-gray-600'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={isSelected ? 'text-[#FF0099]' : 'text-gray-400'}>
                {option.icon}
              </span>
              <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                {option.label}
              </span>
            </div>
            <p className="text-xs text-gray-500">{option.description}</p>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// COMPONENT: SimpleDateInput
// ============================================================================
// Native date input with consistent styling

interface SimpleDateInputProps {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  label?: string;
  showPreview?: boolean;
}

export function SimpleDateInput({
  value,
  onChange,
  min,
  max,
  disabled = false,
  label,
  showPreview = true,
}: SimpleDateInputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-700 rounded-lg text-white bg-gray-800 text-sm focus:ring-2 focus:ring-[#FF0099]/30 focus:border-[#FF0099] disabled:opacity-50"
      />
      {showPreview && value && (
        <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/20 p-2 rounded-lg">
          <Calendar className="w-3 h-3" />
          <span>
            {formatDateLong(value)}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENT: CalendarDatePicker
// ============================================================================
// Full calendar-style date picker

interface CalendarDatePickerProps {
  selectedDate: string | null;
  onSelect: (date: string) => void;
  minDate?: Date;
  maxDate?: Date;
  availableDates?: Set<string>;
  highlightToday?: boolean;
}

export function CalendarDatePicker({
  selectedDate,
  onSelect,
  minDate,
  maxDate,
  availableDates,
  highlightToday = true,
}: CalendarDatePickerProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) return new Date(selectedDate);
    return new Date();
  });

  const handlePrevMonth = useCallback(() => {
    const newMonth = new Date(viewMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);

    if (minDate) {
      const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      if (newMonth < minMonth) return;
    }

    setViewMonth(newMonth);
  }, [viewMonth, minDate]);

  const handleNextMonth = useCallback(() => {
    const newMonth = new Date(viewMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);

    if (maxDate) {
      const maxMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      if (newMonth > maxMonth) return;
    }

    setViewMonth(newMonth);
  }, [viewMonth, maxDate]);

  const monthDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    // Convert Sunday=0 to Sunday=6 for Mon-Sun layout
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const days: { day: number; dateStr: string }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ day, dateStr });
    }

    return { days, startOffset };
  }, [viewMonth]);

  const today = new Date();
  const isPrevDisabled = minDate && viewMonth.getFullYear() === minDate.getFullYear() && viewMonth.getMonth() === minDate.getMonth();
  const isNextDisabled = maxDate && viewMonth.getFullYear() === maxDate.getFullYear() && viewMonth.getMonth() === maxDate.getMonth();

  return (
    <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          disabled={isPrevDisabled}
          className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4 text-gray-400" />
        </button>
        <span className="text-white text-sm font-medium">
          {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <button
          onClick={handleNextMonth}
          disabled={isNextDisabled}
          className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Day Headers (Mon-Sun) */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div key={day} className="text-center text-gray-500 text-xs font-medium py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for offset */}
        {Array.from({ length: monthDays.startOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Day buttons */}
        {monthDays.days.map(({ day, dateStr }) => {
          const isSelected = selectedDate === dateStr;
          const isToday = highlightToday && isTodayDate(dateStr);
          const isPast = isPastDate(dateStr);
          const hasSlots = availableDates ? availableDates.has(dateStr) : true;
          const isDisabled = isPast || (availableDates && !hasSlots);

          return (
            <button
              key={day}
              onClick={() => !isDisabled && onSelect(dateStr)}
              disabled={isDisabled}
              className={`
                aspect-square rounded-lg text-sm font-medium transition-all
                flex items-center justify-center
                ${isSelected ? 'bg-[#FF0099] text-white' : ''}
                ${isToday && !isSelected ? 'ring-2 ring-[#00ABFF]' : ''}
                ${!isDisabled && !isSelected ? 'hover:bg-[#FF0099]/20 cursor-pointer text-white' : ''}
                ${isDisabled ? 'text-gray-700 cursor-not-allowed' : ''}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-white/20" />
          <span>Available</span>
        </div>
        {highlightToday && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-2 border-[#00ABFF]" />
            <span>Today</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENT: BookingPreferenceSelector
// ============================================================================
// Combined start option + date + time preference for enrollment flow

interface BookingPreferenceSelectorProps {
  startOption: 'now' | 'later';
  startDate: string;
  timePreference: TimePreference;
  onStartOptionChange: (option: 'now' | 'later') => void;
  onStartDateChange: (date: string) => void;
  onTimePreferenceChange: (preference: TimePreference) => void;
  minDate: string;
  maxDate: string;
}

export function BookingPreferenceSelector({
  startOption,
  startDate,
  timePreference,
  onStartOptionChange,
  onStartDateChange,
  onTimePreferenceChange,
  minDate,
  maxDate,
}: BookingPreferenceSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Start Date Section */}
      <div className="border border-gray-700 rounded-xl p-3 bg-gray-800/50">
        <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-purple-400" />
          When would you like to start?
        </label>

        {/* Start Immediately */}
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all mb-2 ${
            startOption === 'now'
              ? 'border-[#FF0099] bg-[#FF0099]/10'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <input
            type="radio"
            name="startOption"
            value="now"
            checked={startOption === 'now'}
            onChange={() => onStartOptionChange('now')}
            className="mt-0.5 w-4 h-4 text-[#FF0099]"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">Start Immediately</span>
              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full">
                RECOMMENDED
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">Sessions scheduled within 48 hours</p>
          </div>
        </label>

        {/* Choose Date */}
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
            startOption === 'later'
              ? 'border-[#FF0099] bg-[#FF0099]/10'
              : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <input
            type="radio"
            name="startOption"
            value="later"
            checked={startOption === 'later'}
            onChange={() => onStartOptionChange('later')}
            className="mt-0.5 w-4 h-4 text-[#FF0099]"
          />
          <div className="flex-1">
            <span className="font-semibold text-white text-sm">Choose a Start Date</span>
            <p className="text-gray-400 text-xs mt-0.5">
              Perfect for after exams, holidays, or travel
            </p>

            {startOption === 'later' && (
              <div className="mt-2">
                <SimpleDateInput
                  value={startDate}
                  onChange={onStartDateChange}
                  min={minDate}
                  max={maxDate}
                />
              </div>
            )}
          </div>
        </label>
      </div>

      {/* Time Preference Section */}
      <div className="border border-gray-700 rounded-xl p-3 bg-gray-800/50">
        <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-purple-400" />
          Preferred session time
        </label>
        <TimePreferenceSelector
          value={timePreference}
          onChange={onTimePreferenceChange}
          showAnyOption={true}
        />
        <p className="text-xs text-gray-500 mt-2">
          We'll schedule sessions during your preferred time when possible
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  DayOfWeekSelector,
  TimeRangeSelector,
  TimePreferenceSelector,
  SimpleDateInput,
  CalendarDatePicker,
  BookingPreferenceSelector,
  // Constants
  DAYS_OF_WEEK,
  TIME_BUCKETS,
  TIME_OPTIONS,
  MONTHS,
  // Utilities
  formatTime12,
  formatDateShort,
  formatDateLong,
  isPastDate,
  isTodayDate,
  getTimeBucket,
};
