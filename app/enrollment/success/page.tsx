'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function EnrollmentSuccessPage() {
  const searchParams = useSearchParams();
  const childName = searchParams.get('childName') || 'your child';
  const childId = searchParams.get('childId') || '';
  
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    // Hide confetti after 5 seconds
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-12 px-4">
      {/* Simple confetti effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][
                    Math.floor(Math.random() * 5)
                  ],
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="max-w-2xl mx-auto text-center">
        {/* Success Icon */}
        <div className="mb-8">
          <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Success Message */}
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          🎉 Welcome to Yestoryd!
        </h1>
        
        <p className="text-xl text-gray-600 mb-8">
          {childName}'s reading journey begins now!
        </p>

        {/* What's Next Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-left mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            What happens next?
          </h2>

          <div className="space-y-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                1
              </div>
              <div className="ml-4">
                <h3 className="font-semibold text-gray-900">Check your email</h3>
                <p className="text-gray-600 text-sm">
                  You'll receive a confirmation email with all the details within 5 minutes.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                2
              </div>
              <div className="ml-4">
                <h3 className="font-semibold text-gray-900">Session scheduling</h3>
                <p className="text-gray-600 text-sm">
                  Our team will reach out within 24 hours to schedule {childName}'s first coaching session.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                3
              </div>
              <div className="ml-4">
                <h3 className="font-semibold text-gray-900">Access your dashboard</h3>
                <p className="text-gray-600 text-sm">
                  Track {childName}'s progress, view upcoming sessions, and access all resources.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
                ✓
              </div>
              <div className="ml-4">
                <h3 className="font-semibold text-gray-900">FREE access unlocked!</h3>
                <p className="text-gray-600 text-sm">
                  E-learning modules, storytelling workshops, and physical classes are now FREE for {childName}.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-indigo-50 rounded-xl p-6 mb-8">
          <p className="text-indigo-900">
            <span className="font-semibold">Questions?</span> WhatsApp us at{' '}
            <a href="https://wa.me/919876543210" className="underline font-semibold">
              +91 98765 43210
            </a>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-8 py-3 bg-white text-gray-700 rounded-xl font-semibold border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
