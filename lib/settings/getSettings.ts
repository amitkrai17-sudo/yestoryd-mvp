// =============================================================================
// SERVER-SIDE SETTINGS UTILITY
// Enterprise Data Architecture: Fetch settings from database
// Usage: Server components, API routes, getServerSideProps
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase/server';
import type {
  SiteSettingRow,
  SettingCategory,
  HomepageSettings,
  PartialHomepageSettings,
  HeroSettings,
  TransformationSettings,
  HeaderSettings,
  ProblemSettings,
  ARCSettings,
  FAQSettings,
  StorySettings,
  RAISettings,
  TestimonialsSettings,
  JourneySettings,
  PricingSettings,
  CTASettings,
  FooterSettings,
  FloatingSettings,
  TriangulationSettings,
  ContactSettings,
  VideoSettings,
  ContentSettings,
  AssessmentSettings,
} from '@/types/settings';

// Use the admin client from shared module
const supabase = supabaseAdmin;

// JSON fields that need parsing
const JSON_FIELDS = new Set([
  'transformation_before_items',
  'transformation_after_items',
  'problem_signs',
  'arc_assess_features',
  'arc_remediate_features',
  'arc_celebrate_features',
  'faq_items',
  'rai_process_steps',
  'default_testimonials',
  'journey_steps',
  'pricing_free_features',
  'triangulation_rai',
  'triangulation_coach',
  'triangulation_parent',
  // Assessment JSON fields
  'assessment_trust_badges',
  'assessment_cta_messages',
  'assessment_score_context',
  'assessment_passages',
  'supported_country_codes',
]);

/**
 * Parse a value, attempting JSON parse for known JSON fields
 * Handles both string (text column) and object (JSONB column) values
 */
function parseValue(key: string, value: unknown): unknown {
  if (JSON_FIELDS.has(key)) {
    // If already an object/array, return as-is (Supabase JSONB returns parsed)
    if (typeof value === 'object' && value !== null) {
      return value;
    }
    // If string, try to parse as JSON
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        console.warn(`[getSettings] Failed to parse JSON for key: ${key}`);
        return value;
      }
    }
  }
  return value;
}

/**
 * Fetch a single setting by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) {
    console.warn(`[getSettings] Setting not found: ${key}`);
    return null;
  }

  return data.value as string | null;
}

/**
 * Fetch a single setting and parse JSON if applicable
 */
export async function getSettingParsed<T = string>(key: string): Promise<T | null> {
  const value = await getSetting(key);
  if (value === null) return null;
  return parseValue(key, value as string) as T;
}

/**
 * Fetch multiple settings by keys
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', keys);

  if (error || !data) {
    console.warn(`[getSettings] Failed to fetch settings:`, error);
    return {};
  }

  return data.reduce((acc, row) => {
    acc[row.key] = String(row.value ?? '');
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Fetch settings by category
 */
export async function getSettingsByCategory(category: SettingCategory): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .eq('category', category);

  if (error || !data) {
    console.warn(`[getSettings] Failed to fetch category: ${category}`, error);
    return {};
  }

  return data.reduce((acc, row) => {
    acc[row.key] = parseValue(row.key, row.value);
    return acc;
  }, {} as Record<string, unknown>);
}

/**
 * Fetch all settings for homepage
 * This is optimized to fetch all settings in one query
 */
export async function getHomepageSettings(): Promise<PartialHomepageSettings> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value, category');

  if (error || !data) {
    console.error(`[getSettings] Failed to fetch homepage settings:`, error);
    return {};
  }

  // Group by category
  const grouped: Record<string, Record<string, unknown>> = {};

  for (const row of data) {
    if (!grouped[row.category]) {
      grouped[row.category] = {};
    }
    grouped[row.category][row.key] = parseValue(row.key, row.value);
  }

  return {
    hero: (grouped.hero || {}) as unknown as HeroSettings,
    transformation: (grouped.transformation || {}) as unknown as TransformationSettings,
    header: (grouped.header || {}) as unknown as HeaderSettings,
    problem: (grouped.problem || {}) as unknown as ProblemSettings,
    arc: (grouped.arc || {}) as unknown as ARCSettings,
    faq: (grouped.faq || {}) as unknown as FAQSettings,
    story: (grouped.story || {}) as unknown as StorySettings,
    rai: (grouped.rai || {}) as unknown as RAISettings,
    testimonials: (grouped.testimonials || {}) as unknown as TestimonialsSettings,
    journey: (grouped.journey || {}) as unknown as JourneySettings,
    pricing: (grouped.pricing || {}) as unknown as PricingSettings,
    cta: (grouped.cta || {}) as unknown as CTASettings,
    footer: (grouped.footer || {}) as unknown as FooterSettings,
    floating: (grouped.floating || {}) as unknown as FloatingSettings,
    triangulation: (grouped.triangulation || {}) as unknown as TriangulationSettings,
    contact: (grouped.contact || {}) as unknown as ContactSettings,
    videos: (grouped.videos || {}) as unknown as VideoSettings,
    content: (grouped.content || {}) as unknown as ContentSettings,
  };
}

/**
 * Fetch specific categories only (more efficient for partial page loads)
 */
export async function getSettingsForCategories(
  categories: SettingCategory[]
): Promise<PartialHomepageSettings> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value, category')
    .in('category', categories);

  if (error || !data) {
    console.error(`[getSettings] Failed to fetch categories:`, error);
    return {};
  }

  // Group by category
  const grouped: Record<string, Record<string, unknown>> = {};

  for (const row of data) {
    if (!grouped[row.category]) {
      grouped[row.category] = {};
    }
    grouped[row.category][row.key] = parseValue(row.key, row.value);
  }

  return grouped as PartialHomepageSettings;
}

// =============================================================================
// CONVENIENCE FUNCTIONS FOR SPECIFIC SECTIONS
// =============================================================================

export async function getHeroSettings(): Promise<Partial<HeroSettings>> {
  return getSettingsByCategory('hero') as Promise<Partial<HeroSettings>>;
}

export async function getTransformationSettings(): Promise<Partial<TransformationSettings>> {
  return getSettingsByCategory('transformation') as Promise<Partial<TransformationSettings>>;
}

export async function getHeaderSettings(): Promise<Partial<HeaderSettings>> {
  return getSettingsByCategory('header') as Promise<Partial<HeaderSettings>>;
}

export async function getProblemSettings(): Promise<Partial<ProblemSettings>> {
  return getSettingsByCategory('problem') as Promise<Partial<ProblemSettings>>;
}

export async function getARCSettings(): Promise<Partial<ARCSettings>> {
  return getSettingsByCategory('arc') as Promise<Partial<ARCSettings>>;
}

export async function getFAQSettings(): Promise<Partial<FAQSettings>> {
  return getSettingsByCategory('faq') as Promise<Partial<FAQSettings>>;
}

export async function getStorySettings(): Promise<Partial<StorySettings>> {
  return getSettingsByCategory('story') as Promise<Partial<StorySettings>>;
}

export async function getRAISettings(): Promise<Partial<RAISettings>> {
  return getSettingsByCategory('rai') as Promise<Partial<RAISettings>>;
}

export async function getTestimonialsSettings(): Promise<Partial<TestimonialsSettings>> {
  return getSettingsByCategory('testimonials') as Promise<Partial<TestimonialsSettings>>;
}

export async function getJourneySettings(): Promise<Partial<JourneySettings>> {
  return getSettingsByCategory('journey') as Promise<Partial<JourneySettings>>;
}

export async function getPricingSettings(): Promise<Partial<PricingSettings>> {
  return getSettingsByCategory('pricing') as Promise<Partial<PricingSettings>>;
}

export async function getCTASettings(): Promise<Partial<CTASettings>> {
  return getSettingsByCategory('cta') as Promise<Partial<CTASettings>>;
}

export async function getFooterSettings(): Promise<Partial<FooterSettings>> {
  return getSettingsByCategory('footer') as Promise<Partial<FooterSettings>>;
}

export async function getFloatingSettings(): Promise<Partial<FloatingSettings>> {
  return getSettingsByCategory('floating') as Promise<Partial<FloatingSettings>>;
}

export async function getTriangulationSettings(): Promise<Partial<TriangulationSettings>> {
  return getSettingsByCategory('triangulation') as Promise<Partial<TriangulationSettings>>;
}

export async function getContactSettings(): Promise<Partial<ContactSettings>> {
  return getSettingsByCategory('contact') as Promise<Partial<ContactSettings>>;
}

export async function getVideoSettings(): Promise<Partial<VideoSettings>> {
  return getSettingsByCategory('videos') as Promise<Partial<VideoSettings>>;
}

export async function getContentSettings(): Promise<Partial<ContentSettings>> {
  return getSettingsByCategory('content') as Promise<Partial<ContentSettings>>;
}

// =============================================================================
// ASSESSMENT PAGE SETTINGS
// =============================================================================

/**
 * Fetch all settings needed for the assessment page
 * Pulls from multiple categories: assessment, cta, contact, pricing
 */
export async function getAssessmentSettings(): Promise<Partial<AssessmentSettings>> {
  const keys = [
    // Assessment category
    'assessment_page_title',
    'assessment_page_subtitle',
    'assessment_hero_badge',
    'assessment_social_proof',
    'assessment_guarantee_text',
    'assessment_trust_badges',
    'assessment_cta_messages',
    'assessment_score_context',
    'assessment_passages',
    'supported_country_codes',
    'consultation_cta_title',
    'consultation_cta_subtitle',
    'consultation_cta_button',
    // CTA category
    'assessment_cta',
    'assessment_cta_secondary',
    // Contact category
    'whatsapp_number',
    // Pricing category
    'free_assessment_worth',
  ];

  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', keys);

  if (error || !data) {
    console.error('[getSettings] Failed to fetch assessment settings:', error);
    return {};
  }

  return data.reduce((acc, row) => {
    acc[row.key as keyof AssessmentSettings] = parseValue(row.key, row.value) as any;
    return acc;
  }, {} as Partial<AssessmentSettings>);
}

// =============================================================================
// SESSION DURATIONS
// =============================================================================

export interface SessionDurations {
  coaching: number;
  skillBuilding: number;
  checkin: number;
  discovery: number;
}

/**
 * Fetch session durations from site_settings
 * Single source of truth for all session duration values
 */
export async function getSessionDurations(): Promise<SessionDurations> {
  const defaults: SessionDurations = {
    coaching: 45,
    skillBuilding: 45,
    checkin: 45,
    discovery: 45,
  };

  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', [
      'session_coaching_duration_mins',
      'session_skill_building_duration_mins',
      'session_checkin_duration_mins',
      'session_discovery_duration_mins',
    ]);

  if (error || !data) {
    console.warn('[getSettings] Failed to fetch session durations, using defaults');
    return defaults;
  }

  return {
    coaching: parseInt(String(data.find(d => d.key === 'session_coaching_duration_mins')?.value ?? '45')),
    skillBuilding: parseInt(String(data.find(d => d.key === 'session_skill_building_duration_mins')?.value ?? '45')),
    checkin: parseInt(String(data.find(d => d.key === 'session_checkin_duration_mins')?.value ?? '45')),
    discovery: parseInt(String(data.find(d => d.key === 'session_discovery_duration_mins')?.value ?? '45')),
  };
}
