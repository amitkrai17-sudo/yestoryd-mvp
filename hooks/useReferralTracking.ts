// file: hooks/useReferralTracking.ts
// Hook to track referral codes from URL and cookies

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const REFERRAL_COOKIE_NAME = 'yestoryd_ref';
const REFERRAL_COOKIE_DAYS = 30;

interface ReferralData {
  referral_code: string | null;
  coach_id: string | null;
  coach_name: string | null;
  source: 'url' | 'cookie' | null;
}

// Cookie helpers
function setCookie(name: string, value: string, days: number) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name: string): string | null {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export function useReferralTracking() {
  const searchParams = useSearchParams();
  const [referralData, setReferralData] = useState<ReferralData>({
    referral_code: null,
    coach_id: null,
    coach_name: null,
    source: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const trackReferral = async () => {
      try {
        // 1. Check URL for ref param
        const urlRef = searchParams.get('ref');
        
        // 2. Check cookie for existing referral
        const cookieRef = getCookie(REFERRAL_COOKIE_NAME);
        
        // 3. Determine which to use (URL takes priority)
        const refCode = urlRef || cookieRef;
        const source = urlRef ? 'url' : cookieRef ? 'cookie' : null;

        if (!refCode) {
          setLoading(false);
          return;
        }

        // 4. Validate referral code with API
        const res = await fetch(`/api/referral/track?ref=${refCode}`);
        const data = await res.json();

        if (data.valid && data.coach_id) {
          // Valid referral - store in cookie if from URL
          if (urlRef) {
            setCookie(REFERRAL_COOKIE_NAME, refCode.toUpperCase(), REFERRAL_COOKIE_DAYS);
            
            // Track visit (only for new URL referrals)
            fetch('/api/referral/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                referral_code: refCode,
                landing_page: window.location.pathname,
                user_agent: navigator.userAgent,
              }),
            }).catch(console.error);
          }

          setReferralData({
            referral_code: data.referral_code,
            coach_id: data.coach_id,
            coach_name: data.coach_name,
            source,
          });
        }
      } catch (error) {
        console.error('Referral tracking error:', error);
      } finally {
        setLoading(false);
      }
    };

    trackReferral();
  }, [searchParams]);

  return { ...referralData, loading };
}

// Utility to get referral data for form submission
export function getReferralDataForSubmission(): { 
  lead_source: string; 
  lead_source_coach_id: string | null;
  referral_code_used: string | null;
} {
  const cookieRef = getCookie(REFERRAL_COOKIE_NAME);
  
  if (cookieRef) {
    // We'll need to fetch the coach_id synchronously or from a stored value
    // For now, return the code and let the backend look it up
    return {
      lead_source: 'coach',
      lead_source_coach_id: null, // Backend will lookup from referral_code
      referral_code_used: cookieRef,
    };
  }

  return {
    lead_source: 'yestoryd',
    lead_source_coach_id: null,
    referral_code_used: null,
  };
}
