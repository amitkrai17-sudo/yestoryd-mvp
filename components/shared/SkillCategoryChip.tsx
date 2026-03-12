// ============================================================
// SKILL CATEGORY CHIP COMPONENT
// File: components/shared/SkillCategoryChip.tsx
// Colored pill/chip for displaying a skill category.
// ============================================================

'use client';

import React from 'react';
import { X } from 'lucide-react';

interface SkillCategoryChipProps {
  slug: string;
  label: string;
  color: string;
  size?: 'xs' | 'sm' | 'md';
  onRemove?: (e: React.MouseEvent) => void;
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'px-1.5 py-0.5 text-xs gap-1',
  sm: 'px-2 py-0.5 text-sm gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
};

export function SkillCategoryChip({
  slug,
  label,
  color,
  size = 'sm',
  onRemove,
  className = '',
}: SkillCategoryChipProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium border
        ${SIZE_CLASSES[size]}
        ${className}
      `}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        borderColor: `${color}40`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hover:opacity-70 rounded-full p-0.5"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
