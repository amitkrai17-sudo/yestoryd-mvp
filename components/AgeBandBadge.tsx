'use client';

export type AgeBand = 'foundation' | 'building' | 'mastery';

const AGE_BAND_STYLES: Record<string, { badge: string; label: string; emoji: string }> = {
  foundation: {
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    label: 'Foundation',
    emoji: '🌱',
  },
  building: {
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    label: 'Building',
    emoji: '🧱',
  },
  mastery: {
    badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    label: 'Mastery',
    emoji: '🏆',
  },
};

export function getAgeBandFromAge(age: number): AgeBand | null {
  if (age >= 4 && age <= 6) return 'foundation';
  if (age >= 7 && age <= 9) return 'building';
  if (age >= 10 && age <= 12) return 'mastery';
  return null;
}

interface AgeBandBadgeProps {
  ageBand?: AgeBand | string | null;
  age?: number;
  size?: 'sm' | 'md';
  showEmoji?: boolean;
}

export function AgeBandBadge({ ageBand, age, size = 'sm', showEmoji = false }: AgeBandBadgeProps) {
  const band = ageBand || (age ? getAgeBandFromAge(age) : null);
  if (!band || !AGE_BAND_STYLES[band]) {
    return <span className="text-text-tertiary text-xs">-</span>;
  }

  const style = AGE_BAND_STYLES[band];
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium border ${style.badge} ${sizeClasses}`}>
      {showEmoji && <span>{style.emoji}</span>}
      {style.label}
    </span>
  );
}

/** Returns the display label for an age band */
export function getAgeBandLabel(band: string): string {
  return AGE_BAND_STYLES[band]?.label || band;
}
