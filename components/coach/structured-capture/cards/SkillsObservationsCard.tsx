// ============================================================
// Card 2: Skills + Performance + Observations — unified per-skill flow
// Select skill chip → rate it → see filtered observations → select
// ============================================================

'use client';

import { useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { CardProps, ModuleGroup, ObservationItem, SkillRating } from '../types';
import { SKILL_RATING_LABELS } from '../types';

interface ContinuationItem {
  id: string;
  observation_id: string;
  observation_text: string;
  observation_type: string;
  skill_id: string;
}

interface SkillsObservationsCardProps extends CardProps {
  modules: ModuleGroup[];
  observations: Record<string, ObservationItem[]>;
  continuations?: ContinuationItem[];
  loadingSkills: boolean;
  loadingObservations: boolean;
  isFromChat?: boolean;
}

const RATINGS: SkillRating[] = ['struggling', 'developing', 'proficient', 'advanced'];
const RATING_COLORS: Record<SkillRating, string> = {
  struggling: 'bg-red-500/20 text-red-400 border-red-500/30',
  developing: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  proficient: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  advanced: 'bg-green-500/20 text-green-400 border-green-500/30',
};

function getFilteredObservations(
  allObs: ObservationItem[],
  rating: string | null,
): { strengths: ObservationItem[]; struggles: ObservationItem[] } {
  // Collect ALL strengths and struggles (unfiltered)
  const allStrengths = allObs.filter(o => o.type === 'strength');
  const allStruggles = allObs.filter(o => o.type === 'struggle');

  // Soft gating: always show primary type fully + top N of minority type
  // So coach can note a positive even for a weak skill, or flag a concern for a strong one
  const r = (rating || '').toLowerCase();
  switch (r) {
    case 'struggling':
      // All struggles + top 2 basic strengths
      return { strengths: allStrengths.slice(0, 2), struggles: allStruggles };
    case 'developing':
      // All struggles + top 3 strengths
      return { strengths: allStrengths.slice(0, 3), struggles: allStruggles };
    case 'proficient':
      // All strengths + top 2 growth areas
      return { strengths: allStrengths, struggles: allStruggles.slice(0, 2) };
    case 'advanced':
      // All strengths + top 1 stretch goal
      return { strengths: allStrengths, struggles: allStruggles.slice(0, 1) };
    default:
      // No rating → show all
      return { strengths: allStrengths, struggles: allStruggles };
  }
}

function getConflictDisabledIds(allObs: ObservationItem[], selectedIds: string[]): Set<string> {
  const disabled = new Set<string>();
  const selectedPairIds = new Set(
    allObs.filter(o => selectedIds.includes(o.id) && o.conflictPairId).map(o => o.conflictPairId!),
  );
  for (const obs of allObs) {
    if (obs.conflictPairId && selectedPairIds.has(obs.conflictPairId) && !selectedIds.includes(obs.id)) {
      disabled.add(obs.id);
    }
  }
  return disabled;
}

// Word tag input (inline)
function WordTagInput({ label, words, onChange, placeholder, chipClass }: {
  label: string; words: string[]; onChange: (w: string[]) => void; placeholder: string; chipClass: string;
}) {
  const [input, setInput] = useState('');
  const add = () => { const w = input.trim().toLowerCase(); if (w && !words.includes(w)) onChange([...words, w]); setInput(''); };
  return (
    <div className="mt-2">
      <label className="text-text-tertiary text-[10px] mb-1 block">{label}</label>
      <input type="text" value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && (e.preventDefault(), add())}
        onBlur={add} placeholder={placeholder}
        className="w-full h-9 bg-surface-2 border border-border rounded-lg px-2.5 text-white text-xs placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-[#00ABFF]"
      />
      {words.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {words.map(w => (
            <span key={w} className={cn('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-medium border', chipClass)}>
              {w}
              <button type="button" onClick={() => onChange(words.filter(x => x !== w))}><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SkillsObservationsCard({
  state, onUpdate, modules, observations, continuations = [], loadingSkills, loadingObservations, isFromChat,
}: SkillsObservationsCardProps) {
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [continuationResponses, setContinuationResponses] = useState<Record<string, string>>({});

  const toggleSkill = (skillId: string) => {
    const current = state.selectedSkillIds;
    const performances = { ...state.skillPerformances };
    if (current.includes(skillId)) {
      delete performances[skillId];
      onUpdate({ selectedSkillIds: current.filter(id => id !== skillId), skillPerformances: performances });
      if (expandedSkill === skillId) setExpandedSkill(null);
    } else {
      performances[skillId] = { rating: null, note: '' };
      onUpdate({ selectedSkillIds: [...current, skillId], skillPerformances: performances });
      setExpandedSkill(skillId);
    }
  };

  const setRating = (skillId: string, rating: SkillRating) => {
    const current = state.skillPerformances[skillId]?.rating;
    onUpdate({
      skillPerformances: {
        ...state.skillPerformances,
        [skillId]: { ...state.skillPerformances[skillId], rating: current === rating ? null : rating, note: state.skillPerformances[skillId]?.note || '' },
      },
    });
  };

  const toggleObs = (obsId: string, type: 'strength' | 'struggle') => {
    if (type === 'strength') {
      const current = state.strengthObservationIds;
      onUpdate({ strengthObservationIds: current.includes(obsId) ? current.filter(x => x !== obsId) : [...current, obsId] });
    } else {
      const current = state.struggleObservationIds;
      onUpdate({ struggleObservationIds: current.includes(obsId) ? current.filter(x => x !== obsId) : [...current, obsId] });
    }
  };

  const handleContinuation = async (contId: string, status: string) => {
    setContinuationResponses(prev => ({ ...prev, [contId]: status }));
    try {
      const { supabase: clientSb } = await import('@/lib/supabase/client');
      await clientSb.from('observation_continuations')
        .update({ continuation_status: status, ...(status !== 'active' ? { resolved_at: new Date().toISOString() } : {}) })
        .eq('id', contId);
    } catch { /* non-fatal */ }
  };

  const allSelectedIds = [...state.strengthObservationIds, ...state.struggleObservationIds];

  if (loadingSkills) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner size="lg" className="text-[#00ABFF] mb-3" />
        <p className="text-text-tertiary text-sm">Loading skills...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-semibold text-base mb-1">Skills & Observations</h3>
        <p className="text-text-tertiary text-xs">Tap a skill, rate it, then select observations. Your ratings and selections will generate a personalized summary on the review page.</p>
      </div>

      {/* Skill category chips */}
      {modules.map(mod => (
        <div key={mod.module.id}>
          <p className="text-text-secondary text-[10px] font-semibold uppercase tracking-wider mb-1.5">{mod.module.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {mod.skills.map(skill => {
              const selected = state.selectedSkillIds.includes(skill.id);
              const rating = state.skillPerformances[skill.id]?.rating;
              return (
                <button
                  key={skill.id}
                  onClick={() => toggleSkill(skill.id)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all min-h-[44px]',
                    selected
                      ? rating ? RATING_COLORS[rating] : 'bg-[#00ABFF]/20 text-[#00ABFF] border-[#00ABFF]/30'
                      : 'bg-surface-3 text-text-secondary border-border hover:border-text-tertiary',
                  )}
                >
                  {skill.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Per-skill accordions */}
      {state.selectedSkillIds.map(skillId => {
        const skill = modules.flatMap(m => m.skills).find(s => s.id === skillId);
        if (!skill) return null;
        const isExpanded = expandedSkill === skillId;
        const rating = state.skillPerformances[skillId]?.rating;
        const skillObs = observations[skillId] || [];
        const { strengths, struggles } = rating ? getFilteredObservations(skillObs, rating) : { strengths: [], struggles: [] };
        const allObs = [...strengths, ...struggles];
        const conflictDisabled = getConflictDisabledIds(allObs, allSelectedIds);
        const skillContinuations = continuations.filter(c => c.skill_id === skillId && !continuationResponses[c.id]);

        return (
          <div key={skillId} className="bg-surface-2 border border-border rounded-2xl overflow-hidden">
            {/* Accordion header */}
            <button
              onClick={() => setExpandedSkill(isExpanded ? null : skillId)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium">{skill.name}</span>
                {rating && (
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', RATING_COLORS[rating])}>
                    {SKILL_RATING_LABELS[rating]}
                  </span>
                )}
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                {/* Rating row */}
                <div>
                  <p className="text-text-tertiary text-[10px] mb-1.5">Performance</p>
                  <div className="grid grid-cols-4 gap-1">
                    {RATINGS.map(r => (
                      <button
                        key={r}
                        onClick={() => setRating(skillId, r)}
                        className={cn(
                          'py-2 rounded-xl text-[10px] font-medium border transition-all',
                          rating === r ? RATING_COLORS[r] : 'bg-surface-3 text-text-secondary border-border',
                        )}
                      >
                        {SKILL_RATING_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Continuations for this skill */}
                {skillContinuations.length > 0 && (
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5">
                    <p className="text-[10px] font-medium text-amber-400">From last session:</p>
                    {skillContinuations.map(cont => (
                      <div key={cont.id} className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-amber-300 truncate flex-1">&ldquo;{cont.observation_text}&rdquo;</span>
                        <div className="flex gap-0.5 flex-shrink-0">
                          <button onClick={() => handleContinuation(cont.id, 'active')} className="text-[9px] px-1.5 py-0.5 rounded-lg bg-red-500/20 text-red-400">Still</button>
                          <button onClick={() => handleContinuation(cont.id, 'improved')} className="text-[9px] px-1.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-400">Better</button>
                          <button onClick={() => handleContinuation(cont.id, 'resolved')} className="text-[9px] px-1.5 py-0.5 rounded-lg bg-green-500/20 text-green-400">Fixed</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Observations (only show after rating) */}
                {rating && !loadingObservations && (
                  <>
                    {strengths.length > 0 && (
                      <div>
                        <p className="text-green-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Strengths</p>
                        <div className="flex flex-wrap gap-1">
                          {strengths.map(obs => {
                            const sel = state.strengthObservationIds.includes(obs.id);
                            const dis = conflictDisabled.has(obs.id);
                            return (
                              <button key={obs.id} onClick={() => !dis && toggleObs(obs.id, 'strength')} disabled={dis}
                                className={cn('px-2 py-1 rounded-full text-[10px] font-medium border transition-all',
                                  dis ? 'opacity-30 cursor-not-allowed line-through bg-surface-3 text-text-tertiary border-border'
                                    : sel ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'bg-surface-3 text-text-secondary border-border hover:border-text-tertiary',
                                )}>
                                {obs.text}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {struggles.length > 0 && (
                      <div>
                        <p className="text-orange-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Areas for Growth</p>
                        <div className="flex flex-wrap gap-1">
                          {struggles.map(obs => {
                            const sel = state.struggleObservationIds.includes(obs.id);
                            const dis = conflictDisabled.has(obs.id);
                            return (
                              <button key={obs.id} onClick={() => !dis && toggleObs(obs.id, 'struggle')} disabled={dis}
                                className={cn('px-2 py-1 rounded-full text-[10px] font-medium border transition-all',
                                  dis ? 'opacity-30 cursor-not-allowed line-through bg-surface-3 text-text-tertiary border-border'
                                    : sel ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                                    : 'bg-surface-3 text-text-secondary border-border hover:border-text-tertiary',
                                )}>
                                {obs.text}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {rating && loadingObservations && (
                  <div className="flex items-center gap-2 py-2">
                    <Spinner size="sm" className="text-[#00ABFF]" />
                    <span className="text-text-tertiary text-xs">Loading observations...</span>
                  </div>
                )}

                {/* Words for this skill */}
                <WordTagInput label="Words struggled" words={state.wordsStruggled || []}
                  onChange={w => onUpdate({ wordsStruggled: w })} placeholder="Type word, press Enter"
                  chipClass="bg-red-500/20 text-red-400 border-red-500/30" />
                <WordTagInput label="Words mastered" words={state.wordsMastered || []}
                  onChange={w => onUpdate({ wordsMastered: w })} placeholder="Type word, press Enter"
                  chipClass="bg-green-500/20 text-green-400 border-green-500/30" />
              </div>
            )}
          </div>
        );
      })}

      {state.selectedSkillIds.length === 0 && (
        <div className={cn(
          'bg-surface-2 border rounded-2xl p-6 text-center',
          isFromChat ? 'border-amber-500/30' : 'border-border',
        )}>
          <p className="text-text-tertiary text-sm">Select skills above to begin</p>
          {isFromChat && (
            <p className="text-amber-400 text-xs mt-1">Not captured in chat — please select skills</p>
          )}
        </div>
      )}
    </div>
  );
}
