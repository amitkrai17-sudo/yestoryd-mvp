// ============================================================
// FILE: lib/backops/policy-loader.ts
// PURPOSE: Cached policy reader for BackOps policies.
//          Pattern: Mirrors site-settings-loader.ts (5-min TTL).
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';

// ── Cache (same pattern as lib/config/site-settings-loader.ts) ──

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();
let allPoliciesCache: { data: Map<string, unknown>; expiresAt: number } | null = null;

function getCached(key: string): unknown | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache(key: string, value: unknown): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Bulk loader ──

async function loadAllPolicies(): Promise<Map<string, unknown>> {
  if (allPoliciesCache && Date.now() < allPoliciesCache.expiresAt) {
    return allPoliciesCache.data;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('backops_policies')
      .select('policy_key, policy_value')
      .eq('is_active', true);

    if (error) {
      console.error('[BackOps] Failed to load policies:', error.message);
      return allPoliciesCache?.data ?? new Map();
    }

    const newCache = new Map<string, unknown>();
    for (const row of data || []) {
      newCache.set(row.policy_key, row.policy_value);
      setCache(row.policy_key, row.policy_value);
    }

    allPoliciesCache = { data: newCache, expiresAt: Date.now() + CACHE_TTL_MS };
    return newCache;
  } catch {
    console.error('[BackOps] Exception loading policies');
    return allPoliciesCache?.data ?? new Map();
  }
}

// ── Public API ──

/**
 * Get a policy value by key. Returns the full JSONB value.
 * ALWAYS provide a fallback — policies may not be seeded yet.
 *
 * Example:
 * ```
 * const policy = await getPolicy('practice_nudge', {
 *   high_engagement_skip: 0.8,
 *   low_engagement_24h: 0.4,
 *   default_nudge_hours: 48,
 * });
 * if (engagement > policy.high_engagement_skip) { // skip }
 * ```
 */
export async function getPolicy<T = Record<string, unknown>>(
  key: string,
  fallback: T,
): Promise<T> {
  try {
    // Check individual cache first
    const cached = getCached(key);
    if (cached !== undefined) return cached as T;

    // Load all policies (bulk fetch, cached)
    const policies = await loadAllPolicies();
    const value = policies.get(key);
    return (value as T) ?? fallback;
  } catch {
    console.error(`[BackOps] Policy fetch failed for ${key}, using fallback`);
    return fallback;
  }
}

/**
 * Get a specific nested value from a policy.
 *
 * Example:
 * ```
 * const threshold = await getPolicyValue('practice_nudge', 'high_engagement_skip', 0.8);
 * ```
 */
export async function getPolicyValue<T>(
  policyKey: string,
  valueKey: string,
  fallback: T,
): Promise<T> {
  try {
    const policy = await getPolicy<Record<string, unknown>>(policyKey, {});
    const value = policy[valueKey];
    return (value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Force-refresh the policy cache. Call after policy updates. */
export function invalidatePolicyCache(): void {
  cache.clear();
  allPoliciesCache = null;
}
