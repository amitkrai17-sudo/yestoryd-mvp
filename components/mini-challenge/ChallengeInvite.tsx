// ============================================================
// FILE: components/mini-challenge/ChallengeInvite.tsx
// ============================================================
// Mini Challenge invitation card
// ============================================================

'use client';

import { Sparkles, Play } from 'lucide-react';

interface ChallengeInviteProps {
  questionsCount: number;
  goalName: string;
  onStart: () => void;
  onSkip: () => void;
}

export function ChallengeInvite({ questionsCount, goalName, onStart, onSkip }: ChallengeInviteProps) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8">
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 bg-[#FF0099]/10 rounded-2xl flex items-center justify-center mb-4">
          <Sparkles className="w-7 h-7 text-[#FF0099]" />
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">
          Ready for a Quick Challenge?
        </h2>

        <p className="text-gray-400 mb-1">
          Topic: <span className="text-white capitalize">{goalName.replace('_', ' ')}</span>
        </p>

        <p className="text-gray-500 text-sm mb-6">
          {questionsCount} questions • 1 short video • ~2 minutes
        </p>

        <button
          onClick={onStart}
          className="w-full h-14 bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <Play className="w-5 h-5" />
          Start Challenge
        </button>

        <button
          onClick={onSkip}
          className="mt-4 text-gray-500 text-sm underline hover:text-gray-400 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
