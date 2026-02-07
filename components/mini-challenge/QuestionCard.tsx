// ============================================================
// FILE: components/mini-challenge/QuestionCard.tsx
// ============================================================
// Mini Challenge question card with multiple choice options
// ============================================================

'use client';

import { Volume2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTTS } from '@/hooks/useTTS';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  showAudio: boolean;
  childAge: number; // Required for TTS
  onAnswer: (selectedIndex: number, isCorrect: boolean) => void;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  showAudio,
  childAge,
  onAnswer
}: QuestionCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  // Use Google Cloud TTS with fallback to Web Speech
  const { speak, isLoading, isPlaying } = useTTS({ age: childAge });

  const handleSelect = (index: number) => {
    if (isAnswered) return;

    setSelectedIndex(index);
    setIsAnswered(true);

    const isCorrect = index === question.correct_answer;

    setTimeout(() => {
      onAnswer(index, isCorrect);
    }, 400);
  };

  const handleAudioPlay = () => {
    speak(question.question);
  };

  const progressPercent = (questionNumber / totalQuestions) * 100;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#FF0099] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-gray-400 text-sm">
          Question {questionNumber} of {totalQuestions}
        </p>
      </div>

      {/* Question */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
        <p className="text-white text-lg font-medium mb-3">
          {question.question}
        </p>

        {showAudio && (
          <button
            onClick={handleAudioPlay}
            disabled={isLoading}
            className="flex items-center gap-2 text-gray-400 hover:text-[#00ABFF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Volume2 className={`w-5 h-5 ${isPlaying ? 'text-[#00ABFF]' : ''}`} />
            )}
            <span className="text-sm">
              {isLoading ? 'Loading...' : isPlaying ? 'Playing...' : 'Listen'}
            </span>
          </button>
        )}
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {question.options.map((option, index) => {
          let optionClass = 'bg-gray-800 border-gray-700 hover:border-[#FF0099]/50';

          if (isAnswered && selectedIndex === index) {
            optionClass = index === question.correct_answer
              ? 'bg-green-900/30 border-green-500'
              : 'bg-red-900/30 border-red-500';
          }

          return (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={isAnswered}
              className={`min-h-[56px] px-4 py-3 border rounded-xl text-white font-medium transition-all ${optionClass} ${isAnswered ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'}`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
