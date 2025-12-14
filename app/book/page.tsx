/**
 * Book Page - Server Component (Dynamic)
 * 
 * This fetches data from the database and passes to the client component.
 * Changes in Admin Settings will reflect here immediately.
 */

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import BookPageClient from './BookPageClient';
import { createClient } from '@supabase/supabase-js';

// Disable caching - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Create Supabase client for server-side fetching
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ==================== DEFAULT VALUES (Fallbacks) ====================
const DEFAULTS = {
  pricing: {
    name: '3-Month Reading Coaching',
    originalPrice: 9999,
    discountedPrice: 5999,
    sessions: 9,
    duration: '3 months',
    discountLabel: 'SAVE 40%',
    features: [
      '6 One-on-One Coaching Sessions',
      '3 Parent Progress Meetings',
      'FREE Access to E-Learning Library',
      'AI-Powered Progress Tracking',
      'WhatsApp Support from Coach',
      '100% Satisfaction Guarantee',
    ],
  },
  coach: {
    id: 'rucha',
    name: 'Rucha',
    title: 'Founder & Lead Reading Coach',
    experience: '10+ years',
    rating: '4.9',
    students: '500+',
    bio: 'Passionate about helping children discover the joy of reading through personalized coaching.',
    phone: '+918976287997',
    email: 'rucha.rai@yestoryd.com',
  },
  contact: {
    whatsapp: '+918976287997',
    calUsername: 'yestoryd',
    calSlug: 'discovery',
  },
  freeSessionEnabled: true,
};

// ==================== DATA FETCHING ====================
async function getPageData() {
  try {
    // Fetch settings, pricing, flags, and testimonials in parallel
    const [settingsResult, pricingResult, flagsResult, testimonialsResult] = await Promise.all([
      supabase.from('site_settings').select('key, value'),
      supabase.from('pricing_plans').select('*').eq('is_active', true).limit(1).single(),
      supabase.from('feature_flags').select('flag_key, flag_value'),
      supabase.from('testimonials').select('*').eq('is_active', true).eq('is_featured', true).order('display_order').limit(1),
    ]);

    // Parse settings into object
    const settings: Record<string, string> = {};
    settingsResult.data?.forEach((item) => {
      try {
        settings[item.key] = JSON.parse(item.value);
      } catch {
        settings[item.key] = item.value;
      }
    });

    // Parse feature flags
    const flags: Record<string, boolean> = {};
    flagsResult.data?.forEach((item) => {
      flags[item.flag_key] = item.flag_value;
    });

    // Build pricing object
    const pricing = pricingResult.data ? {
      name: pricingResult.data.name || DEFAULTS.pricing.name,
      originalPrice: pricingResult.data.original_price || DEFAULTS.pricing.originalPrice,
      discountedPrice: pricingResult.data.discounted_price || DEFAULTS.pricing.discountedPrice,
      sessions: pricingResult.data.sessions_included || DEFAULTS.pricing.sessions,
      duration: `${pricingResult.data.duration_months || 3} months`,
      discountLabel: pricingResult.data.discount_label || DEFAULTS.pricing.discountLabel,
      features: typeof pricingResult.data.features === 'string' 
        ? JSON.parse(pricingResult.data.features) 
        : pricingResult.data.features || DEFAULTS.pricing.features,
    } : DEFAULTS.pricing;

    // Build coach object
    const coach = {
      id: 'rucha',
      name: settings.default_coach_name || DEFAULTS.coach.name,
      title: settings.default_coach_title || DEFAULTS.coach.title,
      experience: settings.default_coach_experience || DEFAULTS.coach.experience,
      rating: settings.default_coach_rating || DEFAULTS.coach.rating,
      students: settings.default_coach_students || DEFAULTS.coach.students,
      bio: settings.default_coach_bio || DEFAULTS.coach.bio,
      phone: settings.default_coach_phone || DEFAULTS.coach.phone,
      email: settings.default_coach_email || DEFAULTS.coach.email,
    };

    // Build contact/links
    const contact = {
      whatsapp: settings.whatsapp_number || DEFAULTS.contact.whatsapp,
      calUsername: settings.cal_username || DEFAULTS.contact.calUsername,
      calSlug: settings.cal_discovery_slug || DEFAULTS.contact.calSlug,
    };

    // Feature flag for free session
    const freeSessionEnabled = flags.show_free_trial ?? DEFAULTS.freeSessionEnabled;

    // Get first featured testimonial
    const testimonial = testimonialsResult.data?.[0] || null;

    return {
      pricing,
      coach,
      contact,
      freeSessionEnabled,
      testimonial,
    };
  } catch (error) {
    console.error('Error fetching page data:', error);
    // Return defaults on error
    return {
      pricing: DEFAULTS.pricing,
      coach: DEFAULTS.coach,
      contact: DEFAULTS.contact,
      freeSessionEnabled: DEFAULTS.freeSessionEnabled,
      testimonial: null,
    };
  }
}

// ==================== SERVER COMPONENT ====================
export default async function BookPage() {
  const data = await getPageData();

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    }>
      <BookPageClient
        pricing={data.pricing}
        coach={data.coach}
        contact={data.contact}
        freeSessionEnabled={data.freeSessionEnabled}
        testimonial={data.testimonial}
      />
    </Suspense>
  );
}
