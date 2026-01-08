// components/celebrations/Confetti.tsx
// Enhanced confetti with sound effect

'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface ConfettiProps {
  duration?: number;
  particleCount?: number;
  playSound?: boolean;
}

// Colors matching Yestoryd brand
const COLORS = ['#FF0099', '#FFDE00', '#00ABFF', '#7B008B', '#22C55E', '#FF6B35'];
const SHAPES = ['●', '■', '▲', '★', '♦'];

export default function Confetti({ 
  duration = 3000, 
  particleCount = 50,
  playSound = true 
}: ConfettiProps) {
  
  useEffect(() => {
    // Play celebration sound
    if (playSound && typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        const ctx = new AudioContext();
        const frequencies = [523, 659, 784, 1047, 1319]; // Victory fanfare
        
        frequencies.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.frequency.value = freq;
          osc.type = 'sine';
          
          const start = ctx.currentTime + i * 0.12;
          gain.gain.setValueAtTime(0.15, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
          
          osc.start(start);
          osc.stop(start + 0.35);
        });
      } catch (e) {
        // Audio not supported
      }
    }
  }, [playSound]);

  const particles = Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    delay: Math.random() * 0.5,
    size: 8 + Math.random() * 12,
    rotation: Math.random() * 360,
    duration: 2 + Math.random() * 1
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: -20,
            color: particle.color,
            fontSize: particle.size,
          }}
          initial={{ 
            y: -20,
            x: 0,
            rotate: 0,
            opacity: 1
          }}
          animate={{ 
            y: window?.innerHeight + 50 || 800,
            x: (Math.random() - 0.5) * 200,
            rotate: particle.rotation + 720,
            opacity: [1, 1, 0]
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
        >
          {particle.shape}
        </motion.div>
      ))}
    </div>
  );
}
