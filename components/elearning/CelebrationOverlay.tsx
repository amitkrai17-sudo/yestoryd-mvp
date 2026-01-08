// =============================================================================
// CELEBRATION OVERLAY
// Beautiful full-screen celebrations for achievements
// Level up, badges, streaks, daily goals, perfect scores
// =============================================================================

'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { playSound, playHaptic } from '@/lib/sounds';
import type { CelebrationEvent } from '@/types/elearning';

interface CelebrationOverlayProps {
  event: CelebrationEvent;
  onComplete: () => void;
}

export default function CelebrationOverlay({ event, onComplete }: CelebrationOverlayProps) {
  // Play sound on mount
  useEffect(() => {
    if (event.type === 'level_up' || event.type === 'perfect') {
      playSound('levelUp');
      playHaptic('heavy');
    } else if (event.type === 'badge') {
      playSound('badge');
      playHaptic('medium');
    } else if (event.type === 'streak') {
      playSound('streak');
      playHaptic('medium');
    } else if (event.type === 'daily_goal') {
      playSound('complete');
      playHaptic('heavy');
    } else {
      playSound('success');
      playHaptic('light');
    }
    
    // Auto-close after animation
    const timer = setTimeout(onComplete, 3500);
    return () => clearTimeout(timer);
  }, [event, onComplete]);
  
  // Render based on event type
  const renderContent = () => {
    switch (event.type) {
      case 'level_up':
        return (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            className="text-center"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ duration: 0.5, repeat: 3 }}
              className="text-8xl mb-4"
            >
              🎉
            </motion.div>
            <h2 className="text-4xl font-bold text-white mb-2">
              LEVEL UP!
            </h2>
            <p className="text-2xl text-white/80">
              You reached Level {event.value}!
            </p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-4 bg-white/20 rounded-full px-6 py-2 inline-block"
            >
              <span className="text-white font-semibold">
                {event.message || 'Keep going!'}
              </span>
            </motion.div>
          </motion.div>
        );
      
      case 'badge':
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ 
                y: [0, -20, 0],
                rotateY: [0, 360]
              }}
              transition={{ duration: 1, repeat: 2 }}
              className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-3xl flex items-center justify-center shadow-2xl"
            >
              <span className="text-6xl">{event.badge?.icon || '🏆'}</span>
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-2">
              New Badge!
            </h2>
            <p className="text-xl text-white/80">
              {event.badge?.name || 'Achievement Unlocked'}
            </p>
          </motion.div>
        );
      
      case 'streak':
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-center"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.3, 1],
                y: [0, -10, 0]
              }}
              transition={{ duration: 0.5, repeat: 4 }}
              className="text-8xl mb-4"
            >
              🔥
            </motion.div>
            <h2 className="text-4xl font-bold text-white mb-2">
              {event.value} Day Streak!
            </h2>
            <p className="text-xl text-white/80">
              You're on fire!
            </p>
          </motion.div>
        );
      
      case 'daily_goal':
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-center"
          >
            <motion.div
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 360 }}
              transition={{ duration: 1 }}
              className="text-8xl mb-4"
            >
              🎁
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-2">
              Daily Goal Complete!
            </h2>
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-yellow-400 text-yellow-900 rounded-2xl px-6 py-3 inline-block"
            >
              <span className="text-xl font-bold">+{event.value} XP Bonus!</span>
            </motion.div>
          </motion.div>
        );
      
      case 'perfect':
        return (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            className="text-center"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 15, -15, 0]
              }}
              transition={{ duration: 0.6, repeat: 2 }}
              className="text-8xl mb-4"
            >
              ⭐
            </motion.div>
            <h2 className="text-4xl font-bold text-white mb-2">
              PERFECT!
            </h2>
            <p className="text-xl text-white/80">
              No mistakes! Amazing!
            </p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-4"
            >
              <span className="text-2xl text-yellow-300 font-bold">
                +{event.value} XP
              </span>
            </motion.div>
          </motion.div>
        );
      
      case 'xp':
      default:
        return (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.3 }}
              className="text-6xl mb-2"
            >
              ⚡
            </motion.div>
            <span className="text-3xl font-bold text-white">
              +{event.value} XP
            </span>
          </motion.div>
        );
    }
  };
  
  // Background gradient based on event type
  const getBgGradient = () => {
    switch (event.type) {
      case 'level_up':
        return 'from-purple-600 via-pink-600 to-red-600';
      case 'badge':
        return 'from-yellow-500 via-amber-500 to-orange-500';
      case 'streak':
        return 'from-orange-500 via-red-500 to-pink-500';
      case 'daily_goal':
        return 'from-green-500 via-emerald-500 to-teal-500';
      case 'perfect':
        return 'from-yellow-400 via-amber-500 to-orange-500';
      default:
        return 'from-[#FF0099] via-purple-600 to-indigo-600';
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br ${getBgGradient()}`}
      onClick={onComplete}
    >
      {/* Confetti/particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-full"
            style={{
              background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#FF0099'][i % 5],
              left: `${Math.random() * 100}%`,
              top: '-20px',
            }}
            animate={{
              y: ['0vh', '120vh'],
              x: [0, (Math.random() - 0.5) * 200],
              rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              delay: Math.random() * 0.5,
              ease: 'easeIn',
            }}
          />
        ))}
      </div>
      
      {/* Stars */}
      {['level_up', 'perfect', 'badge'].includes(event.type) && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={`star-${i}`}
              className="absolute text-2xl"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
                rotate: [0, 180],
              }}
              transition={{
                duration: 1,
                delay: Math.random() * 2,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            >
              ✨
            </motion.div>
          ))}
        </div>
      )}
      
      {/* Content */}
      <div className="relative z-10 p-8">
        {renderContent()}
      </div>
      
      {/* Tap to continue */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 text-white/60 text-sm"
      >
        Tap anywhere to continue
      </motion.p>
    </motion.div>
  );
}
