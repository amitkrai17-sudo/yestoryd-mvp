'use client';

import { useEffect } from 'react';

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin dashboard error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl shadow-lg p-6 text-center border border-gray-700">
        <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h2 className="text-xl font-bold text-white mb-2">
          Admin Portal Error
        </h2>
        
        <p className="text-gray-400 mb-6">
          Failed to load admin dashboard. Check console for details.
        </p>

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-purple-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Reload Admin
          </button>
          
          <button
            onClick={() => {
              // Copy error details to clipboard for debugging
              navigator.clipboard.writeText(
                `Error: ${error.message}\nDigest: ${error.digest || 'N/A'}\nStack: ${error.stack || 'N/A'}`
              );
              alert('Error details copied to clipboard');
            }}
            className="w-full bg-gray-700 text-gray-300 font-medium py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            Copy Error Details
          </button>
        </div>

        {error.digest && (
          <p className="mt-4 text-xs text-gray-500 font-mono">
            {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
