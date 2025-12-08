import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yestoryd - Unlock Your Child\'s Reading Potential',
  description: 'AI-powered reading assessments, personalized coaching, eLearning, storytelling, and more. Help your child become a confident reader.',
  keywords: ['reading', 'coaching', 'children', 'education', 'AI assessment', 'phonics', 'fluency'],
  authors: [{ name: 'Yestoryd', url: 'https://yestoryd.com' }],
  openGraph: {
    title: 'Yestoryd - Reading Excellence for Every Child',
    description: 'AI-powered reading assessments and personalized coaching',
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
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
