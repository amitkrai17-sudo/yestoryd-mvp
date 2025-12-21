'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface UseActivityTrackerOptions {
  userType: 'parent' | 'coach' | 'admin';
  userEmail: string | null;
  enabled?: boolean;
}

export function useActivityTracker({
  userType,
  userEmail,
  enabled = true,
}: UseActivityTrackerOptions) {
  const pathname = usePathname();
  const hasTrackedLogin = useRef(false);
  const lastTrackedPath = useRef<string | null>(null);

  // Track login on first mount
  useEffect(() => {
    if (!enabled || !userEmail || hasTrackedLogin.current) return;

    const trackLogin = async () => {
      try {
        await fetch('/api/activity/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userType,
            userEmail,
            action: 'login',
            pagePath: pathname,
          }),
        });
        hasTrackedLogin.current = true;
      } catch (error) {
        // Silently fail - activity tracking shouldn't break the app
        console.log('Activity tracking failed:', error);
      }
    };

    trackLogin();
  }, [userEmail, userType, enabled, pathname]);

  // Track page views on navigation
  useEffect(() => {
    if (!enabled || !userEmail) return;
    if (pathname === lastTrackedPath.current) return;

    const trackPageView = async () => {
      try {
        await fetch('/api/activity/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userType,
            userEmail,
            action: 'page_view',
            pagePath: pathname,
          }),
        });
        lastTrackedPath.current = pathname;
      } catch (error) {
        console.log('Page view tracking failed:', error);
      }
    };

    // Debounce to avoid tracking rapid navigations
    const timeout = setTimeout(trackPageView, 1000);
    return () => clearTimeout(timeout);
  }, [pathname, userEmail, userType, enabled]);

  // Track chat interactions
  const trackChat = async () => {
    if (!enabled || !userEmail) return;

    try {
      await fetch('/api/activity/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userType,
          userEmail,
          action: 'chat',
          pagePath: pathname,
        }),
      });
    } catch (error) {
      console.log('Chat tracking failed:', error);
    }
  };

  return { trackChat };
}

export default useActivityTracker;
