// =============================================================================
// FILE: components/library/BookCover.tsx
// PURPOSE: Book cover image with gradient fallback (first letter of title)
// =============================================================================

'use client';

import { BookOpen } from 'lucide-react';

const GRADIENTS = [
  'from-rose-400 to-pink-600',
  'from-blue-400 to-indigo-600',
  'from-emerald-400 to-teal-600',
  'from-amber-400 to-orange-600',
  'from-purple-400 to-violet-600',
  'from-cyan-400 to-blue-600',
];

function getGradient(title: string): string {
  const charCode = title.charCodeAt(0) || 0;
  return GRADIENTS[charCode % GRADIENTS.length];
}

interface BookCoverProps {
  coverUrl: string | null;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'w-16 h-22',
  md: 'w-24 h-36',
  lg: 'w-32 h-48',
};

export function BookCover({ coverUrl, title, size = 'md', className = '' }: BookCoverProps) {
  if (coverUrl) {
    return (
      <div className={`${SIZES[size]} rounded-xl overflow-hidden flex-shrink-0 ${className}`}>
        <img
          src={coverUrl}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  const gradient = getGradient(title);
  const letter = (title[0] || 'B').toUpperCase();
  const fontSize = size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-4xl';

  return (
    <div className={`${SIZES[size]} rounded-xl bg-gradient-to-br ${gradient} flex flex-col items-center justify-center flex-shrink-0 ${className}`}>
      <span className={`${fontSize} font-bold text-white/90`}>{letter}</span>
      <BookOpen className="w-4 h-4 text-white/50 mt-1" />
    </div>
  );
}
