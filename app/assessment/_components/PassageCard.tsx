'use client';

import { RefreshCw, BookOpen } from 'lucide-react';

interface PassageCardProps {
  passage: {
    text: string;
    level: string;
    readingTime: string;
  };
  childName: string;
  isRecording: boolean;
  onNewPassage: () => void;
}

export function PassageCard({ passage, childName, isRecording, onNewPassage }: PassageCardProps) {
  return (
    <div className="space-y-4">
      {/* Header with passage level */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <BookOpen className="w-4 h-4" />
          <span>{passage.level}</span>
          <span className="text-gray-300">|</span>
          <span>{passage.readingTime}</span>
        </div>

        {/* Try different passage button */}
        {!isRecording && (
          <button
            onClick={onNewPassage}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#FF0099] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Different passage</span>
          </button>
        )}
      </div>

      {/* Passage text - reading surface style */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-gray-100">
        <p className="text-gray-400 text-xs mb-4">
          Ask {childName} to read aloud:
        </p>
        <p className="font-['Georgia','Times_New_Roman',serif] text-lg md:text-xl leading-relaxed text-gray-800 tracking-wide">
          {passage.text}
        </p>
      </div>
    </div>
  );
}
