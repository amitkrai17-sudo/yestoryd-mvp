// =============================================================================
// PHONICS POP GAME ENGINE
// Pop bubbles with the correct sound
// Fun arcade-style game with animations
// =============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Volume2, VolumeX } from 'lucide-react';
import { playSound, playHaptic, speak } from '@/lib/sounds';
import type { BaseGameProps, GameResult, WordItem, PhonicsPopConfig } from '@/types/elearning';

interface Bubble {
  id: string;
  word: string;
  isTarget: boolean;
  x: number;
  y: number;
  speed: number;
  popped: boolean;
}

interface PhonicsPopGameProps extends BaseGameProps {
  config?: PhonicsPopConfig;
}

export default function PhonicsPopGame({
  contentPool,
  config = {},
  onComplete,
  onQuit,
  childAge = 7,
  audioEnabled = true,
}: PhonicsPopGameProps) {
  // Config with defaults
  const bubblesPerRound = config.bubbles_per_round || 10;
  const speed = config.speed || 'medium';
  const initialLives = config.lives || 3;
  
  // Speed multiplier
  const speedMultiplier = speed === 'slow' ? 0.5 : speed === 'fast' ? 1.5 : 1;
  
  // Game state
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [targetSound, setTargetSound] = useState('');
  const [targetWords, setTargetWords] = useState<string[]>([]);
  const [lives, setLives] = useState(initialLives);
  const [score, setScore] = useState(0);
  const [popped, setPopped] = useState(0);
  const [streak, setStreak] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audio, setAudio] = useState(audioEnabled);
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [startTime] = useState(Date.now());
  
  // Refs
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  
  // Initialize game
  useEffect(() => {
    initializeGame();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  // Initialize game
  const initializeGame = () => {
    const words = contentPool.content as WordItem[];
    
    // Determine target sound from first word's type or extract common sound
    const targetType = words[0]?.type || 'th';
    setTargetSound(targetType);
    
    // Filter target words (matching type) and distractor words
    const targets = words.filter(w => w.type === targetType).map(w => w.word);
    const distractors = words.filter(w => w.type !== targetType).map(w => w.word);
    
    setTargetWords(targets);
    
    // Create initial bubbles
    createBubbles(targets, distractors);
  };
  
  // Create bubbles
  const createBubbles = (targets: string[], distractors: string[]) => {
    const allWords = [...targets, ...distractors];
    const shuffled = allWords.sort(() => Math.random() - 0.5).slice(0, 8);
    
    const newBubbles: Bubble[] = shuffled.map((word, i) => ({
      id: `bubble-${Date.now()}-${i}`,
      word,
      isTarget: targets.includes(word),
      x: Math.random() * 80 + 10, // 10-90%
      y: 110 + Math.random() * 20, // Start below screen
      speed: (0.3 + Math.random() * 0.3) * speedMultiplier,
      popped: false,
    }));
    
    setBubbles(newBubbles);
  };
  
  // Animation loop
  useEffect(() => {
    if (gameOver || isPaused) return;
    
    const animate = () => {
      setBubbles(prev => {
        const updated = prev.map(bubble => {
          if (bubble.popped) return bubble;
          
          // Move bubble up
          const newY = bubble.y - bubble.speed;
          
          // Check if escaped (target that reached top)
          if (newY < -10 && bubble.isTarget) {
            setLives(l => {
              const newLives = l - 1;
              if (newLives <= 0) {
                setGameOver(true);
              }
              return newLives;
            });
            playSound('error');
            return { ...bubble, popped: true };
          }
          
          return { ...bubble, y: newY };
        });
        
        // Remove popped/escaped bubbles and add new ones
        const active = updated.filter(b => !b.popped && b.y > -10);
        
        if (active.length < 5 && !gameOver) {
          // Add new bubble
          const words = contentPool.content as WordItem[];
          const targets = words.filter(w => w.type === targetSound).map(w => w.word);
          const distractors = words.filter(w => w.type !== targetSound).map(w => w.word);
          const allWords = [...targets, ...distractors];
          const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
          
          active.push({
            id: `bubble-${Date.now()}`,
            word: randomWord,
            isTarget: targets.includes(randomWord),
            x: Math.random() * 80 + 10,
            y: 110,
            speed: (0.3 + Math.random() * 0.3) * speedMultiplier,
            popped: false,
          });
        }
        
        return active;
      });
      
      if (!gameOver) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameOver, isPaused, targetSound, speedMultiplier]);
  
  // Handle bubble tap
  const handleBubbleTap = (bubble: Bubble) => {
    if (bubble.popped || gameOver) return;
    
    if (bubble.isTarget) {
      // Correct!
      playSound('success');
      playHaptic('medium');
      
      const newStreak = streak + 1;
      setStreak(newStreak);
      setScore(prev => prev + 10 + (newStreak >= 3 ? 5 : 0));
      setPopped(prev => {
        const newPopped = prev + 1;
        if (newPopped >= bubblesPerRound) {
          handleGameComplete(true);
        }
        return newPopped;
      });
      
      setBubbles(prev => prev.map(b => 
        b.id === bubble.id ? { ...b, popped: true } : b
      ));
    } else {
      // Wrong!
      playSound('error');
      playHaptic('heavy');
      
      setStreak(0);
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          handleGameComplete(false);
        }
        return newLives;
      });
      
      setMistakes(prev => [...prev, {
        item: bubble.word,
        wrongAnswer: 'tapped',
        correctAnswer: `Should not tap (not ${targetSound})`,
      }]);
      
      setBubbles(prev => prev.map(b => 
        b.id === bubble.id ? { ...b, popped: true } : b
      ));
    }
  };
  
  // Handle game complete
  const handleGameComplete = (won: boolean) => {
    setGameOver(true);
    
    if (won && mistakes.length === 0) {
      playSound('perfect');
    } else if (won) {
      playSound('complete');
    }
    
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    
    setTimeout(() => {
      onComplete({
        score,
        maxScore: bubblesPerRound * 15,
        correctItems: popped,
        totalItems: bubblesPerRound,
        timeTakenSeconds: timeTaken,
        mistakes,
        isPerfect: won && mistakes.length === 0,
      });
    }, 2000);
  };
  
  // Play target sound
  const playTargetSound = () => {
    if (audio) {
      speak(`Pop the ${targetSound} sound words!`);
    }
  };
  
  return (
    <div 
      ref={gameAreaRef}
      className="min-h-screen bg-gradient-to-b from-sky-300 via-sky-400 to-blue-500 relative overflow-hidden"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onQuit}
            className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            {/* Score */}
            <div className="bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="text-yellow-300">⭐</span>
              <span className="font-bold text-white">{score}</span>
            </div>
            
            {/* Lives */}
            <div className="flex items-center gap-1">
              {[...Array(initialLives)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={i >= lives ? { scale: 0 } : { scale: 1 }}
                >
                  <Heart 
                    className={`w-6 h-6 ${i < lives ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} 
                  />
                </motion.div>
              ))}
            </div>
            
            {/* Audio toggle */}
            <button
              onClick={() => setAudio(!audio)}
              className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white"
            >
              {audio ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Target instruction */}
      <div className="absolute top-20 left-0 right-0 z-10 text-center">
        <motion.button
          onClick={playTargetSound}
          className="bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg inline-flex items-center gap-2"
          whileTap={{ scale: 0.95 }}
        >
          <Volume2 className="w-5 h-5 text-[#FF0099]" />
          <span className="font-bold text-gray-800">
            Pop the "{targetSound.toUpperCase()}" words!
          </span>
        </motion.button>
      </div>
      
      {/* Progress */}
      <div className="absolute top-32 left-4 right-4 z-10">
        <div className="h-2 bg-white/30 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white"
            style={{ width: `${(popped / bubblesPerRound) * 100}%` }}
          />
        </div>
        <p className="text-center text-white/80 text-sm mt-1">
          {popped} / {bubblesPerRound} popped
        </p>
      </div>
      
      {/* Streak indicator */}
      <AnimatePresence>
        {streak >= 3 && (
          <motion.div
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0 }}
            className="absolute top-44 left-1/2 -translate-x-1/2 z-20 bg-orange-500 text-white px-4 py-2 rounded-full font-bold"
          >
            🔥 {streak} streak!
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Bubbles */}
      <div className="absolute inset-0 pt-40">
        <AnimatePresence>
          {bubbles.map(bubble => (
            <motion.button
              key={bubble.id}
              className={`
                absolute w-20 h-20 rounded-full flex items-center justify-center
                text-white font-bold text-lg shadow-lg
                ${bubble.isTarget 
                  ? 'bg-gradient-to-br from-pink-400 to-rose-500' 
                  : 'bg-gradient-to-br from-purple-400 to-indigo-500'}
              `}
              style={{
                left: `${bubble.x}%`,
                top: `${bubble.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              onClick={() => handleBubbleTap(bubble)}
              initial={{ scale: 0 }}
              animate={{ 
                scale: bubble.popped ? 0 : 1,
                opacity: bubble.popped ? 0 : 1,
              }}
              exit={{ scale: 1.5, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <span className="drop-shadow-md">{bubble.word}</span>
              
              {/* Bubble shine */}
              <div className="absolute top-2 left-3 w-4 h-4 bg-white/40 rounded-full" />
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Game Over overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-3xl p-8 max-w-sm mx-4 text-center"
            >
              <div className="text-6xl mb-4">
                {lives > 0 ? '🎉' : '😅'}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {lives > 0 ? 'Great Job!' : 'Game Over'}
              </h2>
              <p className="text-gray-500 mb-4">
                You popped {popped} bubbles!
              </p>
              <div className="text-3xl font-bold text-[#FF0099] mb-4">
                +{score} XP
              </div>
              <p className="text-sm text-gray-400">
                Continuing in a moment...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Clouds decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/20 to-transparent" />
    </div>
  );
}
