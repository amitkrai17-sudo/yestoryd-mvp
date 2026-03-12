'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { formatTime12 } from '@/lib/utils/date-format';

interface TimeInputProps {
  value: string;
  onChange: (time: string) => void;
  min?: string;
  max?: string;
  step?: number;
  label?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

function generateTimeSlots(step: number, min?: string, max?: string): string[] {
  const slots: string[] = [];
  const minMinutes = min ? parseInt(min.split(':')[0]) * 60 + parseInt(min.split(':')[1]) : 0;
  const maxMinutes = max ? parseInt(max.split(':')[0]) * 60 + parseInt(max.split(':')[1]) : 23 * 60 + 30;

  for (let m = minMinutes; m <= maxMinutes; m += step) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return slots;
}

export function TimeInput({
  value,
  onChange,
  min,
  max,
  step = 30,
  label,
  error,
  className = '',
  disabled = false,
  placeholder = 'Select time',
}: TimeInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const slots = useMemo(() => generateTimeSlots(step, min, max), [step, min, max]);

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
    if (open && activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }, [open]);

  function handleSelect(time: string) {
    onChange(time);
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
        <Clock className="w-4 h-4 text-text-tertiary flex-shrink-0" />
        <span className={value ? 'text-text-primary' : 'text-text-tertiary'}>
          {value ? formatTime12(value) : placeholder}
        </span>
      </button>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {open && (
        <div className="absolute z-50 mt-1 w-44 bg-surface-1 border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin">
            {slots.map(slot => {
              const isActive = value === slot;
              return (
                <button
                  key={slot}
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  onClick={() => handleSelect(slot)}
                  className={`
                    w-full px-4 py-2.5 text-sm text-left transition-colors
                    ${isActive
                      ? 'bg-accent/10 text-accent font-semibold'
                      : 'text-text-primary hover:bg-surface-2'
                    }
                  `}
                >
                  {formatTime12(slot)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
