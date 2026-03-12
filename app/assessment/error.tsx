'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

export default function AssessmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Assessment error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-purple-800 to-pink-800 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        {/* Friendly illustration */}
        <div className="flex justify-center mb-4">
          <RefreshCw className="w-16 h-16 text-purple-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Let&apos;s Try That Again
        </h1>
        
        <p className="text-gray-600 mb-6">
          The assessment hit a small bump. Don&apos;t worry - we can restart from where you left off.
        </p>

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-4 px-6 rounded-xl hover:opacity-90 transition-opacity text-lg"
          >
            Continue Assessment
          </button>
          
          <a
            href="/assessment"
            className="block w-full bg-gray-100 text-gray-700 font-medium py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Start Fresh
          </a>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-sm text-gray-500 mb-3">
            Still having trouble?
          </p>
          <WhatsAppButton
            phone={COMPANY_CONFIG.leadBotWhatsApp}
            message="Hi, I'm having trouble with the reading assessment"
            label="Chat with us on WhatsApp"
            variant="link"
          />
        </div>

        {error.digest && (
          <p className="mt-4 text-xs text-gray-400">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
