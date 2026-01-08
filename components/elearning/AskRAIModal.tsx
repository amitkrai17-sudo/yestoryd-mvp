// =============================================================================
// ASK RAI MODAL
// Kid-friendly topic selector for learning override
// Beautiful UI with quick picks and custom input
// =============================================================================

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Search, ArrowRight } from 'lucide-react';
import { playSound } from '@/lib/sounds';

interface AskRAIModalProps {
  onSelect: (topic: string) => void;
  onClose: () => void;
}

const QUICK_PICKS = [
  { 
    id: 'phonics', 
    label: 'Phonics', 
    emoji: '🔤', 
    description: 'Letter sounds',
    gradient: 'from-pink-400 to-rose-500',
  },
  { 
    id: 'sight-words', 
    label: 'Sight Words', 
    emoji: '👁️', 
    description: 'Common words',
    gradient: 'from-purple-400 to-indigo-500',
  },
  { 
    id: 'blends', 
    label: 'Blends', 
    emoji: '🔠', 
    description: 'bl, cl, fl...',
    gradient: 'from-blue-400 to-cyan-500',
  },
  { 
    id: 'digraphs', 
    label: 'Digraphs', 
    emoji: '✨', 
    description: 'th, sh, ch...',
    gradient: 'from-teal-400 to-emerald-500',
  },
  { 
    id: 'vowels', 
    label: 'Vowels', 
    emoji: '🎵', 
    description: 'a, e, i, o, u',
    gradient: 'from-orange-400 to-amber-500',
  },
  { 
    id: 'stories', 
    label: 'Stories', 
    emoji: '📖', 
    description: 'Reading practice',
    gradient: 'from-red-400 to-pink-500',
  },
];

export default function AskRAIModal({ onSelect, onClose }: AskRAIModalProps) {
  const [customInput, setCustomInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSelect = async (topic: string) => {
    playSound('success');
    setIsLoading(true);
    
    // Small delay for feedback
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onSelect(topic);
  };
  
  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      handleSelect(customInput.trim());
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <h2 className="font-bold text-lg">Ask rAI</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-white/80 text-sm">
            What would you like to practice today?
          </p>
        </div>
        
        {/* Quick picks */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          <p className="text-sm text-gray-500 mb-3">Quick picks:</p>
          
          <div className="grid grid-cols-2 gap-3">
            {QUICK_PICKS.map((pick) => (
              <motion.button
                key={pick.id}
                onClick={() => handleSelect(pick.id)}
                disabled={isLoading}
                className={`
                  relative overflow-hidden rounded-2xl p-4 text-left
                  bg-gradient-to-br ${pick.gradient}
                  text-white shadow-lg
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                
                <span className="text-2xl mb-2 block">{pick.emoji}</span>
                <span className="font-semibold block">{pick.label}</span>
                <span className="text-xs text-white/70">{pick.description}</span>
              </motion.button>
            ))}
          </div>
          
          {/* Custom input */}
          <div className="mt-5">
            <p className="text-sm text-gray-500 mb-2">Or tell rAI what you want:</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                  placeholder="e.g., magic e words"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#FF0099] focus:ring-2 focus:ring-[#FF0099]/20 outline-none text-gray-800"
                  disabled={isLoading}
                />
              </div>
              <motion.button
                onClick={handleCustomSubmit}
                disabled={!customInput.trim() || isLoading}
                className={`
                  px-4 rounded-xl flex items-center justify-center
                  ${customInput.trim() && !isLoading
                    ? 'bg-[#FF0099] text-white'
                    : 'bg-gray-100 text-gray-400'
                  }
                `}
                whileHover={customInput.trim() ? { scale: 1.05 } : {}}
                whileTap={customInput.trim() ? { scale: 0.95 } : {}}
              >
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            rAI will find the best activities for you ✨
          </p>
        </div>
        
        {/* Loading overlay */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-white/90 flex items-center justify-center"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 border-3 border-[#FF0099]/20 border-t-[#FF0099] rounded-full mx-auto mb-3"
              />
              <p className="text-gray-600">rAI is finding activities...</p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
