// =============================================================================
// WORD MATCH GAME ENGINE
// Drag words to matching images/sounds
// Fixed layout - fits in viewport without scrolling
// =============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, HelpCircle, X, Check, RefreshCw } from 'lucide-react';
import { playSound, playHaptic } from '@/lib/sounds';
import type { BaseGameProps, GameResult, WordItem, WordMatchConfig } from '@/types/elearning';

interface MatchItem extends WordItem {
  id: string;
  isMatched: boolean;
}

interface WordMatchGameProps extends BaseGameProps {
  config?: WordMatchConfig;
}

export default function WordMatchGame({
  contentPool,
  config = {},
  onComplete,
  onQuit,
  childAge = 7,
  audioEnabled = true,
}: WordMatchGameProps) {
  // Config with defaults
  const itemsPerRound = config.items_per_round || 6;
  const matchType = config.match_type || 'image';
  const showHints = config.show_hints ?? true;
  
  // Game state
  const [items, setItems] = useState<MatchItem[]>([]);
  const [shuffledWords, setShuffledWords] = useState<MatchItem[]>([]);
  const [selectedWord, setSelectedWord] = useState<MatchItem | null>(null);
  const [matches, setMatches] = useState<Map<string, string>>(new Map());
  const [mistakes, setMistakes] = useState<{ item: string; wrongAnswer: string; correctAnswer: string }[]>([]);
  const [streak, setStreak] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [score, setScore] = useState(0);
  const [startTime] = useState(Date.now());
  const [audio, setAudio] = useState(audioEnabled);
  const [showCelebration, setShowCelebration] = useState<'correct' | 'streak' | 'perfect' | null>(null);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize game
  useEffect(() => {
    const words = contentPool.content as WordItem[];
    const selectedWords = shuffleArray(words).slice(0, itemsPerRound);
    
    const itemsWithIds = selectedWords.map((word, index) => ({
      ...word,
      id: `item-${index}`,
      isMatched: false,
    }));
    
    setItems(itemsWithIds);
    setShuffledWords(shuffleArray([...itemsWithIds]));
  }, [contentPool, itemsPerRound]);
  
  // Shuffle helper
  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  // Play word audio
  const playWordAudio = useCallback((item: MatchItem) => {
    if (!audio) return;
    
    if (item.audio_url) {
      const audioEl = new Audio(item.audio_url);
      audioEl.play().catch(() => {
        speakWord(item.word);
      });
    } else {
      speakWord(item.word);
    }
  }, [audio]);
  
  // Speech synthesis fallback
  const speakWord = (word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.rate = 0.8;
      utterance.pitch = 1.1;
      speechSynthesis.speak(utterance);
    }
  };
  
  // Handle word selection
  const handleWordSelect = (item: MatchItem) => {
    if (item.isMatched) return;
    
    playHaptic('light');
    playWordAudio(item);
    setSelectedWord(item);
  };
  
  // Handle target (image) selection
  const handleTargetSelect = (target: MatchItem) => {
    if (!selectedWord || target.isMatched) return;
    
    const isCorrect = selectedWord.id === target.id;
    
    if (isCorrect) {
      // Correct match!
      playSound('success');
      playHaptic('medium');
      
      const newStreak = streak + 1;
      const pointsEarned = 10 + (newStreak >= 3 ? newStreak * 2 : 0);
      
      setStreak(newStreak);
      setScore(s => s + pointsEarned);
      
      // Update matches
      const newMatches = new Map(matches);
      newMatches.set(selectedWord.id, target.id);
      setMatches(newMatches);
      
      // Mark both as matched
      setItems(prev => prev.map(i => 
        i.id === target.id ? { ...i, isMatched: true } : i
      ));
      setShuffledWords(prev => prev.map(i => 
        i.id === selectedWord.id ? { ...i, isMatched: true } : i
      ));
      
      // Show celebration
      if (newStreak >= 3 && newStreak % 3 === 0) {
        setShowCelebration('streak');
        setTimeout(() => setShowCelebration(null), 1500);
      } else {
        setShowCelebration('correct');
        setTimeout(() => setShowCelebration(null), 500);
      }
      
      // Check if complete
      if (newMatches.size === items.length) {
        handleGameComplete(newMatches);
      }
      
      setSelectedWord(null);
    } else {
      // Wrong match
      playSound('error');
      playHaptic('heavy');
      
      setStreak(0);
      setMistakes(prev => [...prev, {
        item: selectedWord.word,
        wrongAnswer: target.word,
        correctAnswer: selectedWord.word,
      }]);
      
      // Shake animation handled by CSS
      setSelectedWord(null);
    }
  };
  
  // Handle game completion
  const handleGameComplete = (finalMatches: Map<string, string>) => {
    setIsComplete(true);
    
    const timeSpentSeconds = Math.floor((Date.now() - startTime) / 1000);
    const isPerfect = mistakes.length === 0;
    
    if (isPerfect) {
      setShowCelebration('perfect');
      playSound('levelUp');
    } else {
      playSound('success');
    }
    
    const result: GameResult = {
      score,
      maxScore: items.length * 10,
      correctItems: finalMatches.size,
      totalItems: items.length,
      timeTakenSeconds: timeSpentSeconds,
      mistakes,
      isPerfect,
    };
    
    setTimeout(() => {
      onComplete(result);
    }, isPerfect ? 3000 : 1500);
  };
  
  // Reset game
  const resetGame = () => {
    const words = contentPool.content as WordItem[];
    const selectedWords = shuffleArray(words).slice(0, itemsPerRound);
    
    const itemsWithIds = selectedWords.map((word, index) => ({
      ...word,
      id: `item-${index}`,
      isMatched: false,
    }));
    
    setItems(itemsWithIds);
    setShuffledWords(shuffleArray([...itemsWithIds]));
    setSelectedWord(null);
    setMatches(new Map());
    setMistakes([]);
    setStreak(0);
    setScore(0);
    setIsComplete(false);
    setShowCelebration(null);
  };
  
  // Get emoji fallback for words without images
  const getEmojiForWord = (word: string): string => {
    const emojiMap: Record<string, string> = {
      'this': '👉', 'that': '👈', 'the': '📰', 'them': '👥',
      'think': '🤔', 'thank': '🙏', 'three': '3️⃣', 'thumb': '👍',
      'bath': '🛁', 'with': '🤝', 'thing': '📦', 'thick': '🧱',
      'thin': '📏', 'throw': '🎾', 'thread': '🧵', 'thunder': '⚡',
    };
    return emojiMap[word.toLowerCase()] || '📝';
  };
  
  // Progress percentage
  const progressPercent = (matches.size / items.length) * 100;
  
  return (
    <div 
      ref={containerRef}
      className="h-screen flex flex-col bg-gradient-to-b from-[#FFF5F9] to-[#F0F7FF] overflow-hidden"
    >
      {/* Header - fixed height */}
      <div className="flex-shrink-0 p-3 flex items-center justify-between">
        <button
          onClick={onQuit}
          className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex items-center gap-3">
          {/* Score */}
          <div className="bg-white px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
            <span className="text-yellow-500 text-sm">⭐</span>
            <span className="font-bold text-gray-700 text-sm">{score}</span>
          </div>
          
          {/* Streak */}
          {streak >= 2 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-orange-100 px-2.5 py-1 rounded-full flex items-center gap-1"
            >
              <span className="text-sm">🔥</span>
              <span className="font-bold text-orange-600 text-sm">{streak}</span>
            </motion.div>
          )}
          
          {/* Audio toggle */}
          <button
            onClick={() => setAudio(!audio)}
            className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400"
          >
            {audio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {/* Progress bar - fixed height */}
      <div className="flex-shrink-0 px-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">
            {matches.size} / {items.length} matched
          </span>
          {showHints && (
            <button
              onClick={() => setShowHint(!showHint)}
              className="text-xs text-[#FF0099] flex items-center gap-1"
            >
              <HelpCircle className="w-3 h-3" />
              Hint
            </button>
          )}
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#FF0099] to-[#FF6B6B]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
      
      {/* Game area - takes remaining space, scrollable */}
      <div className="flex-1 overflow-y-auto px-3 pb-20">
        <div className="grid grid-cols-2 gap-3">
          {/* Words column */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-500 text-center mb-1">Words</h3>
            {shuffledWords.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => handleWordSelect(item)}
                disabled={item.isMatched}
                className={`
                  w-full h-10 rounded-xl border-2 text-sm font-semibold
                  transition-all duration-200
                  ${item.isMatched 
                    ? 'bg-green-100 border-green-300 text-green-700 opacity-50 cursor-default'
                    : selectedWord?.id === item.id
                      ? 'bg-[#FF0099] border-[#FF0099] text-white shadow-lg scale-105'
                      : 'bg-white border-gray-200 text-gray-800 hover:border-[#FF0099]/50 hover:shadow-md'
                  }
                `}
                whileHover={!item.isMatched ? { scale: 1.02 } : {}}
                whileTap={!item.isMatched ? { scale: 0.98 } : {}}
                layout
              >
                <div className="flex items-center justify-center gap-1.5">
                  {item.isMatched && <Check className="w-3 h-3" />}
                  {item.word}
                  {audio && !item.isMatched && (
                    <Volume2 className="w-3 h-3 opacity-50" />
                  )}
                </div>
              </motion.button>
            ))}
          </div>
          
          {/* Images column */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-500 text-center mb-1">Pictures</h3>
            {items.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => handleTargetSelect(item)}
                disabled={item.isMatched || !selectedWord}
                className={`
                  w-full h-10 rounded-xl border-2 overflow-hidden relative
                  transition-all duration-200
                  ${item.isMatched 
                    ? 'border-green-500 border-4 opacity-100'
                    : selectedWord
                      ? 'bg-white border-[#FF0099]/30 hover:border-[#FF0099] hover:shadow-lg cursor-pointer'
                      : 'bg-gray-50 border-gray-200 cursor-not-allowed'
                  }
                `}
                whileHover={!item.isMatched && selectedWord ? { scale: 1.02 } : {}}
                whileTap={!item.isMatched && selectedWord ? { scale: 0.98 } : {}}
                layout
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt=""
                    className={`w-full h-full object-cover ${item.isMatched ? 'opacity-50' : ''}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">
                    {getEmojiForWord(item.word)}
                  </div>
                )}
                
                {item.isMatched && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 bg-green-500/40 flex items-center justify-center"
                  >
                    <Check className="w-5 h-5 text-green-700 stroke-[3]" />
                  </motion.div>
                )}
                
                {/* Hint overlay */}
                {showHint && !item.isMatched && selectedWord?.id === item.id && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-green-500/30 border-4 border-green-500 rounded-xl"
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Selected word indicator - fixed at bottom */}
      <AnimatePresence>
        {selectedWord && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#FF0099] text-white px-5 py-2.5 rounded-full shadow-lg z-10"
          >
            <span className="font-semibold text-sm">Find: "{selectedWord.word}"</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Celebrations */}
      <AnimatePresence>
        {showCelebration === 'correct' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="text-5xl">✨</div>
          </motion.div>
        )}
        
        {showCelebration === 'streak' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="bg-orange-500 text-white px-6 py-3 rounded-2xl shadow-2xl text-center">
              <div className="text-3xl mb-1">🔥</div>
              <div className="text-lg font-bold">{streak} in a row!</div>
            </div>
          </motion.div>
        )}
        
        {showCelebration === 'perfect' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              className="bg-white rounded-3xl p-6 text-center shadow-2xl"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: 2 }}
                className="text-6xl mb-3"
              >
                🏆
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Perfect!</h2>
              <p className="text-gray-500">No mistakes! Amazing job! 🌟</p>
              <div className="mt-3 text-3xl font-bold text-[#FF0099]">+{score} XP</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}






