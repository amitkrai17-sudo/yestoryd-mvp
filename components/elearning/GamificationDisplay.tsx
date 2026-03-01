// =============================================================================
// FILE: components/elearning/GamificationDisplay.tsx
// PURPOSE: All gamification UI components - XP bar, streaks, badges, popups
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import {
  Star, Flame, Trophy, Zap, TrendingUp, Crown, Medal,
  CheckCircle, Sparkles, X, Gift
} from 'lucide-react';
import type { XPLevel, BadgeDefinition, ChildBadge, LeaderboardEntry } from '@/types/elearning';

// ==================== XP PROGRESS BAR ====================

interface XPProgressBarProps {
  totalXP: number;
  currentLevel: XPLevel;
  nextLevel: XPLevel | null;
  xpProgress: number;
  showLevelUp?: boolean;
  onLevelUpComplete?: () => void;
  compact?: boolean;
}

export function XPProgressBar({
  totalXP,
  currentLevel,
  nextLevel,
  xpProgress,
  showLevelUp = false,
  onLevelUpComplete,
  compact = false,
}: XPProgressBarProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(xpProgress), 100);
    return () => clearTimeout(timer);
  }, [xpProgress]);

  useEffect(() => {
    if (showLevelUp && onLevelUpComplete) {
      const timer = setTimeout(onLevelUpComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [showLevelUp, onLevelUpComplete]);

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{currentLevel.icon}</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Level {currentLevel.level}</p>
            <p className="text-xs text-gray-500">{currentLevel.title}</p>
          </div>
        </div>
        <div className="flex-1">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#ff0099] to-[#7b008b] transition-all duration-500"
              style={{ width: `${animatedProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{totalXP.toLocaleString()} XP</span>
            {nextLevel && <span>{nextLevel.xp_required.toLocaleString()} XP</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 relative overflow-hidden">
      {/* Level Up Animation */}
      {showLevelUp && (
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-purple-500/20 animate-pulse z-10 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl text-center animate-bounce">
            <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            <p className="text-xl font-bold text-gray-900">Level Up!</p>
            <p className="text-[#7b008b] font-medium">{currentLevel.title}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#ff0099] to-[#7b008b] flex items-center justify-center text-3xl">
            {currentLevel.icon}
          </div>
          <div>
            <p className="text-sm text-gray-500">Current Level</p>
            <p className="text-xl font-bold text-gray-900">{currentLevel.title}</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm text-gray-500">Total XP</p>
          <p className="text-2xl font-bold text-[#7b008b] flex items-center gap-1">
            <Zap className="w-5 h-5" />
            {totalXP.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#ff0099] to-[#7b008b] rounded-full transition-all duration-1000 ease-out relative"
            style={{ width: `${animatedProgress}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>

        {/* Level markers */}
        <div className="flex justify-between mt-2 text-xs">
          <span className="text-gray-500">Lvl {currentLevel.level}</span>
          {nextLevel && (
            <span className="text-gray-500">Lvl {nextLevel.level} ({nextLevel.xp_required.toLocaleString()} XP)</span>
          )}
        </div>
      </div>

      {nextLevel && (
        <p className="text-center text-sm text-gray-600 mt-3">
          <span className="font-semibold text-[#7b008b]">{(nextLevel.xp_required - totalXP).toLocaleString()}</span> XP to next level
        </p>
      )}
    </div>
  );
}

// ==================== STREAK DISPLAY ====================

interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  lastActivity: string | null;
}

export function StreakDisplay({ currentStreak, longestStreak, lastActivity }: StreakDisplayProps) {
  const isActiveToday = lastActivity ? new Date(lastActivity).toDateString() === new Date().toDateString() : false;

  return (
    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-5 border border-orange-200">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          currentStreak > 0 ? 'bg-gradient-to-br from-orange-400 to-red-500' : 'bg-gray-300'
        }`}>
          <Flame className={`w-6 h-6 ${currentStreak > 0 ? 'text-white' : 'text-gray-500'}`} />
        </div>
        <div>
          <p className="text-sm text-gray-600">Current Streak</p>
          <p className="text-3xl font-bold text-orange-600">{currentStreak} days</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Best: <span className="font-semibold text-orange-600">{longestStreak} days</span>
        </span>
        {isActiveToday ? (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            Active today!
          </span>
        ) : (
          <span className="text-gray-400">Learn today to keep streak!</span>
        )}
      </div>
    </div>
  );
}

// ==================== BADGE DISPLAY ====================

interface BadgeDisplayProps {
  badges: ChildBadge[];
  allBadges: BadgeDefinition[];
  maxDisplay?: number;
}

export function BadgeDisplay({ badges, allBadges, maxDisplay = 6 }: BadgeDisplayProps) {
  const [showAll, setShowAll] = useState(false);
  const earnedCount = badges.length;
  const totalCount = allBadges.length;

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-gray-900">Badges</h3>
        </div>
        <span className="text-sm text-gray-500">
          {earnedCount}/{totalCount}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {badges.slice(0, maxDisplay).map(b => (
          <div
            key={b.id}
            className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-100 to-amber-100 flex items-center justify-center text-xl border border-yellow-300"
            title={b.badge_name}
          >
            {b.badge_icon || '🏆'}
          </div>
        ))}

        {earnedCount > maxDisplay && (
          <button
            onClick={() => setShowAll(true)}
            className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600 hover:bg-gray-200"
          >
            +{earnedCount - maxDisplay}
          </button>
        )}

        {earnedCount === 0 && (
          <p className="text-sm text-gray-400">Complete activities to earn badges!</p>
        )}
      </div>

      {/* Badge Modal */}
      {showAll && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAll(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">All Badges</h3>
              <button onClick={() => setShowAll(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {allBadges.map(badge => {
                const isEarned = badges.some(b => b.badge_slug === badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-3 rounded-xl text-center ${
                      isEarned ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200' : 'bg-gray-100 opacity-50'
                    }`}
                  >
                    <span className={`text-2xl ${!isEarned && 'grayscale'}`}>{badge.icon}</span>
                    <p className="text-xs mt-1 font-medium text-gray-700 truncate">{badge.name}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== STATS CARD ====================

interface StatsCardProps {
  stats: {
    videosCompleted: number;
    quizzesCompleted: number;
    gamesCompleted: number;
    perfectQuizzes: number;
  };
}

export function StatsCard({ stats }: StatsCardProps) {
  const statItems = [
    { label: 'Videos', value: stats.videosCompleted, icon: '🎬', color: 'from-blue-400 to-blue-600' },
    { label: 'Quizzes', value: stats.quizzesCompleted, icon: '📝', color: 'from-green-400 to-green-600' },
    { label: 'Games', value: stats.gamesCompleted, icon: '🎮', color: 'from-purple-400 to-purple-600' },
    { label: 'Perfect', value: stats.perfectQuizzes, icon: '⭐', color: 'from-yellow-400 to-yellow-600' },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-[#7b008b]" />
        <h3 className="font-semibold text-gray-900">Your Stats</h3>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {statItems.map(item => (
          <div key={item.label} className="text-center">
            <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-xl mb-2`}>
              {item.icon}
            </div>
            <p className="text-xl font-bold text-gray-900">{item.value}</p>
            <p className="text-xs text-gray-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== XP POPUP ====================

interface XPPopupProps {
  xp: number;
  onComplete: () => void;
}

export function XPPopup({ xp, onComplete }: XPPopupProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="animate-bounce-in bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
        <Zap className="w-8 h-8" />
        <span className="text-3xl font-bold">+{xp} XP</span>
        <Sparkles className="w-6 h-6 animate-spin" />
      </div>

      <style jsx>{`
        @keyframes bounceIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounceIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

// ==================== BADGE EARNED POPUP ====================

interface BadgeEarnedPopupProps {
  badge: BadgeDefinition;
  onComplete: () => void;
}

export function BadgeEarnedPopup({ badge, onComplete }: BadgeEarnedPopupProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onComplete}>
      <div className="animate-scale-up bg-white rounded-3xl p-8 text-center max-w-sm shadow-2xl">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-100 to-amber-100 flex items-center justify-center text-5xl border-4 border-yellow-300">
          {badge.icon}
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Gift className="w-5 h-5 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-600">New Badge!</span>
        </div>

        <h3 className="text-2xl font-bold text-gray-900 mb-2">{badge.name}</h3>
        <p className="text-gray-600 mb-4">{badge.description}</p>

        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#7b008b]/10 rounded-full">
          <Zap className="w-4 h-4 text-[#7b008b]" />
          <span className="font-medium text-[#7b008b]">+{badge.xp_bonus} XP Bonus</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes scaleUp {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-up {
          animation: scaleUp 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

// ==================== LEADERBOARD MINI ====================

interface LeaderboardMiniProps {
  entries: LeaderboardEntry[];
  childId: string;
  childRank: number | null;
}

export function LeaderboardMini({ entries, childId, childRank }: LeaderboardMiniProps) {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-500">{rank}</span>;
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-gray-900">Leaderboard</h3>
        </div>
        {childRank && (
          <span className="text-sm text-gray-500">
            Your Rank: <span className="font-bold text-[#7b008b]">#{childRank}</span>
          </span>
        )}
      </div>

      <div className="space-y-2">
        {entries.slice(0, 5).map((entry, idx) => {
          const isCurrentChild = entry.childId === childId;
          return (
            <div
              key={entry.childId}
              className={`flex items-center gap-3 p-2 rounded-lg ${
                isCurrentChild ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'
              }`}
            >
              {getRankIcon(idx + 1)}
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${isCurrentChild ? 'text-[#7b008b]' : 'text-gray-900'}`}>
                  {entry.childName}
                  {isCurrentChild && ' (You)'}
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Zap className="w-4 h-4 text-[#7b008b]" />
                <span className="font-bold text-gray-700">{entry.totalXP.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}




