// =============================================================================
// UNIT PLAYER PAGE
// Handles the complete unit flow: Video → Game → Video → Quiz
// Seamless transitions with progress tracking
// =============================================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Award, RotateCcw } from 'lucide-react';
import { playSound, playHaptic } from '@/lib/sounds';

// Components
import VideoPlayer from '@/components/elearning/VideoPlayer';
import WordMatchGame from '@/components/games/WordMatchGame';
import QuizPlayer from '@/components/elearning/QuizPlayer';
import CelebrationOverlay from '@/components/elearning/CelebrationOverlay';

import type { Unit, UnitSequenceItem, ContentPool, GameResult, CelebrationEvent } from '@/types/elearning';

interface UnitData {
  unit: Unit;
  progress: any;
  contentPools: Map<string, ContentPool>;
}

export default function UnitPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const childId = params.childId as string;
  const unitId = params.unitId as string;

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unitData, setUnitData] = useState<UnitData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepResults, setStepResults] = useState<Map<number, any>>(new Map());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const [totalXPEarned, setTotalXPEarned] = useState(0);

  // Fetch unit data
  useEffect(() => {
    fetchUnitData();
  }, [unitId, childId]);

  const fetchUnitData = async () => {
    console.log('Fetching unit data...');
    console.log('Fetching unit data...');
    try {
      setLoading(true);
      const response = await fetch(`/api/elearning/unit/${unitId}?childId=${childId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load unit');
      }

      console.log('Data received:', data);
      setUnitData({
        unit: data.unit,
        progress: data.progress,
        contentPools: new Map(Object.entries(data.contentPools || {})),
      });

      // Resume from last step if in progress
      if (data.progress?.current_step > 0) {
        setCurrentStep(data.progress.current_step);
      }
    } catch (err: any) {
      console.error('Unit fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get current step data
  const getCurrentStep = (): UnitSequenceItem | null => {
    if (!unitData) return null;
    return unitData.unit.sequence[currentStep] || null;
  };

  // Handle step completion
  const handleStepComplete = useCallback(async (result: any) => {
    if (!unitData) return;

    const step = getCurrentStep();
    if (!step) return;

    // Calculate XP earned
    let xpEarned = step.xp_reward || 0;
    if (result.isPerfect) {
      xpEarned += 10; // Perfect bonus
    }

    // Update results
    const newResults = new Map(stepResults);
    newResults.set(currentStep, { ...result, xpEarned });
    setStepResults(newResults);
    setTotalXPEarned(prev => prev + xpEarned);

    // Show XP celebration
    setCelebration({ type: 'xp', value: xpEarned });

    // Save progress to server
    try {
      await fetch('/api/elearning/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          unitId,
          stepIndex: currentStep,
          stepType: step.type,
          result,
          xpEarned,
        }),
      });
    } catch (err) {
      console.error('Failed to save progress:', err);
    }

    // Check if this was the last step
    const isLastStep = currentStep >= unitData.unit.sequence.length - 1;

    if (isLastStep) {
      // Unit complete!
      setTimeout(() => {
        handleUnitComplete();
      }, 1500);
    } else {
      // Move to next step after celebration
      setTimeout(() => {
        setCelebration(null);
        moveToNextStep();
      }, 1500);
    }
  }, [unitData, currentStep, stepResults, childId, unitId]);

  // Move to next step with transition
  const moveToNextStep = () => {
    setIsTransitioning(true);
    playSound('success');

    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
      setIsTransitioning(false);
    }, 500);
  };

  // Handle unit completion
  const handleUnitComplete = async () => {
    if (!unitData) return;

    // Calculate total score
    let totalScore = 0;
    let maxScore = 0;
    stepResults.forEach((result, stepIndex) => {
      const step = unitData.unit.sequence[stepIndex];
      if (step.type === 'quiz' || step.type === 'game') {
        totalScore += result.score || 0;
        maxScore += result.maxScore || 100;
      }
    });

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100;
    const isPerfect = percentage === 100;

    // Save completion
    try {
      const response = await fetch('/api/elearning/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          unitId,
          totalXP: totalXPEarned,
          score: percentage,
          isPerfect,
        }),
      });

      const data = await response.json();

      // Check for level up or badge
      if (data.levelUp) {
        setCelebration({ type: 'level_up', value: data.newLevel });
      } else if (isPerfect) {
        setCelebration({ type: 'perfect', value: totalXPEarned });
      } else if (data.newBadge) {
        setCelebration({ type: 'badge', badge: data.newBadge });
      } else if (data.dailyGoalAchieved) {
        setCelebration({ type: 'daily_goal', value: 25 });
      }

      // Show completion after celebration
      setTimeout(() => {
        setCelebration(null);
        setShowCompletion(true);
      }, 3500);

    } catch (err) {
      console.error('Failed to save completion:', err);
      setShowCompletion(true);
    }
  };

  // Handle exit
  const handleExit = () => {
    playSound('click');
    router.push(`/child/${childId}/play`);
  };

  // Render current step content
  const renderStepContent = () => {
    console.log('renderStepContent called, currentStep:', currentStep);
    const step = getCurrentStep();
    if (!step || !unitData) return null;

    switch (step.type) {
      case 'video':
          console.log('Rendering video step:', step);
        return (
          <VideoPlayer
            videoId={step.video_id!}
            title={step.title}
            onComplete={() => handleStepComplete({ completed: true })}
            onExit={handleExit}
          />
        );

      case 'game':
        const contentPool = unitData.contentPools.get(step.content_pool_id || '');
        if (!contentPool) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <p className="text-gray-500">Game content not available</p>
            </div>
          );
        }

        // Select game engine based on slug
        switch (step.game_engine_slug) {
          case 'word-match':
            return (
              <WordMatchGame
                contentPool={contentPool}
                config={step.config}
                onComplete={handleStepComplete}
                onQuit={handleExit}
              />
            );
          // Add other game engines here
          default:
            return (
              <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-500">Game engine not found: {step.game_engine_slug}</p>
              </div>
            );
        }

      case 'quiz':
        return (
          <QuizPlayer
            quizId={step.quiz_id!}
            onComplete={handleStepComplete}
            onExit={handleExit}
          />
        );

      default:
        return null;
    }
  };

  // Loading state
  console.log('Render - loading:', loading, 'unitData:', unitData);
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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFF5F9] to-[#F0F7FF] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-lg text-center max-w-sm">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Oops!</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={handleExit}
            className="w-full bg-[#FF0099] text-white py-3 rounded-xl font-semibold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!unitData) return null;

  const step = getCurrentStep();
  const totalSteps = unitData.unit.sequence.length;
  const progressPercent = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Celebration overlay */}
      <AnimatePresence>
        {celebration && (
          <CelebrationOverlay
            event={celebration}
            onComplete={() => setCelebration(null)}
          />
        )}
      </AnimatePresence>

      {/* Completion screen */}
      <AnimatePresence>
        {showCompletion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-gradient-to-b from-[#FFF5F9] to-[#F0F7FF] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 shadow-xl max-w-sm w-full text-center"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
                className="text-6xl mb-4"
              >
                🎉
              </motion.div>

              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Unit Complete!
              </h2>

              <p className="text-gray-500 mb-6">
                {unitData.unit.quest_title || unitData.unit.name}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-yellow-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-yellow-600">
                    +{totalXPEarned}
                  </div>
                  <div className="text-xs text-yellow-600">XP Earned</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {stepResults.size}/{totalSteps}
                  </div>
                  <div className="text-xs text-green-600">Steps Done</div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleExit}
                  className="w-full bg-gradient-to-r from-[#FF0099] to-[#7B008B] text-white py-3 rounded-xl font-semibold"
                >
                  Continue Learning
                </button>
                <button
                  onClick={() => {
                    setShowCompletion(false);
                    setCurrentStep(0);
                    setStepResults(new Map());
                    setTotalXPEarned(0);
                  }}
                  className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress header */}
      {!showCompletion && step && (
        <div className="sticky top-0 z-40 bg-white border-b border-gray-100">
          <div className="px-4 py-3 max-w-lg mx-auto">
            {/* Top row */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={handleExit}
                className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {currentStep + 1} / {totalSteps}
                </span>
                <span className="text-yellow-500">⚡</span>
                <span className="font-semibold text-gray-700">{totalXPEarned}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#FF0099] to-[#FF6B6B]"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mt-2">
              {unitData.unit.sequence.map((s, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${i < currentStep ? 'bg-green-500' :
                      i === currentStep ? 'bg-[#FF0099]' :
                        'bg-gray-200'
                    }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step content */}
      <AnimatePresence mode="wait">
        {!isTransitioning && !showCompletion && (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            {renderStepContent()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transition screen */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-white flex items-center justify-center"
          >
            <div className="text-center">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5 }}
                className="text-5xl mb-4"
              >
                {step?.type === 'video' ? '🎬' :
                  step?.type === 'game' ? '🎮' :
                    step?.type === 'quiz' ? '📝' : '🎤'}
              </motion.div>
              <p className="text-gray-600 font-medium">
                Next: {unitData.unit.sequence[currentStep + 1]?.title || 'Complete!'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}







