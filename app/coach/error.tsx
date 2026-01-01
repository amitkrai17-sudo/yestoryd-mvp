'use client';

import { useEffect } from 'react';

export default function CoachDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Coach dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Coach Portal Error
        </h2>
        
        <p className="text-gray-600 mb-6">
          Something went wrong loading the coach portal. Your student data is unaffected.
        </p>

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Reload Portal
          </button>
          
          <a
            href="/coach/dashboard"
            className="block text-gray-500 hover:text-gray-700"
          >
            Go to Dashboard
          </a>
        </div>

        {error.digest && (
          <p className="mt-4 text-xs text-gray-400">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
