// components/child/TodaysFocus.tsx
// Today's Focus card with rAI Intelligence branding

'use client';

import { motion } from 'framer-motion';

interface TodaysFocusProps {
  quest: {
    unit: {
      id: string;
      name: string;
      quest_title?: string;
      skill?: { name: string };
    };
    progress?: {
      status: string;
    };
  };
  onStart: () => void;
}

export default function TodaysFocus({ quest, onStart }: TodaysFocusProps) {
  const isInProgress = quest.progress?.status === 'in_progress';
  const skillName = quest.unit?.skill?.name || 'Reading Practice';

  return (
    <motion.div
      className="bg-white rounded-xl p-4 shadow-sm"
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Green Icon */}
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl">🎯</span>
          </div>
          
          {/* Content */}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Today's Focus</p>
            <h3 className="font-semibold text-gray-800">{skillName}</h3>
            <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
              <span>💡</span>
              {isInProgress ? 'Continue practicing' : 'Start practicing'}
            </p>
          </div>
        </div>

        {/* rAI Badge */}
        <div className="text-right">
          <p className="text-[10px] text-gray-400">Based on</p>
          <p className="text-xs font-medium text-[#FF0099]">rAI Intelligence</p>
        </div>
      </div>

      {/* Start Button */}
      <motion.button
        onClick={onStart}
        className="w-full mt-4 bg-green-500 text-white py-3 rounded-xl font-medium text-sm hover:bg-green-600 transition-colors"
        whileTap={{ scale: 0.98 }}
      >
        {isInProgress ? 'Continue Learning' : 'Start Learning'}
      </motion.button>
    </motion.div>
  );
}
