// =============================================================================
// FILE: components/coach/session-form/components/SkillTagSelector.tsx
// PURPOSE: Skill tag selector grouped by level
// =============================================================================

'use client';

import { FC } from 'react';
import { SkillGroup, BRAND_COLORS } from '../constants';

interface SkillTagSelectorProps {
  selected: string[];
  onChange: (skills: string[]) => void;
  groups: SkillGroup;
}

const LEVEL_LABELS: Record<keyof SkillGroup, { label: string; color: string }> = {
  foundation: { label: 'Foundation', color: BRAND_COLORS.successGreen },
  building: { label: 'Building', color: BRAND_COLORS.electricBlue },
  advanced: { label: 'Advanced', color: BRAND_COLORS.deepPurple },
};

const SkillTagSelector: FC<SkillTagSelectorProps> = ({
  selected,
  onChange,
  groups,
}) => {
  const toggleSkill = (skill: string) => {
    if (selected.includes(skill)) {
      onChange(selected.filter((s) => s !== skill));
    } else {
      onChange([...selected, skill]);
    }
  };

  const levelOrder: (keyof SkillGroup)[] = ['foundation', 'building', 'advanced'];

  return (
    <div className="space-y-4">
      {levelOrder.map((level) => {
        const skills = groups[level];
        if (!skills || skills.length === 0) return null;

        const { label, color } = LEVEL_LABELS[level];

        return (
          <div key={level}>
            <div
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color }}
            >
              {label}
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => {
                const isSelected = selected.includes(skill);

                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className="px-3 py-2 text-sm rounded-xl border-2 font-medium transition-all"
                    style={{
                      borderColor: isSelected ? color : BRAND_COLORS.mediumGray,
                      background: isSelected ? `${color}15` : `${BRAND_COLORS.darkGray}80`,
                      color: isSelected ? 'white' : '#999',
                      boxShadow: isSelected ? `0 4px 12px ${color}30` : 'none',
                    }}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SkillTagSelector;
