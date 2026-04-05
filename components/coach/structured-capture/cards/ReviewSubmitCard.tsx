// ============================================================
// Card 4: Review + Submit — Gemini-generated summary + homework + engagement
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pencil, Check, Sparkles, AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { ScorePreview } from '../ScorePreview';
import { getHomeworkSuggestions } from '@/lib/homework/suggestion-templates';
import type { CardProps, ModuleGroup, EngagementLevel } from '../types';

const ENGAGEMENT_LEVELS: { value: EngagementLevel; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { value: 'moderate', label: 'Moderate', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'high', label: 'High', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'exceptional', label: 'Exceptional', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
];

interface ReviewSubmitCardProps extends CardProps {
  childName: string;
  childAge: number;
  modules: ModuleGroup[];
  voiceSegments: { skills: string; strengths: string; struggles: string; homework: string } | null;
  scorePreview: { score: number; signals: { hasSkills: boolean; hasPerformance: boolean; hasArtifact: boolean; hasObservations: boolean; hasEngagement: boolean } };
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  selectedSkillSlugs: string[];
}

export function ReviewSubmitCard({
  state, onUpdate, childName, childAge, modules,
  voiceSegments, scorePreview, submitting, submitError, onSubmit, selectedSkillSlugs,
}: ReviewSubmitCardProps) {
  const [summary, setSummary] = useState({ strengthSummary: '', growthSummary: '', homeworkSuggestion: '' });
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryGenerated, setSummaryGenerated] = useState(false);
  const [editingStrength, setEditingStrength] = useState(false);
  const [editingGrowth, setEditingGrowth] = useState(false);
  const [editingHomework, setEditingHomework] = useState(false);

  // Fetch Gemini summary on mount (once)
  useEffect(() => {
    if (summaryGenerated) return;
    generateSummary();
  }, []);

  const generateSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const skills = modules.flatMap(m => m.skills)
        .filter(s => state.selectedSkillIds.includes(s.id))
        .map(s => ({ name: s.name, rating: state.skillPerformances[s.id]?.rating || 'not rated' }));

      const res = await fetch('/api/intelligence/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName, childAge, skills,
          strengthObservations: state.strengthObservationIds,
          struggleObservations: state.struggleObservationIds,
          wordsMastered: state.wordsMastered,
          wordsStruggled: state.wordsStruggled,
          voiceSegments,
          engagementLevel: state.engagementLevel,
        }),
      });

      const data = await res.json();
      if (data.strengthSummary || data.growthSummary || data.homeworkSuggestion) {
        setSummary(data);
        // Pre-fill form fields
        if (data.strengthSummary && !state.customStrengthNote) {
          onUpdate({ customStrengthNote: data.strengthSummary });
        }
        if (data.growthSummary && !state.customStruggleNote) {
          onUpdate({ customStruggleNote: data.growthSummary });
        }
        if (data.homeworkSuggestion && !state.homeworkDescription) {
          onUpdate({ homeworkDescription: data.homeworkSuggestion, homeworkAssigned: true });
        }
      }
      setSummaryGenerated(true);
    } catch {
      // Silent — coach can fill manually
    } finally {
      setLoadingSummary(false);
    }
  }, [childName, childAge, modules, state, voiceSegments, onUpdate]);

  const homeworkChips = getHomeworkSuggestions(selectedSkillSlugs);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-semibold text-base mb-1">Review & Submit</h3>
        <p className="text-text-tertiary text-xs">AI summary based on your input. Tap the pencil to edit anything.</p>
      </div>

      {/* Engagement Level */}
      <div>
        <p className="text-text-secondary text-xs font-medium mb-1.5">Engagement Level *</p>
        <div className="grid grid-cols-4 gap-1.5">
          {ENGAGEMENT_LEVELS.map(e => (
            <button
              key={e.value}
              onClick={() => onUpdate({ engagementLevel: state.engagementLevel === e.value ? null : e.value })}
              className={cn(
                'py-2.5 rounded-xl text-xs font-medium border transition-all min-h-[44px]',
                state.engagementLevel === e.value ? e.color : 'bg-surface-3 text-text-secondary border-border',
              )}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Summary */}
      {loadingSummary ? (
        <div className="bg-surface-2 border border-border rounded-2xl p-4 flex items-center gap-3">
          <Spinner size="sm" className="text-[#00ABFF]" />
          <div>
            <p className="text-white text-sm">Generating summary...</p>
            <p className="text-text-tertiary text-[10px]">AI is reviewing your observations</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Strengths Summary */}
          <div className="bg-surface-2 border border-border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-green-400" />
                <p className="text-green-400 text-xs font-semibold">Strengths</p>
              </div>
              <button onClick={() => setEditingStrength(!editingStrength)} className="text-text-tertiary hover:text-white">
                {editingStrength ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              </button>
            </div>
            {editingStrength ? (
              <textarea
                value={state.customStrengthNote}
                onChange={e => onUpdate({ customStrengthNote: e.target.value })}
                rows={3}
                className="w-full bg-surface-3 border border-border rounded-xl px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#00ABFF]"
              />
            ) : state.customStrengthNote || summary.strengthSummary ? (
              <p className="text-text-secondary text-sm leading-relaxed">
                {state.customStrengthNote || summary.strengthSummary}
              </p>
            ) : (
              <textarea
                value={state.customStrengthNote}
                onChange={e => onUpdate({ customStrengthNote: e.target.value })}
                placeholder="AI couldn't generate — type your strength notes here"
                rows={2}
                className="w-full bg-surface-3 border border-border rounded-xl px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#00ABFF] placeholder:text-text-tertiary"
              />
            )}
          </div>

          {/* Growth Summary */}
          <div className="bg-surface-2 border border-border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <p className="text-orange-400 text-xs font-semibold">Areas for Growth</p>
              </div>
              <button onClick={() => setEditingGrowth(!editingGrowth)} className="text-text-tertiary hover:text-white">
                {editingGrowth ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              </button>
            </div>
            {editingGrowth ? (
              <textarea
                value={state.customStruggleNote}
                onChange={e => onUpdate({ customStruggleNote: e.target.value })}
                rows={3}
                className="w-full bg-surface-3 border border-border rounded-xl px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#00ABFF]"
              />
            ) : state.customStruggleNote || summary.growthSummary ? (
              <p className="text-text-secondary text-sm leading-relaxed">
                {state.customStruggleNote || summary.growthSummary}
              </p>
            ) : (
              <textarea
                value={state.customStruggleNote}
                onChange={e => onUpdate({ customStruggleNote: e.target.value })}
                placeholder="AI couldn't generate — type your growth notes here"
                rows={2}
                className="w-full bg-surface-3 border border-border rounded-xl px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#00ABFF] placeholder:text-text-tertiary"
              />
            )}
          </div>

          {/* Homework */}
          <div className="bg-surface-2 border border-border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[#00ABFF] text-xs font-semibold">Homework Suggestion</p>
              <button onClick={() => setEditingHomework(!editingHomework)} className="text-text-tertiary hover:text-white">
                {editingHomework ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              </button>
            </div>
            {editingHomework ? (
              <div className="space-y-2">
                <textarea
                  value={state.homeworkDescription}
                  onChange={e => onUpdate({ homeworkDescription: e.target.value, homeworkAssigned: e.target.value.length > 0 })}
                  rows={2}
                  placeholder="What should they practice at home?"
                  className="w-full bg-surface-3 border border-border rounded-xl px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#00ABFF]"
                />
                {homeworkChips.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {homeworkChips.map((chip, i) => (
                      <button key={i} onClick={() => onUpdate({ homeworkDescription: chip, homeworkAssigned: true })}
                        className="text-[10px] px-2 py-1 bg-surface-3 border border-border rounded-lg text-text-secondary hover:text-white truncate max-w-full">
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : state.homeworkDescription || summary.homeworkSuggestion ? (
              <p className="text-text-secondary text-sm leading-relaxed">
                {state.homeworkDescription || summary.homeworkSuggestion}
              </p>
            ) : (
              <textarea
                value={state.homeworkDescription}
                onChange={e => onUpdate({ homeworkDescription: e.target.value, homeworkAssigned: e.target.value.length > 0 })}
                placeholder="What should they practice at home?"
                rows={2}
                className="w-full bg-surface-3 border border-border rounded-xl px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#00ABFF] placeholder:text-text-tertiary"
              />
            )}
          </div>
        </div>
      )}

      {/* Score Preview */}
      <ScorePreview score={scorePreview.score} signals={scorePreview.signals} />

      {/* Submit Error */}
      {submitError && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {submitError}
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={onSubmit}
        disabled={submitting || !state.engagementLevel}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold transition-all min-h-[48px]',
          submitting || !state.engagementLevel
            ? 'bg-surface-3 text-text-tertiary cursor-not-allowed'
            : 'bg-gradient-to-r from-[#00ABFF] to-[#7C3AED] text-white active:scale-[0.98]',
        )}
      >
        {submitting ? (
          <>
            <Spinner size="sm" />
            Saving observations...
          </>
        ) : (
          <>
            <Check className="w-5 h-5" />
            Submit Session Report
          </>
        )}
      </button>
    </div>
  );
}
