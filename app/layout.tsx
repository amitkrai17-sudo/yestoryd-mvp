import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'Yestoryd - AI-Powered Reading Intelligence for Children',
  description: 'Personalized reading assessment and coaching for children aged 4-15. Take a free AI assessment and get matched with expert coaches.',
  keywords: 'reading assessment, children reading, phonics, reading coach, AI assessment, Yestoryd',
  openGraph: {
    title: 'Yestoryd - AI-Powered Reading Intelligence',
    description: 'Unlock your child\'s reading potential with AI-powered assessment and personalized coaching.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${poppins.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
