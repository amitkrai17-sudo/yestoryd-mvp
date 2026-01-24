// =============================================================================
// FILE: components/coach/session-form/components/FocusAreaGrid.tsx
// PURPOSE: Grid of focus area selection buttons
// =============================================================================

'use client';

import { FC } from 'react';
import { FocusAreaKey } from '../types';
import { FocusAreaConfig, BRAND_COLORS } from '../constants';

interface FocusAreaGridProps {
  value: FocusAreaKey | null;
  onChange: (focus: FocusAreaKey) => void;
  options: [FocusAreaKey, FocusAreaConfig][];
}

const FocusAreaGrid: FC<FocusAreaGridProps> = ({ value, onChange, options }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map(([key, config]) => {
        const isSelected = value === key;
        const Icon = config.icon;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="p-4 rounded-xl border-2 transition-all text-left"
            style={{
              borderColor: isSelected ? config.color : BRAND_COLORS.mediumGray,
              background: isSelected ? `${config.color}15` : `${BRAND_COLORS.darkGray}50`,
              boxShadow: isSelected ? `0 4px 12px ${config.color}25` : 'none',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: isSelected ? `${config.color}20` : `${BRAND_COLORS.lightGray}50`,
                }}
              >
                <Icon
                  className="w-5 h-5"
                  style={{ color: isSelected ? config.color : '#9CA3AF' }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white block leading-tight">
                  {config.label}
                </span>
                <span className="text-xs text-gray-500 mt-0.5 block">
                  {config.ageRange} years
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default FocusAreaGrid;
