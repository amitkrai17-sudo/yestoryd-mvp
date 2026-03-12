// components/child/ChildHeader.tsx
// SUBTLE + GAMING - Clean header with animated streak

'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import StreakFlame from './StreakFlame';

interface ChildHeaderProps {
  avatar: {
    avatar_type: string;
    avatar_color: string;
    avatar_name: string;
    evolution_level: number;
  } | null;
  displayName: string;
  coins: number;
  streak: number;
  level: number;
  onBackToParent: () => void;
}

const AVATAR_COLORS: Record<string, string> = {
  fox: 'bg-orange-500',
  bunny: 'bg-pink-400',
  bear: 'bg-amber-600',
  lion: 'bg-yellow-500',
  cat: 'bg-purple-400',
  owl: 'bg-indigo-500',
  panda: 'bg-gray-700',
  butterfly: 'bg-teal-400',
};

export default function ChildHeader({
  avatar,
  displayName,
  coins,
  streak,
  level,
  onBackToParent
}: ChildHeaderProps) {
  const avatarColor = avatar ? AVATAR_COLORS[avatar.avatar_type] || 'bg-orange-500' : 'bg-gray-400';
  const avatarLetter = avatar?.avatar_type?.[0]?.toUpperCase() || '?';

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        
        {/* Back Button */}
        <motion.button
          onClick={onBackToParent}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>

        {/* Center: Avatar & Name */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold text-lg`}>
              {avatarLetter}
            </div>
            {/* Level badge */}
            <motion.div 
              className="absolute -bottom-0.5 -right-0.5 bg-[#FF0099] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
            >
              {level}
            </motion.div>
          </div>
          <span className="font-semibold text-gray-800">{displayName}</span>
        </div>

        {/* Right: Coins with animation */}
        <motion.div 
          className="flex items-center gap-1 bg-[#FFF4E5] px-3 py-1.5 rounded-full"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.span
            className="text-sm"
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
          >
            <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
          </motion.span>
          <span className="font-semibold text-gray-700 text-sm">{coins}</span>
        </motion.div>
      </div>
    </header>
  );
}
