/**
 * Homepage - Server Component (Dynamic)
 *
 * Fetches data from database and passes to client component.
 * Changes in Admin Settings reflect here immediately.
 *
 * Enterprise Data Architecture: ALL content from site_settings table
 */

import { createClient } from '@supabase/supabase-js';
import HomePageClient, { ContentSettings } from './HomePageClient';

// Disable caching - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper to safely parse JSON values
function parseSettingValue(value: string): unknown {
  if (typeof value !== 'string') return value;
  // Check if it looks like JSON
  if ((value.startsWith('[') && value.endsWith(']')) ||
      (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

// Helper to safely extract string from settings (prevents rendering objects as React children)
function safeString(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  // If it's an object, return fallback to prevent "Objects are not valid as React child" error
  if (typeof value === 'object') {
    console.warn('Expected string but got object:', value);
    return fallback;
  }
  return String(value);
}

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
      supabase.from('site_settings').select('key, value, category'),
      supabase.from('pricing_plans').select('*').eq('is_active', true).eq('is_visible', true).order('display_order', { ascending: true }),
      supabase.from('testimonials').select('*').eq('is_active', true).order('display_order').limit(6),
      supabase.from('feature_flags').select('flag_key, flag_value'),
    ]);

    // Parse ALL settings (including new content settings)
    const settings: Record<string, unknown> = {};
    settingsResult.data?.forEach((item) => {
      settings[item.key] = parseSettingValue(item.value);
    });

    // Parse flags
    const flags: Record<string, boolean> = {};
    flagsResult.data?.forEach((item) => {
      flags[item.flag_key] = item.flag_value;
    });

    // Build stats object (ensure string types)
    const stats = {
      totalAssessments: String(settings.total_assessments || DEFAULTS.stats.totalAssessments),
      happyParents: String(settings.happy_parents || DEFAULTS.stats.happyParents),
      successRate: String(settings.success_rate || DEFAULTS.stats.successRate),
      avgImprovement: String(settings.average_improvement || DEFAULTS.stats.avgImprovement),
    };

    // Build session durations object (single source of truth)
    const sessionDurations = {
      coaching: parseInt(String(settings.session_coaching_duration_mins || '45')),
      skillBuilding: parseInt(String(settings.session_skill_building_duration_mins || '45')),
      checkin: parseInt(String(settings.session_checkin_duration_mins || '45')),
      discovery: parseInt(String(settings.session_discovery_duration_mins || '45')),
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
      isLocked: plan.is_locked || false,
      lockMessage: plan.lock_message || null,
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
      freeAssessmentWorth: String(settings.free_assessment_worth || '999'),
    } : {
      // Fallback: shows 0 which will trigger "Contact us for pricing" in UI
      originalPrice: 0,
      discountedPrice: 0,
      discountLabel: '',
      freeAssessmentWorth: String(settings.free_assessment_worth || '999'),
    };

    // Build contact
    const contact = {
      whatsappNumber: String(settings.whatsapp_number || DEFAULTS.contact.whatsappNumber).replace(/[^0-9]/g, ''),
    };

    // Build videos object
    const videos = {
      homepageStoryVideoUrl: String(settings.homepage_story_video_url || settings.homepage_video_url || DEFAULTS.videos.homepageStoryVideoUrl),
    };

    // Testimonials - use from DB or defaults
    const testimonials = testimonialsResult.data && testimonialsResult.data.length > 0
      ? testimonialsResult.data.slice(0, 3) // Show max 3 on homepage
      : DEFAULTS.testimonials;

    // Feature flags
    const showTestimonials = flags.show_testimonials ?? DEFAULTS.showTestimonials;

    // Build content settings object (all the new settings from site_settings)
    const content = {
      // Hero section (A/B tested)
      hero_badge_curiosity: safeString(settings.hero_badge_curiosity, 'rAI-Powered Reading Analysis'),
      hero_badge_validation: safeString(settings.hero_badge_validation, 'For Ages 4-12 • AI + Expert Coaches'),
      hero_headline_curiosity: settings.hero_headline_curiosity as string || "There's a Reason Your Child Avoids Reading",
      hero_headline_validation: settings.hero_headline_validation as string || "You've Noticed Something Isn't Clicking With Your Child's Reading",
      hero_reframe_text: settings.hero_reframe_text as string || "It's not laziness. It's not attitude.",
      hero_explanation_curiosity: settings.hero_explanation_curiosity as string || "It's usually a small gap in how they process sounds — something schools rarely identify. Our rAI finds it in 5 minutes. Free.",
      hero_explanation_validation: settings.hero_explanation_validation as string || "It's usually a small gap that schools don't catch — but rAI does. In 5 minutes. Free.",
      hero_cta_primary: settings.hero_cta_primary as string || 'Reading Test - Free',
      hero_cta_secondary: settings.hero_cta_secondary as string || 'Watch Our Story',
      hero_trust_badge_1: safeString(settings.hero_trust_badge_1, '100% Free'),
      hero_trust_badge_2: safeString(settings.hero_trust_badge_2, '5 Minutes'),
      hero_trust_badge_3: safeString(settings.hero_trust_badge_3, 'Instant Results'),
      hero_stat_percentage: settings.hero_stat_percentage as string || '87%',
      hero_stat_text: settings.hero_stat_text as string || 'of parents finally understood WHY their child struggled',
      hero_urgency_text: settings.hero_urgency_text as string || 'Reading gaps widen every month. Early identification matters.',

      // Transformation section
      transformation_header: settings.transformation_header as string || 'The 90-Day Transformation',
      transformation_before_items: settings.transformation_before_items as string[] || ['"I hate reading"', 'Avoids books', 'Reads slowly', 'Losing confidence'],
      transformation_after_items: settings.transformation_after_items as string[] || ['"Can I read more?"', 'Picks up books', 'Reads fluently', 'Speaks confidently'],
      transformation_tagline: settings.transformation_tagline as string || 'rAI finds the gaps • Coach fills them • You see progress',

      // Top bar / Header
      topbar_text_desktop: settings.topbar_text_desktop as string || 'Jolly Phonics Certified • 7 Years Experience',
      topbar_text_mobile: settings.topbar_text_mobile as string || 'Certified Phonics Expert',

      // Problem section
      problem_section_title: settings.problem_section_title as string || "What Schools Don't Tell You",
      problem_section_subtitle: settings.problem_section_subtitle as string || 'About why your child struggles with reading',
      problem_insight_title: settings.problem_insight_title as string || 'Reading is a Skill — Like Swimming',
      problem_insight_description: settings.problem_insight_description as string || 'Schools teach children WHAT to read, but rarely HOW to read. The science of reading — how sounds form words, how words form meaning — is often skipped.',
      problem_aser_stat: settings.problem_aser_stat as string || '50%',
      problem_aser_description: settings.problem_aser_description as string || 'of Grade 5 students in India cannot read a Grade 2 level text',
      problem_aser_source: settings.problem_aser_source as string || '— ASER 2023 Report',
      problem_signs: settings.problem_signs as string[] || ['Reads slowly, word by word', 'Guesses words instead of reading them', 'Understands when YOU read, struggles when THEY read', 'Avoids reading aloud', 'Says "I hate reading"'],
      problem_symptoms_text: settings.problem_symptoms_text as string || 'These are symptoms. The cause is usually a gap in phonemic awareness.',
      problem_good_news: settings.problem_good_news as string || 'Good news: Once identified, these gaps can be filled in weeks, not years.',

      // ARC section
      arc_section_badge: safeString(settings.arc_section_badge, 'THE YESTORYD ARC™'),
      arc_section_title: settings.arc_section_title as string || "Your Child's 90-Day Transformation",
      arc_section_subtitle: settings.arc_section_subtitle as string || 'A clear path from struggling reader to confident communicator',
      arc_assess_weeks: settings.arc_assess_weeks as string || 'Week 1-4',
      arc_assess_title: settings.arc_assess_title as string || 'Assess',
      arc_assess_subtitle: settings.arc_assess_subtitle as string || 'Foundation Arc',
      arc_assess_description: settings.arc_assess_description as string || 'AI listens to your child read and identifies exact gaps in 40+ sound patterns.',
      arc_assess_features: settings.arc_assess_features as string[] || ['5-minute AI assessment', 'Detailed gap report', 'Personalized learning path'],
      arc_remediate_weeks: settings.arc_remediate_weeks as string || 'Week 5-8',
      arc_remediate_title: settings.arc_remediate_title as string || 'Remediate',
      arc_remediate_subtitle: settings.arc_remediate_subtitle as string || 'Building Arc',
      arc_remediate_description: settings.arc_remediate_description as string || 'Expert coaches fill gaps with personalized 1:1 sessions using Jolly Phonics.',
      arc_remediate_features: settings.arc_remediate_features as string[] || ['6 coaching sessions (1:1)', 'Practice activities at home', 'Weekly WhatsApp updates'],
      arc_celebrate_weeks: settings.arc_celebrate_weeks as string || 'Week 9-12',
      arc_celebrate_title: settings.arc_celebrate_title as string || 'Celebrate',
      arc_celebrate_subtitle: settings.arc_celebrate_subtitle as string || 'Confidence Arc',
      arc_celebrate_description: settings.arc_celebrate_description as string || 'Your child reads with confidence. Measurable improvement you can see.',
      arc_celebrate_features: settings.arc_celebrate_features as string[] || ['Before/after comparison', 'Progress certificate', 'Continuation roadmap'],
      arc_promise_title: settings.arc_promise_title as string || 'The 90-Day Promise',
      arc_promise_description: settings.arc_promise_description as string || 'In 90 days, your child reads more fluently. This becomes the foundation for grammar, comprehension, writing, and confident English communication.',
      arc_promise_badge_1: safeString(settings.arc_promise_badge_1, 'Measurable Growth'),
      arc_promise_badge_2: safeString(settings.arc_promise_badge_2, '100% Refund Guarantee'),
      arc_promise_badge_3: safeString(settings.arc_promise_badge_3, 'Full Transparency'),
      arc_trust_assessment_time: settings.arc_trust_assessment_time as string || '5 min',
      arc_trust_coaching_type: settings.arc_trust_coaching_type as string || '1:1',
      arc_trust_transformation_days: settings.arc_trust_transformation_days as string || '90 days',

      // FAQ section
      faq_section_badge: safeString(settings.faq_section_badge, 'Common Questions'),
      faq_section_title: settings.faq_section_title as string || 'Frequently Asked Questions',
      faq_section_subtitle: settings.faq_section_subtitle as string || 'Everything you need to know before getting started',
      faq_still_questions: settings.faq_still_questions as string || 'Still have questions?',
      faq_whatsapp_cta: settings.faq_whatsapp_cta as string || 'Chat with us on WhatsApp',
      faq_items: settings.faq_items as Array<{ question: string; answer: string }> || [],

      // Story section
      story_section_badge: safeString(settings.story_section_badge, 'THE YESTORYD STORY'),
      story_quote: settings.story_quote as string || "I realized that love for stories wasn't enough. Kids needed the science of reading.",
      story_paragraph_1: settings.story_paragraph_1 as string || "Yestoryd started simply — I wanted to share the joy of storytelling with kids. But in my classes, I noticed a pattern. Kids loved the stories, but many couldn't read them.",
      story_paragraph_2: settings.story_paragraph_2 as string || "They struggled with sounds, blending, and word composition. I realized that reading is not natural — it's an acquired skill.",
      story_paragraph_3: settings.story_paragraph_3 as string || "I spent 7 years mastering Jolly Phonics and Jolly Grammar. Now, with AI technology, we can diagnose reading gaps instantly — so coaches can focus purely on the child.",
      story_credential_1: settings.story_credential_1 as string || 'Jolly Phonics Certified',
      story_credential_2: settings.story_credential_2 as string || '7 Years Experience',

      // rAI section
      rai_section_badge: safeString(settings.rai_section_badge, 'Meet rAI'),
      rai_section_title: settings.rai_section_title as string || 'Why rAI is Different (and Safer)',
      rai_section_subtitle: settings.rai_section_subtitle as string || 'rAI = Reading Intelligence — our AI that never guesses',
      rai_generic_ai_label: settings.rai_generic_ai_label as string || 'Generic AI',
      rai_generic_ai_name: settings.rai_generic_ai_name as string || 'ChatGPT, etc.',
      rai_generic_ai_type: settings.rai_generic_ai_type as string || 'General Purpose AI',
      rai_generic_ai_description: settings.rai_generic_ai_description as string || 'Guesses based on the internet. No reading expertise. No understanding of phonics rules. May give incorrect or generic advice.',
      rai_safe_ai_label: settings.rai_safe_ai_label as string || 'Safe, Expert-Verified AI',
      rai_safe_ai_name: settings.rai_safe_ai_name as string || 'rAI Knowledge Engine',
      rai_safe_ai_type: settings.rai_safe_ai_type as string || 'Expert-Verified AI',
      rai_safe_ai_description: settings.rai_safe_ai_description as string || "Consults our Expert Knowledge Base first. Built on 7+ years of Rucha's phonics expertise. Never guesses — always references proven methods.",
      rai_process_steps: settings.rai_process_steps as string[] || ['Child Error', 'Check Expert DB', 'Perfect Fix ✓'],
      rai_explanation_intro: settings.rai_explanation_intro as string || "Most AI makes things up. We couldn't risk that with your child's education.",
      rai_explanation_analogy: settings.rai_explanation_analogy as string || "Imagine rAI as a librarian with a manual written by Rucha. Built on 7+ years of phonics expertise.",
      rai_explanation_detail: settings.rai_explanation_detail as string || 'When your child makes a mistake, rAI doesn\'t guess. It looks up the exact page in our "Expert Manual" and tells the coach precisely which Phonics rule to practice.',

      // Testimonials section
      testimonials_section_badge: safeString(settings.testimonials_section_badge, 'Real Results'),
      testimonials_section_title: settings.testimonials_section_title as string || 'Parents See the Difference',
      testimonials_found_issue_stat: settings.testimonials_found_issue_stat as string || '87%',
      testimonials_found_issue_label: settings.testimonials_found_issue_label as string || 'Found the Real Issue',
      testimonials_improvement_stat: settings.testimonials_improvement_stat as string || '2x',
      testimonials_improvement_label: settings.testimonials_improvement_label as string || 'Avg. Improvement',

      // Journey section
      journey_section_badge: safeString(settings.journey_section_badge, 'The Complete Journey'),
      journey_section_title: settings.journey_section_title as string || 'From Reading Mastery to English Confidence',
      journey_section_subtitle: settings.journey_section_subtitle as string || 'Reading is the foundation. Everything else builds on top.',
      journey_insight_text: settings.journey_insight_text as string || 'In 90 days, your child masters reading fluency.',
      journey_insight_detail: settings.journey_insight_detail as string || 'This becomes the foundation for grammar, comprehension, writing, and eventually — confident English communication. The journey starts with the first step: understanding exactly where they are today.',

      // Pricing section
      pricing_section_badge: safeString(settings.pricing_section_badge, 'Start Your ARC Journey'),
      pricing_section_title: settings.pricing_section_title as string || 'Simple, Transparent Pricing',
      pricing_section_subtitle: settings.pricing_section_subtitle as string || 'Start free. See your child\'s reading profile. Choose the program that fits your family.',
      pricing_free_badge: safeString(settings.pricing_free_badge, 'Step 1 — Start Here'),
      pricing_free_title: settings.pricing_free_title as string || 'Free AI Assessment',
      pricing_free_description: settings.pricing_free_description as string || "See rAI in action — understand your child's reading level",
      pricing_free_price_label: settings.pricing_free_price_label as string || 'forever free',
      pricing_step2_badge: safeString(settings.pricing_step2_badge, 'Step 2 — Choose Your Program'),
      pricing_guarantee_text: settings.pricing_guarantee_text as string || '100% satisfaction guarantee on all programs. Flexible scheduling included.',

      // Final CTA section
      final_cta_title_line1: settings.final_cta_title_line1 as string || 'Reading Gaps Widen Every Month.',
      final_cta_title_line2: settings.final_cta_title_line2 as string || 'Find Yours in 5 Minutes.',
      final_cta_description: settings.final_cta_description as string || '87% of parents finally understood WHY their child struggled — after just one 5-minute assessment.',
      final_cta_subdescription: settings.final_cta_subdescription as string || 'Free. No card required. Instant results.',
      final_cta_urgency: settings.final_cta_urgency as string || "Early identification leads to faster improvement. Don't wait for report cards.",
      whatsapp_button_text: settings.whatsapp_button_text as string || 'WhatsApp Us',

      // Footer
      footer_description: settings.footer_description as string || 'AI-powered reading assessment and expert coaching for children aged 4-12. The Yestoryd ARC™ — Assess, Remediate, Celebrate.',
      footer_credential: settings.footer_credential as string || 'Jolly Phonics & Grammar Certified',
      footer_tagline: settings.footer_tagline as string || 'Made with love for young readers in India',

      // Floating elements
      floating_whatsapp_hover: settings.floating_whatsapp_hover as string || 'Chat with Us',
      sticky_mobile_cta: settings.sticky_mobile_cta as string || 'Reading Test - Free',
    };

    return {
      stats,
      pricing,
      products,
      contact,
      videos,
      testimonials,
      showTestimonials,
      content,
      sessionDurations,
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
      content: {} as ContentSettings,
      sessionDurations: { coaching: 45, skillBuilding: 45, checkin: 45, discovery: 45 },
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
      content={data.content}
      sessionDurations={data.sessionDurations}
    />
  );
}
