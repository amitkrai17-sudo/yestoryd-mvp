import type { Metadata } from 'next';
import CoachingPageClient from './CoachingPageClient';
import { getPricingConfig } from '@/lib/config/pricing-config';

export const metadata: Metadata = {
  title: '1:1 English Coaching for Kids — AI-Powered, Personalized | Yestoryd',
  description:
    'Personalized 1:1 English coaching for children ages 4-12. AI-recorded sessions, SmartPractice daily homework, dedicated coach, reading assessments. Rs 6,999/season.',
  keywords:
    'english coaching for kids, 1:1 coaching, personalized english, reading coach, AI coaching, phonics coaching, english tutor india',
  openGraph: {
    title: '1:1 English Coaching for Kids — AI-Powered, Personalized | Yestoryd',
    description:
      'Personalized 1:1 English coaching for children ages 4-12. AI-recorded sessions, dedicated coach, measurable progress in 90 days.',
    url: 'https://yestoryd.com/coaching',
    siteName: 'Yestoryd',
    type: 'website',
  },
};

export default async function CoachingPage() {
  // Fetch coaching pricing from DB (5-min cached) — pricing_plans 'full' tier
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
    console.error('[CoachingPage] Failed to fetch pricing config:', err);
  }

  return (
    <CoachingPageClient
      coachingOriginalPrice={coachingOriginalPrice}
      coachingDiscountedPrice={coachingDiscountedPrice}
    />
  );
}
