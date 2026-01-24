'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
          <WifiOff className="w-10 h-10 text-gray-500" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">You&apos;re Offline</h1>
        <p className="text-gray-400 mb-6">Check your internet connection and try again.</p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF0099] text-white rounded-lg hover:bg-[#FF0099]/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
