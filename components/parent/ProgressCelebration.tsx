// =============================================================================
// FILE: components/parent/ProgressCelebration.tsx
// PURPOSE: CRO - Score improvement, streak badge, milestone card
// =============================================================================

'use client';

import { TrendingUp, Flame, Star } from 'lucide-react';

interface ProgressCelebrationProps {
  currentProgress?: string;
  previousProgress?: string;
  currentStreak: number;
  milestoneReached?: string;
  childName: string;
}

const PROGRESS_LEVELS: Record<string, number> = {
  emerging: 1,
  developing: 2,
  proficient: 3,
  advanced: 4,
};

const PROGRESS_LABEL: Record<string, string> = {
  emerging: 'Emerging',
  developing: 'Developing',
  proficient: 'Proficient',
  advanced: 'Advanced',
};

export default function ProgressCelebration({
  currentProgress,
  previousProgress,
  currentStreak,
  milestoneReached,
  childName,
}: ProgressCelebrationProps) {
  const currentLevel = currentProgress ? (PROGRESS_LEVELS[currentProgress] || 0) : 0;
  const previousLevel = previousProgress ? (PROGRESS_LEVELS[previousProgress] || 0) : 0;
  const showImprovement = currentLevel > previousLevel && previousLevel > 0;
  const showStreak = currentStreak > 0;
  const showMilestone = !!milestoneReached;

  if (!showImprovement && !showStreak && !showMilestone) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {showImprovement && (
          <span className="bg-emerald-50 text-emerald-700 rounded-xl px-3 py-1.5 inline-flex items-center gap-1.5 text-sm font-medium">
            <TrendingUp className="w-4 h-4" />
            Now {PROGRESS_LABEL[currentProgress!] || currentProgress}
          </span>
        )}
        {showStreak && (
          <span className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 inline-flex items-center gap-1.5 text-sm font-medium">
            <Flame className="w-4 h-4 text-[#E6C600]" />
            {currentStreak}-day streak!
          </span>
        )}
      </div>
      {showMilestone && (
        <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">Milestone: {milestoneReached}</p>
          </div>
        </div>
      )}
    </div>
  );
}
