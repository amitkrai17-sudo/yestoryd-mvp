import './globals.css';
import { Poppins } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import TrackingPixels from '@/components/TrackingPixels';
import PWAProvider from '@/components/shared/pwa/PWAProvider';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FF0099',
};

export const metadata: Metadata = {
  title: 'Yestoryd - AI Reading Assessment & Coaching for Kids',
  description: 'Free AI-powered reading assessment for children aged 4-12. Get instant results, personalized feedback, and expert coaching to improve your child\'s reading skills.',
  keywords: 'reading assessment, kids reading, phonics, reading coach, AI assessment, children education, reading skills',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Yestoryd',
  },
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  openGraph: {
    title: 'Yestoryd - Free AI Reading Assessment for Kids',
    description: 'Know your child\'s reading level in 5 minutes. Free AI-powered assessment with instant results.',
    url: 'https://yestoryd.com',
    siteName: 'Yestoryd',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={poppins.variable}>
        <GoogleAnalytics />
        <TrackingPixels />
        <PWAProvider>
          {children}
        </PWAProvider>
      </body>
    </html>
  );
}
