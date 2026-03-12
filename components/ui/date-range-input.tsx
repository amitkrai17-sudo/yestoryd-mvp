'use client';

import React from 'react';
import { DateInput } from '@/components/ui/date-input';

interface DateRangeInputProps {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  label?: string;
  error?: string;
  className?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
}

export function DateRangeInput({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  label,
  error,
  className = '',
  minDate,
  maxDate,
  disabled = false,
}: DateRangeInputProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <DateInput
          value={startDate}
          onChange={onStartChange}
          min={minDate}
          max={endDate || maxDate}
          disabled={disabled}
          placeholder="Start date"
        />
        <span className="text-text-tertiary text-sm flex-shrink-0">to</span>
        <DateInput
          value={endDate}
          onChange={onEndChange}
          min={startDate || minDate}
          max={maxDate}
          disabled={disabled}
          placeholder="End date"
        />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
