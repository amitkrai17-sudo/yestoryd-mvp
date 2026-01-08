// components/child/MoreQuests.tsx
// SUBTLE VERSION - Clean, minimal upcoming activities list

'use client';

import { motion } from 'framer-motion';

interface Quest {
  unit: {
    id: string;
    name: string;
    quest_title?: string;
    quest_description?: string;
    xp_reward?: number;
    estimated_minutes?: number;
    skill?: {
      name: string;
    };
  };
  progress?: any;
  sequence?: any[];
}

interface MoreQuestsProps {
  quests: Quest[];
  onSelect: (unitId: string) => void;
}

function getSimpleTitle(title: string): string {
  return title
    .replace('Quest', '')
    .replace('Adventure', '')
    .replace('The', '')
    .replace('!', '')
    .trim() || 'Activity';
}

export default function MoreQuests({ quests, onSelect }: MoreQuestsProps) {
  if (!quests || quests.length === 0) return null;

  return (
    <div className="space-y-3">
      {quests.filter(q => q && q.unit).map((quest, index) => (
        <motion.button
          key={quest.unit.id}
          onClick={() => onSelect(quest.unit.id)}
          className="w-full bg-white rounded-xl p-4 shadow-sm text-left hover:shadow-md transition-shadow flex items-center gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.99 }}
        >
          {/* Icon */}
          <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-2xl opacity-50">📚</span>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-700 truncate">
              {getSimpleTitle(quest.unit.quest_title || quest.unit.name)}
            </h4>
            <p className="text-sm text-gray-400 flex items-center gap-2 mt-0.5">
              <span>⏱ {quest.unit.estimated_minutes || 10} min</span>
              <span>•</span>
              <span>⭐ +{quest.unit.xp_reward || 50}</span>
            </p>
          </div>
          
          {/* Arrow */}
          <div className="text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
