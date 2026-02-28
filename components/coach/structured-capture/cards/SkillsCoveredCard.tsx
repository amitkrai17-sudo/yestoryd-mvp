// ============================================================
// Card 1: Skills Covered — Tap-toggle chips grouped by module
// ============================================================

'use client';

import { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CardProps, ModuleGroup } from '../types';

interface SkillsCoveredCardProps extends CardProps {
  modules: ModuleGroup[];
  loading: boolean;
}

export function SkillsCoveredCard({ state, onUpdate, modules, loading }: SkillsCoveredCardProps) {
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

  const toggleModule = (moduleId: string) => {
    setCollapsedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const toggleSkill = (skillId: string) => {
    const current = state.selectedSkillIds;
    const updated = current.includes(skillId)
      ? current.filter(id => id !== skillId)
      : [...current, skillId];

    // Also update skillPerformances — add entry for new skills, remove for deselected
    const performances = { ...state.skillPerformances };
    if (!current.includes(skillId)) {
      performances[skillId] = { rating: null, note: '' };
    } else {
      delete performances[skillId];
    }

    onUpdate({ selectedSkillIds: updated, skillPerformances: performances });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#00ABFF] animate-spin mb-3" />
        <p className="text-text-tertiary text-sm">Loading skills...</p>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-tertiary text-sm">No skills available. Please contact admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-semibold text-base mb-1">Skills Covered</h3>
        <p className="text-text-tertiary text-xs">
          Select the skills worked on in this session ({state.selectedSkillIds.length} selected)
        </p>
      </div>

      <div className="space-y-3">
        {modules.map(({ module, skills }) => {
          const isCollapsed = collapsedModules.has(module.id);
          const selectedCount = skills.filter(s => state.selectedSkillIds.includes(s.id)).length;

          return (
            <div key={module.id} className="bg-surface-2 border border-border rounded-xl overflow-hidden">
              {/* Module header */}
              <button
                type="button"
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-3 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">{module.name}</span>
                  {selectedCount > 0 && (
                    <span className="bg-[#00ABFF]/20 text-[#00ABFF] text-[10px] px-1.5 py-0.5 rounded-full">
                      {selectedCount}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-text-tertiary transition-transform',
                    isCollapsed && '-rotate-90',
                  )}
                />
              </button>

              {/* Skills chips */}
              {!isCollapsed && (
                <div className="px-3 pb-3 flex flex-wrap gap-2">
                  {skills.map(skill => {
                    const selected = state.selectedSkillIds.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => toggleSkill(skill.id)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium border transition-all min-h-[36px]',
                          'active:scale-95',
                          selected
                            ? 'bg-[#00ABFF]/20 text-[#00ABFF] border-[#00ABFF]/40'
                            : 'bg-surface-3 text-text-secondary border-border hover:border-text-tertiary',
                        )}
                      >
                        {skill.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
