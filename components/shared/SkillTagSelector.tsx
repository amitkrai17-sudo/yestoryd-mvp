// ============================================================
// SKILL TAG SELECTOR COMPONENT
// File: components/shared/SkillTagSelector.tsx
// Multi-select component for coach skill tags
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Search, Loader2 } from 'lucide-react';

interface SkillTag {
  id: string;
  tag_name: string;
  tag_slug: string;
  category: string;
}

interface SkillTagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  placeholder?: string;
  disabled?: boolean;
  showCategories?: boolean;
  className?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  reading: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  writing: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  speech: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'special-needs': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  general: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

export default function SkillTagSelector({
  selectedTags,
  onChange,
  maxTags = 20,
  placeholder = 'Search skills...',
  disabled = false,
  showCategories = true,
  className = '',
}: SkillTagSelectorProps) {
  const [tags, setTags] = useState<SkillTag[]>([]);
  const [groupedTags, setGroupedTags] = useState<Record<string, SkillTag[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Fetch tags on mount
  useEffect(() => {
    async function fetchTags() {
      try {
        const response = await fetch('/api/skill-tags');
        if (!response.ok) throw new Error('Failed to fetch tags');
        
        const data = await response.json();
        setTags(data.tags || []);
        setGroupedTags(data.grouped || {});
      } catch (err) {
        setError('Failed to load skills');
        console.error('Error fetching skill tags:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTags();
  }, []);

  // Filter tags based on search
  const filteredTags = searchQuery
    ? tags.filter(tag => 
        tag.tag_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tag.tag_slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tags;

  // Group filtered tags by category
  const filteredGrouped = showCategories
    ? filteredTags.reduce((acc, tag) => {
        if (!acc[tag.category]) acc[tag.category] = [];
        acc[tag.category].push(tag);
        return acc;
      }, {} as Record<string, SkillTag[]>)
    : { all: filteredTags };

  // Handle tag selection
  const toggleTag = useCallback((tagSlug: string) => {
    if (disabled) return;

    if (selectedTags.includes(tagSlug)) {
      onChange(selectedTags.filter(t => t !== tagSlug));
    } else if (selectedTags.length < maxTags) {
      onChange([...selectedTags, tagSlug]);
    }
  }, [selectedTags, onChange, maxTags, disabled]);

  // Remove tag
  const removeTag = useCallback((tagSlug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedTags.filter(t => t !== tagSlug));
  }, [selectedTags, onChange, disabled]);

  // Get tag details by slug
  const getTagBySlug = (slug: string) => tags.find(t => t.tag_slug === slug);

  // Get category style
  const getCategoryStyle = (category: string) => 
    CATEGORY_COLORS[category] || CATEGORY_COLORS.general;

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">Loading skills...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-red-500 bg-red-50 rounded-lg ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Selected tags display */}
      <div 
        className={`
          min-h-[42px] p-2 border rounded-lg cursor-pointer
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-gray-400'}
          ${isOpen ? 'border-[#FF0099] ring-2 ring-pink-100' : 'border-gray-300'}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.length > 0 ? (
            selectedTags.map(slug => {
              const tag = getTagBySlug(slug);
              const style = getCategoryStyle(tag?.category || 'general');
              return (
                <span
                  key={slug}
                  className={`
                    inline-flex items-center gap-1 px-2 py-0.5 text-sm rounded-full
                    ${style.bg} ${style.text} ${style.border} border
                  `}
                >
                  {tag?.tag_name || slug}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => removeTag(slug, e)}
                      className="hover:bg-black/10 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              );
            })
          ) : (
            <span className="text-gray-500 text-sm py-0.5">{placeholder}</span>
          )}
        </div>
      </div>

      {/* Count indicator */}
      {selectedTags.length > 0 && (
        <div className="mt-1 text-xs text-gray-500 text-right">
          {selectedTags.length}/{maxTags} selected
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#FF0099]"
                autoFocus
              />
            </div>
          </div>

          {/* Tags list */}
          <div className="overflow-y-auto max-h-60">
            {Object.entries(filteredGrouped).map(([category, categoryTags]) => (
              <div key={category}>
                {showCategories && category !== 'all' && (
                  <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase bg-gray-50 sticky top-0">
                    {category.replace('-', ' ')}
                  </div>
                )}
                {categoryTags.map(tag => {
                  const isSelected = selectedTags.includes(tag.tag_slug);
                  const style = getCategoryStyle(tag.category);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.tag_slug)}
                      disabled={!isSelected && selectedTags.length >= maxTags}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 text-sm text-left
                        hover:bg-[#FF0099]/20 transition-colors
                        ${isSelected ? 'bg-[#FF0099]/10' : ''}
                        ${!isSelected && selectedTags.length >= maxTags ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${style.bg.replace('50', '500')}`} />
                        {tag.tag_name}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-[#FF0099]" />}
                    </button>
                  );
                })}
              </div>
            ))}

            {filteredTags.length === 0 && (
              <div className="p-4 text-center text-gray-500 text-sm">
                No skills found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// =====================================================
// COMPACT VERSION FOR DISPLAY ONLY
// =====================================================
export function SkillTagDisplay({
  tags,
  maxVisible = 5,
  size = 'sm',
}: {
  tags: string[];
  maxVisible?: number;
  size?: 'xs' | 'sm' | 'md';
}) {
  const [allTags, setAllTags] = useState<SkillTag[]>([]);

  useEffect(() => {
    fetch('/api/skill-tags')
      .then(res => res.json())
      .then(data => setAllTags(data.tags || []))
      .catch(console.error);
  }, []);

  const getTag = (slug: string) => allTags.find(t => t.tag_slug === slug);

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-0.5 text-sm',
    md: 'px-3 py-1 text-base',
  };

  const visibleTags = tags.slice(0, maxVisible);
  const hiddenCount = tags.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleTags.map(slug => {
        const tag = getTag(slug);
        const style = CATEGORY_COLORS[tag?.category || 'general'];
        return (
          <span
            key={slug}
            className={`
              inline-flex items-center rounded-full
              ${style.bg} ${style.text} ${style.border} border
              ${sizeClasses[size]}
            `}
          >
            {tag?.tag_name || slug}
          </span>
        );
      })}
      {hiddenCount > 0 && (
        <span className={`inline-flex items-center rounded-full bg-gray-100 text-gray-600 ${sizeClasses[size]}`}>
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}
