// =============================================================================
// FILE: components/elearning/GamificationHeader.tsx
// PURPOSE: Display XP, level, and streak in the e-learning header
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { Star, Flame, Trophy, ChevronRight, Sparkles } from 'lucide-react';

interface GamificationHeaderProps {
  childId: string;
  compact?: boolean;
  onBadgeClick?: () => void;
}

interface GamificationState {
  xp: number;
  level: number;
  levelTitle: string;
  levelIcon: string;
  streak: number;
  progressToNextLevel: number;
  nextLevelXP: number;
  badges: any[];
  recentBadges: any[];
}

export default function GamificationHeader({
  childId,
  compact = false,
  onBadgeClick
}: GamificationHeaderProps) {
  const [state, setState] = useState<GamificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [animateXP, setAnimateXP] = useState(false);

  useEffect(() => {
    fetchGamificationState();
  }, [childId]);

  async function fetchGamificationState() {
    try {
      const res = await fetch(`/api/elearning/gamification?childId=${childId}&action=state`);
      const data = await res.json();
      if (data.success && data.data) {
        setState(data.data);
      }
    } catch (error) {
      console.error('Error fetching gamification state:', error);
    } finally {
      setLoading(false);
    }
  }

  // Refresh gamification state (called after XP awards)
  async function refresh() {
    const oldState = state;
    await fetchGamificationState();
    
    // Check for level up
    if (oldState && state && state.level > oldState.level) {
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 3000);
    }
    
    // Animate XP change
    if (oldState && state && state.xp > oldState.xp) {
      setAnimateXP(true);
      setTimeout(() => setAnimateXP(false), 1000);
    }
  }

  // Expose refresh function
  useEffect(() => {
    (window as any).refreshGamification = refresh;
    return () => {
      delete (window as any).refreshGamification;
    };
  }, [state]);

  if (loading || !state) {
    return (
      <div className="flex items-center gap-4 animate-pulse">
        <div className="w-24 h-8 bg-gray-200 rounded-full" />
        <div className="w-20 h-8 bg-gray-200 rounded-full" />
        <div className="w-16 h-8 bg-gray-200 rounded-full" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* XP Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-full ${animateXP ? 'animate-bounce' : ''}`}>
          <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
          <span className="font-bold text-amber-700">{state.xp.toLocaleString()}</span>
        </div>

        {/* Streak */}
        {state.streak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-100 to-red-100 rounded-full">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="font-bold text-orange-700">{state.streak}</span>
          </div>
        )}

        {/* Level */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full">
          <span className="text-lg">{state.levelIcon}</span>
          <span className="font-bold text-purple-700">Lvl {state.level}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      {/* Level Up Animation Overlay */}
      {showLevelUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 text-center animate-scale-up">
            <div className="text-6xl mb-4">{state.levelIcon}</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Level Up!</h2>
            <p className="text-lg text-purple-600 font-semibold">{state.levelTitle}</p>
            <p className="text-gray-500 mt-2">You reached Level {state.level}!</p>
            <Sparkles className="w-8 h-8 text-yellow-500 mx-auto mt-4 animate-spin" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        {/* Left: XP & Level */}
        <div className="flex items-center gap-4">
          {/* XP Display */}
          <div className={`flex flex-col items-center ${animateXP ? 'animate-pulse' : ''}`}>
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-xl text-white">
              <Star className="w-5 h-5" fill="currentColor" />
              <span className="font-bold text-lg">{state.xp.toLocaleString()} XP</span>
            </div>
            <div className="mt-2 w-full">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 to-yellow-400 transition-all duration-500"
                  style={{ width: `${state.progressToNextLevel}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                {state.nextLevelXP - state.xp} XP to next level
              </p>
            </div>
          </div>

          {/* Level Display */}
          <div className="flex flex-col items-center px-4 py-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl text-white">
            <span className="text-3xl">{state.levelIcon}</span>
            <span className="font-bold">Level {state.level}</span>
            <span className="text-xs opacity-90">{state.levelTitle}</span>
          </div>
        </div>

        {/* Center: Streak */}
        <div className="flex flex-col items-center px-4 py-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl text-white">
          <Flame className="w-8 h-8" />
          <span className="font-bold text-2xl">{state.streak}</span>
          <span className="text-xs opacity-90">Day Streak</span>
        </div>

        {/* Right: Badges */}
        <button
          onClick={onBadgeClick}
          className="flex flex-col items-center px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
        >
          <div className="flex -space-x-2">
            {state.badges.slice(0, 3).map((badge, i) => (
              <span key={badge.id} className="text-2xl" style={{ zIndex: 3 - i }}>
                {badge.icon}
              </span>
            ))}
            {state.badges.length === 0 && (
              <Trophy className="w-8 h-8 text-gray-400" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-700 mt-1">
            {state.badges.length} Badges
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            View All <ChevronRight className="w-3 h-3" />
          </span>
        </button>
      </div>

      {/* Recent Badge Notification */}
      {state.recentBadges.length > 0 && (
        <div className="mt-4 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border border-yellow-200">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{state.recentBadges[0].icon}</span>
            <div>
              <p className="font-semibold text-gray-900">New Badge Earned!</p>
              <p className="text-sm text-gray-600">{state.recentBadges[0].name}</p>
            </div>
            <div className="ml-auto text-sm font-medium text-amber-600">
              +{state.recentBadges[0].xp_bonus} XP
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
