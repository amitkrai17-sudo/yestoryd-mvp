'use client';

import { useState, useEffect } from 'react';
import {
  HeaderNav,
  HeroSection,
  TransformationSection,
  ProblemSection,
  ArcSection,
  StorySection,
  RaiSection,
  TestimonialsSection,
  JourneySection,
  PricingSection,
  FaqSection,
  CtaSection,
  FooterSection,
  FloatingElements,
} from './(home)/_components';
import SocialProofBar from '@/components/website/SocialProofBar';
import AICredibilitySection from '@/components/website/AICredibilitySection';
import AssessmentPreview from '@/components/website/AssessmentPreview';

// ==================== TYPES ====================
interface StatsData {
  totalAssessments: string;
  happyParents: string;
  successRate: string;
  avgImprovement: string;
}

interface PricingData {
  originalPrice: number;
  discountedPrice: number;
  discountLabel: string;
  freeAssessmentWorth: string;
}

interface ProductData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  originalPrice: number;
  discountedPrice: number;
  discountLabel: string | null;
  sessionsIncluded: number;
  coachingSessions: number;
  skillBuildingSessions: number;
  checkinSessions: number;
  durationMonths: number;
  features: string[];
  isFeatured: boolean;
  badgeText: string | null;
  displayOrder: number;
  isLocked?: boolean;
  lockMessage?: string | null;
}

interface ContactData {
  whatsappNumber: string;
}

interface VideoData {
  homepageStoryVideoUrl: string;
}

interface TestimonialData {
  id: string;
  testimonial_text: string;
  parent_name: string;
  parent_location?: string;
  child_name: string;
  child_age: number;
  rating: number;
}

interface ABTestConfig {
  enabled: boolean;
  testName: string;
  split: number;
}

// Content settings from database (single source of truth)
export interface ContentSettings {
  hero_badge_curiosity: string;
  hero_badge_validation: string;
  hero_headline_curiosity: string;
  hero_headline_validation: string;
  hero_reframe_text: string;
  hero_explanation_curiosity: string;
  hero_explanation_validation: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  hero_trust_badge_1: string;
  hero_trust_badge_2: string;
  hero_trust_badge_3: string;
  hero_stat_percentage: string;
  hero_stat_text: string;
  hero_urgency_text: string;
  transformation_header: string;
  transformation_before_items: string[];
  transformation_after_items: string[];
  transformation_tagline: string;
  topbar_text_desktop: string;
  topbar_text_mobile: string;
  problem_section_title: string;
  problem_section_subtitle: string;
  problem_insight_title: string;
  problem_insight_description: string;
  problem_aser_stat: string;
  problem_aser_description: string;
  problem_aser_source: string;
  problem_signs: string[];
  problem_symptoms_text: string;
  problem_good_news: string;
  arc_section_badge: string;
  arc_section_title: string;
  arc_section_subtitle: string;
  arc_assess_weeks: string;
  arc_assess_title: string;
  arc_assess_subtitle: string;
  arc_assess_description: string;
  arc_assess_features: string[];
  arc_remediate_weeks: string;
  arc_remediate_title: string;
  arc_remediate_subtitle: string;
  arc_remediate_description: string;
  arc_remediate_features: string[];
  arc_celebrate_weeks: string;
  arc_celebrate_title: string;
  arc_celebrate_subtitle: string;
  arc_celebrate_description: string;
  arc_celebrate_features: string[];
  arc_promise_title: string;
  arc_promise_description: string;
  arc_promise_badge_1: string;
  arc_promise_badge_2: string;
  arc_promise_badge_3: string;
  arc_trust_assessment_time: string;
  arc_trust_coaching_type: string;
  arc_trust_transformation_days: string;
  faq_section_badge: string;
  faq_section_title: string;
  faq_section_subtitle: string;
  faq_still_questions: string;
  faq_whatsapp_cta: string;
  faq_items: Array<{ question: string; answer: string }>;
  story_section_badge: string;
  story_quote: string;
  story_paragraph_1: string;
  story_paragraph_2: string;
  story_paragraph_3: string;
  story_credential_1: string;
  story_credential_2: string;
  rai_section_badge: string;
  rai_section_title: string;
  rai_section_subtitle: string;
  rai_generic_ai_label: string;
  rai_generic_ai_name: string;
  rai_generic_ai_type: string;
  rai_generic_ai_description: string;
  rai_safe_ai_label: string;
  rai_safe_ai_name: string;
  rai_safe_ai_type: string;
  rai_safe_ai_description: string;
  rai_process_steps: string[];
  rai_explanation_intro: string;
  rai_explanation_analogy: string;
  rai_explanation_detail: string;
  testimonials_section_badge: string;
  testimonials_section_title: string;
  testimonials_found_issue_stat: string;
  testimonials_found_issue_label: string;
  testimonials_improvement_stat: string;
  testimonials_improvement_label: string;
  journey_section_badge: string;
  journey_section_title: string;
  journey_section_subtitle: string;
  journey_insight_text: string;
  journey_insight_detail: string;
  pricing_section_badge: string;
  pricing_section_title: string;
  pricing_section_subtitle: string;
  pricing_free_badge: string;
  pricing_free_title: string;
  pricing_free_description: string;
  pricing_free_price_label: string;
  pricing_step2_badge: string;
  pricing_guarantee_text: string;
  final_cta_title_line1: string;
  final_cta_title_line2: string;
  final_cta_description: string;
  final_cta_subdescription: string;
  final_cta_urgency: string;
  whatsapp_button_text: string;
  footer_description: string;
  footer_credential: string;
  footer_tagline: string;
  floating_whatsapp_hover: string;
  sticky_mobile_cta: string;
}

interface SessionDurations {
  coaching: number;
  skillBuilding: number;
  checkin: number;
  discovery: number;
}

interface HomePageClientProps {
  stats: StatsData;
  pricing: PricingData;
  products: ProductData[];
  contact: ContactData;
  videos: VideoData;
  testimonials: TestimonialData[];
  showTestimonials: boolean;
  abTestConfig?: ABTestConfig;
  content: ContentSettings;
  sessionDurations: SessionDurations;
  pricingDisplayData?: any;
}

// ==================== A/B TEST UTILITIES ====================
type ABVariant = 'curiosity' | 'validation';

const getOrSetABVariant = (testName: string, split: number = 0.5): ABVariant => {
  if (typeof window === 'undefined') return 'validation';
  const cookieName = `yestoryd_ab_${testName}`;
  const existingCookie = document.cookie.split('; ').find(row => row.startsWith(cookieName));
  if (existingCookie) return existingCookie.split('=')[1] as ABVariant;
  const variant: ABVariant = Math.random() < split ? 'curiosity' : 'validation';
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  document.cookie = `${cookieName}=${variant}; expires=${expires.toUTCString()}; path=/`;
  return variant;
};

const trackABEvent = async (testName: string, variant: string, eventType: string) => {
  try {
    await fetch('/api/ab-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test_name: testName,
        variant,
        event_type: eventType,
        device_type: window.innerWidth < 768 ? 'mobile' : 'desktop',
        referrer: document.referrer || null,
      }),
    });
  } catch (error) {
    console.error('AB tracking error:', error);
  }
};

// Build session duration FAQ answer from pricing display data (age bands)
function buildDurationFaqAnswer(pricingDisplayData?: any): string {
  const ageBands = pricingDisplayData?.ageBands;
  if (ageBands?.length > 0) {
    const parts = ageBands.map((b: any) =>
      `${b.sessionDurationMinutes} minutes for ages ${b.ageMin}-${b.ageMax}`
    );
    return `Session length depends on your child's age band: ${parts.join(', ')}. This is the optimal duration for each age group with engagement breaks built in. Sessions are scheduled at times convenient for you — weekdays or weekends.`;
  }
  return `Session length depends on your child's age band: 30 minutes for ages 4-6, 45 minutes for ages 7-9, and 60 minutes for ages 10-12. This is the optimal duration for each age group with engagement breaks built in. Sessions are scheduled at times convenient for you — weekdays or weekends.`;
}

// Default FAQ data - function to inject session durations
const getDefaultFaqData = (durations: { coaching: number; checkin: number }, pricingDisplayData?: any) => [
  { question: "What device do I need for the assessment?", answer: "Any smartphone, tablet, or laptop with a microphone works! The assessment runs in your browser — no app download needed. 80% of our parents use their phone." },
  { question: "How many sessions does my child get?", answer: "Your program runs for 12 weeks. The number and length of sessions are tailored to your child's age — younger children (4-6) get shorter, more frequent sessions while older children (10-12) get longer, focused sessions. Every child receives personalized 1:1 coaching totalling about 12 hours." },
  { question: "How long is each coaching session?", answer: buildDurationFaqAnswer(pricingDisplayData) },
  { question: "Is this a subscription? Will I be charged monthly?", answer: "No subscriptions! It's a one-time payment. Choose from Starter Pack, Continuation, or Full Program based on your needs. No hidden fees, no recurring charges." },
  { question: "What if my child doesn't improve?", answer: "We offer a 100% satisfaction guarantee. If you don't see improvement after completing the program, we'll either continue working with you at no extra cost or provide a full refund." },
  { question: "How will I know my child is improving?", answer: "You'll receive automated Progress Pulse reports after every few sessions showing your child's specific improvements, strengths, and home activities to try. Plus, you can request a coach call once a month for a personal update." },
  { question: "Is the AI safe for my child?", answer: "Absolutely. Unlike ChatGPT which guesses, rAI (our Reading Intelligence) only references our expert-verified knowledge base built on 7+ years of phonics expertise." },
  { question: "Are the coaches certified?", answer: "Our coaches are experienced educators with diverse specializations — including Jolly Phonics certification, ADHD expertise, and child development training. Above all, they excel at connecting with and managing children effectively." },
  { question: "What age group is this for?", answer: "Yestoryd is designed for children aged 4-12 years, across three age bands: Foundation (4-6), Building (7-9), and Mastery (10-12). Our AI adapts the assessment based on your child's age, and coaches personalize sessions accordingly." }
];

// Default testimonials
const defaultTestimonials = [
  { id: '1', testimonial_text: 'Finally understood WHY my son struggled. The AI found gaps we never knew existed. In 3 months, his reading score went from 4/10 to 8/10.', parent_name: 'Priya S.', parent_location: 'Mumbai', child_name: 'Aarav', child_age: 6, rating: 5 },
  { id: '2', testimonial_text: 'My daughter now picks up books on her own. She went from avoiding reading completely to asking "Can I read more?" Her fluency improved 2x.', parent_name: 'Rahul G.', parent_location: 'Delhi', child_name: 'Ananya', child_age: 7, rating: 5 },
  { id: '3', testimonial_text: 'The AI assessment showed us exactly where Arjun was stuck — it was blending sounds. After 2 months, he reads sentences smoothly. Clarity score: 5→9.', parent_name: 'Sneha P.', parent_location: 'Bangalore', child_name: 'Arjun', child_age: 5, rating: 5 },
  { id: '4', testimonial_text: 'Ishaan was 2 grades behind in reading. After 3 months, his teacher asked what changed. Speed improved from 15 WPM to 40 WPM.', parent_name: 'Meera K.', parent_location: 'Pune', child_name: 'Ishaan', child_age: 8, rating: 5 },
];

// ==================== MAIN COMPONENT ====================
export default function HomePageClient({
  stats,
  pricing,
  products,
  contact,
  videos,
  testimonials,
  abTestConfig = { enabled: true, testName: 'homepage_hero_jan2026', split: 0.5 },
  content,
  sessionDurations,
  pricingDisplayData,
}: HomePageClientProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [abVariant, setABVariant] = useState<ABVariant>('validation');
  const [showStickyMobileCTA, setShowStickyMobileCTA] = useState(false);

  const c = content || {} as ContentSettings;
  const whatsappNumber = contact.whatsappNumber;
  const whatsappMessage = "Hi! I'd like to know more about the reading program for my child.";
  const storyVideoUrl = videos?.homepageStoryVideoUrl || 'https://www.youtube.com/embed/Dz94bVuWH_A';
  const durations = sessionDurations || { coaching: 45, skillBuilding: 45, checkin: 45, discovery: 45 }; // V1 fallback – SiteSettingsContext is authoritative

  // Compute session range label from pricing display data (e.g., "6–18 coaching sessions (1:1)")
  const sessionRangeLabel = (() => {
    const bands = pricingDisplayData?.ageBands;
    if (!bands?.length) return '6 coaching sessions (1:1)';
    // Get session count range across all age bands for the continuation tier (building arc)
    const contTier = bands[0]?.tiers?.find((t: any) => t.slug === 'continuation');
    if (!contTier) return '6 coaching sessions (1:1)';
    const counts = bands.map((b: any) => {
      const tier = b.tiers?.find((t: any) => t.slug === 'continuation');
      return tier?.sessionsCoaching || 0;
    }).filter((n: number) => n > 0);
    if (counts.length === 0) return '6 coaching sessions (1:1)';
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const range = min === max ? `${min}` : `${min}–${max}`;
    return `${range} coaching sessions (1:1)`;
  })();

  const faqItems = c.faq_items?.length > 0 ? c.faq_items : getDefaultFaqData(durations, pricingDisplayData);
  const displayTestimonials = testimonials.length > 0 ? testimonials : defaultTestimonials;

  useEffect(() => {
    if (abTestConfig.enabled) {
      const variant = getOrSetABVariant(abTestConfig.testName, abTestConfig.split);
      setABVariant(variant);
      trackABEvent(abTestConfig.testName, variant, 'view');
    }
  }, [abTestConfig.enabled, abTestConfig.testName, abTestConfig.split]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 20);
          setShowStickyMobileCTA(window.scrollY > 600);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setActiveTestimonial((prev) => (prev + 1) % 4), 5000);
    return () => clearInterval(timer);
  }, []);

  const handleCTAClick = () => {
    if (abTestConfig.enabled) trackABEvent(abTestConfig.testName, abVariant, 'cta_click');
  };

  return (
    <div className="min-h-screen bg-surface-0 font-sans">
      <HeaderNav
        scrolled={scrolled}
        topBarTextDesktop={c.topbar_text_desktop || 'Jolly Phonics Certified • 7 Years Experience'}
        topBarTextMobile={c.topbar_text_mobile || 'Certified Phonics Expert'}
        onCTAClick={handleCTAClick}
      />

      {/* Hero Section */}
      <section className="pt-28 sm:pt-32 lg:pt-36 pb-12 sm:pb-14 lg:pb-20 bg-gradient-to-b from-surface-1 to-surface-0 relative overflow-x-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#00abff]/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#ff0099]/10 rounded-full blur-3xl -z-10 -translate-x-1/3 translate-y-1/4"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <HeroSection
              variant={abVariant}
              testimonial={displayTestimonials[0]}
              content={{
                badge: abVariant === 'curiosity' ? c.hero_badge_curiosity : c.hero_badge_validation,
                headline: abVariant === 'curiosity' ? c.hero_headline_curiosity : c.hero_headline_validation,
                reframeText: c.hero_reframe_text || "It's not laziness. It's not attitude.",
                explanation: abVariant === 'curiosity' ? c.hero_explanation_curiosity : c.hero_explanation_validation,
                ctaPrimary: c.hero_cta_primary || 'Reading Test - Free',
                ctaSecondary: c.hero_cta_secondary || 'Watch Our Story',
                trustBadge1: c.hero_trust_badge_1 || '100% Free',
                trustBadge2: c.hero_trust_badge_2 || '5 Minutes',
                trustBadge3: c.hero_trust_badge_3 || 'Instant Results',
                statPercentage: c.hero_stat_percentage || '87%',
                statText: c.hero_stat_text || 'of parents finally understood WHY their child struggled',
                urgencyText: c.hero_urgency_text || 'Reading gaps widen every month. Early identification matters.',
              }}
              onCTAClick={handleCTAClick}
            />
            <div className="relative">
              <TransformationSection
                header={c.transformation_header || 'The 90-Day Transformation'}
                beforeItems={c.transformation_before_items || ['"I hate reading"', 'Avoids books', 'Reads slowly', 'Losing confidence']}
                afterItems={c.transformation_after_items || ['"Can I read more?"', 'Picks up books', 'Reads fluently', 'Speaks confidently']}
                tagline={c.transformation_tagline || 'rAI finds the gaps • Coach fills them • You see progress'}
              />
            </div>
          </div>
        </div>
      </section>

      <SocialProofBar />

      <ProblemSection
        title={c.problem_section_title || "What Schools Don't Tell You"}
        subtitle={c.problem_section_subtitle || 'About why your child struggles with reading'}
        insightTitle={c.problem_insight_title || 'Reading is a Skill — Like Swimming'}
        insightDescription={c.problem_insight_description || 'Schools teach children WHAT to read, but rarely HOW to read.'}
        aserStat={c.problem_aser_stat || '50%'}
        aserDescription={c.problem_aser_description || 'of Grade 5 students in India cannot read a Grade 2 level text'}
        aserSource={c.problem_aser_source || '— ASER 2023 Report'}
        signs={c.problem_signs || ['Reads slowly, word by word', 'Guesses words instead of reading them', 'Understands when YOU read, struggles when THEY read', 'Avoids reading aloud', 'Says "I hate reading"']}
        symptomsText={c.problem_symptoms_text || 'These are symptoms. The cause is usually a gap in phonemic awareness.'}
        goodNews={c.problem_good_news || 'Good news: Once identified, these gaps can be filled in weeks, not years.'}
      />

      <ArcSection
        badge={c.arc_section_badge || 'THE YESTORYD ARC™'}
        title={c.arc_section_title || "Your Child's 90-Day Transformation"}
        subtitle={c.arc_section_subtitle || 'A clear path from struggling reader to confident communicator'}
        phases={{
          assess: { letter: 'A', weeks: c.arc_assess_weeks || 'Week 1-4', title: c.arc_assess_title || 'Assess', subtitle: c.arc_assess_subtitle || 'Foundation Arc', description: c.arc_assess_description || 'AI listens to your child read and identifies exact gaps in 40+ sound patterns.', features: c.arc_assess_features || ['5-minute AI assessment', 'Detailed gap report', 'Personalized learning path'], icon: 'brain', color: '#00ABFF' },
          remediate: { letter: 'R', weeks: c.arc_remediate_weeks || 'Week 5-8', title: c.arc_remediate_title || 'Remediate', subtitle: c.arc_remediate_subtitle || 'Building Arc', description: c.arc_remediate_description || 'Expert coaches fill gaps with personalized 1:1 sessions covering phonics, grammar, comprehension, and vocabulary — tailored for ages 4-12.', features: c.arc_remediate_features || [sessionRangeLabel, 'Practice activities at home', 'Weekly WhatsApp updates'], icon: 'heart', color: '#FF0099' },
          celebrate: { letter: 'C', weeks: c.arc_celebrate_weeks || 'Week 9-12', title: c.arc_celebrate_title || 'Celebrate', subtitle: c.arc_celebrate_subtitle || 'Confidence Arc', description: c.arc_celebrate_description || 'Your child reads with confidence. Measurable improvement you can see.', features: c.arc_celebrate_features || ['Before/after comparison', 'Progress certificate', 'Continuation roadmap'], icon: 'award', color: '#c44dff' },
        }}
        promise={{ title: c.arc_promise_title || 'The 90-Day Promise', description: c.arc_promise_description || 'In 90 days, your child reads more fluently.', badges: [c.arc_promise_badge_1 || 'Measurable Growth', c.arc_promise_badge_2 || '100% Refund Guarantee', c.arc_promise_badge_3 || 'Full Transparency'] }}
        trustStats={{ assessmentTime: c.arc_trust_assessment_time || '5 min', coachingType: c.arc_trust_coaching_type || '1:1', transformationDays: c.arc_trust_transformation_days || '90 days', happyParents: stats.happyParents }}
        onCTAClick={handleCTAClick}
      />

      <StorySection
        badge={c.story_section_badge || 'THE YESTORYD STORY'}
        quote={c.story_quote || "I realized that love for stories wasn't enough. Kids needed the science of reading."}
        paragraphs={[c.story_paragraph_1 || "Yestoryd started simply — I wanted to share the joy of storytelling with kids.", c.story_paragraph_2 || "They struggled with sounds, blending, and word composition.", c.story_paragraph_3 || "I spent 7 years mastering Jolly Phonics and Jolly Grammar."]}
        credentials={[c.story_credential_1 || 'Jolly Phonics Certified', c.story_credential_2 || '7 Years Experience']}
        videoUrl={storyVideoUrl}
      />

      <RaiSection
        badge={c.rai_section_badge || 'Meet rAI'}
        title={c.rai_section_title || 'Why rAI is Different (and Safer)'}
        subtitle={c.rai_section_subtitle || 'our AI that never guesses'}
        genericAi={{ label: c.rai_generic_ai_label || '❌ Generic AI', name: c.rai_generic_ai_name || 'ChatGPT, etc.', type: c.rai_generic_ai_type || 'General Purpose AI', description: c.rai_generic_ai_description || 'based on the internet. No reading expertise. No understanding of phonics rules. May give incorrect or generic advice.' }}
        safeAi={{ label: c.rai_safe_ai_label || '✓ Safe, Expert-Verified AI', name: c.rai_safe_ai_name || 'rAI Knowledge Engine', type: c.rai_safe_ai_type || 'Expert-Verified AI', description: c.rai_safe_ai_description || "Built on 7+ years of Rucha's phonics expertise. Never guesses — always references proven methods." }}
        processSteps={c.rai_process_steps || ['Child Error', 'Check Expert DB', 'Perfect Fix ✓']}
        explanation={{ intro: c.rai_explanation_intro || "Most AI makes things up. We couldn't risk that with your child's education.", analogy: c.rai_explanation_analogy || "Imagine rAI as a librarian with a manual written by Rucha.", detail: c.rai_explanation_detail || "When your child makes a mistake, rAI doesn't guess." }}
      />

      <AICredibilitySection />

      <TestimonialsSection
        badge={c.testimonials_section_badge || 'Real Results'}
        title={c.testimonials_section_title || 'Parents See the Difference'}
        subtitle={c.testimonials_found_issue_label || 'of parents finally understood WHY their child struggled'}
        testimonials={displayTestimonials}
        activeIndex={activeTestimonial}
        stats={{ totalAssessments: stats.totalAssessments, foundIssueStat: c.testimonials_found_issue_stat || '87%', foundIssueLabel: c.testimonials_found_issue_label || 'Found the Real Issue', improvementStat: c.testimonials_improvement_stat || '2x', improvementLabel: c.testimonials_improvement_label || 'Avg. Improvement' }}
      />

      <JourneySection
        badge={c.journey_section_badge || 'The Complete Journey'}
        title={c.journey_section_title || 'From Reading Mastery to English Confidence'}
        subtitle={c.journey_section_subtitle || 'Reading is the foundation. Everything else builds on top.'}
        steps={[]}
        insightText={c.journey_insight_text || 'In 90 days, your child masters reading fluency.'}
        insightDetail={c.journey_insight_detail || 'This becomes the foundation for grammar, comprehension, writing, and eventually — confident English communication.'}
      />

      <AssessmentPreview />

      <PricingSection
        badge={c.pricing_section_badge || 'Start Your ARC Journey'}
        title={c.pricing_section_title || 'Simple, Transparent Pricing'}
        subtitle={c.pricing_section_subtitle || "Start free. See your child's reading profile. Choose the program that fits your family."}
        freeBadge={c.pricing_free_badge || 'Step 1 — Start Here'}
        freeTitle={c.pricing_free_title || 'Free AI Assessment'}
        freeDescription={c.pricing_free_description || "See rAI in action — understand your child's reading level"}
        freePriceLabel={c.pricing_free_price_label || 'forever free'}
        freeAssessmentWorth={pricing.freeAssessmentWorth || '999'}
        step2Badge={c.pricing_step2_badge || 'Step 2 — Choose Your Program'}
        guaranteeText={c.pricing_guarantee_text || '100% satisfaction guarantee on all programs. Flexible scheduling included.'}
        products={products}
        onCTAClick={handleCTAClick}
        sessionDurations={durations}
        pricingDisplayData={pricingDisplayData}
      />

      <FaqSection
        badge={c.faq_section_badge || 'Common Questions'}
        title={c.faq_section_title || 'Frequently Asked Questions'}
        subtitle={c.faq_section_subtitle || 'Everything you need to know before getting started'}
        items={faqItems}
        stillQuestionsText={c.faq_still_questions || 'Still have questions?'}
        whatsappCtaText={c.faq_whatsapp_cta || 'Chat with us on WhatsApp'}
        whatsappNumber={whatsappNumber}
      />

      <CtaSection
        titleLine1={c.final_cta_title_line1 || 'Reading Gaps Widen Every Month.'}
        titleLine2={c.final_cta_title_line2 || 'Find Yours in 5 Minutes.'}
        description={c.final_cta_description || '87% of parents finally understood WHY their child struggled — after just one 5-minute assessment.'}
        subdescription={c.final_cta_subdescription || 'Free. No card required. Instant results.'}
        urgencyText={c.final_cta_urgency || "Early identification leads to faster improvement. Don't wait for report cards."}
        whatsappButtonText={c.whatsapp_button_text || 'WhatsApp Us'}
        whatsappNumber={whatsappNumber}
        whatsappMessage={whatsappMessage}
        onCTAClick={handleCTAClick}
      />

      <FooterSection
        description={c.footer_description || 'AI-powered reading assessment and expert coaching for children aged 4-12. The Yestoryd ARC™ — Assess, Remediate, Celebrate.'}
        credential={c.footer_credential || 'Jolly Phonics & Grammar Certified'}
        tagline={c.footer_tagline || 'Made with love for young readers in India'}
      />

      <FloatingElements
        whatsappNumber={whatsappNumber}
        whatsappMessage={whatsappMessage}
        whatsappHoverText={c.floating_whatsapp_hover || 'Chat with Us'}
        stickyCtaText={c.sticky_mobile_cta || 'Reading Test - Free'}
        showStickyCta={showStickyMobileCTA}
        onCTAClick={handleCTAClick}
      />
    </div>
  );
}
