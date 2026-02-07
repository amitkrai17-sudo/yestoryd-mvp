// =============================================================================
// MINI CHALLENGE SETTINGS UTILITY
// Server-side utility to fetch Mini Challenge configuration from site_settings
// Usage: API routes, server components
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase/server';

export interface MiniChallengeSettings {
  enabled: boolean;
  questionsCount: number;
  xpCorrect: number;
  xpIncorrect: number;
  xpVideo: number;
  videoSkipDelay: number;
}

/**
 * Get Mini Challenge settings for a specific child age
 * Fetches from site_settings table with age-appropriate question counts
 */
export async function getMiniChallengeSettings(childAge: number): Promise<MiniChallengeSettings> {
  const supabase = supabaseAdmin;

  // Fetch all mini_challenge settings
  const { data: settings, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .or('key.like.mini_challenge%,category.eq.features')
    .in('key', [
      'mini_challenge_enabled',
      'mini_challenge_questions_count_4_6',
      'mini_challenge_questions_count_7_9',
      'mini_challenge_questions_count_10_12',
      'mini_challenge_xp_correct',
      'mini_challenge_xp_incorrect',
      'mini_challenge_xp_video',
      'mini_challenge_video_skip_delay_seconds',
    ]);

  if (error) {
    console.warn('[getMiniChallengeSettings] Failed to fetch settings:', error);
  }

  // Helper to get setting value with fallback
  const get = (key: string, fallback: string): string => {
    const setting = settings?.find(s => s.key === key);
    if (!setting) return fallback;
    // Handle JSONB values (remove quotes if present)
    const value = String(setting.value || fallback);
    return value.replace(/^"(.*)"$/, '$1');
  };

  // Determine question count based on age
  let questionsKey = 'mini_challenge_questions_count_4_6';
  if (childAge >= 7 && childAge <= 9) {
    questionsKey = 'mini_challenge_questions_count_7_9';
  } else if (childAge >= 10) {
    questionsKey = 'mini_challenge_questions_count_10_12';
  }

  return {
    enabled: get('mini_challenge_enabled', 'true') === 'true',
    questionsCount: parseInt(get(questionsKey, '4')),
    xpCorrect: parseInt(get('mini_challenge_xp_correct', '10')),
    xpIncorrect: parseInt(get('mini_challenge_xp_incorrect', '0')),
    xpVideo: parseInt(get('mini_challenge_xp_video', '20')),
    videoSkipDelay: parseInt(get('mini_challenge_video_skip_delay_seconds', '30')),
  };
}

/**
 * Check if Mini Challenge is enabled globally
 */
export async function isMiniChallengeEnabled(): Promise<boolean> {
  const supabase = supabaseAdmin;

  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'mini_challenge_enabled')
    .single();

  if (!data) return true; // Default to enabled if setting not found

  const value = String(data.value || 'true');
  return value.replace(/^"(.*)"$/, '$1') === 'true';
}
