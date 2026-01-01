'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to your error reporting service (Sentry is already set up)
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Sad mascot or icon */}
          <div className="text-6xl mb-4">📚</div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Oops! Something went wrong
          </h1>
          
          <p className="text-gray-600 mb-6">
            Don&apos;t worry, your child&apos;s progress is safe. 
            Let&apos;s get you back on track.
          </p>

          <div className="space-y-3">
            <button
              onClick={reset}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
            
            <a
              href="/"
              className="block w-full bg-gray-100 text-gray-700 font-medium py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Go to Homepage
            </a>
          </div>

          {/* Error details for debugging - only show digest */}
          {error.digest && (
            <p className="mt-6 text-xs text-gray-400">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Support link */}
        <p className="text-center mt-4 text-sm text-gray-500">
          Need help?{' '}
          <a 
            href="https://wa.me/918976287997" 
            className="text-pink-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact us on WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}
