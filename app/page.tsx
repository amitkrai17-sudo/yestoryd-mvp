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
    // NOTE: These are last-resort fallbacks only used if pricing_plans DB fetch fails
    // Actual pricing comes from pricing_plans table via getHomePageData()
    originalPrice: 0,
    discountedPrice: 0,
    discountLabel: '',
    freeAssessmentWorth: '999',
  },
  contact: {
    whatsappNumber: '918976287997',
  },
  videos: {
    homepageStoryVideoUrl: 'https://www.youtube.com/embed/Dz94bVuWH_A',
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
      testimonial_text: "rAI pinpointed exactly where my son was struggling. The personalized coaching fixed issues his school couldn't identify.",
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
    const [settingsResult, productsResult, testimonialsResult, flagsResult] = await Promise.all([
      supabase.from('site_settings').select('key, value'),
      supabase.from('pricing_plans').select('*').eq('is_active', true).order('display_order', { ascending: true }),
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

    // Build products array from pricing_plans
    const products = (productsResult.data || []).map(plan => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      originalPrice: plan.original_price,
      discountedPrice: plan.discounted_price,
      discountLabel: plan.discount_label,
      sessionsIncluded: plan.sessions_included,
      coachingSessions: plan.sessions_coaching || 0,
      skillBuildingSessions: plan.sessions_skill_building || 0,
      checkinSessions: plan.sessions_checkin || 0,
      durationMonths: plan.duration_months,
      features: typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || []),
      isFeatured: plan.is_featured || false,
      badgeText: plan.badge_text,
      displayOrder: plan.display_order,
    }));

    // Build pricing object from pricing_plans table (full product)
    const fullProduct = products.find(p => p.slug === 'full') || products[products.length - 1];
    if (!fullProduct) {
      console.warn('[Homepage] No pricing_plans found in database - pricing will show loading');
    }
    const pricing = fullProduct ? {
      originalPrice: fullProduct.originalPrice,
      discountedPrice: fullProduct.discountedPrice,
      discountLabel: fullProduct.discountLabel || '',
      freeAssessmentWorth: settings.free_assessment_worth || '999',
    } : {
      // Fallback: shows 0 which will trigger "Contact us for pricing" in UI
      originalPrice: 0,
      discountedPrice: 0,
      discountLabel: '',
      freeAssessmentWorth: settings.free_assessment_worth || '999',
    };

    // Build contact
    const contact = {
      whatsappNumber: (settings.whatsapp_number || DEFAULTS.contact.whatsappNumber).replace(/[^0-9]/g, ''),
    };

    // Build videos object
    const videos = {
      homepageStoryVideoUrl: settings.homepage_story_video_url || settings.homepage_video_url || DEFAULTS.videos.homepageStoryVideoUrl,
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
      products,
      contact,
      videos,
      testimonials,
      showTestimonials,
    };
  } catch (error) {
    console.error('Error fetching homepage data:', error);
    return {
      stats: DEFAULTS.stats,
      pricing: DEFAULTS.pricing,
      products: [],
      contact: DEFAULTS.contact,
      videos: DEFAULTS.videos,
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
      products={data.products}
      contact={data.contact}
      videos={data.videos}
      testimonials={data.testimonials}
      showTestimonials={data.showTestimonials}
    />
  );
}
