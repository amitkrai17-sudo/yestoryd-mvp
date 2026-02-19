// =============================================================================
// FILE: components/coach/session-form/steps/Step3Planning.tsx
// PURPOSE: Step 3 - Forward Planning (next session, homework, parent update)
// FEATURES: Real Gemini AI suggestions with loading state and fallback
// =============================================================================

'use client';

import { FC, useEffect, useState, useMemo } from 'react';
import {
  Target, Home, Bell, Lightbulb, ArrowRight, ArrowLeft, CheckCircle, Loader2
} from 'lucide-react';
import { SessionFormState, ParentUpdateType } from '../types';
import {
  FOCUS_AREAS,
  RECOMMENDATIONS_BY_PROGRESS,
  HOMEWORK_TEMPLATES,
  PARENT_UPDATE_TYPES,
  BRAND_COLORS,
} from '../constants';

interface Step3Props {
  formState: SessionFormState;
  childId: string;
  childName: string;
  childAge: number;
  sessionNumber: number;
  onUpdate: (updates: Partial<SessionFormState>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface AISuggestionState {
  text: string;
  activities: string[];
  isLoading: boolean;
  isFallback: boolean;
  error: string | null;
}

/**
 * Step 3: Forward Planning
 * Next session focus, homework, parent updates
 * Features real Gemini AI suggestions
 */
const Step3Planning: FC<Step3Props> = ({
  formState,
  childId,
  childName,
  childAge,
  sessionNumber,
  onUpdate,
  onNext,
  onBack,
}) => {
  const { primaryFocus, focusProgress, highlights, challenges } = formState;

  // State for AI suggestion
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestionState>({
    text: '',
    activities: [],
    isLoading: false,
    isFallback: false,
    error: null,
  });

  // Get contextualized recommendations (fallback/manual options)
  const recommendations = useMemo(() => {
    if (!focusProgress) return null;
    return RECOMMENDATIONS_BY_PROGRESS[focusProgress];
  }, [focusProgress]);

  const homeworkTemplates = useMemo(() => {
    if (!primaryFocus) return [];
    return HOMEWORK_TEMPLATES[primaryFocus];
  }, [primaryFocus]);

  // Fetch AI suggestion when step loads
  useEffect(() => {
    const fetchAISuggestion = async () => {
      // Don't fetch if missing required data
      if (!primaryFocus || highlights.length === 0 || !focusProgress) {
        // Set a basic fallback
        if (primaryFocus && focusProgress && recommendations) {
          setAiSuggestion({
            text: `Continue working on ${FOCUS_AREAS[primaryFocus].label.toLowerCase()} with ${childName}. Focus on building consistency and confidence.`,
            activities: recommendations.stayInFocus.slice(0, 3),
            isLoading: false,
            isFallback: true,
            error: null,
          });
        }
        return;
      }

      setAiSuggestion(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch('/api/coach/ai-suggestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId,
            childName,
            childAge,
            sessionNumber,
            primaryFocus,
            skillsPracticed: formState.skillsPracticed,
            highlights,
            challenges,
            focusProgress,
            engagementLevel: formState.engagementLevel,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setAiSuggestion({
            text: data.suggestion,
            activities: data.recommendedActivities || recommendations?.stayInFocus.slice(0, 3) || [],
            isLoading: false,
            isFallback: data.context?.fallback || false,
            error: null,
          });
        } else {
          throw new Error(data.error || 'Failed to get suggestion');
        }
      } catch (error) {
        console.error('AI suggestion error:', error);
        // Use fallback
        const focusLabel = primaryFocus ? FOCUS_AREAS[primaryFocus].label.toLowerCase() : 'reading skills';
        setAiSuggestion({
          text: `Since ${childName} ${highlights[0]?.toLowerCase() || 'made progress'}, consider building on this momentum with more ${focusLabel} exercises.`,
          activities: recommendations?.stayInFocus.slice(0, 3) || [],
          isLoading: false,
          isFallback: true,
          error: error instanceof Error ? error.message : 'Failed to load AI suggestion',
        });
      }
    };

    fetchAISuggestion();
  }, [
    primaryFocus,
    highlights,
    focusProgress,
    childId,
    childName,
    childAge,
    sessionNumber,
    challenges,
    formState.skillsPracticed,
    formState.engagementLevel,
    recommendations,
  ]);

  if (!primaryFocus || !focusProgress) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>Please complete previous steps first</p>
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

  const isValid = formState.nextSessionFocus !== null;

  return (
    <div className="space-y-8">
      {/* Session Summary Context */}
      <div className="bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm border border-gray-700">
        <div className="flex items-center gap-2 text-green-400">
          <Target className="w-4 h-4" />
          <span>
            {FOCUS_AREAS[primaryFocus].label} | {focusProgress.replace(/_/g, ' ')}
          </span>
        </div>
        {highlights.length > 0 && (
          <div className="text-gray-400">
            Win: {highlights[0]}
          </div>
        )}
      </div>

      {/* AI Suggestion Card */}
      <section
        className="rounded-xl p-4 border"
        style={{
          background: `linear-gradient(135deg, ${BRAND_COLORS.hotPink}10 0%, ${BRAND_COLORS.deepPurple}10 100%)`,
          borderColor: `${BRAND_COLORS.hotPink}30`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${BRAND_COLORS.hotPink}20` }}
          >
            <Lightbulb className="w-5 h-5" style={{ color: BRAND_COLORS.hotPink }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-white">rAI Suggestion</h4>
              {aiSuggestion.isLoading ? (
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded animate-pulse">
                  Analyzing...
                </span>
              ) : aiSuggestion.isFallback ? (
                <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                  Template
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                  AI Powered
                </span>
              )}
            </div>

            {aiSuggestion.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing {childName}&apos;s learning history...</span>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-300 mb-3">{aiSuggestion.text}</p>
                {aiSuggestion.activities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestion.activities.map((activity) => (
                      <button
                        key={activity}
                        type="button"
                        onClick={() => onUpdate({ nextSessionFocus: activity })}
                        className="px-3 py-1.5 text-xs rounded-lg border transition-all"
                        style={{
                          background: formState.nextSessionFocus === activity
                            ? BRAND_COLORS.hotPink
                            : 'transparent',
                          borderColor: formState.nextSessionFocus === activity
                            ? BRAND_COLORS.hotPink
                            : `${BRAND_COLORS.hotPink}50`,
                          color: formState.nextSessionFocus === activity
                            ? 'white'
                            : BRAND_COLORS.hotPink,
                        }}
                      >
                        {activity}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Manual Selection */}
      <section>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
          <Target className="w-5 h-5" style={{ color: BRAND_COLORS.electricBlue }} />
          Next Session Focus
          <span style={{ color: BRAND_COLORS.errorRed }}>*</span>
        </h3>

        {/* Stay in Focus */}
        {recommendations && (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">
                Stay in {FOCUS_AREAS[primaryFocus].label}:
              </p>
              <div className="flex flex-wrap gap-2">
                {recommendations.stayInFocus.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onUpdate({ nextSessionFocus: option })}
                    className="px-4 py-2 text-sm rounded-xl border-2 transition-all"
                    style={{
                      background: formState.nextSessionFocus === option
                        ? BRAND_COLORS.electricBlue
                        : BRAND_COLORS.darkGray,
                      borderColor: formState.nextSessionFocus === option
                        ? BRAND_COLORS.electricBlue
                        : BRAND_COLORS.mediumGray,
                      color: formState.nextSessionFocus === option ? 'white' : '#999',
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Branch Out */}
            <div>
              <p className="text-sm text-gray-400 mb-2">Branch out:</p>
              <div className="flex flex-wrap gap-2">
                {recommendations.branchOut.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onUpdate({ nextSessionFocus: option })}
                    className="px-4 py-2 text-sm rounded-xl border-2 transition-all"
                    style={{
                      background: formState.nextSessionFocus === option
                        ? BRAND_COLORS.deepPurple
                        : BRAND_COLORS.darkGray,
                      borderColor: formState.nextSessionFocus === option
                        ? BRAND_COLORS.deepPurple
                        : BRAND_COLORS.mediumGray,
                      color: formState.nextSessionFocus === option ? 'white' : '#999',
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Homework */}
      <section className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formState.homeworkAssigned}
            onChange={(e) => onUpdate({
              homeworkAssigned: e.target.checked,
              homeworkItems: e.target.checked ? formState.homeworkItems : [],
            })}
            className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-[#00ABFF] focus:ring-[#00ABFF]"
          />
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5" style={{ color: BRAND_COLORS.yellow }} />
            <span className="font-medium text-white">Assign homework for practice</span>
          </div>
        </label>

        {formState.homeworkAssigned && (
          <div className="mt-4 pl-8 space-y-2">
            {homeworkTemplates.map((template) => (
              <label key={template} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formState.homeworkItems.includes(template)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onUpdate({ homeworkItems: [...formState.homeworkItems, template] });
                    } else {
                      onUpdate({ homeworkItems: formState.homeworkItems.filter(h => h !== template) });
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#FFDE00] focus:ring-[#FFDE00]"
                />
                <span className="text-sm text-gray-300">{template}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Parent Update */}
      <section className="bg-gray-800/30 rounded-xl p-4 border border-gray-700">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formState.parentUpdateNeeded}
            onChange={(e) => onUpdate({
              parentUpdateNeeded: e.target.checked,
              parentUpdateType: e.target.checked ? formState.parentUpdateType : null,
            })}
            className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-[#00ABFF] focus:ring-[#00ABFF]"
          />
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" style={{ color: BRAND_COLORS.hotPink }} />
            <span className="font-medium text-white">Flag for parent update</span>
          </div>
        </label>

        {formState.parentUpdateNeeded && (
          <div className="mt-4 pl-8 flex flex-wrap gap-2">
            {PARENT_UPDATE_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => onUpdate({ parentUpdateType: type.value as ParentUpdateType })}
                className="px-3 py-1.5 text-sm rounded-lg border transition-all"
                style={{
                  background: formState.parentUpdateType === type.value
                    ? BRAND_COLORS.hotPink
                    : BRAND_COLORS.darkGray,
                  borderColor: formState.parentUpdateType === type.value
                    ? BRAND_COLORS.hotPink
                    : BRAND_COLORS.mediumGray,
                  color: formState.parentUpdateType === type.value ? 'white' : '#999',
                }}
                title={type.description}
              >
                {type.label}
              </button>
            ))}
          </div>
        )}
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
          Review & Complete
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Step3Planning;
