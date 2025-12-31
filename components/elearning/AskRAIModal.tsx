// =============================================================================
// FILE: components/elearning/AskRAIModal.tsx
// PURPOSE: Modal for requesting different learning content from rAI
// MOBILE-FIRST RESPONSIVE
// =============================================================================

'use client';

import { useState } from 'react';
import { X, Brain, Sparkles, Send, BookOpen, Mic, Puzzle, Volume2 } from 'lucide-react';

interface AskRAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (requestType: string, customRequest?: string) => void;
  isLoading?: boolean;
}

const QUICK_OPTIONS = [
  {
    id: 'phonics',
    label: 'Phonics',
    icon: Volume2,
    description: 'Letter sounds',
    color: 'from-blue-400 to-blue-600',
  },
  {
    id: 'sight_words',
    label: 'Sight Words',
    icon: BookOpen,
    description: 'Common words',
    color: 'from-green-400 to-green-600',
  },
  {
    id: 'blends',
    label: 'Blends',
    icon: Puzzle,
    description: 'bl, cr, st...',
    color: 'from-purple-400 to-purple-600',
  },
  {
    id: 'digraphs',
    label: 'Digraphs',
    icon: Volume2,
    description: 'th, sh, ch...',
    color: 'from-orange-400 to-orange-600',
  },
  {
    id: 'vowels',
    label: 'Vowels',
    icon: Mic,
    description: 'Short & long',
    color: 'from-pink-400 to-pink-600',
  },
  {
    id: 'fluency',
    label: 'Fluency',
    icon: BookOpen,
    description: 'Reading flow',
    color: 'from-teal-400 to-teal-600',
  },
];

export default function AskRAIModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: AskRAIModalProps) {
  const [customRequest, setCustomRequest] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSubmit() {
    if (selectedOption) {
      onSubmit(selectedOption);
    } else if (customRequest.trim()) {
      onSubmit('custom', customRequest.trim());
    }
  }

  function handleQuickSelect(optionId: string) {
    setSelectedOption(optionId);
    setCustomRequest('');
    setTimeout(() => {
      onSubmit(optionId);
    }, 300);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - Full width on mobile, constrained on desktop */}
      <div className="relative bg-white w-full md:rounded-2xl md:max-w-lg md:mx-4 max-h-[85vh] md:max-h-[90vh] overflow-hidden rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#ff0099] to-[#7b008b] p-4 md:p-5 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-lg md:rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold">Ask rAI</h2>
                <p className="text-xs md:text-sm text-white/80">What to practice?</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 md:p-2 hover:bg-white/20 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 md:p-5 space-y-4 md:space-y-5 overflow-y-auto flex-1">
          {/* Quick Options */}
          <div>
            <p className="text-xs md:text-sm font-medium text-gray-700 mb-2 md:mb-3 flex items-center gap-2">
              <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-[#7b008b]" />
              Quick picks
            </p>
            <div className="grid grid-cols-3 md:grid-cols-2 gap-2 md:gap-3">
              {QUICK_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedOption === option.id;

                return (
                  <button
                    key={option.id}
                    onClick={() => handleQuickSelect(option.id)}
                    disabled={isLoading}
                    className={`p-2.5 md:p-4 rounded-lg md:rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-[#7b008b] bg-[#7b008b]/5 ring-2 ring-[#7b008b]/20'
                        : 'border-gray-200 active:bg-gray-50 md:hover:border-[#7b008b]/50 md:hover:bg-gray-50'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start gap-1.5 md:gap-3">
                      <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br ${option.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-xs md:text-sm truncate">{option.label}</p>
                        <p className="text-[10px] md:text-xs text-gray-500 truncate hidden md:block">{option.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs md:text-sm">
              <span className="px-3 bg-white text-gray-500">or type</span>
            </div>
          </div>

          {/* Custom Request */}
          <div>
            <div className="relative">
              <input
                type="text"
                value={customRequest}
                onChange={(e) => {
                  setCustomRequest(e.target.value);
                  setSelectedOption(null);
                }}
                placeholder="magic-e words, short stories..."
                className="w-full px-3 md:px-4 py-2.5 md:py-3 pr-12 border border-gray-200 rounded-lg md:rounded-xl text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-[#7b008b]/20 focus:border-[#7b008b]"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customRequest.trim()) {
                    handleSubmit();
                  }
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!customRequest.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 md:p-2 bg-[#7b008b] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#6a0078] transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-3 md:p-4 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between text-xs md:text-sm gap-2">
            <p className="text-gray-500 flex items-center gap-1 truncate">
              <Brain className="w-3 h-3 md:w-4 md:h-4 text-[#7b008b] flex-shrink-0" />
              <span className="truncate">rAI curates based on your pick</span>
            </p>
            <button
              onClick={onClose}
              className="px-3 md:px-4 py-1.5 md:py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition flex-shrink-0"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="text-center">
              <Brain className="w-10 h-10 md:w-12 md:h-12 text-[#7b008b] mx-auto mb-3 animate-pulse" />
              <p className="text-gray-600 text-sm md:text-base">Finding content...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
