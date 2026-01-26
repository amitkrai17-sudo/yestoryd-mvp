'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold text-white mb-4">Something went wrong</h2>
        <p className="text-text-secondary mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
