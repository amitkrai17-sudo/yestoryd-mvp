// =============================================================================
// FILE: components/coach/session-form/steps/Step2DeepDive.tsx
// PURPOSE: Step 2 - Deep Dive (skills, highlights, challenges, progress)
// =============================================================================

'use client';

import { FC, useMemo } from 'react';
import {
  CheckCircle, ThumbsUp, AlertCircle, TrendingUp, Heart, ArrowRight, ArrowLeft
} from 'lucide-react';
import { SessionFormState } from '../types';
import {
  SKILLS_BY_FOCUS,
  HIGHLIGHTS_BY_FOCUS,
  CHALLENGES_BY_FOCUS,
  PROGRESS_OPTIONS,
  ENGAGEMENT_OPTIONS,
  FOCUS_AREAS,
  BRAND_COLORS,
  SkillGroup,
} from '../constants';
import SkillTagSelector from '../components/SkillTagSelector';
import QuickPickInput from '../components/QuickPickInput';
import ProgressSelector from '../components/ProgressSelector';

interface Step2Props {
  formState: SessionFormState;
  childAge: number;
  onUpdate: (updates: Partial<SessionFormState>) => void;
  onNext: () => void;
  onBack: () => void;
}

/**
 * Step 2: Deep Dive
 * Contextual skills, highlights, and progress based on Step 1 focus
 */
const Step2DeepDive: FC<Step2Props> = ({
  formState,
  childAge,
  onUpdate,
  onNext,
  onBack,
}) => {
  const { primaryFocus } = formState;

  // Get contextualized options based on selected focus
  const contextualOptions = useMemo(() => {
    if (!primaryFocus) return null;

    const skills = SKILLS_BY_FOCUS[primaryFocus];
    const highlights = HIGHLIGHTS_BY_FOCUS[primaryFocus];
    const challenges = CHALLENGES_BY_FOCUS[primaryFocus];

    // Filter skills by age appropriateness
    const ageAppropriateSkills: SkillGroup = {
      foundation: childAge <= 7 ? skills.foundation : skills.foundation.slice(0, 3),
      building: childAge >= 6 ? skills.building : [],
      advanced: childAge >= 9 ? skills.advanced : [],
    };

    return {
      skills: ageAppropriateSkills,
      highlights,
      challenges,
    };
  }, [primaryFocus, childAge]);

  if (!contextualOptions || !primaryFocus) {
    return (
      <div className="text-center text-gray-500 py-8">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-600" />
        <p>Please select a focus area first</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-6 py-2 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isValid =
    formState.skillsPracticed.length > 0 &&
    formState.highlights.length > 0 &&
    formState.focusProgress !== null &&
    formState.engagementLevel !== null;

  return (
    <div className="space-y-8">
      {/* Context Header */}
      <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-800/50 rounded-xl p-3 border border-gray-700">
        <CheckCircle className="w-4 h-4 text-green-400" />
        <span>
          Focus: <strong className="text-white">{FOCUS_AREAS[primaryFocus].label}</strong>
        </span>
        <span className="text-gray-600">|</span>
        <span>
          Age: <strong className="text-white">{childAge} years</strong>
        </span>
      </div>

      {/* Skills Practiced */}
      <section>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <CheckCircle className="w-5 h-5" style={{ color: BRAND_COLORS.electricBlue }} />
          Skills Practiced
          <span className="text-xs font-normal text-gray-500">(Age-appropriate for {childAge} years)</span>
        </h3>
        <SkillTagSelector
          selected={formState.skillsPracticed}
          onChange={(skills) => onUpdate({ skillsPracticed: skills })}
          groups={contextualOptions.skills}
        />
        {formState.skillsPracticed.length === 0 && (
          <p className="text-sm text-amber-400 mt-2">Select at least one skill</p>
        )}
      </section>

      {/* What Clicked - Highlights */}
      <section>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <ThumbsUp className="w-5 h-5" style={{ color: BRAND_COLORS.successGreen }} />
          What clicked today?
          <span style={{ color: BRAND_COLORS.errorRed }}>*</span>
        </h3>
        <QuickPickInput
          selected={formState.highlights}
          suggestions={contextualOptions.highlights}
          onChange={(highlights) => onUpdate({ highlights })}
          placeholder="Add a custom highlight..."
          maxItems={5}
          accentColor="green"
        />
      </section>

      {/* Challenges */}
      <section>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <AlertCircle className="w-5 h-5" style={{ color: BRAND_COLORS.warningOrange }} />
          Any sticking points?
          <span className="text-xs font-normal text-gray-500">(Optional)</span>
        </h3>
        <QuickPickInput
          selected={formState.challenges}
          suggestions={contextualOptions.challenges}
          onChange={(challenges) => onUpdate({ challenges })}
          placeholder="Add a custom challenge..."
          maxItems={3}
          accentColor="orange"
        />
      </section>

      {/* Progress Rating */}
      <section>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <TrendingUp className="w-5 h-5" style={{ color: BRAND_COLORS.electricBlue }} />
          Progress in {FOCUS_AREAS[primaryFocus].label}
          <span style={{ color: BRAND_COLORS.errorRed }}>*</span>
        </h3>
        <ProgressSelector
          value={formState.focusProgress}
          onChange={(progress) => onUpdate({ focusProgress: progress })}
          options={PROGRESS_OPTIONS}
        />
      </section>

      {/* Engagement Level */}
      <section>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <Heart className="w-5 h-5" style={{ color: BRAND_COLORS.hotPink }} />
          Engagement Level
          <span style={{ color: BRAND_COLORS.errorRed }}>*</span>
        </h3>
        <ProgressSelector
          value={formState.engagementLevel}
          onChange={(level) => onUpdate({ engagementLevel: level })}
          options={ENGAGEMENT_OPTIONS}
        />
      </section>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!isValid}
          className={`
            flex-1 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2
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
    </div>
  );
};

export default Step2DeepDive;
