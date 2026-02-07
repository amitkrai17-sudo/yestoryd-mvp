// ============================================================
// FILE: components/mini-challenge/ChallengeResults.tsx
// ============================================================
// Final results screen with CTA to book discovery call
// ============================================================

'use client';

import { Target, Play, Star, Calendar } from 'lucide-react';
import { LottieAnimation } from '@/components/ui/LottieAnimation';

interface ChallengeResultsProps {
  score: number;
  total: number;
  videoWatched: boolean;
  xpEarned: number;
  childName: string;
  onBookDiscovery: () => void;
  onSkip: () => void;
}

export function ChallengeResults({
  score,
  total,
  videoWatched,
  xpEarned,
  childName,
  onBookDiscovery,
  onSkip
}: ChallengeResultsProps) {
  return (
    <div className="space-y-6">
      {/* Celebration */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8">
        <div className="flex flex-col items-center text-center">
          <LottieAnimation name="complete" size={100} />

          <h2 className="text-2xl font-bold text-white mt-4">
            Challenge Complete!
          </h2>

          <p className="text-gray-400 mt-2">
            Great work, {childName}!
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
        <p className="text-gray-400 text-sm mb-4">Your Results</p>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <Target className="w-5 h-5 text-gray-400 mx-auto mb-2" />
            <p className="text-white font-semibold">{score}/{total}</p>
            <p className="text-gray-500 text-xs mt-1">Questions</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <Play className="w-5 h-5 text-gray-400 mx-auto mb-2" />
            <p className="text-white font-semibold">{videoWatched ? 'Yes' : 'No'}</p>
            <p className="text-gray-500 text-xs mt-1">Video</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <Star className="w-5 h-5 text-[#FF0099] mx-auto mb-2" />
            <p className="text-[#FF0099] font-semibold">{xpEarned}</p>
            <p className="text-gray-500 text-xs mt-1">XP Earned</p>
          </div>
        </div>
      </div>

      {/* Message */}
      <div className="text-center">
        <p className="text-gray-400">
          Your coach will unlock 100+ more challenges like this!
        </p>
      </div>

      {/* CTAs */}
      <div className="space-y-3">
        <button
          onClick={onBookDiscovery}
          className="w-full h-14 bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <Calendar className="w-5 h-5" />
          Book Free Discovery Call
        </button>

        <button
          onClick={onSkip}
          className="w-full text-gray-500 text-sm hover:text-gray-400 transition-colors py-2"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
