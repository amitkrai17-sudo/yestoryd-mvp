// =============================================================================
// ARTIFACT CONFIGURATION LOADER
// lib/config/artifact-config.ts
//
// Loads artifact settings from site_settings with hardcoded fallbacks.
// Pattern follows lib/config/payout-config.ts (batch query, TTL cache).
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase/server';

// =============================================================================
// TYPES
// =============================================================================

export interface ArtifactConfig {
  artifact_max_file_size_bytes: number;
  artifact_image_max_dimension: number;
  artifact_thumbnail_dimension: number;
  artifact_analysis_model: string;
  artifact_retention_original_days: number;
  artifact_retention_processed_days: number; // -1 = forever
}

// =============================================================================
// FALLBACKS (safety net — DB should always have values)
// =============================================================================

const FALLBACKS: Record<string, string | number> = {
  artifact_max_file_size_bytes: 10485760,       // 10 MB
  artifact_image_max_dimension: 2048,            // px
  artifact_thumbnail_dimension: 200,             // px
  artifact_analysis_model: 'gemini-2.5-flash',
  artifact_retention_original_days: 365,         // 1 year
  artifact_retention_processed_days: -1,         // forever
};

const ALL_KEYS = Object.keys(FALLBACKS);

// =============================================================================
// HELPERS
// =============================================================================

function tryParseJSON(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return val; }
}

function asNumber(val: unknown, fallback: number): number {
  const parsed = tryParseJSON(val);
  const num = Number(parsed);
  return isNaN(num) ? fallback : num;
}

function asString(val: unknown, fallback: string): string {
  const parsed = tryParseJSON(val);
  return typeof parsed === 'string' ? parsed : fallback;
}

// =============================================================================
// CACHE
// =============================================================================

let configCache: { data: ArtifactConfig; loadedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateArtifactConfigCache(): void {
  configCache = null;
}

// =============================================================================
// LOADER
// =============================================================================

/**
 * Batch-fetch all artifact config keys from site_settings.
 * 5-min in-memory cache. DB values merged over fallbacks.
 */
export async function loadArtifactConfig(forceRefresh = false): Promise<ArtifactConfig> {
  if (!forceRefresh && configCache && Date.now() - configCache.loadedAt < CACHE_TTL) {
    return configCache.data;
  }

  const { data: rows, error } = await supabaseAdmin
    .from('site_settings')
    .select('key, value')
    .in('key', ALL_KEYS);

  if (error) {
    console.error('[ArtifactConfig] DB fetch failed, using fallbacks:', error.message);
  }

  const dbMap = new Map<string, unknown>();
  for (const row of rows || []) {
    dbMap.set(row.key, row.value);
  }

  const get = (key: string) => dbMap.has(key) ? dbMap.get(key) : undefined;
  const fb = FALLBACKS;

  const config: ArtifactConfig = {
    artifact_max_file_size_bytes: asNumber(get('artifact_max_file_size_bytes'), fb.artifact_max_file_size_bytes as number),
    artifact_image_max_dimension: asNumber(get('artifact_image_max_dimension'), fb.artifact_image_max_dimension as number),
    artifact_thumbnail_dimension: asNumber(get('artifact_thumbnail_dimension'), fb.artifact_thumbnail_dimension as number),
    artifact_analysis_model: asString(get('artifact_analysis_model'), fb.artifact_analysis_model as string),
    artifact_retention_original_days: asNumber(get('artifact_retention_original_days'), fb.artifact_retention_original_days as number),
    artifact_retention_processed_days: asNumber(get('artifact_retention_processed_days'), fb.artifact_retention_processed_days as number),
  };

  configCache = { data: config, loadedAt: Date.now() };
  return config;
}
