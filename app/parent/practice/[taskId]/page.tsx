// ============================================================
// SmartPractice Page — Interactive Homework Quiz
// Child reads passage, answers MCQs, earns XP
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Check, X, ChevronRight, Lightbulb, Star } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface PracticeQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_option_id: string;
  explanation: string | null;
  points: number;
}

interface PracticeData {
  task: {
    id: string;
    title: string;
    description: string;
    child_id: string;
    content_item_id: string;
  };
  passage: {
    title: string;
    text: string;
    wordCount: number;
  };
  questions: PracticeQuestion[];
}

type Stage = 'loading' | 'passage' | 'quiz' | 'results' | 'error';

export default function SmartPracticePage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [stage, setStage] = useState<Stage>('loading');
  const [data, setData] = useState<PracticeData | null>(null);
  const [error, setError] = useState('');

  // Quiz state
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: string; selectedIdx: number; isCorrect: boolean }[]>([]);

  // Results
  const [score, setScore] = useState({ correct: 0, total: 0, xp: 0 });
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    fetchPractice();
  }, [taskId]);

  const fetchPractice = async () => {
    try {
      const res = await fetch(`/api/parent/practice/${taskId}`);
      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'Practice not found');
        setStage('error');
        return;
      }
      setData(result);
      setStage('passage');
    } catch {
      setError('Failed to load practice');
      setStage('error');
    }
  };

  const handleAnswer = (optionIdx: number) => {
    if (answered || !data) return;
    setSelected(optionIdx);
    setAnswered(true);

    const q = data.questions[currentQ];
    const isCorrect = String(optionIdx) === q.correct_option_id;
    setAnswers(prev => [...prev, { questionId: q.id, selectedIdx: optionIdx, isCorrect }]);
  };

  const handleNext = () => {
    if (!data) return;
    if (currentQ < data.questions.length - 1) {
      setCurrentQ(prev => prev + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      // Quiz complete — calculate score
      const correctCount = answers.length > 0
        ? answers.filter(a => a.isCorrect).length + (selected !== null && String(selected) === data.questions[currentQ].correct_option_id ? 1 : 0)
        : 0;
      // Recalculate from full answers array (handleAnswer already pushed the last one)
      const allAnswers = answers;
      const correct = allAnswers.filter(a => a.isCorrect).length;
      const total = data.questions.length;
      const passed = (correct / total) >= 0.7;
      const perfect = correct === total;
      const xp = passed ? (perfect ? 80 : 50) : 0;

      setScore({ correct, total, xp });
      setStage('results');

      // Auto-complete task (non-blocking)
      completeTask(correct, total, xp);
    }
  };

  const completeTask = async (correct: number, total: number, xp: number) => {
    if (!data) return;
    setCompleting(true);
    try {
      // Mark task as completed
      await fetch(`/api/parent/tasks/${data.task.child_id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
    } catch (err) {
      console.error('Task completion failed:', err);
    } finally {
      setCompleting(false);
    }
  };

  // --- RENDER ---

  if (stage === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-gray-500 text-sm mt-3">Loading your practice...</p>
        </div>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">{error}</p>
          <button onClick={() => router.back()} className="mt-4 text-[#FF0099] font-medium text-sm">Go Back</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // PASSAGE STAGE
  if (stage === 'passage') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
        <div className="max-w-lg mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-100 rounded-xl">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Reading Time</h1>
              <p className="text-xs text-gray-500">{data.passage.wordCount} words</p>
            </div>
          </div>

          {/* Passage Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-4 font-reading">{data.passage.title}</h2>
            <div className="text-gray-700 text-base leading-relaxed whitespace-pre-line font-reading">
              {data.passage.text}
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={() => setStage('quiz')}
            className="w-full mt-6 bg-[#FF0099] text-white rounded-xl h-12 text-base font-medium flex items-center justify-center gap-2"
          >
            I've finished reading
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // QUIZ STAGE
  if (stage === 'quiz') {
    const q = data.questions[currentQ];
    const progress = ((currentQ + 1) / data.questions.length) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-lg mx-auto px-4 py-6">
          {/* Progress Bar */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-gray-100 rounded-xl">
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF0099] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 font-medium">{currentQ + 1}/{data.questions.length}</span>
          </div>

          {/* Question */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-4">
            <p className="text-gray-900 text-base font-medium leading-relaxed">{q.question_text}</p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {q.options.map((opt, idx) => {
              const isSelected = selected === idx;
              const isCorrect = String(idx) === q.correct_option_id;
              const showResult = answered;

              let optClass = 'bg-white border-gray-200 text-gray-900';
              if (showResult && isCorrect) {
                optClass = 'bg-emerald-50 border-emerald-400 text-emerald-900';
              } else if (showResult && isSelected && !isCorrect) {
                optClass = 'bg-red-50 border-red-400 text-red-900';
              } else if (isSelected && !showResult) {
                optClass = 'bg-[#FF0099]/10 border-[#FF0099] text-gray-900';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={answered}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all min-h-[48px] ${optClass} disabled:cursor-default`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      showResult && isCorrect ? 'border-emerald-500 bg-emerald-500' :
                      showResult && isSelected && !isCorrect ? 'border-red-500 bg-red-500' :
                      isSelected ? 'border-[#FF0099] bg-[#FF0099]' : 'border-gray-300'
                    }`}>
                      {showResult && isCorrect && <Check className="w-4 h-4 text-white" />}
                      {showResult && isSelected && !isCorrect && <X className="w-4 h-4 text-white" />}
                      {!showResult && isSelected && <div className="w-3 h-3 bg-white rounded-full" />}
                    </div>
                    <span className="text-sm">{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation + Next */}
          {answered && (
            <div className="mt-4 space-y-3">
              {q.explanation && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                  <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-900 text-sm">{q.explanation}</p>
                </div>
              )}
              <button
                onClick={handleNext}
                className="w-full bg-[#FF0099] text-white rounded-xl h-12 text-base font-medium flex items-center justify-center gap-2"
              >
                {currentQ < data.questions.length - 1 ? 'Next Question' : 'See Results'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // RESULTS STAGE
  if (stage === 'results') {
    const passed = (score.correct / score.total) >= 0.7;
    const perfect = score.correct === score.total;

    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-lg mx-auto px-4 py-12 text-center">
          {/* Star Icon */}
          <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${
            perfect ? 'bg-amber-100' : passed ? 'bg-emerald-100' : 'bg-blue-100'
          }`}>
            <Star className={`w-10 h-10 ${
              perfect ? 'text-amber-500' : passed ? 'text-emerald-500' : 'text-blue-500'
            }`} />
          </div>

          {/* Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {perfect ? 'Perfect Score!' : passed ? 'Great Job!' : 'Good Try!'}
          </h1>
          <p className="text-gray-500 mb-8">
            {perfect
              ? 'You answered every question correctly!'
              : passed
              ? `You got ${score.correct} out of ${score.total} right.`
              : `You got ${score.correct} out of ${score.total}. Keep practicing!`}
          </p>

          {/* Score Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold text-gray-900">{score.correct}/{score.total}</p>
                <p className="text-xs text-gray-500">Correct</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{Math.round((score.correct / score.total) * 100)}%</p>
                <p className="text-xs text-gray-500">Score</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#FF0099]">+{score.xp}</p>
                <p className="text-xs text-gray-500">XP</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={() => router.push('/parent/dashboard')}
            className="w-full bg-[#FF0099] text-white rounded-xl h-12 text-base font-medium mb-3"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => router.back()}
            className="w-full text-gray-500 text-sm"
          >
            View Tasks
          </button>
        </div>
      </div>
    );
  }

  return null;
}
