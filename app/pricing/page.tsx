import type { Metadata } from 'next';
import PricingPageClient from './PricingPageClient';
import { getPricingConfig } from '@/lib/config/pricing-config';

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

export default async function PricingPage() {
  // Fetch coaching pricing from DB (5-min cached)
  let coachingOriginalPrice = 11999;
  let coachingDiscountedPrice = 6999;

  try {
    const config = await getPricingConfig();
    const fullTier = config.tiers.find((t) => t.slug === 'full');
    if (fullTier) {
      coachingOriginalPrice = fullTier.originalPrice;
      coachingDiscountedPrice = fullTier.discountedPrice;
    }
  } catch (err) {
    console.error('[PricingPage] Failed to fetch pricing config:', err);
  }

  return (
    <PricingPageClient
      coachingOriginalPrice={coachingOriginalPrice}
      coachingDiscountedPrice={coachingDiscountedPrice}
    />
  );
}
