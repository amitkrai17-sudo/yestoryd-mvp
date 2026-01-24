// =============================================================================
// FILE: components/coach/session-form/components/RatingScale.tsx
// PURPOSE: 1-5 rating scale with icons
// =============================================================================

'use client';

import { FC } from 'react';
import { RatingOption } from '../constants';
import { OverallRating } from '../types';
import { BRAND_COLORS } from '../constants';

interface RatingScaleProps {
  value: OverallRating | null;
  onChange: (rating: OverallRating) => void;
  options: RatingOption[];
}

const RatingScale: FC<RatingScaleProps> = ({ value, onChange, options }) => {
  return (
    <div className="flex gap-2 sm:gap-3">
      {options.map((option) => {
        const isSelected = value === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              flex-1 flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all
              ${isSelected
                ? 'border-[#FF0099] bg-[#FF0099]/10 scale-105'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }
            `}
          >
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center
                ${isSelected ? 'bg-[#FF0099]/20' : 'bg-gray-700/50'}
              `}
            >
              <Icon
                className={`w-5 h-5 ${isSelected ? option.color : 'text-gray-500'}`}
              />
            </div>
            <span
              className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-500'}`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default RatingScale;
