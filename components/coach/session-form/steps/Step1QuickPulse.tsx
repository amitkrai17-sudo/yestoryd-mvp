// =============================================================================
// FILE: components/coach/session-form/steps/Step1QuickPulse.tsx
// PURPOSE: Step 1 - Quick Pulse (overall rating + focus area selection)
// =============================================================================

'use client';

import { FC, useMemo } from 'react';
import { Target, ArrowRight } from 'lucide-react';
import { FocusAreaKey, SessionFormState } from '../types';
import { FOCUS_AREAS, RATING_OPTIONS, BRAND_COLORS } from '../constants';
import RatingScale from '../components/RatingScale';
import FocusAreaGrid from '../components/FocusAreaGrid';

interface Step1Props {
  formState: SessionFormState;
  childAge: number;
  onUpdate: (updates: Partial<SessionFormState>) => void;
  onNext: () => void;
}

/**
 * Step 1: Quick Pulse
 * Captures overall session impression and primary focus area
 */
const Step1QuickPulse: FC<Step1Props> = ({
  formState,
  childAge,
  onUpdate,
  onNext,
}) => {
  const isValid = formState.overallRating !== null && formState.primaryFocus !== null;

  // Filter focus areas by age appropriateness
  const availableFocusAreas = useMemo(() => {
    return (Object.entries(FOCUS_AREAS) as [FocusAreaKey, typeof FOCUS_AREAS[FocusAreaKey]][])
      .filter(([_, area]) => childAge >= area.minAge && childAge <= area.maxAge);
  }, [childAge]);

  return (
    <div className="space-y-8">
      {/* Overall Rating */}
      <section>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <Target className="w-5 h-5" style={{ color: BRAND_COLORS.hotPink }} />
          How did the session go?
        </h3>
        <RatingScale
          value={formState.overallRating}
          onChange={(rating) => onUpdate({ overallRating: rating })}
          options={RATING_OPTIONS}
        />
      </section>

      {/* Focus Area Selection */}
      <section>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-2">
          <Target className="w-5 h-5" style={{ color: BRAND_COLORS.electricBlue }} />
          What was the primary focus?
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          This shapes your next options
        </p>
        <FocusAreaGrid
          value={formState.primaryFocus}
          onChange={(focus) => onUpdate({ primaryFocus: focus })}
          options={availableFocusAreas}
        />
      </section>

      {/* Next Button */}
      <button
        type="button"
        onClick={onNext}
        disabled={!isValid}
        className={`
          w-full py-3 rounded-xl font-semibold transition-all
          flex items-center justify-center gap-2
          ${isValid
            ? 'text-white hover:opacity-90'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }
        `}
        style={isValid ? {
          background: `linear-gradient(135deg, ${BRAND_COLORS.hotPink} 0%, ${BRAND_COLORS.deepPurple} 100%)`,
          boxShadow: `0 8px 20px ${BRAND_COLORS.hotPink}30`,
        } : undefined}
      >
        Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Step1QuickPulse;
