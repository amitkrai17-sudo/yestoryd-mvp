// ============================================================
// FILE: components/mini-challenge/MiniChallengeFlow.tsx
// ============================================================
// Main orchestrator for Mini Challenge flow
// Manages state transitions between all stages
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { ChallengeInvite } from './ChallengeInvite';
import { QuestionCard } from './QuestionCard';
import { AnswerFeedback } from './AnswerFeedback';
import { VideoLesson } from './VideoLesson';
import { ChallengeResults } from './ChallengeResults';

type Stage = 'loading' | 'error' | 'invite' | 'question' | 'feedback' | 'video' | 'results';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}

interface Answer {
  question: string;
  selected_index: number;
  correct_index: number;
  is_correct: boolean;
}

interface ChallengeData {
  childName: string;
  childAge: number;
  goalArea: string;
  questions: Question[];
  video: {
    id: string;
    name: string;
    video_url: string;
    estimated_minutes: number;
  } | null;
  settings: {
    xpCorrect: number;
    xpVideo: number;
    videoSkipDelay: number;
  };
}

interface MiniChallengeFlowProps {
  childId: string;
  goalArea?: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

export function MiniChallengeFlow({ childId, goalArea, onComplete, onSkip }: MiniChallengeFlowProps) {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState<string | null>(null);
  const [challengeData, setChallengeData] = useState<ChallengeData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [lastAnswer, setLastAnswer] = useState<{ isCorrect: boolean; selectedIndex: number } | null>(null);
  const [videoWatched, setVideoWatched] = useState(false);
  const [videoWatchPercent, setVideoWatchPercent] = useState(0);
  const [finalResults, setFinalResults] = useState<any>(null);

  useEffect(() => {
    loadChallenge();
  }, [childId, goalArea]);

  async function loadChallenge() {
    try {
      setStage('loading');
      setError(null);

      const res = await fetch('/api/mini-challenge/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, goalArea })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load challenge');
      }

      if (data.already_completed) {
        router.push(`/enroll?childId=${childId}&source=mini-challenge-completed`);
        return;
      }

      setChallengeData({
        childName: data.childName,
        childAge: data.childAge || 7,
        goalArea: data.goalArea,
        questions: data.questions,
        video: data.video,
        settings: {
          xpCorrect: data.settings?.xpCorrect || 10,
          xpVideo: data.settings?.xpVideo || 20,
          videoSkipDelay: data.settings?.videoSkipDelay || 30
        }
      });
      setStage('invite');

    } catch (err) {
      console.error('Failed to load challenge:', err);
      setError(err instanceof Error ? err.message : 'Failed to load challenge');
      setStage('error');
    }
  }

  function handleStart() {
    if (!challengeData) return;
    setStage('question');
  }

  function handleAnswer(selectedIndex: number, isCorrect: boolean) {
    if (!challengeData) return;

    const currentQuestion = challengeData.questions[currentQuestionIndex];

    const answer: Answer = {
      question: currentQuestion.question,
      selected_index: selectedIndex,
      correct_index: currentQuestion.correct_answer,
      is_correct: isCorrect
    };

    setAnswers(prev => [...prev, answer]);
    setLastAnswer({ isCorrect, selectedIndex });
    setStage('feedback');
  }

  function handleContinueAfterFeedback() {
    if (!challengeData) return;

    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex < challengeData.questions.length) {
      setCurrentQuestionIndex(nextIndex);
      setLastAnswer(null);
      setStage('question');
    } else {
      if (challengeData.video) {
        setStage('video');
      } else {
        submitResults(false, 0);
      }
    }
  }

  function handleVideoComplete(watchPercent: number) {
    setVideoWatched(true);
    setVideoWatchPercent(watchPercent);
    submitResults(true, watchPercent);
  }

  function handleVideoSkip() {
    submitResults(false, videoWatchPercent);
  }

  async function submitResults(watched: boolean, watchPercent: number) {
    if (!challengeData) return;

    try {
      const res = await fetch('/api/mini-challenge/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          goal: challengeData.goalArea,
          answers,
          videoWatched: watched,
          videoWatchPercent: watchPercent
        })
      });

      const data = await res.json();

      setFinalResults({
        score: data.score || answers.filter(a => a.is_correct).length,
        total: data.total || answers.length,
        xp_earned: data.xp_earned || 0
      });
      setVideoWatched(watched);
      setStage('results');

    } catch (err) {
      console.error('Failed to submit results:', err);
      const correctCount = answers.filter(a => a.is_correct).length;
      setFinalResults({
        score: correctCount,
        total: answers.length,
        xp_earned: (correctCount * (challengeData?.settings.xpCorrect || 10)) + (watched ? (challengeData?.settings.xpVideo || 20) : 0)
      });
      setVideoWatched(watched);
      setStage('results');
    }
  }

  function handleBookDiscovery() {
    if (!challengeData) return;

    // Build params for lets-talk page (discovery call booking)
    const params = new URLSearchParams({
      childId,
      childName: challengeData.childName,
      childAge: challengeData.childAge.toString(),
      source: 'mini-challenge',
    });

    router.push(`/lets-talk?${params.toString()}`);
    onComplete?.();
  }

  function handleSkipAll() {
    if (!challengeData) {
      router.push(`/enroll?childId=${childId}&source=assessment`);
      onSkip?.();
      return;
    }

    // Build params for enrollment page
    const params = new URLSearchParams({
      childId,
      childName: challengeData.childName,
      childAge: challengeData.childAge.toString(),
      source: 'mini-challenge-skip',
    });

    router.push(`/enroll?${params.toString()}`);
    onSkip?.();
  }

  // Render based on stage
  if (stage === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF0099]" />
        <p className="text-gray-400">Loading challenge...</p>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-white font-semibold mb-2">Something went wrong</h3>
        <p className="text-gray-400 mb-6">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={loadChallenge}
            className="h-12 px-6 bg-[#FF0099] hover:bg-[#FF0099]/90 text-white font-medium rounded-xl transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={handleSkipAll}
            className="h-12 px-6 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
          >
            Skip Challenge
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'invite' && challengeData) {
    return (
      <ChallengeInvite
        questionsCount={challengeData.questions.length}
        goalName={challengeData.goalArea}
        onStart={handleStart}
        onSkip={handleSkipAll}
      />
    );
  }

  if (stage === 'question' && challengeData) {
    const showAudio = challengeData.childAge <= 7;

    return (
      <QuestionCard
        question={challengeData.questions[currentQuestionIndex]}
        questionNumber={currentQuestionIndex + 1}
        totalQuestions={challengeData.questions.length}
        showAudio={showAudio}
        childAge={challengeData.childAge}
        onAnswer={handleAnswer}
      />
    );
  }

  if (stage === 'feedback' && challengeData && lastAnswer !== null) {
    const currentQuestion = challengeData.questions[currentQuestionIndex];
    const xpEarned = lastAnswer.isCorrect ? challengeData.settings.xpCorrect : 0;

    return (
      <AnswerFeedback
        isCorrect={lastAnswer.isCorrect}
        correctAnswer={currentQuestion.options[currentQuestion.correct_answer]}
        explanation={currentQuestion.explanation}
        xpEarned={xpEarned}
        childAge={challengeData.childAge}
        onContinue={handleContinueAfterFeedback}
      />
    );
  }

  if (stage === 'video' && challengeData?.video) {
    return (
      <VideoLesson
        videoUrl={challengeData.video.video_url}
        title={challengeData.video.name}
        skipDelaySeconds={challengeData.settings.videoSkipDelay}
        onComplete={handleVideoComplete}
        onSkip={handleVideoSkip}
      />
    );
  }

  if (stage === 'results' && finalResults && challengeData) {
    return (
      <ChallengeResults
        score={finalResults.score}
        total={finalResults.total}
        videoWatched={videoWatched}
        xpEarned={finalResults.xp_earned}
        childName={challengeData.childName}
        onBookDiscovery={handleBookDiscovery}
        onSkip={handleSkipAll}
      />
    );
  }

  return null;
}
