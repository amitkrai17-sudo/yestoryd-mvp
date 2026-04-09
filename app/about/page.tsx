import type { Metadata } from 'next';
import AboutPageClient from './AboutPageClient';

export const metadata: Metadata = {
  title: 'About Yestoryd — AI-Powered English Learning for Kids | Founded by Rucha Rai',
  description:
    'Yestoryd combines certified reading coaching with AI intelligence to help children ages 4-12 build English confidence. Founded by Rucha Rai, a certified reading coach and mother.',
  keywords:
    'about yestoryd, rucha rai, reading coach india, ai english learning, children reading program',
  openGraph: {
    title: 'About Yestoryd — AI-Powered English Learning for Kids',
    description:
      'Certified reading coaching with AI intelligence for children ages 4-12. Founded by Rucha Rai.',
    url: 'https://yestoryd.com/about',
    siteName: 'Yestoryd',
    type: 'website',
  },
};

export default function AboutPage() {
  return <AboutPageClient />;
}
