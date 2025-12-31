// =============================================================================
// FILE: components/elearning/XPAwardPopup.tsx
// PURPOSE: Animated popup shown when XP is awarded
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { Star, Flame, Trophy, Sparkles, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_bonus: number;
}

interface XPAwardPopupProps {
  isOpen: boolean;
  onClose: () => void;
  xpEarned: number;
  totalXP: number;
  newLevel?: number;
  levelTitle?: string;
  levelIcon?: string;
  leveledUp: boolean;
  previousLevel?: number;
  streakBonus?: number;
  currentStreak?: number;
  streakBroken?: boolean;
  newBadges?: Badge[];
  activityType: 'video' | 'quiz' | 'game' | 'reading';
  isPerfect?: boolean;
}

export default function XPAwardPopup({
  isOpen,
  onClose,
  xpEarned,
  totalXP,
  newLevel,
  levelTitle,
  levelIcon,
  leveledUp,
  previousLevel,
  streakBonus = 0,
  currentStreak = 0,
  streakBroken = false,
  newBadges = [],
  activityType,
  isPerfect = false,
}: XPAwardPopupProps) {
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setAnimationStep(0);
      
      // Trigger confetti for special achievements
      if (leveledUp || isPerfect || newBadges.length > 0) {
        triggerConfetti();
      }

      // Animate through steps
      const timer1 = setTimeout(() => setAnimationStep(1), 300);
      const timer2 = setTimeout(() => setAnimationStep(2), 800);
      const timer3 = setTimeout(() => setAnimationStep(3), 1200);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isOpen]);

  function triggerConfetti() {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff0099', '#7b008b', '#fbbf24', '#22c55e', '#3b82f6'],
    });
  }

  if (!isOpen) return null;

  const activityEmoji = {
    video: '🎬',
    quiz: '📝',
    game: '🎮',
    reading: '📖',
  };

  const activityText = {
    video: 'Video Complete!',
    quiz: isPerfect ? 'Perfect Score!' : 'Quiz Complete!',
    game: 'Game Complete!',
    reading: 'Reading Complete!',
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl transform transition-all"
        style={{
          animation: 'scaleUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Activity Completion */}
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">
            {activityEmoji[activityType]}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {activityText[activityType]}
          </h2>
        </div>

        {/* XP Earned */}
        <div 
          className={`mt-6 flex justify-center ${animationStep >= 1 ? 'animate-fade-in' : 'opacity-0'}`}
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-2xl text-white shadow-lg">
            <Star className="w-8 h-8" fill="currentColor" />
            <div className="text-left">
              <p className="text-3xl font-bold">+{xpEarned}</p>
              <p className="text-sm opacity-90">XP Earned</p>
            </div>
          </div>
        </div>

        {/* Streak Bonus */}
        {streakBonus > 0 && (
          <div 
            className={`mt-4 flex justify-center ${animationStep >= 2 ? 'animate-fade-in' : 'opacity-0'}`}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-100 to-red-100 rounded-xl">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="font-semibold text-orange-700">
                +{streakBonus} Streak Bonus ({currentStreak} days!)
              </span>
            </div>
          </div>
        )}

        {/* Streak Broken Warning */}
        {streakBroken && (
          <div 
            className={`mt-4 flex justify-center ${animationStep >= 2 ? 'animate-fade-in' : 'opacity-0'}`}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl">
              <Flame className="w-5 h-5 text-gray-400" />
              <span className="text-gray-600">
                Streak reset - but you&apos;re back! 🔥
              </span>
            </div>
          </div>
        )}

        {/* Level Up */}
        {leveledUp && (
          <div 
            className={`mt-6 text-center ${animationStep >= 3 ? 'animate-scale-up' : 'opacity-0'}`}
          >
            <div className="inline-block p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl text-white shadow-lg">
              <Sparkles className="w-8 h-8 mx-auto mb-2" />
              <p className="font-bold text-lg">LEVEL UP!</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-2xl">{levelIcon}</span>
                <span className="text-xl font-bold">{levelTitle}</span>
              </div>
              <p className="text-sm opacity-90 mt-1">Level {newLevel}</p>
            </div>
          </div>
        )}

        {/* New Badges */}
        {newBadges.length > 0 && (
          <div 
            className={`mt-6 ${animationStep >= 3 ? 'animate-fade-in' : 'opacity-0'}`}
          >
            <p className="text-center text-gray-500 text-sm mb-3">New Badge{newBadges.length > 1 ? 's' : ''} Earned!</p>
            <div className="flex flex-wrap justify-center gap-3">
              {newBadges.map((badge) => (
                <div 
                  key={badge.id}
                  className="flex flex-col items-center p-3 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border border-yellow-200"
                >
                  <span className="text-4xl">{badge.icon}</span>
                  <p className="font-semibold text-gray-800 text-sm mt-1">{badge.name}</p>
                  <p className="text-xs text-amber-600">+{badge.xp_bonus} XP</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total XP */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">Total XP</p>
          <p className="text-2xl font-bold text-gray-900">{totalXP.toLocaleString()}</p>
        </div>

        {/* Continue Button */}
        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-semibold hover:opacity-90 transition"
        >
          {leveledUp ? '🎉 Awesome!' : 'Continue Learning'}
        </button>
      </div>

      <style jsx global>{`
        @keyframes scaleUp {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-scale-up {
          animation: scaleUp 0.4s ease-out;
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
