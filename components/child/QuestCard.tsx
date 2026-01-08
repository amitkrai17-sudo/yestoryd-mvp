// components/child/QuestCard.tsx
// SUBTLE VERSION - Premium, clean, educational feel
// Design: White card, soft shadows, brand pink accent only on CTA

'use client';

import { motion } from 'framer-motion';

interface QuestCardProps {
  quest: {
    unit: {
      id: string;
      name: string;
      quest_title?: string;
      quest_description?: string;
      xp_reward?: number;
      coins_reward?: number;
      estimated_minutes?: number;
      world_theme?: string;
      skill?: {
        name: string;
      };
    };
    progress?: {
      status: string;
      current_step: number;
      overall_mastery_percent: number;
    } | null;
    sequence?: Array<{
      type: string;
      id: string;
      name: string;
      status: string;
    }>;
  };
  onStart: () => void;
  isActive?: boolean;
}

// Friendly but calm titles (no excessive emojis)
function getActivityTitle(originalTitle: string, skillName?: string): string {
  const text = (originalTitle + ' ' + (skillName || '')).toLowerCase();
  
  if (text.includes('uppercase') && text.includes('a-m')) return 'Find Letters A-M';
  if (text.includes('uppercase') && text.includes('n-z')) return 'Find Letters N-Z';
  if (text.includes('lowercase')) return 'Lowercase Letters';
  if (text.includes('bl blend') || text.includes('bl ')) return 'BL Sound Practice';
  if (text.includes('blend')) return 'Blend Sounds';
  if (text.includes('th')) return 'TH Sound Practice';
  if (text.includes('sh')) return 'SH Sound Practice';
  if (text.includes('ch')) return 'CH Sound Practice';
  if (text.includes('cvc') && text.includes('short a')) return 'Short A Words';
  if (text.includes('cvc')) return 'Word Building';
  if (text.includes('sight word')) return 'Sight Words';
  if (text.includes('consonant')) return 'Consonant Sounds';
  if (text.includes('ending')) return 'Ending Sounds';
  if (text.includes('beginning')) return 'Beginning Sounds';
  if (text.includes('rhym')) return 'Rhyming Words';
  if (text.includes('letter match')) return 'Letter Matching';
  
  // Clean up the original title
  return originalTitle
    .replace('Quest', '')
    .replace('Adventure', '')
    .replace('The', '')
    .trim() || 'Today\'s Activity';
}

// Simple, clear descriptions
function getActivityDescription(originalDesc: string, title: string): string {
  const text = (originalDesc + ' ' + title).toLowerCase();
  
  if (text.includes('uppercase')) return 'Practice recognizing capital letters';
  if (text.includes('lowercase')) return 'Practice recognizing small letters';
  if (text.includes('blend')) return 'Learn to blend sounds together';
  if (text.includes('th') || text.includes('sh') || text.includes('ch')) 
    return 'Practice this special sound';
  if (text.includes('rhym')) return 'Find words that sound alike';
  if (text.includes('sight word')) return 'Learn important reading words';
  if (text.includes('beginning')) return 'Listen for the first sound';
  if (text.includes('ending')) return 'Listen for the last sound';
  
  return 'A fun learning activity for you';
}

export default function QuestCard({ quest, onStart, isActive = true }: QuestCardProps) {
  if (!quest || !quest.unit) {
    return null;
  }

  const progress = quest.progress;
  const sequence = quest.sequence || [];
  const currentStep = progress?.current_step || 0;
  const totalSteps = sequence.length || 3;
  const progressPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  const displayTitle = getActivityTitle(
    quest.unit.quest_title || quest.unit.name || 'Activity', 
    quest.unit.skill?.name
  );
  const displayDescription = getActivityDescription(
    quest.unit.quest_description || '', 
    displayTitle
  );

  const xpReward = quest.unit.xp_reward || 50;
  const estimatedMinutes = quest.unit.estimated_minutes || 10;

  return (
    <motion.div
      className={`bg-white rounded-2xl overflow-hidden transition-all duration-300 ${
        isActive 
          ? 'shadow-lg border-2 border-[#FF0099]/20' 
          : 'shadow-md border border-gray-100 opacity-60'
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={isActive ? { y: -2, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' } : {}}
      transition={{ duration: 0.2 }}
    >
      {/* Top Accent Bar - Brand color */}
      <div className={`h-1 ${isActive ? 'bg-[#FF0099]' : 'bg-gray-200'}`} />

      {/* Main Content */}
      <div className="p-5">
        {/* Header Row */}
        <div className="flex items-start gap-4 mb-4">
          {/* Icon Container - Subtle */}
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
            isActive 
              ? 'bg-[#FF0099]/10' 
              : 'bg-gray-100'
          }`}>
            <span className="text-3xl">📚</span>
          </div>
          
          {/* Title & Description */}
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold text-xl mb-1 ${
              isActive ? 'text-gray-900' : 'text-gray-400'
            }`}>
              {displayTitle}
            </h3>
            <p className={`text-sm leading-relaxed ${
              isActive ? 'text-gray-500' : 'text-gray-400'
            }`}>
              {displayDescription}
            </p>
          </div>
        </div>

        {/* Progress Steps - Clean dots */}
        {sequence.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              {sequence.map((step, index) => (
                <div key={step.id || index} className="flex items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step.status === 'completed'
                        ? 'bg-green-500 text-white'
                        : step.status === 'ready' && isActive
                        ? 'bg-[#FF0099] text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {step.status === 'completed' ? '✓' : index + 1}
                  </div>
                  {index < sequence.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${
                      step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-gray-400">
              {sequence.map((step, index) => (
                <span key={`label-${step.id || index}`} className="text-center flex-1">
                  {step.type === 'game' ? 'Practice' : step.type === 'video' ? 'Learn' : 'Complete'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Simple progress bar if no sequence */}
        {sequence.length === 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Progress</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#FF0099] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Meta Info Row */}
        <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <span>⏱</span> {estimatedMinutes} min
          </span>
          <span className="flex items-center gap-1">
            <span>⭐</span> +{xpReward} points
          </span>
        </div>

        {/* CTA Button - Clean, brand color */}
        <motion.button
          onClick={onStart}
          disabled={!isActive}
          className={`w-full py-3.5 rounded-xl font-semibold text-lg transition-all ${
            isActive 
              ? 'bg-[#FF0099] text-white hover:bg-[#E6008A] active:scale-[0.98]' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          whileTap={isActive ? { scale: 0.98 } : {}}
        >
          {progress?.status === 'in_progress' ? 'Continue' : 'Start Activity'}
        </motion.button>
      </div>
    </motion.div>
  );
}

