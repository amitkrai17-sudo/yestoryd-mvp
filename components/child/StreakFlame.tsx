// components/child/StreakFlame.tsx
// Animated flame that grows with streak days

'use client';

import { motion } from 'framer-motion';

interface StreakFlameProps {
  streak: number;
  showAnimation?: boolean;
}

export default function StreakFlame({ streak, showAnimation = true }: StreakFlameProps) {
  if (streak === 0) return null;

  // Flame intensity based on streak
  const getFlameConfig = (days: number) => {
    if (days >= 30) return { 
      size: 'text-3xl', 
      glow: 'shadow-[0_0_20px_rgba(251,146,60,0.8)]',
      label: 'ON FIRE!',
      flames: 3,
      color: 'from-red-500 via-orange-500 to-yellow-400'
    };
    if (days >= 14) return { 
      size: 'text-2xl', 
      glow: 'shadow-[0_0_15px_rgba(251,146,60,0.6)]',
      label: 'Hot!',
      flames: 2,
      color: 'from-orange-500 to-yellow-400'
    };
    if (days >= 7) return { 
      size: 'text-xl', 
      glow: 'shadow-[0_0_10px_rgba(251,146,60,0.4)]',
      label: 'Warm',
      flames: 1,
      color: 'from-orange-400 to-yellow-300'
    };
    if (days >= 3) return { 
      size: 'text-lg', 
      glow: '',
      label: '',
      flames: 1,
      color: 'from-orange-400 to-yellow-300'
    };
    return { 
      size: 'text-base', 
      glow: '',
      label: '',
      flames: 1,
      color: 'from-orange-300 to-yellow-200'
    };
  };

  const config = getFlameConfig(streak);

  return (
    <motion.div 
      className={`relative flex items-center gap-1.5 bg-gradient-to-r ${config.color} px-3 py-1.5 rounded-full ${config.glow}`}
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.05 }}
    >
      {/* Flame Stack */}
      <div className="relative">
        {/* Main Flame */}
        <motion.span
          className={config.size}
          animate={showAnimation ? { 
            scale: [1, 1.15, 1],
            y: [0, -2, 0]
          } : {}}
          transition={{ 
            duration: 0.6, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          🔥
        </motion.span>

        {/* Second Flame (7+ days) */}
        {config.flames >= 2 && (
          <motion.span
            className="absolute -top-1 -left-1 text-sm"
            animate={{ 
              scale: [0.8, 1.1, 0.8],
              y: [0, -3, 0],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{ 
              duration: 0.7, 
              repeat: Infinity,
              delay: 0.2
            }}
          >
            🔥
          </motion.span>
        )}

        {/* Third Flame (30+ days) */}
        {config.flames >= 3 && (
          <motion.span
            className="absolute -top-2 left-2 text-xs"
            animate={{ 
              scale: [0.7, 1, 0.7],
              y: [0, -4, 0],
              opacity: [0.5, 0.9, 0.5]
            }}
            transition={{ 
              duration: 0.5, 
              repeat: Infinity,
              delay: 0.4
            }}
          >
            🔥
          </motion.span>
        )}

        {/* Sparkles for 14+ days */}
        {streak >= 14 && (
          <>
            <motion.span
              className="absolute -top-2 -right-2 text-xs"
              animate={{ 
                rotate: [0, 360],
                scale: [0.8, 1, 0.8]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity 
              }}
            >
              ✨
            </motion.span>
          </>
        )}
      </div>

      {/* Streak Number */}
      <span className="font-bold text-white text-sm drop-shadow-sm">
        {streak}
      </span>

      {/* Label for high streaks */}
      {config.label && (
        <motion.span 
          className="text-[10px] font-bold text-white/90 uppercase tracking-wider"
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {config.label}
        </motion.span>
      )}
    </motion.div>
  );
}
