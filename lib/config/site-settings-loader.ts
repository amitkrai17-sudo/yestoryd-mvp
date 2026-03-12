// =============================================================================
// SITE SETTINGS LOADER (Generic, Cached)
// lib/config/site-settings-loader.ts
// =============================================================================
//
// Generic cached site_settings loader for ad-hoc key lookups.
// Use this for any route/lib that needs 1-N site_settings keys with caching.
//
// For category-specific configs, prefer the dedicated loaders in:
// - lib/config/loader.ts (auth, coach, payment, scheduling, etc.)
// - lib/config/pricing-config.ts (pricing plans)
// - lib/config/artifact-config.ts (artifact analysis)
//
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

// ── Cache ──

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function getCached(key: string): string | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache(key: string, value: string): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Clear settings cache (call after admin updates) */
export function clearSettingsCache(): void {
  cache.clear();
}

// ── Public API ──

/**
 * Fetch a single site_settings value by key (cached 5 min).
 * Returns null if not found.
 */
export async function getSiteSetting(key: string): Promise<string | null> {
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .single();

    const value = data?.value != null ? String(data.value) : null;
    if (value !== null) setCache(key, value);
    return value;
  } catch {
    return null;
  }
}

/**
 * Fetch multiple site_settings values by keys (cached 5 min).
 * Returns a Record mapping key → value. Missing keys are omitted.
 */
export async function getSiteSettings(keys: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const uncached: string[] = [];

  for (const key of keys) {
    const cached = getCached(key);
    if (cached !== undefined) {
      result[key] = cached;
    } else {
      uncached.push(key);
    }
  }

  if (uncached.length === 0) return result;

  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', uncached);

    if (data) {
      for (const row of data) {
        const val = row.value != null ? String(row.value) : '';
        result[row.key] = val;
        setCache(row.key, val);
      }
    }
  } catch (error) {
    console.error('[SiteSettingsLoader] Error fetching settings:', error);
  }

  return result;
}

/**
 * Fetch a site_settings value and parse as number (cached 5 min).
 * Returns the fallback if not found or not a valid number.
 */
export async function getSiteSettingInt(key: string, fallback: number): Promise<number> {
  const value = await getSiteSetting(key);
  if (value === null) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Fetch a site_settings value and parse as boolean (cached 5 min).
 * Treats 'true', '1', 'yes' as true; everything else as false.
 */
export async function getSiteSettingBool(key: string, fallback = false): Promise<boolean> {
  const value = await getSiteSetting(key);
  if (value === null) return fallback;
  return value === 'true' || value === '1' || value === 'yes';
}
