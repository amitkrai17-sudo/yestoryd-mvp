'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

/**
 * Handles Supabase implicit flow hash fragments on login pages.
 * When middleware redirects an authenticated request to /login, the
 * #access_token hash survives (RFC 7231). This hook extracts it,
 * calls setSession(), and hard-navigates to the dashboard.
 *
 * Returns a ref that is true while processing (caller should
 * skip normal auth setup when ref.current is true).
 */
export function useHashSessionRedirect(
  redirectTo: string,
  callbacks: {
    setError: (msg: string) => void;
    setCheckingSession: (v: boolean) => void;
  }
): { isProcessingHash: React.MutableRefObject<boolean> } {
  const isProcessingHash = useRef(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (!accessToken) return;

    if (!refreshToken) {
      callbacks.setError('Login failed — incomplete credentials. Please try again.');
      callbacks.setCheckingSession(false);
      return;
    }

    isProcessingHash.current = true;

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => {
        if (!sessionError) {
          // Clear hash only on success so tokens survive for retry on failure
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          window.location.href = redirectTo;
        } else {
          console.error('[Login] Failed to set session from hash:', sessionError.message);
          callbacks.setError('Login failed. Please try again.');
          callbacks.setCheckingSession(false);
          isProcessingHash.current = false;
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isProcessingHash };
}
