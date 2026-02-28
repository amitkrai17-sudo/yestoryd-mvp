// ============================================================
// Card 5: Engagement, Context, Homework, Parent Update + Submit
// ============================================================

'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScorePreview } from '../ScorePreview';
import type { CardProps, EngagementLevel, ParentUpdateType } from '../types';
import {
  ENGAGEMENT_LABELS,
  ENGAGEMENT_COLORS,
  CONTEXT_TAGS,
  CONTEXT_TAG_LABELS,
} from '../types';

interface EngagementSubmitCardProps extends CardProps {
  scorePreview: {
    score: number;
    signals: {
      hasSkills: boolean;
      hasPerformance: boolean;
      hasArtifact: boolean;
      hasObservations: boolean;
      hasEngagement: boolean;
    };
  };
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
}

const ENGAGEMENT_LEVELS: EngagementLevel[] = ['exceptional', 'high', 'moderate', 'low'];

const PARENT_UPDATE_TYPES: { value: ParentUpdateType; label: string }[] = [
  { value: 'celebrate', label: 'Celebrate' },
  { value: 'support', label: 'Support' },
  { value: 'homework', label: 'Homework' },
  { value: 'concern', label: 'Concern' },
];

export function EngagementSubmitCard({
  state,
  onUpdate,
  scorePreview,
  submitting,
  submitError,
  onSubmit,
}: EngagementSubmitCardProps) {
  return (
    <div className="space-y-5">
      {/* Engagement Level */}
      <div>
        <h3 className="text-white font-semibold text-base mb-1">Engagement Level</h3>
        <p className="text-text-tertiary text-xs mb-2.5">How engaged was the child? (required)</p>
        <div className="grid grid-cols-2 gap-2">
          {ENGAGEMENT_LEVELS.map(level => {
            const selected = state.engagementLevel === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => onUpdate({ engagementLevel: selected ? null : level })}
                className={cn(
                  'px-3 py-2.5 rounded-xl text-sm font-medium border transition-all min-h-[44px]',
                  'active:scale-95',
                  selected
                    ? ENGAGEMENT_COLORS[level]
                    : 'bg-surface-2 text-text-tertiary border-border hover:border-text-tertiary',
                )}
              >
                {ENGAGEMENT_LABELS[level]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Context Tags */}
      <div>
        <h4 className="text-text-secondary text-xs font-medium mb-2">Context Tags (optional)</h4>
        <div className="flex flex-wrap gap-2">
          {CONTEXT_TAGS.map(tag => {
            const selected = state.contextTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  const updated = selected
                    ? state.contextTags.filter(t => t !== tag)
                    : [...state.contextTags, tag];
                  onUpdate({ contextTags: updated });
                }}
                className={cn(
                  'px-2.5 py-1.5 rounded-full text-[11px] font-medium border transition-all',
                  'active:scale-95',
                  selected
                    ? 'bg-[#00ABFF]/20 text-[#00ABFF] border-[#00ABFF]/40'
                    : 'bg-surface-3 text-text-tertiary border-border hover:border-text-tertiary',
                )}
              >
                {CONTEXT_TAG_LABELS[tag] || tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Homework Toggle */}
      <div className="bg-surface-2 border border-border rounded-xl p-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium">Homework Assigned</span>
          <button
            type="button"
            onClick={() => onUpdate({ homeworkAssigned: !state.homeworkAssigned })}
            className={cn(
              'w-11 h-6 rounded-full transition-colors relative',
              state.homeworkAssigned ? 'bg-[#00ABFF]' : 'bg-surface-3',
            )}
          >
            <div
              className={cn(
                'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform',
                state.homeworkAssigned ? 'translate-x-[22px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
        {state.homeworkAssigned && (
          <textarea
            value={state.homeworkDescription}
            onChange={e => onUpdate({ homeworkDescription: e.target.value })}
            placeholder="Describe the homework..."
            rows={2}
            className="w-full mt-2.5 bg-surface-3 border border-border rounded-lg px-3 py-2 text-white text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-[#00ABFF] resize-none"
          />
        )}
      </div>

      {/* Parent Update Toggle */}
      <div className="bg-surface-2 border border-border rounded-xl p-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium">Parent Update</span>
          <button
            type="button"
            onClick={() => onUpdate({ parentUpdateNeeded: !state.parentUpdateNeeded, parentUpdateType: null })}
            className={cn(
              'w-11 h-6 rounded-full transition-colors relative',
              state.parentUpdateNeeded ? 'bg-[#00ABFF]' : 'bg-surface-3',
            )}
          >
            <div
              className={cn(
                'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform',
                state.parentUpdateNeeded ? 'translate-x-[22px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
        {state.parentUpdateNeeded && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {PARENT_UPDATE_TYPES.map(({ value, label }) => {
              const selected = state.parentUpdateType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onUpdate({ parentUpdateType: selected ? null : value })}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all min-h-[36px]',
                    'active:scale-95',
                    selected
                      ? 'bg-[#00ABFF]/20 text-[#00ABFF] border-[#00ABFF]/40'
                      : 'bg-surface-3 text-text-tertiary border-border hover:border-text-tertiary',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Score Preview */}
      <div className="bg-surface-2 border border-border rounded-xl p-4">
        <h4 className="text-white text-sm font-medium mb-3 text-center">Intelligence Score Preview</h4>
        <ScorePreview
          score={scorePreview.score}
          signals={scorePreview.signals}
          size="md"
        />
      </div>

      {/* Error */}
      {submitError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <p className="text-red-400 text-sm">{submitError}</p>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !state.engagementLevel}
        className={cn(
          'w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all min-h-[48px]',
          'flex items-center justify-center gap-2',
          submitting || !state.engagementLevel
            ? 'bg-surface-3 text-text-tertiary cursor-not-allowed'
            : 'bg-[#00ABFF] hover:bg-[#00ABFF]/90 active:scale-[0.98]',
        )}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </>
        ) : (
          `Submit Capture (Score: ${scorePreview.score})`
        )}
      </button>
    </div>
  );
}
