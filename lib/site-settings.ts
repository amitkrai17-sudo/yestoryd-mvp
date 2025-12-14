/**
 * Site Settings Utility Library
 * 
 * This file provides helper functions to fetch dynamic settings from the database.
 * Use these functions in your pages/components to make them dynamic.
 * 
 * USAGE:
 * - Server Components: Use directly with await
 * - Client Components: Use React hooks with useEffect + useState
 */

import { createClient } from '@supabase/supabase-js';

// Create Supabase client (use anon key for public data)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ==================== TYPES ====================

export interface SiteSettings {
  // Contact
  whatsapp_number: string;
  support_email: string;
  support_phone: string;
  
  // Social
  instagram_url: string;
  facebook_url: string;
  youtube_url: string;
  
  // Stats (homepage)
  total_assessments: string;
  happy_parents: string;
  success_rate: string;
  average_improvement: string;
  
  // Pricing
  free_assessment_worth: string;
  default_discount_percent: string;
  
  // Coach
  default_coach_name: string;
  default_coach_title: string;
  default_coach_experience: string;
  default_coach_rating: string;
  default_coach_students: string;
  default_coach_phone: string;
  default_coach_email: string;
  default_coach_bio: string;
  
  // Program
  program_duration_months: string;
  total_sessions: string;
  coaching_sessions: string;
  parent_meetings: string;
  coaching_duration_minutes: string;
  parent_meeting_duration_minutes: string;
  
  // Booking
  cal_username: string;
  cal_discovery_slug: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  original_price: number;
  discounted_price: number;
  discount_label: string;
  duration_months: number;
  sessions_included: number;
  features: string[];
  is_active: boolean;
  is_featured: boolean;
  offer_valid_until: string;
}

export interface Testimonial {
  id: string;
  parent_name: string;
  parent_location: string;
  child_name: string;
  child_age: number;
  testimonial_text: string;
  rating: number;
  image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
}

export interface FeatureFlags {
  show_free_trial: boolean;
  enable_razorpay: boolean;
  enable_whatsapp_notifications: boolean;
  enable_email_notifications: boolean;
  enable_session_recordings: boolean;
  maintenance_mode: boolean;
  show_testimonials: boolean;
  enable_google_signin: boolean;
}

// ==================== DEFAULT VALUES (Fallbacks) ====================

export const DEFAULT_SETTINGS: SiteSettings = {
  // Contact
  whatsapp_number: '+918976287997',
  support_email: 'engage@yestoryd.com',
  support_phone: '+918976287997',
  
  // Social
  instagram_url: 'https://instagram.com/yestoryd',
  facebook_url: '',
  youtube_url: '',
  
  // Stats
  total_assessments: '1000+',
  happy_parents: '500+',
  success_rate: '95',
  average_improvement: '2x',
  
  // Pricing
  free_assessment_worth: '999',
  default_discount_percent: '40',
  
  // Coach
  default_coach_name: 'Rucha',
  default_coach_title: 'Founder & Lead Reading Coach',
  default_coach_experience: '10+ years',
  default_coach_rating: '4.9',
  default_coach_students: '500+',
  default_coach_phone: '+918976287997',
  default_coach_email: 'rucha.rai@yestoryd.com',
  default_coach_bio: 'Passionate about helping children discover the joy of reading through personalized coaching.',
  
  // Program
  program_duration_months: '3',
  total_sessions: '9',
  coaching_sessions: '6',
  parent_meetings: '3',
  coaching_duration_minutes: '45',
  parent_meeting_duration_minutes: '15',
  
  // Booking
  cal_username: 'yestoryd',
  cal_discovery_slug: 'discovery',
};

export const DEFAULT_PRICING: PricingPlan = {
  id: 'default',
  name: '3-Month Reading Coaching',
  slug: 'coaching-3month',
  description: 'Complete reading transformation program',
  original_price: 9999,
  discounted_price: 5999,
  discount_label: 'SAVE 40%',
  duration_months: 3,
  sessions_included: 9,
  features: [
    '6 personalized coaching sessions',
    '3 parent progress meetings',
    'E-learning access',
    'AI progress tracking',
    'WhatsApp support',
    'Session recordings',
  ],
  is_active: true,
  is_featured: true,
  offer_valid_until: '2025-03-31',
};

export const DEFAULT_FLAGS: FeatureFlags = {
  show_free_trial: true,
  enable_razorpay: true,
  enable_whatsapp_notifications: true,
  enable_email_notifications: true,
  enable_session_recordings: true,
  maintenance_mode: false,
  show_testimonials: true,
  enable_google_signin: true,
};

// ==================== FETCH FUNCTIONS ====================

/**
 * Fetch all site settings
 * Returns merged settings with defaults as fallback
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value');

    if (error) {
      console.error('Error fetching site settings:', error);
      return DEFAULT_SETTINGS;
    }

    // Merge database values with defaults
    const settings = { ...DEFAULT_SETTINGS };
    
    data?.forEach((item) => {
      const key = item.key as keyof SiteSettings;
      if (key in settings) {
        try {
          // Parse JSON value
          settings[key] = JSON.parse(item.value);
        } catch {
          settings[key] = item.value;
        }
      }
    });

    return settings;
  } catch (error) {
    console.error('Error in getSiteSettings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Fetch specific settings by keys
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', keys);

    if (error) throw error;

    const settings: Record<string, string> = {};
    data?.forEach((item) => {
      try {
        settings[item.key] = JSON.parse(item.value);
      } catch {
        settings[item.key] = item.value;
      }
    });

    // Add defaults for missing keys
    keys.forEach((key) => {
      if (!settings[key] && key in DEFAULT_SETTINGS) {
        settings[key] = DEFAULT_SETTINGS[key as keyof SiteSettings];
      }
    });

    return settings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    // Return defaults for requested keys
    const defaults: Record<string, string> = {};
    keys.forEach((key) => {
      if (key in DEFAULT_SETTINGS) {
        defaults[key] = DEFAULT_SETTINGS[key as keyof SiteSettings];
      }
    });
    return defaults;
  }
}

/**
 * Fetch active pricing plan
 */
export async function getPricing(): Promise<PricingPlan> {
  try {
    const { data, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    return {
      ...data,
      features: typeof data.features === 'string' 
        ? JSON.parse(data.features) 
        : data.features || [],
    };
  } catch (error) {
    console.error('Error fetching pricing:', error);
    return DEFAULT_PRICING;
  }
}

/**
 * Fetch all active pricing plans
 */
export async function getAllPricingPlans(): Promise<PricingPlan[]> {
  try {
    const { data, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    return data?.map(plan => ({
      ...plan,
      features: typeof plan.features === 'string' 
        ? JSON.parse(plan.features) 
        : plan.features || [],
    })) || [DEFAULT_PRICING];
  } catch (error) {
    console.error('Error fetching pricing plans:', error);
    return [DEFAULT_PRICING];
  }
}

/**
 * Fetch testimonials
 */
export async function getTestimonials(featuredOnly = false): Promise<Testimonial[]> {
  try {
    let query = supabase
      .from('testimonials')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (featuredOnly) {
      query = query.eq('is_featured', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    return [];
  }
}

/**
 * Fetch feature flags
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('flag_key, flag_value');

    if (error) throw error;

    const flags = { ...DEFAULT_FLAGS };
    data?.forEach((item) => {
      const key = item.flag_key as keyof FeatureFlags;
      if (key in flags) {
        flags[key] = item.flag_value;
      }
    });

    return flags;
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return DEFAULT_FLAGS;
  }
}

/**
 * Check if a specific feature is enabled
 */
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('flag_value')
      .eq('flag_key', flagKey)
      .single();

    if (error) throw error;

    return data?.flag_value ?? DEFAULT_FLAGS[flagKey as keyof FeatureFlags] ?? false;
  } catch (error) {
    console.error('Error checking feature flag:', error);
    return DEFAULT_FLAGS[flagKey as keyof FeatureFlags] ?? false;
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Format WhatsApp link
 */
export function getWhatsAppLink(phone: string, message?: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const baseUrl = `https://wa.me/${cleanPhone}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}

/**
 * Format Cal.com booking link
 */
export function getCalBookingLink(username: string, slug: string): string {
  return `https://cal.com/${username}/${slug}`;
}

/**
 * Calculate discount percentage
 */
export function calculateDiscount(original: number, discounted: number): number {
  return Math.round(((original - discounted) / original) * 100);
}
