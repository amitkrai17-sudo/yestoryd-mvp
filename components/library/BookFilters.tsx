// =============================================================================
// FILE: components/library/BookFilters.tsx
// PURPOSE: Filter bar for library page — age bands + skill pills + search
// =============================================================================

'use client';

import { Search, SlidersHorizontal } from 'lucide-react';

interface BookFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  ageBand: string;
  onAgeBandChange: (value: string) => void;
  skill: string;
  onSkillChange: (value: string) => void;
}

const AGE_BANDS = [
  { label: 'All Ages', value: '' },
  { label: '4-6 yrs', value: '4-6' },
  { label: '7-9 yrs', value: '7-9' },
  { label: '10-12 yrs', value: '10-12' },
];

const SKILLS = [
  { label: 'All Skills', value: '' },
  { label: 'Phonics', value: 'Phonics' },
  { label: 'Fluency', value: 'Fluency' },
  { label: 'Comprehension', value: 'Comprehension' },
  { label: 'Vocabulary', value: 'Vocabulary' },
  { label: 'Expression', value: 'Expression' },
];

export function BookFilters({
  search, onSearchChange,
  ageBand, onAgeBandChange,
  skill, onSkillChange,
}: BookFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by title or author..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 h-11 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
        />
      </div>

      {/* Age Band Pills */}
      <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-hide">
        {AGE_BANDS.map((band) => (
          <button
            key={band.value}
            onClick={() => onAgeBandChange(band.value)}
            className={`snap-start flex-shrink-0 px-4 h-9 rounded-xl text-sm font-medium transition-colors ${
              ageBand === band.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {band.label}
          </button>
        ))}
      </div>

      {/* Skill Pills */}
      <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 scrollbar-hide">
        {SKILLS.map((s) => (
          <button
            key={s.value}
            onClick={() => onSkillChange(s.value)}
            className={`snap-start flex-shrink-0 px-4 h-9 rounded-xl text-sm font-medium transition-colors ${
              skill === s.value
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
