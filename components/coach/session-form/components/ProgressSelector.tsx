// =============================================================================
// FILE: components/coach/session-form/components/ProgressSelector.tsx
// PURPOSE: Progress and engagement level selector
// =============================================================================

'use client';

import { FC } from 'react';
import { LucideIcon } from 'lucide-react';
import { BRAND_COLORS } from '../constants';

interface Option {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor?: string;
}

interface ProgressSelectorProps<T extends string> {
  value: T | null;
  onChange: (value: T) => void;
  options: Option[];
}

function ProgressSelector<T extends string>({
  value,
  onChange,
  options,
}: ProgressSelectorProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = value === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value as T)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all
              ${isSelected
                ? `${option.bgColor || 'bg-gray-700'} border-current ${option.color}`
                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
              }
            `}
          >
            <Icon className={`w-4 h-4 ${isSelected ? option.color : 'text-gray-500'}`} />
            <span className="text-sm font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ProgressSelector;
