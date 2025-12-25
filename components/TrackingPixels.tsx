// file: components/TrackingPixels.tsx
'use client';

import Script from 'next/script';
import { Suspense } from 'react';

const META_PIXEL_ID = '650578416315366';
const GOOGLE_ADS_ID = 'AW-7985613870';

declare global {
  interface Window {
    fbq: any;
    gtag: any;
  }
}

function MetaPixel() {
  if (!META_PIXEL_ID || META_PIXEL_ID === 'YOUR_META_PIXEL_ID') {
    return null;
  }

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

function GoogleAdsTag() {
  if (!GOOGLE_ADS_ID || GOOGLE_ADS_ID === 'YOUR_GOOGLE_ADS_ID') {
    return null;
  }

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

export function trackMetaEvent(
  eventName: 'Lead' | 'CompleteRegistration' | 'Purchase' | 'InitiateCheckout' | 'Contact' | 'Schedule' | 'ViewContent',
  params?: Record<string, any>
) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
  }
}

export function trackGoogleConversion(conversionLabel: string, value?: number) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: `${GOOGLE_ADS_ID}/${conversionLabel}`,
      value: value,
      currency: 'INR',
    });
  }
}