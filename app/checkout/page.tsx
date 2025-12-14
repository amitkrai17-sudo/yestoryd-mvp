/**
 * Checkout Page - Server Component (Dynamic)
 * 
 * Fetches pricing from database and passes to client component.
 */

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import CheckoutClient from './CheckoutClient';
import { createClient } from '@supabase/supabase-js';

// Disable caching - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Default values
const DEFAULTS = {
  programName: '3-Month Reading Coaching',
  originalPrice: 9999,
  discountedPrice: 5999,
  sessions: 9,
  coachingSessions: 6,
  parentMeetings: 3,
  coachName: 'Rucha',
  features: [
    '6 One-on-One Coaching Sessions',
    '3 Parent Progress Meetings',
    'FREE E-Learning Library Access',
    'AI Progress Tracking',
    'WhatsApp Coach Support',
    'Session Recordings',
  ],
};

async function getPricingData() {
  try {
    const [pricingResult, settingsResult] = await Promise.all([
      supabase
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true)
        .eq('is_featured', true)
        .limit(1)
        .single(),
      supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['default_coach_name', 'coaching_sessions', 'parent_meetings']),
    ]);

    // Parse settings
    const settings: Record<string, string> = {};
    settingsResult.data?.forEach((item) => {
      try {
        settings[item.key] = JSON.parse(item.value);
      } catch {
        settings[item.key] = item.value;
      }
    });

    if (pricingResult.data) {
      const plan = pricingResult.data;
      const features = typeof plan.features === 'string' 
        ? JSON.parse(plan.features) 
        : plan.features || DEFAULTS.features;

      return {
        programName: plan.name || DEFAULTS.programName,
        originalPrice: plan.original_price || DEFAULTS.originalPrice,
        discountedPrice: plan.discounted_price || DEFAULTS.discountedPrice,
        sessions: plan.sessions_included || DEFAULTS.sessions,
        coachingSessions: parseInt(settings.coaching_sessions) || DEFAULTS.coachingSessions,
        parentMeetings: parseInt(settings.parent_meetings) || DEFAULTS.parentMeetings,
        coachName: settings.default_coach_name || DEFAULTS.coachName,
        features,
      };
    }

    return DEFAULTS;
  } catch (error) {
    console.error('Error fetching pricing:', error);
    return DEFAULTS;
  }
}

export default async function CheckoutPage() {
  const pricing = await getPricingData();

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    }>
      <CheckoutClient pricing={pricing} />
    </Suspense>
  );
}
