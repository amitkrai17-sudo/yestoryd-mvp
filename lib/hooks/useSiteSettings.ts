// =============================================================================
// CLIENT-SIDE SETTINGS HOOK
// Enterprise Data Architecture: React hook for fetching settings
// Usage: Client components that need dynamic settings
// =============================================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import type {
  SettingCategory,
  PartialHomepageSettings,
} from '@/types/settings';

// Create client-side Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
]);

/**
 * Parse a value, attempting JSON parse for known JSON fields
 */
function parseValue(key: string, value: string): unknown {
  if (JSON_FIELDS.has(key)) {
    try {
      return JSON.parse(value);
    } catch {
      console.warn(`[useSiteSettings] Failed to parse JSON for key: ${key}`);
      return value;
    }
  }
  return value;
}

interface UseSiteSettingsOptions {
  /**
   * Specific keys to fetch (if not fetching by category)
   */
  keys?: string[];
  /**
   * Category to fetch settings for
   */
  category?: SettingCategory;
  /**
   * Multiple categories to fetch
   */
  categories?: SettingCategory[];
  /**
   * Skip fetching on mount (useful for conditional fetching)
   */
  skip?: boolean;
}

interface UseSiteSettingsReturn<T> {
  settings: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch site settings on the client side
 *
 * @example
 * // Fetch all settings for a category
 * const { settings, loading } = useSiteSettings({ category: 'hero' });
 *
 * @example
 * // Fetch specific keys
 * const { settings } = useSiteSettings({ keys: ['hero_headline', 'hero_cta'] });
 *
 * @example
 * // Fetch multiple categories
 * const { settings } = useSiteSettings({ categories: ['hero', 'cta'] });
 */
export function useSiteSettings<T = Record<string, unknown>>(
  options: UseSiteSettingsOptions = {}
): UseSiteSettingsReturn<T> {
  const [settings, setSettings] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState<Error | null>(null);

  // Memoize options to avoid unnecessary re-renders
  const keysStr = useMemo(() => options.keys?.join(',') ?? '', [options.keys]);
  const categoriesStr = useMemo(() => options.categories?.join(',') ?? '', [options.categories]);

  const fetchSettings = useCallback(async () => {
    if (options.skip) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase.from('site_settings').select('key, value, category');

      // Apply filters based on options
      if (options.keys && options.keys.length > 0) {
        query = query.in('key', options.keys);
      } else if (options.category) {
        query = query.eq('category', options.category);
      } else if (options.categories && options.categories.length > 0) {
        query = query.in('category', options.categories);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      if (!data) {
        setSettings(null);
        return;
      }

      // Transform data based on fetch type
      if (options.categories && options.categories.length > 0) {
        // Group by category for multiple categories
        const grouped: Record<string, Record<string, unknown>> = {};
        for (const row of data) {
          if (!grouped[row.category]) {
            grouped[row.category] = {};
          }
          grouped[row.category][row.key] = parseValue(row.key, row.value);
        }
        setSettings(grouped as T);
      } else {
        // Flat object for single category or keys
        const result = data.reduce((acc, row) => {
          acc[row.key] = parseValue(row.key, row.value);
          return acc;
        }, {} as Record<string, unknown>);
        setSettings(result as T);
      }
    } catch (err) {
      console.error('[useSiteSettings] Error fetching settings:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch settings'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.skip, options.category, keysStr, categoriesStr]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
  };
}

/**
 * Hook to fetch a single setting
 *
 * @example
 * const { value, loading } = useSetting('hero_headline');
 */
export function useSetting(key: string): {
  value: string | null;
  loading: boolean;
  error: Error | null;
} {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchSetting() {
      try {
        const { data, error: fetchError } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', key)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        setValue(data?.value ?? null);
      } catch (err) {
        console.error(`[useSetting] Error fetching ${key}:`, err);
        setError(err instanceof Error ? err : new Error('Failed to fetch setting'));
      } finally {
        setLoading(false);
      }
    }

    fetchSetting();
  }, [key]);

  return { value, loading, error };
}

/**
 * Hook to fetch homepage settings (all categories)
 * Use with caution - fetches all settings
 *
 * @example
 * const { settings, loading } = useHomepageSettings();
 */
export function useHomepageSettings(): UseSiteSettingsReturn<PartialHomepageSettings> {
  return useSiteSettings<PartialHomepageSettings>({
    categories: [
      'hero',
      'transformation',
      'header',
      'problem',
      'arc',
      'faq',
      'story',
      'rai',
      'testimonials',
      'journey',
      'pricing',
      'cta',
      'footer',
      'floating',
      'triangulation',
      'contact',
      'videos',
      'content',
    ],
  });
}

// =============================================================================
// CONVENIENCE HOOKS FOR SPECIFIC SECTIONS
// =============================================================================

export function useHeroSettings() {
  return useSiteSettings({ category: 'hero' });
}

export function useTransformationSettings() {
  return useSiteSettings({ category: 'transformation' });
}

export function useHeaderSettings() {
  return useSiteSettings({ category: 'header' });
}

export function useProblemSettings() {
  return useSiteSettings({ category: 'problem' });
}

export function useARCSettings() {
  return useSiteSettings({ category: 'arc' });
}

export function useFAQSettings() {
  return useSiteSettings({ category: 'faq' });
}

export function useStorySettings() {
  return useSiteSettings({ category: 'story' });
}

export function useRAISettings() {
  return useSiteSettings({ category: 'rai' });
}

export function useTestimonialsSettings() {
  return useSiteSettings({ category: 'testimonials' });
}

export function useJourneySettings() {
  return useSiteSettings({ category: 'journey' });
}

export function usePricingSettings() {
  return useSiteSettings({ category: 'pricing' });
}

export function useCTASettings() {
  return useSiteSettings({ category: 'cta' });
}

export function useFooterSettings() {
  return useSiteSettings({ category: 'footer' });
}

export function useFloatingSettings() {
  return useSiteSettings({ category: 'floating' });
}

export function useTriangulationSettings() {
  return useSiteSettings({ category: 'triangulation' });
}

export function useContactSettings() {
  return useSiteSettings({ category: 'contact' });
}

export function useVideoSettings() {
  return useSiteSettings({ category: 'videos' });
}

export function useContentSettings() {
  return useSiteSettings({ category: 'content' });
}
