// components/child/BadgeUnlock.tsx
// Achievement badge with unlock animation and glow

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Badge {
  id: string;
  icon: string;
  name: string;
  description?: string;
}

interface BadgeUnlockProps {
  badge: Badge;
  isNew?: boolean;
  onAnimationComplete?: () => void;
}

// Sound effect for badge unlock
const playUnlockSound = () => {
  if (typeof window !== 'undefined' && 'AudioContext' in window) {
    try {
      const audioContext = new AudioContext();
      
      // Magical chime sound
      const frequencies = [784, 988, 1175, 1568]; // G5, B5, D6, G6
      
      frequencies.forEach((freq, i) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        const startTime = audioContext.currentTime + i * 0.1;
        gainNode.gain.setValueAtTime(0.15, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.4);
      });
    } catch (e) {
      // Audio not supported
    }
  }
};

// Full-screen unlock celebration modal
export function BadgeUnlockModal({ 
  badge, 
  onClose 
}: { 
  badge: Badge; 
  onClose: () => void;
}) {
  useEffect(() => {
    playUnlockSound();
    
    // Auto-close after 3 seconds
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", damping: 15, stiffness: 200 }}
        className="bg-white rounded-3xl p-8 text-center max-w-sm relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background glow */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-[#FFDE00]/30 via-transparent to-[#FF0099]/30"
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Floating particles */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-xl"
            initial={{ 
              x: '50%',
              y: '50%',
              opacity: 0,
              scale: 0
            }}
            animate={{ 
              x: `${50 + (Math.random() - 0.5) * 100}%`,
              y: `${50 + (Math.random() - 0.5) * 100}%`,
              opacity: [0, 1, 0],
              scale: [0, 1, 0.5]
            }}
            transition={{ 
              duration: 2,
              delay: i * 0.1,
              repeat: Infinity,
              repeatDelay: 1
            }}
          >
            {['✨', '⭐', '🌟'][i % 3]}
          </motion.div>
        ))}

        {/* Content */}
        <div className="relative z-10">
          <motion.p
            className="text-sm font-bold text-[#FF0099] uppercase tracking-widest mb-4"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            🎉 Achievement Unlocked! 🎉
          </motion.p>

          {/* Badge Icon */}
          <motion.div
            className="w-28 h-28 mx-auto bg-gradient-to-br from-[#FFDE00] to-[#FFA500] rounded-full flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(255,222,0,0.6)]"
            animate={{ 
              scale: [1, 1.05, 1],
              boxShadow: [
                '0 0 40px rgba(255,222,0,0.6)',
                '0 0 60px rgba(255,222,0,0.8)',
                '0 0 40px rgba(255,222,0,0.6)'
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className="text-6xl">{badge.icon}</span>
          </motion.div>

          <h3 className="text-2xl font-bold text-gray-800 mb-2">{badge.name}</h3>
          {badge.description && (
            <p className="text-gray-500 mb-6">{badge.description}</p>
          )}

          <motion.button
            onClick={onClose}
            className="bg-[#FF0099] text-white px-8 py-3 rounded-full font-semibold hover:bg-[#E6008A] transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Awesome!
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Badge display component (for grid/list)
export default function BadgeDisplay({ 
  badge, 
  isNew = false,
  isLocked = false,
  onClick
}: { 
  badge?: Badge;
  isNew?: boolean;
  isLocked?: boolean;
  onClick?: () => void;
}) {
  if (isLocked || !badge) {
    // Locked/empty badge slot
    return (
      <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200">
        <span className="text-2xl text-gray-300">?</span>
      </div>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      className="relative"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Glow for new badges */}
      {isNew && (
        <motion.div
          className="absolute inset-0 bg-[#FFDE00] rounded-xl blur-md"
          animate={{ 
            opacity: [0.4, 0.8, 0.4],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Badge */}
      <div className={`relative w-16 h-16 bg-gradient-to-br from-[#FFF9E6] to-[#FFECB3] rounded-xl flex items-center justify-center shadow-sm ${
        isNew ? 'ring-2 ring-[#FFDE00] ring-offset-2' : ''
      }`}>
        <span className="text-3xl">{badge.icon}</span>
      </div>

      {/* NEW badge indicator */}
      {isNew && (
        <motion.div
          className="absolute -top-1 -right-1 bg-[#FF0099] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          NEW
        </motion.div>
      )}
    </motion.button>
  );
}

