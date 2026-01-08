// =============================================================================
// JOURNEY MAP COMPONENT
// Visual learning path showing all units as a journey
// Kids see progress as traveling towards a goal
// =============================================================================

'use client';

import { motion } from 'framer-motion';
import { Lock, Check, Play, RotateCcw, Star } from 'lucide-react';
import type { Unit, UnitProgress } from '@/types/elearning';

interface JourneyMapProps {
  units: {
    unit: Unit;
    progress: UnitProgress | null;
    isUnlocked: boolean;
    isReview?: boolean;
  }[];
  onSelectUnit: (unit: Unit) => void;
}

// Status colors and icons
const STATUS_CONFIG = {
  completed: {
    bg: 'bg-gradient-to-br from-green-400 to-emerald-500',
    border: 'border-green-300',
    icon: Check,
    iconBg: 'bg-white/30',
    text: 'text-white',
    label: 'Done!',
  },
  in_progress: {
    bg: 'bg-gradient-to-br from-[#FF0099] to-[#7B008B]',
    border: 'border-[#FF0099]',
    icon: Play,
    iconBg: 'bg-white/30',
    text: 'text-white',
    label: 'Continue',
  },
  review: {
    bg: 'bg-gradient-to-br from-amber-400 to-orange-500',
    border: 'border-amber-300',
    icon: RotateCcw,
    iconBg: 'bg-white/30',
    text: 'text-white',
    label: 'Review',
  },
  ready: {
    bg: 'bg-white',
    border: 'border-gray-200',
    icon: Play,
    iconBg: 'bg-[#FF0099]/10',
    text: 'text-gray-800',
    label: 'Start',
  },
  locked: {
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    icon: Lock,
    iconBg: 'bg-gray-200',
    text: 'text-gray-400',
    label: 'Locked',
  },
};

function getUnitStatus(
  progress: UnitProgress | null,
  isUnlocked: boolean,
  isReview?: boolean
): keyof typeof STATUS_CONFIG {
  if (!isUnlocked) return 'locked';
  if (isReview) return 'review';
  if (!progress) return 'ready';
  if (progress.status === 'completed') return 'completed';
  if (progress.status === 'in_progress') return 'in_progress';
  return 'ready';
}

export default function JourneyMap({ units, onSelectUnit }: JourneyMapProps) {
  return (
    <div className="relative">
      {/* Journey path line */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-300 via-[#FF0099]/30 to-gray-200" />
      
      {/* Units */}
      <div className="space-y-4">
        {units.map((item, index) => {
          const status = getUnitStatus(item.progress, item.isUnlocked, item.isReview);
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          const isClickable = status !== 'locked';
          
          return (
            <motion.div
              key={item.unit.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative flex items-start gap-4"
            >
              {/* Node on path */}
              <div className="relative z-10">
                <motion.div
                  className={`
                    w-16 h-16 rounded-2xl flex items-center justify-center
                    border-2 ${config.border} ${config.bg}
                    ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}
                  `}
                  whileHover={isClickable ? { scale: 1.05 } : {}}
                  whileTap={isClickable ? { scale: 0.95 } : {}}
                  onClick={() => isClickable && onSelectUnit(item.unit)}
                >
                  {status === 'completed' ? (
                    <div className="text-center">
                      <Check className="w-6 h-6 text-white mx-auto" />
                      <span className="text-[10px] text-white/80 font-medium">
                        {item.progress?.best_score}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-2xl">{item.unit.icon_emoji || '📚'}</span>
                  )}
                </motion.div>
                
                {/* Progress ring for in-progress */}
                {status === 'in_progress' && item.progress && (
                  <svg
                    className="absolute -inset-1 w-[72px] h-[72px]"
                    viewBox="0 0 72 72"
                  >
                    <circle
                      cx="36"
                      cy="36"
                      r="34"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="2"
                    />
                    <motion.circle
                      cx="36"
                      cy="36"
                      r="34"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 34}`}
                      strokeDashoffset={`${2 * Math.PI * 34 * (1 - item.progress.completion_percentage / 100)}`}
                      transform="rotate(-90 36 36)"
                      initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - item.progress.completion_percentage / 100) }}
                    />
                  </svg>
                )}
              </div>
              
              {/* Content card */}
              <motion.button
                className={`
                  flex-1 rounded-xl p-3 text-left
                  border ${config.border} ${isClickable ? config.bg : 'bg-gray-50'}
                  ${isClickable ? '' : 'opacity-60'}
                `}
                onClick={() => isClickable && onSelectUnit(item.unit)}
                disabled={!isClickable}
                whileHover={isClickable ? { scale: 1.01 } : {}}
                whileTap={isClickable ? { scale: 0.99 } : {}}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className={`font-semibold ${config.text}`}>
                      {item.unit.quest_title || item.unit.name}
                    </h4>
                    <div className={`flex items-center gap-2 mt-1 text-xs ${
                      status === 'locked' ? 'text-gray-400' : 
                      ['completed', 'in_progress', 'review'].includes(status) ? 'text-white/70' : 
                      'text-gray-500'
                    }`}>
                      <span>⚡ {item.unit.total_xp_reward} XP</span>
                      <span>•</span>
                      <span>⏱️ {item.unit.estimated_minutes} min</span>
                    </div>
                  </div>
                  
                  {/* Status badge */}
                  <div className={`
                    px-2.5 py-1 rounded-full text-xs font-medium
                    ${status === 'locked' ? 'bg-gray-200 text-gray-500' :
                      status === 'completed' ? 'bg-white/20 text-white' :
                      status === 'review' ? 'bg-white/20 text-white' :
                      status === 'in_progress' ? 'bg-white/20 text-white' :
                      'bg-[#FF0099] text-white'}
                  `}>
                    <div className="flex items-center gap-1">
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </div>
                  </div>
                </div>
                
                {/* Activity preview */}
                <div className={`flex items-center gap-1 mt-2 ${
                  status === 'locked' ? 'text-gray-300' :
                  ['completed', 'in_progress', 'review'].includes(status) ? 'text-white/60' :
                  'text-gray-400'
                }`}>
                  {item.unit.sequence.map((step, i) => (
                    <span key={i} className="text-sm">
                      {step.type === 'video' ? '🎬' :
                       step.type === 'game' ? '🎮' :
                       step.type === 'quiz' ? '📝' : '🎤'}
                    </span>
                  ))}
                </div>
              </motion.button>
            </motion.div>
          );
        })}
      </div>
      
      {/* Journey end (castle/goal) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: units.length * 0.05 + 0.2 }}
        className="relative flex items-center gap-4 mt-6"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 border-2 border-yellow-300 flex items-center justify-center">
          <span className="text-3xl">🏰</span>
        </div>
        <div className="flex-1 bg-yellow-50 rounded-xl p-3 border border-yellow-200">
          <h4 className="font-semibold text-yellow-800">Master Reader!</h4>
          <p className="text-xs text-yellow-600">Complete all units to become a master</p>
        </div>
      </motion.div>
    </div>
  );
}
