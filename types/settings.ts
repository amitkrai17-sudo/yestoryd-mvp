// =============================================================================
// SITE SETTINGS TYPES
// Enterprise Data Architecture: Type-safe settings access
// =============================================================================

// Raw database row
export interface SiteSettingRow {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Setting categories
export type SettingCategory =
  | 'hero'
  | 'transformation'
  | 'header'
  | 'problem'
  | 'arc'
  | 'faq'
  | 'story'
  | 'rai'
  | 'testimonials'
  | 'journey'
  | 'pricing'
  | 'cta'
  | 'footer'
  | 'floating'
  | 'triangulation'
  | 'contact'
  | 'videos'
  | 'content'
  | 'assessment';

// Hero section settings
export interface HeroSettings {
  hero_badge_curiosity: string;
  hero_badge_validation: string;
  hero_headline_curiosity: string;
  hero_headline_validation: string;
  hero_explanation_curiosity: string;
  hero_explanation_validation: string;
  hero_reframe_text: string;
  hero_cta_primary: string;
  hero_cta_secondary: string;
  hero_trust_badge_1: string;
  hero_trust_badge_2: string;
  hero_trust_badge_3: string;
  hero_stat_percentage: string;
  hero_stat_text: string;
  hero_urgency_text: string;
}

// Transformation section settings
export interface TransformationSettings {
  transformation_header: string;
  transformation_before_items: string[]; // Parsed from JSON
  transformation_after_items: string[]; // Parsed from JSON
  transformation_tagline: string;
}

// Header settings
export interface HeaderSettings {
  topbar_text_desktop: string;
  topbar_text_mobile: string;
  nav_item_1: string;
  nav_item_2: string;
  nav_item_3: string;
  nav_login_text: string;
}

// Problem section settings
export interface ProblemSettings {
  problem_section_title: string;
  problem_section_subtitle: string;
  problem_insight_title: string;
  problem_insight_description: string;
  problem_aser_stat: string;
  problem_aser_description: string;
  problem_aser_source: string;
  problem_signs: string[]; // Parsed from JSON
  problem_symptoms_text: string;
  problem_good_news: string;
}

// ARC section settings
export interface ARCSettings {
  arc_section_badge: string;
  arc_section_title: string;
  arc_section_subtitle: string;
  // Assess phase
  arc_assess_weeks: string;
  arc_assess_title: string;
  arc_assess_subtitle: string;
  arc_assess_description: string;
  arc_assess_features: string[]; // Parsed from JSON
  // Remediate phase
  arc_remediate_weeks: string;
  arc_remediate_title: string;
  arc_remediate_subtitle: string;
  arc_remediate_description: string;
  arc_remediate_features: string[]; // Parsed from JSON
  // Celebrate phase
  arc_celebrate_weeks: string;
  arc_celebrate_title: string;
  arc_celebrate_subtitle: string;
  arc_celebrate_description: string;
  arc_celebrate_features: string[]; // Parsed from JSON
  // Promise section
  arc_promise_title: string;
  arc_promise_description: string;
  arc_promise_badge_1: string;
  arc_promise_badge_2: string;
  arc_promise_badge_3: string;
  // Trust indicators
  arc_trust_assessment_time: string;
  arc_trust_coaching_type: string;
  arc_trust_transformation_days: string;
}

// FAQ item type
export interface FAQItem {
  question: string;
  answer: string;
}

// FAQ section settings
export interface FAQSettings {
  faq_section_badge: string;
  faq_section_title: string;
  faq_section_subtitle: string;
  faq_still_questions: string;
  faq_whatsapp_cta: string;
  faq_items: FAQItem[]; // Parsed from JSON
}

// Story section settings
export interface StorySettings {
  story_section_badge: string;
  story_quote: string;
  story_paragraph_1: string;
  story_paragraph_2: string;
  story_paragraph_3: string;
  story_credential_1: string;
  story_credential_2: string;
}

// rAI tech section settings
export interface RAISettings {
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
  rai_process_label: string;
  rai_process_steps: string[]; // Parsed from JSON
  rai_explanation_intro: string;
  rai_explanation_analogy: string;
  rai_explanation_detail: string;
}

// Testimonial type
export interface TestimonialItem {
  id: string;
  testimonial_text: string;
  parent_name: string;
  parent_location?: string;
  child_name: string;
  child_age: number;
  rating: number;
  score_before?: string;
  score_after?: string;
}

// Testimonials section settings
export interface TestimonialsSettings {
  testimonials_section_badge: string;
  testimonials_section_title: string;
  testimonials_found_issue_stat: string;
  testimonials_found_issue_label: string;
  testimonials_improvement_stat: string;
  testimonials_improvement_label: string;
  default_testimonials: TestimonialItem[]; // Parsed from JSON
}

// Journey step type
export interface JourneyStep {
  stage: string;
  skill: string;
  icon: string;
  color: string;
}

// Journey section settings
export interface JourneySettings {
  journey_section_badge: string;
  journey_section_title: string;
  journey_section_subtitle: string;
  journey_steps: JourneyStep[]; // Parsed from JSON
  journey_insight_text: string;
  journey_insight_detail: string;
}

// Free feature item (can be string or object with highlight)
export type FreeFeatureItem = string | { text: string; highlight: string };

// Pricing section settings
export interface PricingSettings {
  pricing_section_badge: string;
  pricing_section_title: string;
  pricing_section_subtitle: string;
  pricing_free_badge: string;
  pricing_free_title: string;
  pricing_free_description: string;
  pricing_free_price_label: string;
  pricing_free_features: FreeFeatureItem[]; // Parsed from JSON
  pricing_step2_badge: string;
  pricing_guarantee_text: string;
}

// CTA section settings
export interface CTASettings {
  final_cta_title_line1: string;
  final_cta_title_line2: string;
  final_cta_description: string;
  final_cta_subdescription: string;
  final_cta_urgency: string;
  whatsapp_button_text: string;
}

// Footer section settings
export interface FooterSettings {
  footer_description: string;
  footer_credential: string;
  footer_quick_links_title: string;
  footer_access_title: string;
  footer_legal_title: string;
  footer_tagline: string;
}

// Floating elements settings
export interface FloatingSettings {
  floating_whatsapp_hover: string;
  sticky_mobile_cta: string;
}

// Triangulation node type
export interface TriangulationNode {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  description: string;
  features: string[];
}

// Triangulation settings
export interface TriangulationSettings {
  triangulation_rai: TriangulationNode;
  triangulation_coach: TriangulationNode;
  triangulation_parent: TriangulationNode;
}

// Contact settings (existing)
export interface ContactSettings {
  whatsapp_number: string;
  support_email?: string;
  support_phone?: string;
}

// Video settings (existing)
export interface VideoSettings {
  homepage_story_video_url: string;
}

// Content/Stats settings (existing)
export interface ContentSettings {
  total_assessments: string;
  happy_parents: string;
  success_rate: string;
  avg_improvement?: string;
}

// Complete homepage settings
export interface HomepageSettings {
  hero: HeroSettings;
  transformation: TransformationSettings;
  header: HeaderSettings;
  problem: ProblemSettings;
  arc: ARCSettings;
  faq: FAQSettings;
  story: StorySettings;
  rai: RAISettings;
  testimonials: TestimonialsSettings;
  journey: JourneySettings;
  pricing: PricingSettings;
  cta: CTASettings;
  footer: FooterSettings;
  floating: FloatingSettings;
  triangulation: TriangulationSettings;
  contact: ContactSettings;
  videos: VideoSettings;
  content: ContentSettings;
}

// Helper type for partial settings fetch
export type PartialHomepageSettings = Partial<HomepageSettings>;

// =============================================================================
// ASSESSMENT SECTION TYPES
// =============================================================================

// Reading passage type
export interface AssessmentPassage {
  id: string;
  ageGroup: string;
  level: string;
  title: string;
  text: string;
  wordCount: number;
  readingTime: string;
}

// Trust badge type
export interface AssessmentTrustBadge {
  icon: string;
  text: string;
}

// CTA message type (per score range)
export interface AssessmentCTAMessage {
  headline: string;
  subtext: string;
  emoji: string;
  primaryCTA: string;
  secondaryCTA: string;
  prioritizeConsultation: boolean;
}

// Score context type
export interface AssessmentScoreContext {
  low: string;
  medium: string;
  high: string;
  excellent: string;
}

// Country code type
export interface SupportedCountryCode {
  code: string;
  country: string;
  flag: string;
}

// Assessment settings interface
export interface AssessmentSettings {
  // Page content
  assessment_page_title: string;
  assessment_page_subtitle: string;
  assessment_hero_badge: string;
  assessment_social_proof: string;
  assessment_guarantee_text: string;
  // Trust badges (JSON array)
  assessment_trust_badges: AssessmentTrustBadge[];
  // CTA messages by score range (JSON object)
  assessment_cta_messages: {
    low: AssessmentCTAMessage;
    medium: AssessmentCTAMessage;
    high: AssessmentCTAMessage;
    excellent: AssessmentCTAMessage;
  };
  // Score context messages (JSON object)
  assessment_score_context: AssessmentScoreContext;
  // Reading passages (JSON array - single source of truth)
  assessment_passages: AssessmentPassage[];
  // Country codes (JSON array)
  supported_country_codes: SupportedCountryCode[];
  // Consultation CTA
  consultation_cta_title: string;
  consultation_cta_subtitle: string;
  consultation_cta_button: string;
  // From other categories
  whatsapp_number: string;
  assessment_cta: string;
  assessment_cta_secondary: string;
  free_assessment_worth: string;
}

// Setting key type (all possible keys)
export type SettingKey = keyof HeroSettings
  | keyof TransformationSettings
  | keyof HeaderSettings
  | keyof ProblemSettings
  | keyof ARCSettings
  | keyof FAQSettings
  | keyof StorySettings
  | keyof RAISettings
  | keyof TestimonialsSettings
  | keyof JourneySettings
  | keyof PricingSettings
  | keyof CTASettings
  | keyof FooterSettings
  | keyof FloatingSettings
  | keyof ContactSettings
  | keyof VideoSettings
  | keyof ContentSettings
  | keyof AssessmentSettings;
