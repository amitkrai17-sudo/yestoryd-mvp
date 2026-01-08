// components/child/LearningPathCarousel.tsx
// Horizontal scrolling learning path with color-coded status
// Green = Complete, Orange = Retry, Gray = Locked, White = Ready

'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';

interface LearningItem {
  unit: {
    id: string;
    name: string;
    quest_title?: string;
    xp_reward?: number;
    estimated_minutes?: number;
  };
  progress?: {
    status: string;
    quiz_score?: number;
  };
  status: string; // 'completed' | 'ready' | 'retry' | 'locked'
  sequence?: Array<{ type: string }>;
}

interface LearningPathCarouselProps {
  items: LearningItem[];
  onSelect: (unitId: string) => void;
}

// Get simple title
function getSimpleTitle(title: string): string {
  return title
    .replace('Quest', '')
    .replace('Adventure', '')
    .replace('The', '')
    .replace('!', '')
    .trim() || 'Activity';
}

// Get card config based on status
function getCardConfig(item: LearningItem, isFirst: boolean = false) {
  const status = item.progress?.status || item.status;
  const quizScore = item.progress?.quiz_score;
  
  // Check if needs retry (failed quiz)
  if (status === 'in_progress' && quizScore !== undefined && quizScore < 70) {
    return {
      bg: 'bg-gradient-to-br from-orange-400 to-orange-500',
      border: 'border-orange-300',
      badge: { text: '↻ Retry Quiz', bg: 'bg-orange-600', color: 'text-white' },
      xpBadge: { text: `+${item.unit?.xp_reward || 50} XP`, bg: 'bg-orange-200', color: 'text-orange-700' },
      icon: '↻',
      iconBg: 'bg-white/30',
      locked: false,
      message: 'Pass the quiz to earn XP'
    };
  }
  
  // Completed
  if (status === 'completed') {
    return {
      bg: 'bg-gradient-to-br from-green-400 to-green-500',
      border: 'border-green-300',
      badge: { text: '✓ Done', bg: 'bg-green-600', color: 'text-white' },
      completeBadge: { text: '✓ Complete', bg: 'bg-white', color: 'text-green-600' },
      icon: '✓',
      iconBg: 'bg-white/30',
      locked: false,
      message: 'Watch again anytime'
    };
  }
  
  // Ready (current) - also treat first item as ready if not locked
  if (status === 'ready' || status === 'in_progress' || isFirst) {
    return {
      bg: 'bg-white',
      border: 'border-[#FF0099]/30',
      badge: { text: '▶ Start', bg: 'bg-[#FF0099]', color: 'text-white' },
      icon: '▶',
      iconBg: 'bg-[#FF0099]/10',
      iconColor: 'text-[#FF0099]',
      locked: false,
      message: null
    };
  }
  
  // Locked (default)
  return {
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    badge: { text: '🎬 Video', bg: 'bg-gray-200', color: 'text-gray-500' },
    icon: '🔒',
    iconBg: 'bg-gray-200',
    locked: true,
    message: 'Complete previous first'
  };
}

export default function LearningPathCarousel({ items, onSelect }: LearningPathCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <p className="text-gray-400">No activities yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Scroll Buttons */}
      {items.length > 2 && (
        <>
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            ‹
          </button>
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            ›
          </button>
        </>
      )}

      {/* Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 px-1 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item, index) => {
          const config = getCardConfig(item, index === 0);
          const hasVideo = item.sequence?.some(s => s.type === 'video');
          const hasQuiz = item.sequence?.some(s => s.type === 'quiz' || s.type === 'game');

          return (
            <motion.button
              key={item.unit?.id || index}
              onClick={() => !config.locked && onSelect(item.unit.id)}
              disabled={config.locked}
              className={`flex-shrink-0 w-44 rounded-xl overflow-hidden border ${config.border} ${config.bg} snap-start ${
                config.locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
              }`}
              whileHover={!config.locked ? { scale: 1.02, y: -2 } : {}}
              whileTap={!config.locked ? { scale: 0.98 } : {}}
            >
              {/* Top Section with Icon */}
              <div className="relative h-28 flex items-center justify-center">
                {/* Status badges */}
                <div className="absolute top-2 left-2 right-2 flex justify-between">
                  {config.badge && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${config.badge.bg} ${config.badge.color}`}>
                      {config.badge.text}
                    </span>
                  )}
                  {config.completeBadge && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${config.completeBadge.bg} ${config.completeBadge.color}`}>
                      {config.completeBadge.text}
                    </span>
                  )}
                  {config.xpBadge && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${config.xpBadge.bg} ${config.xpBadge.color}`}>
                      {config.xpBadge.text}
                    </span>
                  )}
                </div>

                {/* Center Icon */}
                <div className={`w-14 h-14 rounded-full ${config.iconBg} flex items-center justify-center`}>
                  <span className={`text-2xl ${config.iconColor || (config.locked ? 'text-gray-400' : 'text-white')}`}>
                    {config.icon}
                  </span>
                </div>
              </div>

              {/* Bottom Section */}
              <div className={`px-3 py-3 ${config.locked ? 'bg-gray-50' : config.bg === 'bg-white' ? 'bg-gray-50' : 'bg-black/10'}`}>
                <h4 className={`font-medium text-sm truncate ${config.locked ? 'text-gray-500' : config.bg === 'bg-white' ? 'text-gray-800' : 'text-white'}`}>
                  {getSimpleTitle(item.unit?.quest_title || item.unit?.name || 'Activity')}
                </h4>
                <div className={`flex items-center gap-2 mt-1 text-xs ${config.locked ? 'text-gray-400' : config.bg === 'bg-white' ? 'text-gray-500' : 'text-white/80'}`}>
                  <span>⏱ {item.unit?.estimated_minutes || 5}:00</span>
                  {hasQuiz && <span>📝 Quiz</span>}
                </div>
                {config.message && (
                  <p className={`text-[10px] mt-1.5 flex items-center gap-1 ${
                    config.locked ? 'text-orange-500' : 
                    config.bg === 'bg-white' ? 'text-green-600' : 'text-white/90'
                  }`}>
                    {config.locked ? '🔒' : '✓'} {config.message}
                  </p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
