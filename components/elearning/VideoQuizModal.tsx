// =============================================================================
// FILE: components/elearning/VideoQuizModal.tsx
// PURPOSE: Combined Video + Quiz modal for seamless learning flow
// MOBILE-FIRST RESPONSIVE
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import {
  X, Play, CheckCircle, ChevronRight, Trophy, Zap,
  Loader2, PartyPopper, XCircle
} from 'lucide-react';

interface QuizQuestion {
  id: string;
  question_text: string;
  options: { id: string; text: string }[];
  correct_option_id: string;
}

interface VideoQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: {
    id: string;
    title: string;
    description?: string;
    video_id?: string;
    video_source?: string;
    duration_seconds?: number;
    xp_reward: number;
    has_quiz?: boolean;
    module_name?: string;
  };
  childId: string;
  onComplete: (result: {
    videoCompleted: boolean;
    quizPassed?: boolean;
    xpEarned: number;
    newBadges: string[];
  }) => void;
}

type ModalState = 'video' | 'quiz' | 'result';

export default function VideoQuizModal({
  isOpen,
  onClose,
  video,
  childId,
  onComplete,
}: VideoQuizModalProps) {
  const [state, setState] = useState<ModalState>('video');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [videoWatched, setVideoWatched] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setState('video');
      setQuizQuestions([]);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setQuizResult(null);
      setVideoWatched(false);
    }
  }, [isOpen, video.id]);

  // Fetch quiz questions when needed
  async function fetchQuizQuestions() {
    try {
      const res = await fetch(`/api/elearning/quiz-questions?videoId=${video.id}`);
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        setQuizQuestions(data.questions);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to fetch quiz:', err);
      return false;
    }
  }

  // Handle video completion
  async function handleVideoComplete() {
    setLoading(true);

    try {
      const res = await fetch('/api/elearning/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          videoId: video.id,
          watchedPercent: 100,
          completed: true,
        }),
      });

      const data = await res.json();
      setVideoWatched(true);

      if (video.has_quiz) {
        const hasQuiz = await fetchQuizQuestions();
        if (hasQuiz) {
          setState('quiz');
          setLoading(false);
          return;
        }
      }

      setQuizResult({
        videoXP: data.xp?.awarded || video.xp_reward,
        quizXP: 0,
        totalXP: data.xp?.awarded || video.xp_reward,
        quizPassed: null,
        isPerfect: false,
        newBadges: data.newBadges || [],
      });
      setState('result');
    } catch (err) {
      console.error('Error completing video:', err);
    } finally {
      setLoading(false);
    }
  }

  function selectAnswer(questionId: string, optionId: string) {
    setSelectedAnswers(prev => ({ ...prev, [questionId]: optionId }));
  }

  function nextQuestion() {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }

  function prevQuestion() {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  }

  async function handleQuizSubmit() {
    setLoading(true);

    try {
      const answers = quizQuestions.map(q => ({
        questionId: q.id,
        selectedOptionId: selectedAnswers[q.id] || '',
      }));

      const res = await fetch('/api/elearning/submit-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, videoId: video.id, answers }),
      });

      const data = await res.json();

      setQuizResult({
        videoXP: video.xp_reward,
        quizXP: data.result?.xpEarned || 0,
        totalXP: video.xp_reward + (data.result?.xpEarned || 0),
        quizPassed: data.result?.passed,
        isPerfect: data.result?.perfect,
        scorePercent: data.result?.score,
        correctCount: data.result?.correctCount,
        totalQuestions: data.result?.totalQuestions,
        newBadges: data.result?.newBadges || [],
      });
      setState('result');
    } catch (err) {
      console.error('Error submitting quiz:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (quizResult) {
      onComplete({
        videoCompleted: true,
        quizPassed: quizResult.quizPassed,
        xpEarned: quizResult.totalXP,
        newBadges: quizResult.newBadges,
      });
    }
    onClose();
  }

  if (!isOpen) return null;

  const currentQuestion = quizQuestions[currentQuestionIndex];
  const allAnswered = quizQuestions.every(q => selectedAnswers[q.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 md:bg-black/90 md:flex md:items-center md:justify-center md:p-4">
      <div className="relative w-full h-full md:h-auto md:max-h-[90vh] md:max-w-3xl overflow-hidden bg-gray-900 md:rounded-2xl flex flex-col">
        {/* Close Button - hide during quiz (quiz header has its own) */}
        {state !== 'quiz' && (
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        )}

        {/* VIDEO STATE */}
        {state === 'video' && (
          <div className="flex flex-col h-full">
            {/* Video Title */}
            <div className="p-3 md:p-4 bg-gray-800 flex-shrink-0">
              <h2 className="text-white text-base md:text-xl font-bold pr-10 line-clamp-2">{video.title}</h2>
              {video.module_name && (
                <p className="text-gray-400 text-xs md:text-sm mt-1">{video.module_name}</p>
              )}
            </div>

            {/* Video Player - Responsive aspect ratio */}
            <div className="flex-1 bg-black flex items-center justify-center min-h-0">
              <div className="w-full aspect-video">
                {video.video_source === 'youtube' && video.video_id ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${video.video_id}?rel=0&playsinline=1`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <Play className="w-12 h-12 md:w-16 md:h-16 opacity-50" />
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 md:p-4 bg-gray-800 flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-white/70 text-xs md:text-sm text-center sm:text-left">
                {video.has_quiz ? (
                  <span className="flex items-center justify-center sm:justify-start gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    Quiz after video
                  </span>
                ) : (
                  <span>+{video.xp_reward} XP on completion</span>
                )}
              </div>
              <button
                onClick={handleVideoComplete}
                disabled={loading}
                className="w-full sm:w-auto px-4 md:px-6 py-3 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-medium hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm md:text-base">I've Watched This</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* QUIZ STATE */}
        {state === 'quiz' && currentQuestion && (
          <div className="flex flex-col h-full">
            {/* Quiz Header */}
            <div className="p-3 md:p-4 bg-gradient-to-r from-[#ff0099] to-[#7b008b] flex-shrink-0">
              <div className="flex items-center justify-between text-white">
                <h2 className="text-lg md:text-xl font-bold">Quiz Time! 🎯</h2>
                <div className="flex items-center gap-3">
                  <span className="px-2 md:px-3 py-1 bg-white/20 rounded-full text-xs md:text-sm">
                    {currentQuestionIndex + 1} / {quizQuestions.length}
                  </span>
                  <button
                    onClick={handleClose}
                    className="p-1.5 hover:bg-white/20 rounded-full transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {/* Progress dots */}
              <div className="flex gap-1.5 md:gap-2 mt-3">
                {quizQuestions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 md:h-2 flex-1 rounded-full transition-all ${
                      i === currentQuestionIndex
                        ? 'bg-white'
                        : selectedAnswers[quizQuestions[i].id]
                        ? 'bg-white/60'
                        : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Question */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
              <h3 className="text-white text-base md:text-xl mb-4 md:mb-6">{currentQuestion.question_text}</h3>

              {/* Options */}
              <div className="space-y-2 md:space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswers[currentQuestion.id] === option.id;
                  const letters = ['A', 'B', 'C', 'D'];

                  return (
                    <button
                      key={option.id}
                      onClick={() => selectAnswer(currentQuestion.id, option.id)}
                      className={`w-full p-3 md:p-4 rounded-xl text-left transition-all flex items-center gap-3 md:gap-4 min-h-[56px] ${
                        isSelected
                          ? 'bg-[#7b008b] text-white ring-2 ring-[#ff0099]'
                          : 'bg-gray-800 text-white active:bg-gray-700 md:hover:bg-gray-700'
                      }`}
                    >
                      <span className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center font-bold text-sm md:text-base flex-shrink-0 ${
                        isSelected ? 'bg-white text-[#7b008b]' : 'bg-gray-700'
                      }`}>
                        {letters[index]}
                      </span>
                      <span className="text-sm md:text-lg">{option.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div className="p-3 md:p-4 bg-gray-800 flex-shrink-0 flex items-center justify-between gap-2">
              <button
                onClick={prevQuestion}
                disabled={currentQuestionIndex === 0}
                className="px-3 md:px-4 py-2 text-white/60 hover:text-white disabled:opacity-30 transition text-sm md:text-base"
              >
                ← Back
              </button>

              {currentQuestionIndex === quizQuestions.length - 1 ? (
                <button
                  onClick={handleQuizSubmit}
                  disabled={!allAnswered || loading}
                  className="flex-1 sm:flex-none px-4 md:px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span className="text-sm md:text-base">Submit</span>
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={nextQuestion}
                  disabled={!selectedAnswers[currentQuestion.id]}
                  className="flex-1 sm:flex-none px-4 md:px-6 py-3 bg-[#7b008b] text-white rounded-xl font-medium hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
                >
                  <span className="text-sm md:text-base">Next</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* RESULT STATE */}
        {state === 'result' && quizResult && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 text-center overflow-y-auto">
            {/* Celebration Icon */}
            <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-4 md:mb-6 ${
              quizResult.isPerfect
                ? 'bg-gradient-to-br from-yellow-400 to-yellow-600'
                : quizResult.quizPassed === false
                ? 'bg-gradient-to-br from-orange-400 to-orange-600'
                : 'bg-gradient-to-br from-green-400 to-green-600'
            }`}>
              {quizResult.isPerfect ? (
                <PartyPopper className="w-10 h-10 md:w-12 md:h-12 text-white" />
              ) : quizResult.quizPassed === false ? (
                <XCircle className="w-10 h-10 md:w-12 md:h-12 text-white" />
              ) : (
                <CheckCircle className="w-10 h-10 md:w-12 md:h-12 text-white" />
              )}
            </div>

            {/* Title */}
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {quizResult.isPerfect
                ? '🎉 Perfect!'
                : quizResult.quizPassed === false
                ? 'Keep Trying!'
                : quizResult.quizPassed
                ? 'Great Job!'
                : 'Complete!'}
            </h2>

            {/* Quiz Score */}
            {quizResult.scorePercent !== undefined && (
              <p className="text-white/70 text-sm md:text-lg mb-4 md:mb-6">
                {quizResult.correctCount}/{quizResult.totalQuestions} correct ({quizResult.scorePercent}%)
              </p>
            )}

            {/* XP Earned */}
            <div className="bg-gray-800 rounded-2xl p-4 md:p-6 mb-4 md:mb-6 w-full max-w-xs">
              <div className="flex items-center justify-center gap-2 md:gap-3 text-xl md:text-2xl font-bold text-white mb-3 md:mb-4">
                <Zap className="w-6 h-6 md:w-8 md:h-8 text-yellow-400" />
                +{quizResult.totalXP} XP
              </div>

              <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm text-white/60">
                <div className="flex justify-between">
                  <span>Video</span>
                  <span>+{quizResult.videoXP} XP</span>
                </div>
                {quizResult.quizXP > 0 && (
                  <div className="flex justify-between">
                    <span>Quiz {quizResult.isPerfect ? '(Perfect!)' : ''}</span>
                    <span>+{quizResult.quizXP} XP</span>
                  </div>
                )}
              </div>
            </div>

            {/* Continue Button */}
            <button
              onClick={handleClose}
              className="w-full max-w-xs px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-medium text-base md:text-lg hover:opacity-90 transition min-h-[48px]"
            >
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
