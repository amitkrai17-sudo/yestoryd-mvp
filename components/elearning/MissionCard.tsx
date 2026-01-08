// =============================================================================
// MISSION CARD COMPONENT
// The ONE clear action for the child - reduces decision paralysis
// Premium design with audio support and visual appeal
// =============================================================================

'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Clock, Zap, Sparkles } from 'lucide-react';
import type { Unit } from '@/types/elearning';

interface MissionCardProps {
  unit: Unit;
  reason: string;
  source: string;
  onStart: () => void;
  audioEnabled?: boolean;
}

export default function MissionCard({
  unit,
  reason,
  source,
  onStart,
  audioEnabled = true,
}: MissionCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Auto-play instruction for young kids
  useEffect(() => {
    if (audioEnabled && 'speechSynthesis' in window) {
      const timer = setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(
          `Your mission today is ${unit.quest_title || unit.name}. Tap the green button to start!`
        );
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        speechSynthesis.speak(utterance);
      }, 1000);
      
      return () => {
        clearTimeout(timer);
        speechSynthesis.cancel();
      };
    }
  }, [unit, audioEnabled]);
  
  // Get activity icons based on sequence
  const getActivityIcons = () => {
    const icons: string[] = [];
    unit.sequence.forEach(item => {
      if (item.type === 'video' && !icons.includes('🎬')) icons.push('🎬');
      if (item.type === 'game' && !icons.includes('🎮')) icons.push('🎮');
      if (item.type === 'quiz' && !icons.includes('📝')) icons.push('📝');
      if (item.type === 'voice-practice' && !icons.includes('🎤')) icons.push('🎤');
    });
    return icons;
  };
  
  const activityIcons = getActivityIcons();
  
  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF0099] to-[#7B008B] p-1"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
    >
      {/* Animated background sparkles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full"
            style={{
              left: `${20 + i * 15}%`,
              top: `${10 + (i % 3) * 30}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 2 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </div>
      
      <div className="relative bg-white rounded-[22px] p-5">
        {/* rAI Badge */}
        <div className="absolute top-4 right-4">
          <div className="bg-[#FF0099]/10 px-2.5 py-1 rounded-full">
            <p className="text-[10px] font-medium text-[#FF0099] flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              rAI picked
            </p>
          </div>
        </div>
        
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF0099] to-[#7B008B] flex items-center justify-center mb-4 shadow-lg shadow-[#FF0099]/30">
          <span className="text-3xl">{unit.icon_emoji || '🎯'}</span>
        </div>
        
        {/* Title */}
        <h3 className="text-xl font-bold text-gray-800 mb-1">
          {unit.quest_title || unit.name}
        </h3>
        
        {/* Reason from rAI */}
        <p className="text-sm text-gray-500 mb-4">
          {reason}
        </p>
        
        {/* Stats row */}
        <div className="flex items-center gap-4 mb-5">
          {/* XP */}
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-yellow-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-yellow-600" />
            </div>
            <span className="font-semibold text-gray-700">{unit.total_xp_reward} XP</span>
          </div>
          
          {/* Time */}
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-gray-500">{unit.estimated_minutes} min</span>
          </div>
          
          {/* Activities */}
          <div className="flex items-center gap-1">
            {activityIcons.map((icon, i) => (
              <span key={i} className="text-lg">{icon}</span>
            ))}
          </div>
        </div>
        
        {/* Start button - BIG and clear */}
        <motion.button
          onClick={onStart}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg shadow-green-500/30"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          animate={{
            boxShadow: [
              '0 10px 20px rgba(34, 197, 94, 0.3)',
              '0 10px 30px rgba(34, 197, 94, 0.5)',
              '0 10px 20px rgba(34, 197, 94, 0.3)',
            ],
          }}
          transition={{
            boxShadow: {
              duration: 2,
              repeat: Infinity,
            },
          }}
        >
          <Play className="w-6 h-6" fill="white" />
          Start Adventure
        </motion.button>
        
        {/* Source (subtle) */}
        <p className="text-[10px] text-gray-400 text-center mt-3">
          Based on: {source}
        </p>
      </div>
    </motion.div>
  );
}
