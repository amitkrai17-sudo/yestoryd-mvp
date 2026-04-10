'use client';

import { useFeatureGate } from '@/lib/features/use-feature-gate';
import type { FeatureKey } from '@/lib/features/types';
import { Lock, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

const FEATURE_DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  progress_cards: { title: 'Progress Reports', description: 'Track your child\'s growth with detailed AI-powered insights and shareable progress cards.' },
  elearning_access: { title: 'Interactive Learning', description: 'Unlock games, videos, and interactive modules that adapt to your child\'s level.' },
  smart_practice: { title: 'AI Daily Practice', description: 'Get personalized daily homework that adapts to your child\'s strengths and gaps.' },
  reading_tests: { title: 'Reading Assessments', description: 'Measure real progress with periodic AI-powered reading tests.' },
  gamification: { title: 'Badges & Rewards', description: 'Motivate your child with achievements, streaks, and a full gamification system.' },
  detailed_analysis: { title: 'Detailed AI Analysis', description: 'Get deep insights from every session with AI-powered analysis.' },
};

interface FeatureGateProps {
  featureKey: FeatureKey;
  childId: string | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  hideCompletely?: boolean;
}

export function FeatureGate({ featureKey, childId, children, fallback, hideCompletely }: FeatureGateProps) {
  const { isEnabled, isLoading } = useFeatureGate(featureKey, childId);

  if (isLoading) return null;

  if (isEnabled) return <>{children}</>;

  if (hideCompletely) return null;

  if (fallback) return <>{fallback}</>;

  const desc = FEATURE_DESCRIPTIONS[featureKey];
  const title = desc?.title ?? 'Available with 1:1 Coaching';
  const description = desc?.description ?? 'Upgrade to unlock this feature and get the full personalized experience.';

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Lock className="h-5 w-5 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {title}
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        {description}
      </p>
      <Link
        href="/coaching"
        className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF0099] px-4 h-10 text-sm font-medium text-white hover:bg-[#FF0099]/90 transition-colors"
      >
        Explore 1:1 Coaching
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
