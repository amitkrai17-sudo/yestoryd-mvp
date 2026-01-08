// components/child/LoadingSpinner.tsx
// Specialist Version: Gamified waiting - part of the experience, not dead time

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingSpinnerProps {
  message?: string;
}

// Fun loading messages that rotate
const LOADING_SCENES = [
  { emoji: '🎒', text: 'Packing your backpack...' },
  { emoji: '🗺️', text: 'Finding the map...' },
  { emoji: '🔦', text: 'Getting the flashlight...' },
  { emoji: '🧭', text: 'Checking the compass...' },
  { emoji: '🍎', text: 'Grabbing a snack...' },
];

// Items that "fly" into the backpack
const FLYING_ITEMS = ['📚', '✏️', '🎨', '⭐', '🏆', '💎'];

export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [flyingItems, setFlyingItems] = useState<string[]>([]);

  // Rotate through scenes
  useEffect(() => {
    const timer = setInterval(() => {
      setSceneIndex(prev => (prev + 1) % LOADING_SCENES.length);
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  // Spawn flying items
  useEffect(() => {
    const spawnItem = () => {
      const item = FLYING_ITEMS[Math.floor(Math.random() * FLYING_ITEMS.length)];
      setFlyingItems(prev => [...prev, item]);
      
      // Remove item after animation
      setTimeout(() => {
        setFlyingItems(prev => prev.slice(1));
      }, 1000);
    };

    const timer = setInterval(spawnItem, 500);
    return () => clearInterval(timer);
  }, []);

  const currentScene = LOADING_SCENES[sceneIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#00ABFF]/20 via-[#FFDE00]/10 to-[#FF0099]/20 flex flex-col items-center justify-center overflow-hidden relative">
      {/* Background stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl opacity-30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.2, 0.5, 0.2],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          >
            ⭐
          </motion.div>
        ))}
      </div>

      {/* Main character with backpack */}
      <div className="relative mb-8">
        {/* Flying items going into backpack */}
        <AnimatePresence>
          {flyingItems.map((item, i) => (
            <motion.div
              key={`${item}-${i}-${Date.now()}`}
              className="absolute text-3xl"
              initial={{ 
                x: (Math.random() - 0.5) * 200, 
                y: -100,
                opacity: 1,
                scale: 1
              }}
              animate={{ 
                x: 0, 
                y: 0,
                opacity: 0,
                scale: 0.3
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeIn" }}
            >
              {item}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Mascot */}
        <motion.div
          className="relative w-32 h-32 bg-gradient-to-br from-[#FF0099] to-[#7B008B] rounded-full flex items-center justify-center shadow-2xl"
          animate={{
            y: [0, -10, 0],
            rotate: [0, -5, 5, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Glow effect */}
          <motion.div
            className="absolute inset-0 bg-[#FF0099] rounded-full blur-xl"
            animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          
          {/* Face */}
          <span className="text-6xl relative z-10">🦊</span>
          
          {/* Backpack on side */}
          <motion.div
            className="absolute -right-4 top-1/2 transform -translate-y-1/2 text-4xl"
            animate={{ rotate: [0, 10, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            🎒
          </motion.div>
        </motion.div>
      </div>

      {/* Current activity */}
      <motion.div
        key={sceneIndex}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="text-center"
      >
        <motion.div
          className="text-5xl mb-4"
          animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 0.5 }}
        >
          {currentScene.emoji}
        </motion.div>
        
        <p className="text-[#7B008B] font-bold text-xl">
          {message || currentScene.text}
        </p>
      </motion.div>

      {/* Progress dots */}
      <div className="flex gap-3 mt-8">
        {LOADING_SCENES.map((_, i) => (
          <motion.div
            key={i}
            className={`w-3 h-3 rounded-full ${
              i === sceneIndex ? 'bg-[#FF0099]' : 'bg-[#FF0099]/30'
            }`}
            animate={i === sceneIndex ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.5 }}
          />
        ))}
      </div>

      {/* Fun fact at bottom */}
      <motion.div
        className="absolute bottom-8 left-4 right-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <div className="bg-white/80 backdrop-blur rounded-xl px-4 py-3 shadow-lg inline-block">
          <span className="text-lg mr-2">💡</span>
          <span className="text-gray-600 text-sm">
            Did you know? Your brain grows when you learn new things!
          </span>
        </div>
      </motion.div>
    </div>
  );
}
