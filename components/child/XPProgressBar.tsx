// components/child/XPProgressBar.tsx
// Gaming-style XP bar with level-up animations

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface XPProgressBarProps {
  currentXP: number;
  level: number;
  showLevelUp?: boolean;
  onLevelUpComplete?: () => void;
}

// XP needed for each level (increases progressively)
const getXPForLevel = (level: number) => {
  return level * 100; // Level 1 = 100, Level 2 = 200, etc.
};

const getTotalXPForLevel = (level: number) => {
  // Sum of XP needed for all previous levels
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getXPForLevel(i);
  }
  return total;
};

export default function XPProgressBar({ 
  currentXP, 
  level, 
  showLevelUp = false,
  onLevelUpComplete 
}: XPProgressBarProps) {
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [displayLevel, setDisplayLevel] = useState(level);

  const xpForCurrentLevel = getXPForLevel(level);
  const xpFromPreviousLevels = getTotalXPForLevel(level);
  const xpInCurrentLevel = currentXP - xpFromPreviousLevels;
  const progressPercent = Math.min((xpInCurrentLevel / xpForCurrentLevel) * 100, 100);

  // Level up animation trigger
  useEffect(() => {
    if (showLevelUp) {
      setIsLevelingUp(true);
      // Play level up sound
      playLevelUpSound();
      
      setTimeout(() => {
        setDisplayLevel(level);
        setIsLevelingUp(false);
        onLevelUpComplete?.();
      }, 2000);
    }
  }, [showLevelUp, level, onLevelUpComplete]);

  const playLevelUpSound = () => {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        const audioContext = new AudioContext();
        
        // Play ascending notes
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = freq;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + i * 0.15);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + i * 0.15 + 0.3);
          
          oscillator.start(audioContext.currentTime + i * 0.15);
          oscillator.stop(audioContext.currentTime + i * 0.15 + 0.3);
        });
      } catch (e) {
        // Audio not supported
      }
    }
  };

  return (
    <div className="relative">
      {/* Level Up Celebration Overlay */}
      <AnimatePresence>
        {isLevelingUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute -top-16 left-1/2 transform -translate-x-1/2 z-20"
          >
            <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white px-6 py-3 rounded-full font-bold text-lg shadow-lg">
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                🎉 LEVEL UP! 🎉
              </motion.span>
            </div>
            
            {/* Floating stars */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute text-2xl"
                initial={{ 
                  x: 0, 
                  y: 0, 
                  opacity: 1,
                  scale: 0
                }}
                animate={{ 
                  x: (Math.random() - 0.5) * 150,
                  y: (Math.random() - 0.5) * 100 - 30,
                  opacity: 0,
                  scale: 1.5
                }}
                transition={{ 
                  duration: 1,
                  delay: i * 0.1
                }}
              >
                ⭐
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* XP Bar Container */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Level Badge */}
            <motion.div
              className="w-10 h-10 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
              animate={isLevelingUp ? { 
                scale: [1, 1.3, 1],
                rotate: [0, 360]
              } : {}}
              transition={{ duration: 0.5 }}
            >
              {displayLevel}
            </motion.div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Level</p>
              <p className="font-semibold text-gray-700">Explorer</p>
            </div>
          </div>
          
          {/* XP Numbers */}
          <div className="text-right">
            <p className="text-xs text-gray-400">XP Progress</p>
            <p className="font-semibold text-gray-700">
              <span className="text-[#FF0099]">{xpInCurrentLevel}</span>
              <span className="text-gray-400"> / {xpForCurrentLevel}</span>
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#FF0099] to-[#7B008B] rounded-full relative"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* Shine effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            />
          </motion.div>
        </div>

        {/* XP to next level */}
        <p className="text-xs text-gray-400 mt-2 text-center">
          {xpForCurrentLevel - xpInCurrentLevel} XP to Level {level + 1}
        </p>
      </div>
    </div>
  );
}

