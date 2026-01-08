// =============================================================================
// QUIZ PLAYER COMPONENT
// Gamified MCQ quiz with instant feedback and celebrations
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertCircle, ChevronRight, Volume2 } from 'lucide-react';
import { playSound, playHaptic, speak } from '@/lib/sounds';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
  image_url?: string;
  audio_url?: string;
}

interface QuizPlayerProps {
  quizId: string;
  onComplete: (result: {
    score: number;
    maxScore: number;
    correctItems: number;
    totalItems: number;
    isPerfect: boolean;
    mistakes: any[];
  }) => void;
  onExit: () => void;
}

export default function QuizPlayer({ quizId, onComplete, onExit }: QuizPlayerProps) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [streak, setStreak] = useState(0);
  const [showResult, setShowResult] = useState(false);
  
  // Fetch quiz questions
  useEffect(() => {
    fetchQuiz();
  }, [quizId]);
  
  const fetchQuiz = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/elearning/quiz/${quizId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      setQuestions(data.questions);
    } catch (err) {
      console.error('Failed to load quiz:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Current question
  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  
  // Handle answer selection
  const handleSelectAnswer = (index: number) => {
    if (isAnswered) return;
    
    setSelectedAnswer(index);
    setIsAnswered(true);
    
    const correct = index === currentQuestion.correct_answer;
    setIsCorrect(correct);
    
    if (correct) {
      playSound('success');
      playHaptic('medium');
      setScore(prev => prev + 10 + (streak >= 2 ? 5 : 0));
      setStreak(prev => prev + 1);
    } else {
      playSound('error');
      playHaptic('heavy');
      setStreak(0);
      setMistakes(prev => [...prev, {
        question: currentQuestion.question,
        wrongAnswer: currentQuestion.options[index],
        correctAnswer: currentQuestion.options[currentQuestion.correct_answer],
      }]);
    }
  };
  
  // Move to next question
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setIsCorrect(false);
    } else {
      // Quiz complete
      handleQuizComplete();
    }
  };
  
  // Handle quiz completion
  const handleQuizComplete = () => {
    const correctCount = questions.length - mistakes.length;
    const maxScore = questions.length * 10;
    const isPerfect = mistakes.length === 0;
    
    if (isPerfect) {
      playSound('perfect');
    } else {
      playSound('complete');
    }
    
    setShowResult(true);
    
    setTimeout(() => {
      onComplete({
        score,
        maxScore,
        correctItems: correctCount,
        totalItems: questions.length,
        isPerfect,
        mistakes,
      });
    }, 2000);
  };
  
  // Play question audio
  const playQuestionAudio = () => {
    if (currentQuestion?.audio_url) {
      new Audio(currentQuestion.audio_url).play();
    } else {
      speak(currentQuestion.question);
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF5F9] to-[#F0F7FF] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-3 border-[#FF0099]/20 border-t-[#FF0099] rounded-full"
        />
      </div>
    );
  }
  
  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No questions available</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF5F9] to-[#F0F7FF] p-4 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onExit}
          className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3">
          {/* Score */}
          <div className="bg-white px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
            <span className="text-yellow-500">⭐</span>
            <span className="font-bold text-gray-700">{score}</span>
          </div>
          
          {/* Streak */}
          {streak >= 2 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-orange-100 px-3 py-1.5 rounded-full flex items-center gap-1.5"
            >
              <span>🔥</span>
              <span className="font-bold text-orange-600">{streak}</span>
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-500">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#FF0099] to-[#FF6B6B]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* Question card */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white rounded-3xl p-6 shadow-lg mb-6"
      >
        {/* Question image */}
        {currentQuestion.image_url && (
          <div className="mb-4 rounded-2xl overflow-hidden">
            <img
              src={currentQuestion.image_url}
              alt=""
              className="w-full h-40 object-cover"
            />
          </div>
        )}
        
        {/* Question text */}
        <div className="flex items-start gap-3">
          <h2 className="text-lg font-semibold text-gray-800 flex-1">
            {currentQuestion.question}
          </h2>
          <button
            onClick={playQuestionAudio}
            className="w-10 h-10 rounded-full bg-[#FF0099]/10 flex items-center justify-center text-[#FF0099]"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
      
      {/* Options */}
      <div className="space-y-3">
        {currentQuestion.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrectAnswer = index === currentQuestion.correct_answer;
          
          let bgColor = 'bg-white';
          let borderColor = 'border-gray-200';
          let textColor = 'text-gray-800';
          
          if (isAnswered) {
            if (isCorrectAnswer) {
              bgColor = 'bg-green-50';
              borderColor = 'border-green-400';
              textColor = 'text-green-700';
            } else if (isSelected && !isCorrectAnswer) {
              bgColor = 'bg-red-50';
              borderColor = 'border-red-400';
              textColor = 'text-red-700';
            }
          } else if (isSelected) {
            bgColor = 'bg-[#FF0099]/10';
            borderColor = 'border-[#FF0099]';
            textColor = 'text-[#FF0099]';
          }
          
          return (
            <motion.button
              key={index}
              onClick={() => handleSelectAnswer(index)}
              disabled={isAnswered}
              className={`
                w-full p-4 rounded-2xl border-2 text-left
                transition-all duration-200
                ${bgColor} ${borderColor} ${textColor}
                ${!isAnswered ? 'hover:border-[#FF0099]/50 hover:shadow-md' : ''}
              `}
              whileHover={!isAnswered ? { scale: 1.01 } : {}}
              whileTap={!isAnswered ? { scale: 0.99 } : {}}
            >
              <div className="flex items-center gap-3">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${isAnswered && isCorrectAnswer ? 'bg-green-500 text-white' :
                    isAnswered && isSelected && !isCorrectAnswer ? 'bg-red-500 text-white' :
                    isSelected ? 'bg-[#FF0099] text-white' :
                    'bg-gray-100 text-gray-600'}
                `}>
                  {isAnswered && isCorrectAnswer ? (
                    <Check className="w-4 h-4" />
                  ) : isAnswered && isSelected && !isCorrectAnswer ? (
                    <X className="w-4 h-4" />
                  ) : (
                    String.fromCharCode(65 + index)
                  )}
                </div>
                <span className="font-medium">{option}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
      
      {/* Feedback & Next button */}
      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100"
          >
            {/* Feedback */}
            <div className={`
              p-4 rounded-xl mb-4 flex items-start gap-3
              ${isCorrect ? 'bg-green-50' : 'bg-red-50'}
            `}>
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center
                ${isCorrect ? 'bg-green-500' : 'bg-red-500'} text-white
              `}>
                {isCorrect ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <p className={`font-semibold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  {isCorrect ? '🎉 Correct!' : '😕 Not quite'}
                </p>
                {!isCorrect && currentQuestion.explanation && (
                  <p className="text-sm text-gray-600 mt-1">
                    {currentQuestion.explanation}
                  </p>
                )}
              </div>
            </div>
            
            {/* Next button */}
            <motion.button
              onClick={handleNext}
              className="w-full bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2"
              whileTap={{ scale: 0.98 }}
            >
              {currentIndex < questions.length - 1 ? (
                <>
                  Next Question
                  <ChevronRight className="w-5 h-5" />
                </>
              ) : (
                'See Results'
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Result overlay */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-3xl p-8 max-w-sm mx-4 text-center"
            >
              <div className="text-6xl mb-4">
                {mistakes.length === 0 ? '🏆' : '👏'}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {mistakes.length === 0 ? 'Perfect!' : 'Quiz Complete!'}
              </h2>
              <p className="text-gray-500 mb-4">
                {questions.length - mistakes.length} / {questions.length} correct
              </p>
              <div className="text-3xl font-bold text-[#FF0099]">
                +{score} XP
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
