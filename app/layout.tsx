import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Yestoryd - AI Reading Coach for Kids',
  description: 'Personalized reading coaching and AI-powered assessments to help every child become a confident reader.',
  keywords: ['reading', 'kids', 'education', 'AI', 'coaching', 'assessment', 'children', 'learning'],
  authors: [{ name: 'Yestoryd' }],
  openGraph: {
    title: 'Yestoryd - AI Reading Coach for Kids',
    description: 'Personalized reading coaching and AI-powered assessments',
    type: 'website',
    locale: 'en_IN',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#030712" />
      </head>
      <body className={`${poppins.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
