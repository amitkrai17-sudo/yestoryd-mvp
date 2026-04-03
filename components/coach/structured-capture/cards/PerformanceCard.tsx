// ============================================================
// Card 2: Performance — Per-skill rating buttons + optional note
// With expandable rubric definitions from skill_categories.rubric
// ============================================================

'use client';

import { useState } from 'react';
import { ChevronDown, MessageSquare, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CardProps, SkillRating, ModuleGroup } from '../types';
import { SKILL_RATING_LABELS, SKILL_RATING_COLORS } from '../types';

const RATINGS: SkillRating[] = ['struggling', 'developing', 'proficient', 'advanced'];

// Map internal rating keys to rubric JSONB keys
const RATING_TO_RUBRIC_KEY: Record<SkillRating, string> = {
  struggling: 'emerging',
  developing: 'developing',
  proficient: 'proficient',
  advanced: 'mastered',
};

interface PerformanceCardProps extends CardProps {
  modules: ModuleGroup[];
}

export function PerformanceCard({ state, onUpdate, modules }: PerformanceCardProps) {
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [expandedRubrics, setExpandedRubrics] = useState<Set<string>>(new Set());

  // Build a flat list of selected skills with their names + parent module rubric
  const selectedSkills = state.selectedSkillIds.map(id => {
    for (const { module, skills } of modules) {
      const skill = skills.find(s => s.id === id);
      if (skill) return { ...skill, rubric: module.rubric || null };
    }
    return { id, name: id, skillTag: '', description: null, difficulty: null, orderIndex: 0, rubric: null };
  });

  const toggleNote = (skillId: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  const toggleRubric = (skillId: string) => {
    setExpandedRubrics(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  const setRating = (skillId: string, rating: SkillRating) => {
    const current = state.skillPerformances[skillId] || { rating: null, note: '' };
    onUpdate({
      skillPerformances: {
        ...state.skillPerformances,
        [skillId]: { ...current, rating: current.rating === rating ? null : rating },
      },
    });
  };

  const setNote = (skillId: string, note: string) => {
    const current = state.skillPerformances[skillId] || { rating: null, note: '' };
    onUpdate({
      skillPerformances: {
        ...state.skillPerformances,
        [skillId]: { ...current, note },
      },
    });
  };

  if (selectedSkills.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-tertiary text-sm">Go back and select at least one skill first.</p>
      </div>
    );
  }

  const ratedCount = selectedSkills.filter(
    s => state.skillPerformances[s.id]?.rating != null,
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-semibold text-base mb-1">Performance Ratings</h3>
        <p className="text-text-tertiary text-xs">
          Rate each skill ({ratedCount}/{selectedSkills.length} rated)
        </p>
      </div>

      <div className="space-y-3">
        {selectedSkills.map(skill => {
          const perf = state.skillPerformances[skill.id];
          const currentRating = perf?.rating || null;
          const noteExpanded = expandedNotes.has(skill.id);
          const rubricExpanded = expandedRubrics.has(skill.id);
          const hasRubric = skill.rubric != null;

          return (
            <div key={skill.id} className="bg-surface-2 border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-white text-sm font-medium truncate">{skill.name}</span>
                  {hasRubric && (
                    <button
                      type="button"
                      onClick={() => toggleRubric(skill.id)}
                      className={cn(
                        'flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors',
                        rubricExpanded ? 'bg-[#00ABFF]/20 text-[#00ABFF]' : 'text-text-tertiary hover:text-white',
                      )}
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleNote(skill.id)}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    noteExpanded ? 'bg-[#00ABFF]/20 text-[#00ABFF]' : 'text-text-tertiary hover:text-white',
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>

              {/* Rubric definitions */}
              {rubricExpanded && hasRubric && (
                <div className="mb-2.5 bg-surface-3 rounded-lg p-2.5 space-y-1.5">
                  {RATINGS.map(rating => {
                    const rubricKey = RATING_TO_RUBRIC_KEY[rating];
                    const definition = skill.rubric![rubricKey];
                    if (!definition) return null;
                    return (
                      <div key={rating} className="flex gap-2 text-[11px]">
                        <span className={cn(
                          'flex-shrink-0 font-semibold w-[72px]',
                          rating === 'struggling' ? 'text-red-400' :
                          rating === 'developing' ? 'text-yellow-400' :
                          rating === 'proficient' ? 'text-green-400' :
                          'text-purple-400'
                        )}>
                          {SKILL_RATING_LABELS[rating]}
                        </span>
                        <span className="text-text-tertiary">{definition}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rating buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {RATINGS.map(rating => {
                  const selected = currentRating === rating;
                  return (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setRating(skill.id, rating)}
                      className={cn(
                        'px-2 py-2 rounded-lg text-[11px] font-medium border transition-all min-h-[44px]',
                        'active:scale-95',
                        selected
                          ? SKILL_RATING_COLORS[rating]
                          : 'bg-surface-3 text-text-tertiary border-border hover:border-text-tertiary',
                      )}
                    >
                      {SKILL_RATING_LABELS[rating]}
                    </button>
                  );
                })}
              </div>

              {/* Note textarea */}
              {noteExpanded && (
                <div className="mt-2.5">
                  <textarea
                    value={perf?.note || ''}
                    onChange={e => setNote(skill.id, e.target.value)}
                    placeholder="Add a note about this skill..."
                    rows={2}
                    className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-white text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-[#00ABFF] resize-none"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
