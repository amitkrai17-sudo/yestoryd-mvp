'use client';

import { useEffect } from 'react';

export default function ParentDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Parent dashboard error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg shadow-gray-200/50 p-6 text-center border border-gray-100">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Dashboard Error
        </h2>

        <p className="text-gray-600 mb-6">
          We couldn&apos;t load your dashboard. Your child&apos;s data is safe.
        </p>

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-[#FF0099] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#FF0099]/80 transition-colors"
          >
            Reload Dashboard
          </button>

          <a
            href="/"
            className="block text-gray-500 hover:text-gray-600 transition-colors"
          >
            Return to Homepage
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
