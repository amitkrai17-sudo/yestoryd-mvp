// =============================================================================
// FILE: components/coach/session-form/steps/Step4Review.tsx
// PURPOSE: Step 4 - Review and Submit
// =============================================================================

'use client';

import { FC } from 'react';
import {
  CheckCircle, ThumbsUp, AlertTriangle, Target, BookOpen, Home,
  Bell, TrendingUp, Heart, FileText, ArrowLeft, Save, Loader2
} from 'lucide-react';
import { SessionFormState } from '../types';
import {
  FOCUS_AREAS,
  RATING_OPTIONS,
  PROGRESS_OPTIONS,
  ENGAGEMENT_OPTIONS,
  BRAND_COLORS,
} from '../constants';

interface Step4Props {
  formState: SessionFormState;
  childName: string;
  sessionNumber: number;
  onUpdate: (updates: Partial<SessionFormState>) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

/**
 * Step 4: Review and Submit
 * Final review of all data before submission
 */
const Step4Review: FC<Step4Props> = ({
  formState,
  childName,
  sessionNumber,
  onUpdate,
  onBack,
  onSubmit,
  isSubmitting,
}) => {
  const { primaryFocus } = formState;

  if (!primaryFocus) {
    return <div className="text-center text-gray-500">Missing required data</div>;
  }

  const focusConfig = FOCUS_AREAS[primaryFocus];
  const ratingOption = RATING_OPTIONS.find(r => r.value === formState.overallRating);
  const progressOption = PROGRESS_OPTIONS.find(p => p.value === formState.focusProgress);
  const engagementOption = ENGAGEMENT_OPTIONS.find(e => e.value === formState.engagementLevel);

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center py-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{
            background: `linear-gradient(135deg, ${BRAND_COLORS.hotPink} 0%, ${BRAND_COLORS.deepPurple} 100%)`,
          }}
        >
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Ready to Submit?</h3>
        <p className="text-gray-400">Review your session feedback for {childName}</p>
      </div>

      {/* Summary Cards */}
      <div className="space-y-4">
        {/* Session Overview */}
        <div
          className="p-4 rounded-xl border"
          style={{ background: `${BRAND_COLORS.darkGray}80`, borderColor: BRAND_COLORS.mediumGray }}
        >
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" style={{ color: focusConfig.color }} />
            Session #{sessionNumber} Overview
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Focus Area</div>
              <div className="text-sm text-white">{focusConfig.label}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Overall Rating</div>
              <div className="text-sm text-white flex items-center gap-1">
                {ratingOption && (
                  <>
                    <ratingOption.icon className={`w-4 h-4 ${ratingOption.color}`} />
                    {ratingOption.label}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress & Engagement */}
        <div
          className="p-4 rounded-xl border"
          style={{ background: `${BRAND_COLORS.darkGray}80`, borderColor: BRAND_COLORS.mediumGray }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Progress
              </div>
              <div className="text-sm text-white flex items-center gap-1">
                {progressOption && (
                  <>
                    <progressOption.icon className={`w-4 h-4 ${progressOption.color}`} />
                    {progressOption.label}
                  </>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Heart className="w-3 h-3" />
                Engagement
              </div>
              <div className="text-sm text-white flex items-center gap-1">
                {engagementOption && (
                  <>
                    <engagementOption.icon className={`w-4 h-4 ${engagementOption.color}`} />
                    {engagementOption.label}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Highlights */}
        {formState.highlights.length > 0 && (
          <div
            className="p-4 rounded-xl border"
            style={{ background: `${BRAND_COLORS.successGreen}10`, borderColor: `${BRAND_COLORS.successGreen}30` }}
          >
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: BRAND_COLORS.successGreen }}>
              <ThumbsUp className="w-4 h-4" />
              Highlights ({formState.highlights.length})
            </h4>
            <ul className="space-y-1">
              {formState.highlights.map((item, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <CheckCircle className="w-3 h-3 mt-1 flex-shrink-0" style={{ color: BRAND_COLORS.successGreen }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Challenges */}
        {formState.challenges.length > 0 && (
          <div
            className="p-4 rounded-xl border"
            style={{ background: `${BRAND_COLORS.warningOrange}10`, borderColor: `${BRAND_COLORS.warningOrange}30` }}
          >
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: BRAND_COLORS.warningOrange }}>
              <AlertTriangle className="w-4 h-4" />
              Challenges ({formState.challenges.length})
            </h4>
            <ul className="space-y-1">
              {formState.challenges.map((item, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 mt-1 flex-shrink-0" style={{ color: BRAND_COLORS.warningOrange }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Skills */}
        {formState.skillsPracticed.length > 0 && (
          <div
            className="p-4 rounded-xl border"
            style={{ background: `${BRAND_COLORS.electricBlue}10`, borderColor: `${BRAND_COLORS.electricBlue}30` }}
          >
            <h4 className="text-sm font-semibold mb-2" style={{ color: BRAND_COLORS.electricBlue }}>
              Skills Practiced ({formState.skillsPracticed.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {formState.skillsPracticed.map((skill, i) => (
                <span
                  key={i}
                  className="text-xs px-3 py-1 rounded-full"
                  style={{ background: `${BRAND_COLORS.electricBlue}20`, color: BRAND_COLORS.electricBlue }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Next Session Focus */}
        {formState.nextSessionFocus && (
          <div
            className="p-4 rounded-xl border"
            style={{ background: `${BRAND_COLORS.deepPurple}10`, borderColor: `${BRAND_COLORS.deepPurple}30` }}
          >
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: BRAND_COLORS.deepPurple }}>
              <Target className="w-4 h-4" />
              Next Session Focus
            </h4>
            <p className="text-sm text-gray-300">{formState.nextSessionFocus}</p>
          </div>
        )}

        {/* Homework */}
        {formState.homeworkAssigned && formState.homeworkItems.length > 0 && (
          <div
            className="p-4 rounded-xl border"
            style={{ background: `${BRAND_COLORS.yellow}10`, borderColor: `${BRAND_COLORS.yellow}30` }}
          >
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: BRAND_COLORS.yellow }}>
              <Home className="w-4 h-4" />
              Homework Assigned
            </h4>
            <ul className="space-y-1">
              {formState.homeworkItems.map((item, i) => (
                <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <BookOpen className="w-3 h-3 mt-1 flex-shrink-0" style={{ color: BRAND_COLORS.yellow }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Parent Update */}
        {formState.parentUpdateNeeded && (
          <div
            className="p-4 rounded-xl border"
            style={{ background: `${BRAND_COLORS.hotPink}10`, borderColor: `${BRAND_COLORS.hotPink}30` }}
          >
            <p className="text-sm flex items-center gap-2" style={{ color: BRAND_COLORS.hotPink }}>
              <Bell className="w-4 h-4" />
              Parent will be notified ({formState.parentUpdateType || 'general update'})
            </p>
          </div>
        )}
      </div>

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          Additional notes <span className="text-gray-500 text-xs">(Optional)</span>
        </label>
        <textarea
          value={formState.additionalNotes}
          onChange={(e) => onUpdate({ additionalNotes: e.target.value })}
          placeholder="Any other observations or notes for future reference..."
          rows={3}
          className="w-full rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00ABFF] transition-all resize-none"
          style={{
            background: BRAND_COLORS.darkGray,
            border: `1px solid ${BRAND_COLORS.mediumGray}`,
          }}
        />
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex-1 py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, ${BRAND_COLORS.successGreen} 0%, #059669 100%)`,
            boxShadow: `0 8px 20px ${BRAND_COLORS.successGreen}40`,
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Complete Session
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Step4Review;
