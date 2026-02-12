// =============================================================================
// MINI CHALLENGE CONTENT UTILITIES
// Fetch Mini Challenge videos from elearning_units
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase/server';

export type GoalArea =
  | 'reading'
  | 'grammar'
  | 'comprehension'
  | 'creative_writing'
  | 'speaking';

export interface MiniChallengeVideo {
  id: string;
  name: string;
  slug: string;
  quest_title: string;
  description: string;
  goal_area: GoalArea;
  video_url: string;
  estimated_minutes: number;
  min_age: number;
  max_age: number;
  difficulty: string;
  icon_emoji: string;
}

/**
 * Get a Mini Challenge video for a specific goal area and child age
 * @param goalArea - Learning goal (reading, grammar, comprehension, creative_writing, speaking)
 * @param childAge - Child's age to filter age-appropriate content
 * @returns Mini Challenge video or null if none found
 */
export async function getMiniChallengeVideo(
  goalArea: GoalArea,
  childAge: number
): Promise<MiniChallengeVideo | null> {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from('el_learning_units')
    .select('id, name, slug, quest_title, description, goal_area, video_url, estimated_minutes, min_age, max_age, difficulty, icon_emoji')
    .eq('is_mini_challenge', true)
    .eq('goal_area', goalArea)
    .lte('min_age', childAge)
    .gte('max_age', childAge)
    .eq('status', 'published')
    .order('difficulty', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    console.error('[getMiniChallengeVideo] Error:', error);
    return null;
  }

  return data as unknown as MiniChallengeVideo;
}

/**
 * Get all Mini Challenge videos for a child's age
 * @param childAge - Child's age to filter age-appropriate content
 * @returns Array of Mini Challenge videos
 */
export async function getAllMiniChallengeVideos(
  childAge: number
): Promise<MiniChallengeVideo[]> {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from('el_learning_units')
    .select('id, name, slug, quest_title, description, goal_area, video_url, estimated_minutes, min_age, max_age, difficulty, icon_emoji')
    .eq('is_mini_challenge', true)
    .lte('min_age', childAge)
    .gte('max_age', childAge)
    .eq('status', 'published')
    .order('goal_area', { ascending: true })
    .order('difficulty', { ascending: true });

  if (error) {
    console.error('[getAllMiniChallengeVideos] Error:', error);
    return [];
  }

  return (data || []) as unknown as MiniChallengeVideo[];
}

/**
 * Mark Mini Challenge as completed for a child
 * @param childId - Child's ID
 * @param challengeData - Data to store (quiz_score, video_watched, xp_earned, etc.)
 * @returns Success boolean
 */
export async function markMiniChallengeCompleted(
  childId: string,
  challengeData: {
    goal_area: GoalArea;
    video_id: string;
    quiz_score: number;
    video_watched: boolean;
    xp_earned: number;
    time_spent_seconds: number;
  }
): Promise<boolean> {
  const supabase = supabaseAdmin;

  const { error } = await (supabase
    .from('children') as any)
    .update({
      mini_challenge_completed: true,
      mini_challenge_data: {
        ...challengeData,
        completed_at: new Date().toISOString(),
      },
    })
    .eq('id', childId);

  if (error) {
    console.error('[markMiniChallengeCompleted] Error:', error);
    return false;
  }

  return true;
}
