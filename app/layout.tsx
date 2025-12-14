import './globals.css';
import { Poppins } from 'next/font/google';
import type { Metadata } from 'next';
import GoogleAnalytics from '@/components/GoogleAnalytics';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'Yestoryd - AI Reading Assessment & Coaching for Kids',
  description: 'Free AI-powered reading assessment for children aged 4-12. Get instant results, personalized feedback, and expert coaching to improve your child\'s reading skills.',
  keywords: 'reading assessment, kids reading, phonics, reading coach, AI assessment, children education, reading skills',
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
        {children}
      </body>
    </html>
  );
}