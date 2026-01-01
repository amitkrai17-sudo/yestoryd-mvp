'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

// ============================================================
// TRACKING PIXELS FOR YESTORYD
// ============================================================
// 
// Meta Pixel ID: 650578416315366
// Google Ads ID: AW-7985613870
//
// ============================================================

const META_PIXEL_ID = '650578416315366'; // Yestoryd Meta Pixel
const GOOGLE_ADS_ID = 'AW-7985613870'; // Yestoryd Google Ads

// Declare fbq and gtag for TypeScript
declare global {
  interface Window {
    fbq: any;
    _fbq: any;
    gtag: any;
    dataLayer: any[];
  }
}

// ==================== META PIXEL ====================
export function MetaPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Track page views on route change
    if (window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [pathname, searchParams]);

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${META_PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

// ==================== GOOGLE ADS TAG ====================
export function GoogleAdsTag() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GOOGLE_ADS_ID}');
        `}
      </Script>
    </>
  );
}

// ==================== COMBINED COMPONENT ====================
function TrackingPixelsContent() {
  return (
    <>
      <MetaPixel />
      <GoogleAdsTag />
    </>
  );
}

export default function TrackingPixels() {
  return (
    <Suspense fallback={null}>
      <TrackingPixelsContent />
    </Suspense>
  );
}

// ==================== TRACKING HELPER FUNCTIONS ====================
// Use these to track specific events throughout your app

/**
 * Track Meta Pixel events
 * Call this when important actions happen
 */
export function trackMetaEvent(
  eventName: 'Lead' | 'CompleteRegistration' | 'Purchase' | 'InitiateCheckout' | 'Contact' | 'Schedule' | 'ViewContent',
  params?: Record<string, any>
) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
    console.log(`📊 Meta Pixel: ${eventName}`, params);
  }
}

/**
 * Track Google Ads conversions
 * Call this when conversions happen
 */
export function trackGoogleConversion(
  conversionLabel: string,
  value?: number,
  currency: string = 'INR'
) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: `${GOOGLE_ADS_ID}/${conversionLabel}`,
      value: value,
      currency: currency,
    });
    console.log(`📊 Google Ads: Conversion`, { conversionLabel, value });
  }
}

// ==================== EVENT MAPPING FOR YESTORYD ====================
/**
 * Ready-to-use tracking functions for Yestoryd events
 */

export const YestorydTracking = {
  // When someone starts the assessment
  assessmentStarted: (childAge: string) => {
    trackMetaEvent('Lead', {
      content_name: 'Assessment Started',
      content_category: 'assessment',
      value: 0,
      currency: 'INR',
    });
  },

  // When someone completes the assessment
  assessmentCompleted: (childName: string, score: number) => {
    trackMetaEvent('CompleteRegistration', {
      content_name: 'Assessment Completed',
      status: true,
      value: 999, // Worth of free assessment
      currency: 'INR',
    });
  },

  // When someone books a discovery call
  discoveryCallBooked: () => {
    trackMetaEvent('Schedule', {
      content_name: 'Discovery Call Booked',
    });
  },

  // When someone initiates checkout
  checkoutStarted: (packageName: string, amount: number) => {
    trackMetaEvent('InitiateCheckout', {
      content_name: packageName,
      value: amount,
      currency: 'INR',
    });
  },

  // When someone completes purchase
  purchaseCompleted: (packageName: string, amount: number, transactionId: string) => {
    trackMetaEvent('Purchase', {
      content_name: packageName,
      value: amount,
      currency: 'INR',
      transaction_id: transactionId,
    });
    // Also track Google Ads conversion (you'll get the label from Google Ads)
    // trackGoogleConversion('YOUR_CONVERSION_LABEL', amount);
  },

  // When someone contacts via WhatsApp
  whatsAppClicked: (source: string) => {
    trackMetaEvent('Contact', {
      content_name: 'WhatsApp Click',
      content_category: source,
    });
  },
};
