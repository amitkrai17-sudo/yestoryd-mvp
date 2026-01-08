// components/child/AskRAIModal.tsx
// Kid-friendly "Ask rAI" modal with quick topic picks
// Simplified version of the parent page modal

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface AskRAIModalProps {
  onSelect: (topic: string) => void;
  onClose: () => void;
}

const QUICK_PICKS = [
  { id: 'phonics', icon: '🔊', label: 'Phonics', description: 'Letter sounds', color: 'from-purple-400 to-purple-500' },
  { id: 'sight-words', icon: '👀', label: 'Sight Words', description: 'Common words', color: 'from-blue-400 to-blue-500' },
  { id: 'blends', icon: '🔗', label: 'Blends', description: 'bl, cr, st...', color: 'from-green-400 to-green-500' },
  { id: 'digraphs', icon: '🎵', label: 'Digraphs', description: 'th, sh, ch...', color: 'from-orange-400 to-orange-500' },
  { id: 'vowels', icon: '🅰️', label: 'Vowels', description: 'Short & long', color: 'from-pink-400 to-pink-500' },
  { id: 'stories', icon: '📖', label: 'Stories', description: 'Fun reading', color: 'from-teal-400 to-teal-500' },
];

export default function AskRAIModal({ onSelect, onClose }: AskRAIModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (topicId: string) => {
    setSelected(topicId);
    // Small delay for visual feedback
    setTimeout(() => {
      onSelect(topicId);
    }, 300);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-xl">✨</span>
              </div>
              <div>
                <h2 className="font-bold text-lg">Ask rAI</h2>
                <p className="text-white/80 text-sm">What do you want to learn?</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
            <span>✨</span>
            Quick picks
          </p>

          {/* Topic Grid */}
          <div className="grid grid-cols-2 gap-3">
            {QUICK_PICKS.map((topic) => (
              <motion.button
                key={topic.id}
                onClick={() => handleSelect(topic.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  selected === topic.id
                    ? 'border-[#FF0099] bg-[#FF0099]/5'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${topic.color} flex items-center justify-center mb-2`}>
                  <span className="text-xl">{topic.icon}</span>
                </div>
                <h3 className="font-medium text-gray-800">{topic.label}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{topic.description}</p>
              </motion.button>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
              <span className="text-[#FF0099]">✨</span>
              rAI will find the best activities for you
            </p>
          </div>
        </div>

        {/* Cancel Button */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2 text-gray-400 text-sm font-medium hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
