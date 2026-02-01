import './globals.css';
import { Plus_Jakarta_Sans, Inter, Lexend } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import TrackingPixels from '@/components/TrackingPixels';
import PWAProvider from '@/components/shared/pwa/PWAProvider';
import { SiteSettingsProvider } from '@/contexts/SiteSettingsContext';
import { getSessionDurations } from '@/lib/settings/getSettings';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['600', '700', '800'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600'],
  display: 'swap',
});

const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-reading',
  weight: ['400', '500'],
  display: 'swap',
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch session durations server-side for SSR hydration
  const sessionDurations = await getSessionDurations();

  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable} ${lexend.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-body bg-surface-0 text-white antialiased">
        <GoogleAnalytics />
        <TrackingPixels />
        <SiteSettingsProvider initialDurations={sessionDurations}>
          <PWAProvider>
            {children}
          </PWAProvider>
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
