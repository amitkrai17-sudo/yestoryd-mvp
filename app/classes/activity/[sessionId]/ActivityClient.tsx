// =============================================================================
// FILE: app/classes/activity/[sessionId]/ActivityClient.tsx
// PURPOSE: Public parent-facing page for typed responses during group class
//          individual moments. Runs on budget Android phones — keep it light.
// =============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

// =============================================================================
// TYPES
// =============================================================================

interface TokenPayload {
  session_id: string;
  participant_id: string;
  child_id: string;
  child_name: string;
}

interface StatusData {
  active: boolean;
  session_status: string;
  prompt: string | null;
  age_band: string;
  already_submitted: boolean;
}

type PageState = 'loading' | 'waiting' | 'active' | 'submitted' | 'already_submitted' | 'error';

// =============================================================================
// TOKEN DECODE (client-side — no HMAC verification, just structure)
// Server verifies HMAC on API calls
// =============================================================================

function decodeTokenClient(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const json = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
    const compact = JSON.parse(json);
    if (!compact.s || !compact.p || !compact.c || !compact.n) return null;
    return {
      session_id: compact.s,
      participant_id: compact.p,
      child_id: compact.c,
      child_name: compact.n,
    };
  } catch {
    return null;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const MAX_CHARS = 500;

export default function ActivityClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const token = searchParams.get('token') || '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [tokenData, setTokenData] = useState<TokenPayload | null>(null);
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Decode token on mount
  useEffect(() => {
    if (!token) {
      setErrorMsg('No activity token provided. Please use the link shared by your instructor.');
      setPageState('error');
      return;
    }

    const decoded = decodeTokenClient(token);
    if (!decoded) {
      setErrorMsg('Invalid activity link. Please ask your instructor for a new link.');
      setPageState('error');
      return;
    }

    if (decoded.session_id !== sessionId) {
      setErrorMsg('Activity link does not match this session.');
      setPageState('error');
      return;
    }

    setTokenData(decoded);
    checkStatus(decoded);
  }, [token, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check session status
  const checkStatus = useCallback(async (data?: TokenPayload) => {
    const td = data || tokenData;
    if (!td) return;

    try {
      const res = await fetch(
        `/api/group-classes/activity/status/${sessionId}?token=${encodeURIComponent(token)}`
      );
      const status: StatusData = await res.json();

      if (!res.ok) {
        setErrorMsg('Could not load activity status.');
        setPageState('error');
        return;
      }

      if (status.already_submitted) {
        setPageState('already_submitted');
        return;
      }

      if (status.active && status.prompt) {
        setPrompt(status.prompt);
        setPageState('active');
      } else {
        setPageState('waiting');
      }
    } catch {
      setErrorMsg('Network error. Please check your connection.');
      setPageState('error');
    }
  }, [tokenData, sessionId, token]);

  // Auto-refresh when waiting (every 10 seconds)
  useEffect(() => {
    if (pageState !== 'waiting') return;
    const interval = setInterval(() => checkStatus(), 10000);
    return () => clearInterval(interval);
  }, [pageState, checkStatus]);

  // Submit response
  const handleSubmit = async () => {
    if (!response.trim() || !token) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/group-classes/activity/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, response_text: response.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');

      setPageState('submitted');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      // Don't change state — let them retry
    } finally {
      setSubmitting(false);
    }
  };

  const childName = tokenData?.child_name || 'there';

  // ─── LOADING ───
  if (pageState === 'loading') {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 border-3 border-pink-200 border-t-pink-500 rounded-full animate-spin mb-4" />
          <p className="text-gray-500 text-sm">Loading activity...</p>
        </div>
      </Shell>
    );
  }

  // ─── ERROR ───
  if (pageState === 'error') {
    return (
      <Shell>
        <div className="text-center py-12 px-4">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Oops!</h2>
          <p className="text-gray-600 text-sm">{errorMsg}</p>
        </div>
      </Shell>
    );
  }

  // ─── WAITING ───
  if (pageState === 'waiting') {
    return (
      <Shell>
        <div className="text-center py-12 px-4">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Hi {childName}!</h2>
          <p className="text-gray-600 text-sm mb-6">
            Waiting for your instructor to start the activity...
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-gray-400 text-xs mt-6">This page refreshes automatically</p>
        </div>
      </Shell>
    );
  }

  // ─── ALREADY SUBMITTED ───
  if (pageState === 'already_submitted') {
    return (
      <Shell>
        <div className="text-center py-12 px-4">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            You&apos;ve already submitted your response!
          </h2>
          <p className="text-gray-600 text-sm">
            Great job, {childName}! Your instructor has received your answer.
          </p>
        </div>
      </Shell>
    );
  }

  // ─── SUBMITTED ───
  if (pageState === 'submitted') {
    return (
      <Shell>
        <div className="text-center py-12 px-4">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Great job, {childName}!
          </h2>
          <p className="text-gray-600 text-sm">
            Your response has been submitted. You can close this page now.
          </p>
        </div>
      </Shell>
    );
  }

  // ─── ACTIVE — Show prompt and input ───
  return (
    <Shell>
      <div className="px-4 py-6 space-y-5">
        {/* Greeting */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">
            Hi {childName}! 👋
          </h2>
        </div>

        {/* Prompt */}
        <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4">
          <p className="text-gray-800 text-base leading-relaxed">{prompt}</p>
        </div>

        {/* Text Input */}
        <div>
          <textarea
            value={response}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) {
                setResponse(e.target.value);
              }
            }}
            placeholder="Type your answer here..."
            className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-gray-800 text-base placeholder:text-gray-400 focus:border-pink-400 focus:outline-none resize-none bg-white"
            rows={6}
            autoFocus
          />
          <div className="flex justify-end mt-1.5">
            <span className={`text-xs ${response.length > MAX_CHARS * 0.9 ? 'text-orange-500' : 'text-gray-400'}`}>
              {response.length}/{MAX_CHARS}
            </span>
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!response.trim() || submitting}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-bold text-lg disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {submitting ? 'Sending...' : 'Submit My Answer ✨'}
        </button>
      </div>
    </Shell>
  );
}

// =============================================================================
// SHELL — minimal layout wrapper (light theme, mobile-first)
// =============================================================================

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3 flex items-center justify-center">
        <span className="text-white font-bold text-sm tracking-wide">YESTORYD</span>
      </div>
      {/* Content */}
      <div className="max-w-lg mx-auto">
        {children}
      </div>
    </div>
  );
}
