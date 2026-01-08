// =============================================================================
// DAILY GOAL CARD COMPONENT
// Shows progress towards daily goal with treasure chest reward
// Habit formation through clear goals
// =============================================================================

'use client';

import { motion } from 'framer-motion';
import { Gift, Check, Sparkles } from 'lucide-react';

interface DailyGoalCardProps {
  target: number;
  completed: number;
  isAchieved: boolean;
  xpBonus: number;
}

export default function DailyGoalCard({
  target,
  completed,
  isAchieved,
  xpBonus,
}: DailyGoalCardProps) {
  const progressPercent = Math.min((completed / target) * 100, 100);
  const remaining = Math.max(target - completed, 0);
  
  return (
    <motion.div
      className={`rounded-2xl p-4 ${
        isAchieved 
          ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200' 
          : 'bg-white shadow-sm'
      }`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <h3 className="font-semibold text-gray-800">Today's Goal</h3>
        </div>
        
        {isAchieved ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1 bg-green-100 px-2.5 py-1 rounded-full"
          >
            <Check className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs font-medium text-green-700">Complete!</span>
          </motion.div>
        ) : (
          <span className="text-sm text-gray-400">
            {remaining} more to go
          </span>
        )}
      </div>
      
      {/* Progress visualization */}
      <div className="flex items-center gap-2 mb-3">
        {[...Array(target)].map((_, i) => (
          <motion.div
            key={i}
            className={`flex-1 h-3 rounded-full ${
              i < completed 
                ? 'bg-gradient-to-r from-[#FF0099] to-[#FF6B6B]' 
                : 'bg-gray-100'
            }`}
            initial={i < completed ? { scale: 0 } : {}}
            animate={i < completed ? { scale: 1 } : {}}
            transition={{ delay: i * 0.1 }}
          />
        ))}
      </div>
      
      {/* Reward preview */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Complete {target} activities to unlock:
        </p>
        
        <motion.div
          className="flex items-center gap-2"
          animate={isAchieved ? {} : { 
            scale: [1, 1.05, 1],
          }}
          transition={{ 
            duration: 2, 
            repeat: isAchieved ? 0 : Infinity,
          }}
        >
          {/* Treasure chest */}
          <motion.div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isAchieved 
                ? 'bg-yellow-400' 
                : 'bg-gray-100'
            }`}
            animate={isAchieved ? {
              rotateY: [0, 180, 360],
            } : {}}
            transition={{ duration: 1 }}
          >
            <span className="text-xl">
              {isAchieved ? '🏆' : '🎁'}
            </span>
          </motion.div>
          
          {/* XP bonus */}
          <div className={`text-right ${isAchieved ? 'text-yellow-700' : 'text-gray-400'}`}>
            <div className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-bold">+{xpBonus} XP</span>
            </div>
            <span className="text-xs">Bonus</span>
          </div>
        </motion.div>
      </div>
      
      {/* Achievement celebration */}
      {isAchieved && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 pt-3 border-t border-yellow-200"
        >
          <div className="flex items-center justify-center gap-2 text-yellow-700">
            <motion.span
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 0.5, repeat: 3 }}
            >
              🎉
            </motion.span>
            <span className="font-medium">Amazing work today!</span>
            <motion.span
              animate={{ rotate: [0, -15, 15, 0] }}
              transition={{ duration: 0.5, repeat: 3 }}
            >
              🎉
            </motion.span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
