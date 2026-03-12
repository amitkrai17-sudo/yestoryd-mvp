// ============================================================
// SKILL CATEGORY SELECT COMPONENT
// File: components/shared/SkillCategorySelect.tsx
// Reusable select for skill categories (single or multi).
// Fetches from skill_categories table via browser client.
// ============================================================

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { SkillCategoryChip } from './SkillCategoryChip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryRow {
  id: string;
  slug: string;
  label: string;
  parent_label: string | null;
  icon: string;
  color: string;
  sort_order: number;
  scope: string;
}

interface SkillCategorySelectProps {
  /** Currently selected slug(s). */
  value: string | string[];
  /** Called with slug(s) on change. */
  onChange: (value: string | string[]) => void;
  /** Allow multiple selections. */
  multiple?: boolean;
  /** Filter by scope: 'coach' shows coach+both, 'parent' shows parent+both. */
  scopeFilter?: 'coach' | 'parent';
  /** Display context: 'parent' shows parent_label, others show label. */
  context?: 'coach' | 'parent' | 'admin';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SkillCategorySelect({
  value,
  onChange,
  multiple = false,
  scopeFilter,
  context = 'coach',
  placeholder = 'Select category...',
  disabled = false,
  className = '',
}: SkillCategorySelectProps) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Normalize to array
  const selected = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value]
  );

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('skill_categories')
        .select('id, slug, label, parent_label, icon, color, sort_order, scope')
        .eq('is_active', true)
        .order('sort_order');

      if (data) {
        let filtered = data;
        if (scopeFilter === 'coach') {
          filtered = data.filter(c => c.scope === 'coach' || c.scope === 'both');
        } else if (scopeFilter === 'parent') {
          filtered = data.filter(c => c.scope === 'parent' || c.scope === 'both');
        }
        setCategories(filtered);
      }
      setLoading(false);
    }
    load();
  }, [scopeFilter]);

  const toggle = useCallback((slug: string) => {
    if (disabled) return;

    if (multiple) {
      const arr = selected.includes(slug)
        ? selected.filter(s => s !== slug)
        : [...selected, slug];
      onChange(arr);
    } else {
      onChange(slug === selected[0] ? '' : slug);
      setIsOpen(false);
    }
  }, [selected, onChange, multiple, disabled]);

  const remove = useCallback((slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (multiple) {
      onChange(selected.filter(s => s !== slug));
    } else {
      onChange('');
    }
  }, [selected, onChange, multiple, disabled]);

  const getCategory = (slug: string) => categories.find(c => c.slug === slug);
  const displayLabel = (cat: CategoryRow) =>
    context === 'parent' ? (cat.parent_label ?? cat.label) : cat.label;

  if (loading) {
    return (
      <div className={`h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse ${className}`} />
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full min-h-[42px] px-3 py-2 border rounded-lg text-left flex items-center gap-2
          ${disabled ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60' : 'bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'}
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-300 dark:border-gray-600'}
        `}
      >
        <div className="flex-1 flex flex-wrap gap-1.5">
          {selected.length > 0 ? (
            selected.map(slug => {
              const cat = getCategory(slug);
              return cat ? (
                <SkillCategoryChip
                  key={slug}
                  slug={cat.slug}
                  label={displayLabel(cat)}
                  color={cat.color}
                  onRemove={!disabled ? (e) => remove(slug, e) : undefined}
                />
              ) : (
                <span key={slug} className="text-sm text-gray-500">{slug}</span>
              );
            })
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-sm">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <>
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {categories.map(cat => {
              const isSelected = selected.includes(cat.slug);
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => toggle(cat.slug)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors
                    hover:bg-gray-50 dark:hover:bg-gray-700
                    ${isSelected ? 'bg-gray-50 dark:bg-gray-700/50' : ''}
                  `}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 text-gray-900 dark:text-gray-100">{displayLabel(cat)}</span>
                  {isSelected && <Check className="w-4 h-4 text-blue-500" />}
                </button>
              );
            })}
          </div>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        </>
      )}
    </div>
  );
}
