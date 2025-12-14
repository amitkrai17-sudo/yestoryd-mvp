'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle,
  XCircle,
  Clock,
  Award,
  Loader2,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

interface Question {
  id: number;
  question: string;
  type: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

interface QuizData {
  id: string;
  topic: string;
  questions: Question[];
  childId: string;
  childName: string;
  sessionId?: string;
}

export default function QuizPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [answers, setAnswers] = useState<Array<{ questionId: number; answer: string }>>([]);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [startTime] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuiz();
  }, [sessionId]);

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      
      // Fetch session and quiz details
      const response = await fetch(`/api/sessions/complete?sessionId=${sessionId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load quiz');
      }

      const session = data.session;
      
      if (!session.quiz_topic) {
        throw new Error('No quiz assigned for this session');
      }

      // Fetch or generate quiz based on topic
      const quizResponse = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: session.quiz_topic,
          childAge: session.children?.age || 8,
          childId: session.children?.id,
          sessionId,
        }),
      });

      const quizResult = await quizResponse.json();

      if (!quizResponse.ok) {
        throw new Error(quizResult.error || 'Failed to load quiz');
      }

      setQuizData({
        id: quizResult.quiz.id,
        topic: session.quiz_topic,
        questions: quizResult.quiz.questions,
        childId: session.children?.id,
        childName: session.children?.child_name || session.children?.name,
        sessionId,
      });

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const nextQuestion = () => {
    if (!selectedAnswer) return;

    const newAnswers = [
      ...answers,
      { questionId: quizData!.questions[currentQuestion].id, answer: selectedAnswer },
    ];
    setAnswers(newAnswers);
    setSelectedAnswer('');

    if (currentQuestion < quizData!.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      submitQuiz(newAnswers);
    }
  };

  const submitQuiz = async (finalAnswers: Array<{ questionId: number; answer: string }>) => {
    if (!quizData) return;

    setSubmitting(true);

    try {
      const timeTaken = Math.round((Date.now() - startTime) / 1000);

      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: quizData.childId,
          sessionId: quizData.sessionId,
          quizId: quizData.id,
          topic: quizData.topic,
          questions: quizData.questions,
          answers: finalAnswers,
          timeTakenSeconds: timeTaken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit quiz');
      }

      setResult(data.result);
      setShowResult(true);

    } catch (err: any) {
      setError(err.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md shadow-lg">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Oops!</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (showResult && result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md shadow-lg">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
            result.percentage >= 60 ? 'bg-green-100' : 'bg-amber-100'
          }`}>
            {result.percentage >= 60 ? (
              <Award className="w-10 h-10 text-green-600" />
            ) : (
              <RefreshCw className="w-10 h-10 text-amber-600" />
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {result.percentage >= 80 ? '🎉 Excellent!' :
             result.percentage >= 60 ? '👍 Good Job!' :
             '💪 Keep Practicing!'}
          </h2>
          
          <div className="text-5xl font-bold text-purple-600 my-4">
            {result.score}/{result.total}
          </div>
          
          <p className="text-gray-500 mb-2">
            You scored {result.percentage}%
          </p>
          
          <p className="text-sm text-gray-400 mb-6">
            <Clock className="w-4 h-4 inline mr-1" />
            Completed in {Math.floor(result.timeTakenSeconds / 60)}:{(result.timeTakenSeconds % 60).toString().padStart(2, '0')}
          </p>

          {/* Show detailed results */}
          <div className="text-left bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Your Answers:</p>
            <div className="space-y-2">
              {result.detailedResults.map((r: any, index: number) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  {r.isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                  <div>
                    <p className={r.isCorrect ? 'text-green-700' : 'text-red-700'}>
                      Q{index + 1}: {r.userAnswer}
                    </p>
                    {!r.isCorrect && (
                      <p className="text-gray-500 text-xs">
                        Correct: {r.correctAnswer}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-purple-600 text-sm">
            ✨ Your result has been saved!
          </p>
        </div>
      </div>
    );
  }

  if (!quizData) return null;

  const question = quizData.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quizData.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-800">
            📝 {quizData.topic}
          </h1>
          <p className="text-gray-500 text-sm">
            Question {currentQuestion + 1} of {quizData.questions.length}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-gray-200 rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-purple-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">
            {question.question}
          </h2>

          <div className="space-y-3">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(option)}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  selectedAnswer === option
                    ? 'bg-purple-100 border-2 border-purple-500'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200 text-sm font-medium mr-3">
                  {String.fromCharCode(65 + index)}
                </span>
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Next Button */}
        <button
          onClick={nextQuestion}
          disabled={!selectedAnswer || submitting}
          className="w-full py-4 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : currentQuestion < quizData.questions.length - 1 ? (
            <>
              Next Question
              <ChevronRight className="w-5 h-5" />
            </>
          ) : (
            <>
              Submit Quiz
              <CheckCircle className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
