// components/child/MascotGuide.tsx
// Specialist Version: Implements scaffolding, pointing behavior, emotional mirroring

'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface MascotGuideProps {
  message: string;
  mood?: 'happy' | 'excited' | 'thinking' | 'celebrating' | 'encouraging' | 'pointing';
  showTip?: boolean;
  isPointing?: boolean; // New: directs attention to CTA
  speakMessage?: boolean; // New: use TTS for pre-readers
}

export default function MascotGuide({ 
  message, 
  mood = 'happy', 
  showTip = false,
  isPointing = false,
  speakMessage = false
}: MascotGuideProps) {
  const hasSpoken = useRef(false);

  // Text-to-Speech for pre-literate children
  useEffect(() => {
    if (speakMessage && message && !hasSpoken.current) {
      if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.85; // Slower for kids
        utterance.pitch = 1.3; // Higher pitch = friendlier
        utterance.volume = 0.8;
        
        // Try to use a friendly voice
        const voices = speechSynthesis.getVoices();
        const friendlyVoice = voices.find(v => 
          v.name.includes('Samantha') || 
          v.name.includes('Karen') ||
          v.name.includes('Female') ||
          v.lang.startsWith('en')
        );
        if (friendlyVoice) {
          utterance.voice = friendlyVoice;
        }
        
        speechSynthesis.speak(utterance);
        hasSpoken.current = true;
      }
    }
  }, [message, speakMessage]);

  // Reset speech flag when message changes
  useEffect(() => {
    hasSpoken.current = false;
  }, [message]);

  const getMascotExpression = () => {
    switch (mood) {
      case 'excited': return '🤩';
      case 'thinking': return '🤔';
      case 'celebrating': return '🥳';
      case 'encouraging': return '🤗';
      case 'pointing': return '👉';
      default: return '🦊';
    }
  };

  const getMascotAnimation = () => {
    switch (mood) {
      case 'excited':
        return { 
          rotate: [-5, 5, -5],
          y: [0, -8, 0],
          scale: [1, 1.1, 1]
        };
      case 'celebrating':
        return {
          rotate: [-10, 10, -10],
          y: [0, -15, 0],
          scale: [1, 1.15, 1]
        };
      case 'pointing':
        return {
          x: [0, 10, 0],
          rotate: [0, 5, 0]
        };
      case 'encouraging':
        return {
          scale: [1, 1.05, 1],
          y: [0, -3, 0]
        };
      default:
        return {
          y: [0, -3, 0]
        };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-4 shadow-lg border-2 border-[#FF0099]/20 relative"
    >
      <div className="flex items-start gap-3">
        {/* Mascot */}
        <motion.div
          className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-full flex items-center justify-center text-4xl shadow-lg"
          animate={getMascotAnimation()}
          transition={{ 
            duration: mood === 'pointing' ? 0.8 : 0.6, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {getMascotExpression()}
        </motion.div>

        {/* Speech Bubble */}
        <div className="flex-1 relative">
          {/* Bubble pointer */}
          <div className="absolute -left-2 top-3 w-3 h-3 bg-gradient-to-br from-[#00ABFF]/20 to-[#FF0099]/20 border-l-2 border-b-2 border-[#FF0099]/20 transform rotate-45" />
          
          <div className="bg-gradient-to-r from-[#00ABFF]/10 to-[#FF0099]/10 rounded-xl px-4 py-3 ml-1 border border-[#FF0099]/10">
            {/* Audio button for accessibility */}
            <div className="flex items-start gap-2">
              <p className="text-gray-800 font-medium leading-relaxed flex-1 text-lg">
                {message}
              </p>
              
              {/* Speaker button for pre-readers */}
              <motion.button
                onClick={() => {
                  if ('speechSynthesis' in window) {
                    speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(message);
                    utterance.rate = 0.85;
                    utterance.pitch = 1.3;
                    speechSynthesis.speak(utterance);
                  }
                }}
                className="flex-shrink-0 w-8 h-8 bg-[#FFDE00] rounded-full flex items-center justify-center shadow-md"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title="Listen"
              >
                <span className="text-lg">🔊</span>
              </motion.button>
            </div>

            {showTip && (
              <motion.p 
                className="text-sm text-[#7B008B] mt-2 flex items-center gap-1 font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <span>💡</span> Tap to start!
              </motion.p>
            )}
          </div>
        </div>
      </div>

      {/* Pointing Arrow Animation */}
      {isPointing && (
        <motion.div
          className="absolute -bottom-8 left-1/2 transform -translate-x-1/2"
          animate={{ 
            y: [0, 10, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 0.8, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <div className="flex flex-col items-center">
            <span className="text-4xl">👇</span>
            <span className="text-xs font-bold text-[#FF0099] bg-white px-2 py-1 rounded-full shadow-md">
              Tap here!
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
