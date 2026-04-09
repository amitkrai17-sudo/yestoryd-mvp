import type { Metadata } from 'next';
import PricingPageClient from './PricingPageClient';

export const metadata: Metadata = {
  title: 'Pricing — Workshops, English Classes & 1:1 Coaching | Yestoryd',
  description:
    'Compare Yestoryd plans for children aged 4-12. Fun workshops from Rs 199, structured English classes with assigned coaches, or full AI-powered 1:1 coaching at Rs 6,999 per season.',
  keywords:
    'yestoryd pricing, english coaching price, english classes for kids price, kids workshops india, reading coaching cost, english tuition fees',
  openGraph: {
    title: 'Pricing — Workshops, English Classes & 1:1 Coaching | Yestoryd',
    description:
      'Compare Yestoryd plans for children aged 4-12. Workshops, English classes, and personalized 1:1 coaching.',
    url: 'https://yestoryd.com/pricing',
    siteName: 'Yestoryd',
    type: 'website',
  },
};

export default function PricingPage() {
  return <PricingPageClient />;
}
