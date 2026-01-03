// =============================================================================
// FILE: app/nps/[enrollmentId]/page.tsx
// PURPOSE: NPS Survey page - collect parent feedback after program completion
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Star, Send, Loader2, CheckCircle, Heart,
  ThumbsUp, ThumbsDown, MessageSquare, Sparkles,
  ChevronRight, ArrowRight
} from 'lucide-react';

export default function NPSSurveyPage() {
  const params = useParams();
  const router = useRouter();
  const enrollmentId = params.enrollmentId as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [improvements, setImprovements] = useState('');
  const [testimonialConsent, setTestimonialConsent] = useState(false);
  const [testimonialText, setTestimonialText] = useState('');

  // Enrollment data
  const [childName, setChildName] = useState('');
  const [coachName, setCoachName] = useState('');

  useEffect(() => {
    checkExistingNps();
  }, [enrollmentId]);

  async function checkExistingNps() {
    try {
      // Check completion status
      const checkRes = await fetch(`/api/completion/check/${enrollmentId}`);
      const checkData = await checkRes.json();

      if (checkData.success) {
        setChildName(checkData.enrollment?.childName || 'your child');
        setCoachName(checkData.enrollment?.coachName || 'your coach');

        if (checkData.npsSubmitted) {
          setSubmitted(true);
        }
      }

      // Check if NPS already exists
      const npsRes = await fetch(`/api/nps?enrollmentId=${enrollmentId}`);
      const npsData = await npsRes.json();

      if (npsData.exists) {
        setSubmitted(true);
        setScore(npsData.data?.score);
      }
    } catch (err) {
      console.error('Error checking NPS:', err);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (score === null) {
      setError('Please select a rating');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/nps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId,
          score,
          feedback,
          improvements,
          testimonialConsent,
          testimonialText: testimonialConsent ? testimonialText : null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Failed to submit feedback');
      }
    } catch (err) {
      setError('Failed to submit feedback');
    }
    setSubmitting(false);
  }

  const getScoreLabel = (s: number) => {
    if (s >= 9) return { text: 'Excellent!', color: 'text-green-600', emoji: '🎉' };
    if (s >= 7) return { text: 'Good', color: 'text-blue-600', emoji: '👍' };
    if (s >= 5) return { text: 'Okay', color: 'text-yellow-600', emoji: '😐' };
    return { text: 'Needs Improvement', color: 'text-red-600', emoji: '😔' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-pink-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Already submitted
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600 mb-6">
            Your feedback helps us improve our reading program for all families.
          </p>
          {score !== null && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500">Your rating</p>
              <p className="text-4xl font-bold text-pink-600">{score}/10</p>
            </div>
          )}
          <Link
            href={`/completion/${enrollmentId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
          >
            View Completion Certificate
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="Yestoryd"
              width={120}
              height={36}
              className="h-8 w-auto"
            />
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            How was {childName}&apos;s reading journey?
          </h1>
          <p className="text-gray-600">
            Your feedback helps us improve the experience for all families
          </p>
        </div>

        {/* Survey Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* NPS Score Selection */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-lg font-semibold text-gray-900 mb-4">
              How likely are you to recommend Yestoryd to other parents?
            </label>

            <div className="flex justify-between mb-2">
              <span className="text-xs text-gray-500">Not likely</span>
              <span className="text-xs text-gray-500">Very likely</span>
            </div>

            <div className="grid grid-cols-11 gap-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  className={`py-3 rounded-lg font-semibold text-sm transition-all ${
                    score === n
                      ? n >= 9
                        ? 'bg-green-500 text-white scale-110'
                        : n >= 7
                        ? 'bg-blue-500 text-white scale-110'
                        : n >= 5
                        ? 'bg-yellow-500 text-white scale-110'
                        : 'bg-red-500 text-white scale-110'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {score !== null && (
              <div className={`mt-4 text-center ${getScoreLabel(score).color}`}>
                <span className="text-2xl mr-2">{getScoreLabel(score).emoji}</span>
                <span className="font-semibold">{getScoreLabel(score).text}</span>
              </div>
            )}
          </div>

          {/* Feedback */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-lg font-semibold text-gray-900 mb-2">
              What did you love about the program?
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={`Tell us about ${childName}'s progress, Coach ${coachName}'s approach, or anything else...`}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            />
          </div>

          {/* Improvements */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <label className="block text-lg font-semibold text-gray-900 mb-2">
              How can we improve?
            </label>
            <textarea
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="Any suggestions for making the program better..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            />
          </div>

          {/* Testimonial Consent */}
          {score !== null && score >= 7 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200 p-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testimonialConsent}
                  onChange={(e) => setTestimonialConsent(e.target.checked)}
                  className="mt-1 w-5 h-5 text-pink-500 border-gray-300 rounded focus:ring-pink-500"
                />
                <div>
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    Share your story to inspire others
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    We&apos;d love to feature your success story on our website (with your permission)
                  </p>
                </div>
              </label>

              {testimonialConsent && (
                <div className="mt-4">
                  <textarea
                    value={testimonialText}
                    onChange={(e) => setTestimonialText(e.target.value)}
                    placeholder={`Share your experience: "My child ${childName} has improved so much..."`}
                    rows={3}
                    className="w-full px-4 py-3 border border-yellow-300 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || score === null}
            className="w-full py-4 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-lg rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Feedback
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
