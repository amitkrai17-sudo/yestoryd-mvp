// components/child/AvatarSelector.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AvatarSelectorProps {
  childId: string;
  childName: string;
  onComplete: (avatar: any) => void;
}

const AVATAR_TYPES = [
  { id: 'fox', name: 'Fox', emoji: '🦊', description: 'Clever and curious' },
  { id: 'bunny', name: 'Bunny', emoji: '🐰', description: 'Quick and friendly' },
  { id: 'bear', name: 'Bear', emoji: '🐻', description: 'Strong and brave' },
  { id: 'lion', name: 'Lion', emoji: '🦁', description: 'Bold and proud' },
  { id: 'cat', name: 'Cat', emoji: '🐱', description: 'Smart and playful' },
  { id: 'owl', name: 'Owl', emoji: '🦉', description: 'Wise and thoughtful' },
  { id: 'panda', name: 'Panda', emoji: '🐼', description: 'Gentle and kind' },
  { id: 'butterfly', name: 'Butterfly', emoji: '🦋', description: 'Free and beautiful' },
];

const AVATAR_COLORS = [
  { id: 'pink', name: 'Pink', hex: '#FF0099' },
  { id: 'blue', name: 'Blue', hex: '#00ABFF' },
  { id: 'yellow', name: 'Yellow', hex: '#FFDE00' },
  { id: 'purple', name: 'Purple', hex: '#7B008B' },
  { id: 'green', name: 'Green', hex: '#22C55E' },
  { id: 'orange', name: 'Orange', hex: '#F97316' },
  { id: 'red', name: 'Red', hex: '#EF4444' },
];

export default function AvatarSelector({ childId, childName, onComplete }: AvatarSelectorProps) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('pink');
  const [avatarName, setAvatarName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/elearning/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          avatarType: selectedType,
          avatarColor: selectedColor,
          avatarName: avatarName || null
        })
      });

      const result = await response.json();
      if (result.success) {
        onComplete(result.data.avatar);
      }
    } catch (error) {
      console.error('Avatar save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const selectedTypeInfo = AVATAR_TYPES.find(t => t.id === selectedType);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF0099] to-[#7B008B] p-6 text-center text-white">
          <motion.div 
            className="text-5xl mb-2"
            animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 0.6 }}
          >
            {step === 1 ? '🎨' : step === 2 ? '🌈' : '✨'}
          </motion.div>
          <h2 className="text-2xl font-black">
            {step === 1 ? 'Choose Your Buddy!' : 
             step === 2 ? 'Pick a Color!' : 
             'Name Your Friend!'}
          </h2>
          <p className="text-white/80 mt-1 text-sm">
            {step === 1 ? `Hi ${childName}! Who will join your adventure?` :
             step === 2 ? 'What\'s their favorite color?' :
             'What should we call them?'}
          </p>
          
          {/* Step indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  s === step ? 'bg-[#FFDE00] w-8' : s < step ? 'bg-white w-2' : 'bg-white/40 w-2'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Choose Type */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-4 gap-3"
              >
                {AVATAR_TYPES.map((type) => (
                  <motion.button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-3 rounded-xl flex flex-col items-center transition-all ${
                      selectedType === type.id
                        ? 'bg-gradient-to-br from-[#FF0099]/20 to-[#7B008B]/20 ring-2 ring-[#FF0099] scale-110'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    whileHover={{ scale: selectedType === type.id ? 1.1 : 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.span 
                      className="text-3xl mb-1"
                      animate={selectedType === type.id ? { y: [0, -5, 0] } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      {type.emoji}
                    </motion.span>
                    <span className="text-xs font-bold text-gray-700">{type.name}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* Step 2: Choose Color */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <motion.div 
                  className="flex justify-center mb-6"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div 
                    className="w-28 h-28 rounded-full flex items-center justify-center text-6xl shadow-xl border-4 border-white"
                    style={{ backgroundColor: AVATAR_COLORS.find(c => c.id === selectedColor)?.hex + '30' }}
                  >
                    {selectedTypeInfo?.emoji}
                  </div>
                </motion.div>
                <div className="flex justify-center gap-3 flex-wrap">
                  {AVATAR_COLORS.map((color) => (
                    <motion.button
                      key={color.id}
                      onClick={() => setSelectedColor(color.id)}
                      className={`w-12 h-12 rounded-full transition-all shadow-lg ${
                        selectedColor === color.id
                          ? 'ring-4 ring-offset-2 ring-gray-400 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      whileHover={{ scale: selectedColor === color.id ? 1.1 : 1.05 }}
                      whileTap={{ scale: 0.9 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: Name */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center"
              >
                <motion.div 
                  className="w-28 h-28 rounded-full flex items-center justify-center text-6xl shadow-xl mx-auto mb-4 border-4 border-white"
                  style={{ backgroundColor: AVATAR_COLORS.find(c => c.id === selectedColor)?.hex + '30' }}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {selectedTypeInfo?.emoji}
                </motion.div>
                <input
                  type="text"
                  value={avatarName}
                  onChange={(e) => setAvatarName(e.target.value)}
                  placeholder={`My ${selectedTypeInfo?.name}'s name...`}
                  className="w-full px-4 py-3 border-2 border-[#FF0099]/30 rounded-xl text-center text-lg font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#FF0099] focus:ring-2 focus:ring-[#FF0099]/20 bg-white"
                  maxLength={20}
                  autoFocus
                />
                <p className="text-gray-400 text-sm mt-2">
                  (You can skip this!)
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
          )}
          
          <motion.button
            onClick={() => {
              if (step < 3) {
                setStep(step + 1);
              } else {
                handleSave();
              }
            }}
            disabled={(step === 1 && !selectedType) || saving}
            className={`flex-1 py-3 rounded-xl font-black text-white transition-all ${
              (step === 1 && !selectedType) || saving
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#FF0099] to-[#7B008B] hover:opacity-90 shadow-lg'
            }`}
            whileHover={(step === 1 && !selectedType) || saving ? {} : { scale: 1.02 }}
            whileTap={(step === 1 && !selectedType) || saving ? {} : { scale: 0.98 }}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  ⏳
                </motion.span>
                Creating...
              </span>
            ) : step === 3 ? (
              '✨ LET\'S GO!'
            ) : (
              'Next →'
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
