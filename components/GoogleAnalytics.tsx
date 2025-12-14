'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

// GA4 Measurement ID
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-1KJ6P709KZ';

// Track page views
function GoogleAnalyticsTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && typeof window !== 'undefined' && (window as any).gtag) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
      (window as any).gtag('config', GA_MEASUREMENT_ID, {
        page_path: url,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export default function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
      <Suspense fallback={null}>
        <GoogleAnalyticsTracking />
      </Suspense>
    </>
  );
}

// ==================== EVENT TRACKING HELPERS ====================

// Call these functions from anywhere in your app to track events

export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, parameters);
  }
};

// Pre-defined events for Yestoryd
export const analytics = {
  // Assessment Events
  assessmentStarted: (childAge: string) => {
    trackEvent('assessment_started', {
      event_category: 'Assessment',
      event_label: `Age ${childAge}`,
      child_age: childAge,
    });
  },

  assessmentCompleted: (childName: string, score: number, childAge: string) => {
    trackEvent('assessment_completed', {
      event_category: 'Assessment',
      event_label: `Score ${score}/10`,
      child_name: childName,
      score: score,
      child_age: childAge,
    });
  },

  // Conversion Events
  ctaClicked: (ctaName: string, location: string) => {
    trackEvent('cta_clicked', {
      event_category: 'Conversion',
      event_label: ctaName,
      cta_location: location,
    });
  },

  coachCallBooked: (childName: string) => {
    trackEvent('coach_call_booked', {
      event_category: 'Conversion',
      event_label: childName,
    });
  },

  enrollmentStarted: (childName: string) => {
    trackEvent('enrollment_started', {
      event_category: 'Conversion',
      event_label: childName,
    });
  },

  enrollmentCompleted: (childName: string, amount: number) => {
    trackEvent('purchase', {
      event_category: 'Conversion',
      event_label: childName,
      value: amount,
      currency: 'INR',
    });
  },

  // User Events
  userSignedUp: (method: string) => {
    trackEvent('sign_up', {
      event_category: 'User',
      method: method, // 'google' or 'email'
    });
  },

  userLoggedIn: (method: string) => {
    trackEvent('login', {
      event_category: 'User',
      method: method,
    });
  },

  // Engagement Events
  whatsappClicked: (location: string) => {
    trackEvent('whatsapp_clicked', {
      event_category: 'Engagement',
      event_label: location,
    });
  },

  resultsShared: (platform: string) => {
    trackEvent('results_shared', {
      event_category: 'Engagement',
      event_label: platform, // 'whatsapp'
    });
  },

  passagePlayed: (ageGroup: string) => {
    trackEvent('passage_played', {
      event_category: 'Assessment',
      event_label: ageGroup,
    });
  },

  recordingStarted: () => {
    trackEvent('recording_started', {
      event_category: 'Assessment',
    });
  },

  recordingCompleted: (duration: number) => {
    trackEvent('recording_completed', {
      event_category: 'Assessment',
      duration_seconds: duration,
    });
  },
};
