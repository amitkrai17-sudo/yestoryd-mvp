// =============================================================================
// FILE: app/classes/register/success/page.tsx
// PURPOSE: Success page after group class registration
// =============================================================================

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle, Calendar, Mail, MessageCircle,
  ArrowRight, Home, Gift, Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

function SuccessContent() {
  const searchParams = useSearchParams();
  const isFree = searchParams.get('free') === 'true';

  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!showConfetti) {
      setShowConfetti(true);

      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number): number => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#ff0099', '#00abff', '#ffde00', '#7b008b'],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#ff0099', '#00abff', '#ffde00', '#7b008b'],
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [showConfetti]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-8 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              You are Registered!
            </h1>
            <p className="text-green-100">
              {isFree ? (
                <span className="flex items-center justify-center gap-2">
                  <Gift className="w-5 h-5" />
                  Free as an enrolled family member!
                </span>
              ) : (
                'Payment successful - see you in class!'
              )}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#ffde00]" />
                What Happens Next?
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#ff0099]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-[#ff0099]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Check Your Email</p>
                    <p className="text-gray-600 text-sm">
                      Confirmation with class details sent to your inbox
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#25D366]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-[#25D366]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">WhatsApp Reminders</p>
                    <p className="text-gray-600 text-sm">
                      We will send reminders 1 day and 1 hour before class
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#00abff]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-[#00abff]" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Join on Class Day</p>
                    <p className="text-gray-600 text-sm">
                      Click the Google Meet link in your email/WhatsApp to join
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 mb-8 border border-amber-100">
              <p className="font-semibold text-amber-800 mb-2">Tips for a Great Class</p>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>Find a quiet spot with good internet</li>
                <li>Have your child ready 5 minutes early</li>
                <li>Keep camera on for best engagement</li>
                <li>Younger children (4-6) may need parent nearby</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Link
                href="/classes"
                className="w-full py-4 bg-gradient-to-r from-[#ff0099] to-[#7b008b] text-white rounded-xl font-bold text-center flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-pink-300/50 transition-all"
              >
                Browse More Classes
                <ArrowRight className="w-5 h-5" />
              </Link>

              <Link
                href="/"
                className="w-full py-4 border-2 border-gray-200 text-gray-700 rounded-xl font-bold text-center flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <Home className="w-5 h-5" />
                Back to Home
              </Link>
            </div>

            {!isFree && (
              <div className="mt-8 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-100">
                <p className="font-bold text-gray-900 mb-2">
                  Want FREE Unlimited Classes?
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  Enroll in our 1:1 coaching program and get all group classes FREE forever!
                </p>
                <Link
                  href="/assessment"
                  className="inline-flex items-center gap-2 text-[#ff0099] font-semibold hover:underline"
                >
                  Reading Test - Free
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-500 text-sm">
            Questions?{' '}
            <a
              href="https://wa.me/918976287997?text=Hi!%20I%20just%20registered%20for%20a%20group%20class%20and%20have%20a%20question."
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#25D366] font-semibold hover:underline"
            >
              Chat with us on WhatsApp
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function RegistrationSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SuccessContent />
    </Suspense>
  );
}
