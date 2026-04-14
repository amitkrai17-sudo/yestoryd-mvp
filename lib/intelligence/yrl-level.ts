// ============================================================
// FILE: lib/intelligence/yrl-level.ts
// PURPOSE: Derive and update Yestoryd Reading Level (YRL)
// YRL values: F1-F4 (Foundation), B1-B4 (Building), M1-M4 (Mastery)
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

const YRL_PATTERN = /^[FBM][1-4]$/;

interface IntelligenceProfile {
  overall_reading_level?: string | null;
  skill_ratings?: Record<string, unknown> | null;
}

export function deriveYrlLevel(
  ageBand: string | null,
  currentReadingLevel: number | null,
  intelligenceProfile?: IntelligenceProfile
): string | null {
  // Priority 1: intelligence profile with a YRL-formatted string
  const profileLevel = intelligenceProfile?.overall_reading_level;
  if (profileLevel && YRL_PATTERN.test(profileLevel)) return profileLevel;

  // Priority 2: derive from age_band + reading_level (1-4 stage within band)
  const stagePrefix =
    ageBand === 'foundation' ? 'F' :
    ageBand === 'building' ? 'B' :
    ageBand === 'mastery' ? 'M' :
    null;
  if (!stagePrefix) return null;

  const clamped =
    currentReadingLevel && currentReadingLevel >= 1 && currentReadingLevel <= 4
      ? currentReadingLevel
      : 1;

  return `${stagePrefix}${clamped}`;
}

export async function updateChildYrlLevel(
  supabase: SupabaseClient,
  childId: string,
  yrlLevel: string
): Promise<void> {
  if (!YRL_PATTERN.test(yrlLevel)) return;
  await supabase
    .from('children')
    .update({ yrl_level: yrlLevel })
    .eq('id', childId);
}

export function isValidYrl(value: unknown): value is string {
  return typeof value === 'string' && YRL_PATTERN.test(value);
}
