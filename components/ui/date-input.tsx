'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils/date-format';
import { MONTHS } from '@/components/ui/DateTimePicker';

interface DateInputProps {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  label?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function DateInput({
  value,
  onChange,
  min,
  max,
  label,
  error,
  className = '',
  disabled = false,
  placeholder = 'Select date',
}: DateInputProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return new Date(value + 'T00:00:00');
    if (min) return new Date(min + 'T00:00:00');
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (value) setViewMonth(new Date(value + 'T00:00:00'));
  }, [value]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minDate = min ? new Date(min + 'T00:00:00') : null;
  const maxDate = max ? new Date(max + 'T00:00:00') : null;
  if (minDate) minDate.setHours(0, 0, 0, 0);
  if (maxDate) maxDate.setHours(0, 0, 0, 0);

  const canGoPrev = !minDate || new Date(year, month - 1, 1) >= new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canGoNext = !maxDate || new Date(year, month + 1, 1) <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  function handleSelect(dateStr: string) {
    onChange(dateStr);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`
          w-full flex items-center gap-2 px-3 h-11 rounded-xl border text-sm text-left transition-colors
          ${error
            ? 'border-red-500 focus:ring-red-500/30'
            : open
              ? 'border-accent ring-2 ring-accent/20'
              : 'border-border hover:border-border-hover'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed bg-surface-2' : 'bg-surface-2 cursor-pointer'}
        `}
      >
        <Calendar className="w-4 h-4 text-text-tertiary flex-shrink-0" />
        <span className={value ? 'text-text-primary' : 'text-text-tertiary'}>
          {value ? formatDate(value) : placeholder}
        </span>
      </button>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {open && (
        <div className="absolute z-50 mt-1 w-72 bg-surface-1 border border-border rounded-2xl shadow-xl p-3 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => canGoPrev && setViewMonth(new Date(year, month - 1, 1))}
              disabled={!canGoPrev}
              className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <span className="text-sm font-semibold text-text-primary">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => canGoNext && setViewMonth(new Date(year, month + 1, 1))}
              disabled={!canGoNext}
              className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-text-tertiary py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`e-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const d = new Date(dateStr + 'T00:00:00');
              d.setHours(0, 0, 0, 0);

              const isSelected = value === dateStr;
              const isToday = d.getTime() === today.getTime();
              const isDisabled = !!(minDate && d < minDate) || !!(maxDate && d > maxDate);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => !isDisabled && handleSelect(dateStr)}
                  disabled={isDisabled}
                  className={`
                    aspect-square rounded-lg text-xs font-medium transition-all flex items-center justify-center
                    ${isSelected ? 'bg-accent text-white' : ''}
                    ${isToday && !isSelected ? 'ring-1 ring-accent/50 text-accent' : ''}
                    ${!isDisabled && !isSelected ? 'hover:bg-accent/10 text-text-primary cursor-pointer' : ''}
                    ${isDisabled ? 'text-text-tertiary/30 cursor-not-allowed' : ''}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
