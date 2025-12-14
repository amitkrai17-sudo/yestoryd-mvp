/**
 * Homepage - Server Component (Dynamic)
 * 
 * Fetches data from database and passes to client component.
 * Changes in Admin Settings reflect here immediately.
 */

import { createClient } from '@supabase/supabase-js';
import HomePageClient from './HomePageClient';

// Disable caching - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ==================== DEFAULT VALUES ====================
const DEFAULTS = {
  stats: {
    totalAssessments: '1000+',
    happyParents: '500+',
    successRate: '95',
    avgImprovement: '2x',
  },
  pricing: {
    originalPrice: 9999,
    discountedPrice: 5999,
    discountLabel: 'SAVE 40%',
    freeAssessmentWorth: '999',
  },
  contact: {
    whatsappNumber: '918976287997',
  },
  testimonials: [
    {
      id: '1',
      testimonial_text: "My daughter went from hating reading to asking for bedtime stories every night. The transformation in 3 months was unbelievable!",
      parent_name: "Priya Mehta",
      parent_location: "Mumbai",
      child_name: "Ananya",
      child_age: 7,
      rating: 5,
    },
    {
      id: '2',
      testimonial_text: "Vedant AI pinpointed exactly where my son was struggling. The personalized coaching fixed issues his school couldn't identify.",
      parent_name: "Rahul Sharma",
      parent_location: "Delhi",
      child_name: "Arjun",
      child_age: 9,
      rating: 5,
    },
    {
      id: '3',
      testimonial_text: "Worth every rupee! My child improved 2 grade levels in reading. The coaches are patient and the progress tracking is excellent.",
      parent_name: "Sneha Patel",
      parent_location: "Bangalore",
      child_name: "Vihaan",
      child_age: 6,
      rating: 5,
    },
  ],
  showTestimonials: true,
};

// ==================== DATA FETCHING ====================
async function getHomePageData() {
  try {
    // Fetch all data in parallel
    const [settingsResult, pricingResult, testimonialsResult, flagsResult] = await Promise.all([
      supabase.from('site_settings').select('key, value'),
      supabase.from('pricing_plans').select('*').eq('is_active', true).eq('is_featured', true).limit(1).single(),
      supabase.from('testimonials').select('*').eq('is_active', true).order('display_order').limit(6),
      supabase.from('feature_flags').select('flag_key, flag_value'),
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

    // Parse flags
    const flags: Record<string, boolean> = {};
    flagsResult.data?.forEach((item) => {
      flags[item.flag_key] = item.flag_value;
    });

    // Build stats object
    const stats = {
      totalAssessments: settings.total_assessments || DEFAULTS.stats.totalAssessments,
      happyParents: settings.happy_parents || DEFAULTS.stats.happyParents,
      successRate: settings.success_rate || DEFAULTS.stats.successRate,
      avgImprovement: settings.average_improvement || DEFAULTS.stats.avgImprovement,
    };

    // Build pricing object
    const pricing = pricingResult.data ? {
      originalPrice: pricingResult.data.original_price || DEFAULTS.pricing.originalPrice,
      discountedPrice: pricingResult.data.discounted_price || DEFAULTS.pricing.discountedPrice,
      discountLabel: pricingResult.data.discount_label || DEFAULTS.pricing.discountLabel,
      freeAssessmentWorth: settings.free_assessment_worth || DEFAULTS.pricing.freeAssessmentWorth,
    } : {
      ...DEFAULTS.pricing,
      freeAssessmentWorth: settings.free_assessment_worth || DEFAULTS.pricing.freeAssessmentWorth,
    };

    // Build contact
    const contact = {
      whatsappNumber: (settings.whatsapp_number || DEFAULTS.contact.whatsappNumber).replace(/[^0-9]/g, ''),
    };

    // Testimonials - use from DB or defaults
    const testimonials = testimonialsResult.data && testimonialsResult.data.length > 0
      ? testimonialsResult.data.slice(0, 3) // Show max 3 on homepage
      : DEFAULTS.testimonials;

    // Feature flags
    const showTestimonials = flags.show_testimonials ?? DEFAULTS.showTestimonials;

    return {
      stats,
      pricing,
      contact,
      testimonials,
      showTestimonials,
    };
  } catch (error) {
    console.error('Error fetching homepage data:', error);
    return {
      stats: DEFAULTS.stats,
      pricing: DEFAULTS.pricing,
      contact: DEFAULTS.contact,
      testimonials: DEFAULTS.testimonials,
      showTestimonials: DEFAULTS.showTestimonials,
    };
  }
}

// ==================== SERVER COMPONENT ====================
export default async function HomePage() {
  const data = await getHomePageData();

  return (
    <HomePageClient
      stats={data.stats}
      pricing={data.pricing}
      contact={data.contact}
      testimonials={data.testimonials}
      showTestimonials={data.showTestimonials}
    />
  );
}
