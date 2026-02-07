// ============================================================
// FILE: components/mini-challenge/AnswerFeedback.tsx
// ============================================================
// Feedback shown after each answer
// ============================================================

'use client';

import { Volume2, ArrowRight, Loader2 } from 'lucide-react';
import { LottieAnimation } from '@/components/ui/LottieAnimation';
import { useTTS } from '@/hooks/useTTS';

interface AnswerFeedbackProps {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  xpEarned: number;
  childAge: number; // Required for TTS
  onContinue: () => void;
}

export function AnswerFeedback({
  isCorrect,
  correctAnswer,
  explanation,
  xpEarned,
  childAge,
  onContinue
}: AnswerFeedbackProps) {

  // Use Google Cloud TTS with fallback to Web Speech
  const { speak, isLoading, isPlaying } = useTTS({ age: childAge });

  const handleAudioPlay = () => {
    const text = isCorrect ? explanation : `The correct answer is ${correctAnswer}. ${explanation}`;
    speak(text);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8">
      <div className="flex flex-col items-center text-center">
        <LottieAnimation
          name={isCorrect ? 'correct' : 'incorrect'}
          size={80}
        />

        <h3 className="text-xl font-semibold text-white mt-4">
          {isCorrect ? 'Correct!' : 'Not quite'}
        </h3>

        {!isCorrect && (
          <p className="text-gray-400 mt-2">
            The correct answer is <span className="text-white font-medium">{correctAnswer}</span>
          </p>
        )}

        <p className="text-gray-400 mt-3 max-w-sm">
          {explanation}
        </p>

        <button
          onClick={handleAudioPlay}
          disabled={isLoading}
          className="flex items-center gap-2 text-[#00ABFF] mt-4 hover:text-[#00ABFF]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
          <span className="text-sm">
            {isLoading ? 'Loading...' : isPlaying ? 'Playing...' : 'Hear it'}
          </span>
        </button>

        {isCorrect && xpEarned > 0 && (
          <p className="text-[#FF0099] font-semibold mt-4 animate-pulse">
            +{xpEarned} XP
          </p>
        )}

        <button
          onClick={onContinue}
          className="mt-6 h-12 px-8 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl flex items-center gap-2 transition-colors"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
