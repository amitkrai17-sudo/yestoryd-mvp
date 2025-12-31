// =============================================================================
// FILE: lib/gamification.ts
// PURPOSE: E-Learning gamification engine - XP, badges, streaks, levels
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// =============================================================================
// TYPES
// =============================================================================
export type ActivityType = 'video' | 'quiz' | 'game' | 'reading' | 'perfect_quiz';

export interface XPAwardResult {
  xpEarned: number;
  totalXP: number;
  newLevel: number;
  levelTitle: string;
  levelIcon: string;
  leveledUp: boolean;
  previousLevel: number;
  streakBonus: number;
  currentStreak: number;
  streakBroken: boolean;
  newBadges: Badge[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xp_bonus: number;
  earnedAt?: string;
}

export interface GamificationState {
  xp: number;
  level: number;
  levelTitle: string;
  levelIcon: string;
  streak: number;
  longestStreak: number;
  nextLevelXP: number;
  progressToNextLevel: number;
  badges: Badge[];
  recentBadges: Badge[];
  stats: {
    videosCompleted: number;
    quizzesCompleted: number;
    gamesCompleted: number;
    readingsCompleted: number;
    perfectQuizzes: number;
  };
}

// XP amounts per activity
export const XP_REWARDS = {
  video: 10,
  quiz: 50,
  quiz_perfect_bonus: 30,
  game: 20,
  reading: 30,
  reading_above_target: 20,
  module_complete: 100,
  level_complete: 500,
};

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Award XP to a child and handle all gamification updates
 */
export async function awardXP(
  childId: string,
  baseXP: number,
  activityType: ActivityType,
  options?: {
    isPerfect?: boolean;
    aboveTarget?: boolean;
    skipStreakUpdate?: boolean;
  }
): Promise<XPAwardResult> {
  let totalXPEarned = baseXP;
  let streakBonus = 0;
  let streakBroken = false;
  let currentStreak = 0;

  // Get current state
  const { data: currentState } = await supabase
    .from('child_gamification')
    .select('*')
    .eq('child_id', childId)
    .single();

  const previousLevel = currentState?.current_level || 1;
  const previousXP = currentState?.total_xp || 0;

  // Update streak (unless skipped)
  if (!options?.skipStreakUpdate) {
    const streakResult = await updateStreak(childId);
    streakBonus = streakResult.streakBonus;
    currentStreak = streakResult.currentStreak;
    streakBroken = streakResult.streakBroken;
    totalXPEarned += streakBonus;
  }

  // Add perfect bonus
  if (options?.isPerfect && activityType === 'quiz') {
    totalXPEarned += XP_REWARDS.quiz_perfect_bonus;
  }

  // Add above target bonus for reading
  if (options?.aboveTarget && activityType === 'reading') {
    totalXPEarned += XP_REWARDS.reading_above_target;
  }

  // Award XP using database function
  const { data: xpResult, error } = await supabase.rpc('award_xp', {
    p_child_id: childId,
    p_xp_amount: totalXPEarned,
    p_activity_type: options?.isPerfect ? 'perfect_quiz' : activityType,
  });

  if (error) {
    console.error('Error awarding XP:', error);
    // Fallback: direct update
    await supabase
      .from('child_gamification')
      .upsert({
        child_id: childId,
        total_xp: previousXP + totalXPEarned,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'child_id' });
  }

  const newTotalXP = xpResult?.[0]?.new_total_xp || previousXP + totalXPEarned;
  const newLevel = xpResult?.[0]?.new_level || previousLevel;
  const levelTitle = xpResult?.[0]?.level_title || 'Beginner';

  // Get level icon
  const { data: levelData } = await supabase
    .from('xp_levels')
    .select('icon')
    .eq('level', newLevel)
    .single();

  // Check for new badges
  const newBadges = await checkAndAwardBadges(childId, activityType, {
    isPerfect: options?.isPerfect,
    streak: currentStreak,
  });

  // Add badge XP bonus
  const badgeXPBonus = newBadges.reduce((sum, b) => sum + b.xp_bonus, 0);
  if (badgeXPBonus > 0) {
    await supabase
      .from('child_gamification')
      .update({ total_xp: newTotalXP + badgeXPBonus })
      .eq('child_id', childId);
  }

  return {
    xpEarned: totalXPEarned,
    totalXP: newTotalXP + badgeXPBonus,
    newLevel,
    levelTitle,
    levelIcon: levelData?.icon || '🌱',
    leveledUp: newLevel > previousLevel,
    previousLevel,
    streakBonus,
    currentStreak,
    streakBroken,
    newBadges,
  };
}

/**
 * Update streak and return bonus XP
 */
export async function updateStreak(childId: string): Promise<{
  currentStreak: number;
  streakBroken: boolean;
  streakBonus: number;
}> {
  try {
    const { data, error } = await supabase.rpc('update_streak', {
      p_child_id: childId,
    });

    if (error) throw error;

    return {
      currentStreak: data?.[0]?.current_streak || 1,
      streakBroken: data?.[0]?.streak_broken || false,
      streakBonus: data?.[0]?.streak_bonus || 5,
    };
  } catch (error) {
    console.error('Error updating streak:', error);
    
    // Fallback: manual streak update
    const today = new Date().toISOString().split('T')[0];
    
    const { data: current } = await supabase
      .from('child_gamification')
      .select('last_activity_date, current_streak_days')
      .eq('child_id', childId)
      .single();

    let newStreak = 1;
    let bonus = 5;
    let broken = false;

    if (current?.last_activity_date) {
      const lastDate = new Date(current.last_activity_date);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Same day
        return { currentStreak: current.current_streak_days || 1, streakBroken: false, streakBonus: 0 };
      } else if (diffDays === 1) {
        // Consecutive
        newStreak = (current.current_streak_days || 0) + 1;
        if (newStreak === 3) bonus += 15;
        else if (newStreak === 7) bonus += 50;
        else if (newStreak === 14) bonus += 60;
        else if (newStreak === 30) bonus += 150;
      } else {
        // Broken
        broken = true;
      }
    }

    await supabase
      .from('child_gamification')
      .upsert({
        child_id: childId,
        current_streak_days: newStreak,
        last_activity_date: today,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'child_id' });

    return { currentStreak: newStreak, streakBroken: broken, streakBonus: bonus };
  }
}

/**
 * Check and award any earned badges
 */
export async function checkAndAwardBadges(
  childId: string,
  activityType: ActivityType,
  context: {
    isPerfect?: boolean;
    streak?: number;
    moduleCompleted?: boolean;
    levelCompleted?: number;
    aboveTargetWPM?: boolean;
  }
): Promise<Badge[]> {
  const newBadges: Badge[] = [];

  // Get child's current stats
  const { data: stats } = await supabase
    .from('child_gamification')
    .select('*')
    .eq('child_id', childId)
    .single();

  if (!stats) return [];

  // Get badges child already has
  const { data: existingBadges } = await supabase
    .from('child_badges')
    .select('badge_id')
    .eq('child_id', childId);

  const earnedBadgeIds = new Set(existingBadges?.map(b => b.badge_id) || []);

  // Get all active badge definitions
  const { data: allBadges } = await supabase
    .from('badge_definitions')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (!allBadges) return [];

  // Check each badge
  for (const badge of allBadges) {
    if (earnedBadgeIds.has(badge.id)) continue;

    let earned = false;

    switch (badge.criteria_type) {
      case 'videos_completed':
        earned = stats.total_videos_completed >= badge.criteria_value;
        break;
      case 'quizzes_completed':
        earned = stats.total_quizzes_completed >= badge.criteria_value;
        break;
      case 'games_completed':
        earned = stats.total_games_completed >= badge.criteria_value;
        break;
      case 'readings_completed':
        earned = stats.total_readings_completed >= badge.criteria_value;
        break;
      case 'perfect_quizzes':
        earned = stats.perfect_quiz_count >= badge.criteria_value;
        break;
      case 'streak_days':
        earned = (context.streak || 0) >= badge.criteria_value;
        break;
      case 'level_complete':
        earned = context.levelCompleted === badge.criteria_value;
        break;
      case 'above_target_wpm':
        earned = context.aboveTargetWPM === true;
        break;
    }

    if (earned) {
      // Award badge
      const { error } = await supabase.from('child_badges').insert({
        child_id: childId,
        badge_id: badge.id,
      });

      if (!error) {
        newBadges.push({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.category,
          xp_bonus: badge.xp_bonus,
        });
      }
    }
  }

  return newBadges;
}

/**
 * Get complete gamification state for a child
 */
export async function getGamificationState(childId: string): Promise<GamificationState | null> {
  // Get or create gamification record
  let { data: gamification } = await supabase
    .from('child_gamification')
    .select('*')
    .eq('child_id', childId)
    .single();

  if (!gamification) {
    // Create initial record
    const { data: newRecord } = await supabase
      .from('child_gamification')
      .insert({ child_id: childId })
      .select()
      .single();
    gamification = newRecord;
  }

  if (!gamification) return null;

  // Get current level info
  const { data: currentLevelInfo } = await supabase
    .from('xp_levels')
    .select('*')
    .eq('level', gamification.current_level)
    .single();

  // Get next level info
  const { data: nextLevelInfo } = await supabase
    .from('xp_levels')
    .select('*')
    .eq('level', gamification.current_level + 1)
    .single();

  // Get badges
  const { data: badges } = await supabase
    .from('child_badges')
    .select('*, badge:badge_definitions(*)')
    .eq('child_id', childId)
    .order('earned_at', { ascending: false });

  // Calculate progress to next level
  const currentLevelXP = currentLevelInfo?.xp_required || 0;
  const nextLevelXP = nextLevelInfo?.xp_required || currentLevelXP + 500;
  const xpInCurrentLevel = gamification.total_xp - currentLevelXP;
  const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
  const progressToNextLevel = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100));

  // Recent badges (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentBadges = (badges || []).filter(b => 
    new Date(b.earned_at) >= sevenDaysAgo
  );

  return {
    xp: gamification.total_xp,
    level: gamification.current_level,
    levelTitle: currentLevelInfo?.title || 'Beginner',
    levelIcon: currentLevelInfo?.icon || '🌱',
    streak: gamification.current_streak_days,
    longestStreak: gamification.longest_streak_days,
    nextLevelXP,
    progressToNextLevel,
    badges: (badges || []).map(b => ({
      id: b.badge_id,
      name: b.badge?.name || '',
      description: b.badge?.description || '',
      icon: b.badge?.icon || '🏆',
      category: b.badge?.category || 'milestone',
      xp_bonus: b.badge?.xp_bonus || 0,
      earnedAt: b.earned_at,
    })),
    recentBadges: recentBadges.map(b => ({
      id: b.badge_id,
      name: b.badge?.name || '',
      description: b.badge?.description || '',
      icon: b.badge?.icon || '🏆',
      category: b.badge?.category || 'milestone',
      xp_bonus: b.badge?.xp_bonus || 0,
      earnedAt: b.earned_at,
    })),
    stats: {
      videosCompleted: gamification.total_videos_completed,
      quizzesCompleted: gamification.total_quizzes_completed,
      gamesCompleted: gamification.total_games_completed,
      readingsCompleted: gamification.total_readings_completed,
      perfectQuizzes: gamification.perfect_quiz_count,
    },
  };
}

/**
 * Get leaderboard for a specific level
 */
export async function getLeaderboard(
  levelId: string | null,
  childId: string,
  limit: number = 10
): Promise<{
  topEntries: any[];
  childRank: number;
  childPercentile: number;
  totalInLevel: number;
}> {
  try {
    // Refresh leaderboard
    await supabase.rpc('refresh_leaderboard');
  } catch (e) {
    // Ignore refresh errors
  }

  // Get top entries
  let query = supabase
    .from('elearning_leaderboard')
    .select('*')
    .order('level_rank', { ascending: true })
    .limit(limit);

  if (levelId) {
    query = query.eq('current_level_id', levelId);
  }

  const { data: topEntries } = await query;

  // Get child's position
  const { data: childEntry } = await supabase
    .from('elearning_leaderboard')
    .select('*')
    .eq('child_id', childId)
    .single();

  // Get total count
  const { count } = await supabase
    .from('elearning_leaderboard')
    .select('child_id', { count: 'exact' });

  return {
    topEntries: topEntries || [],
    childRank: childEntry?.level_rank || 0,
    childPercentile: Math.round((1 - (childEntry?.percentile || 1)) * 100),
    totalInLevel: count || 0,
  };
}

/**
 * Get all available badges with earned status
 */
export async function getAllBadges(childId: string): Promise<{
  earned: Badge[];
  unearned: Badge[];
}> {
  // Get all badges
  const { data: allBadges } = await supabase
    .from('badge_definitions')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  // Get child's earned badges
  const { data: earnedBadges } = await supabase
    .from('child_badges')
    .select('badge_id, earned_at')
    .eq('child_id', childId);

  const earnedIds = new Set(earnedBadges?.map(b => b.badge_id) || []);
  const earnedMap = new Map(earnedBadges?.map(b => [b.badge_id, b.earned_at]) || []);

  const earned: Badge[] = [];
  const unearned: Badge[] = [];

  for (const badge of allBadges || []) {
    const badgeData: Badge = {
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      xp_bonus: badge.xp_bonus,
    };

    if (earnedIds.has(badge.id)) {
      earned.push({ ...badgeData, earnedAt: earnedMap.get(badge.id) });
    } else {
      unearned.push(badgeData);
    }
  }

  return { earned, unearned };
}

/**
 * Record video completion with XP award
 */
export async function recordVideoCompletion(
  childId: string,
  videoId: string,
  xpReward: number = XP_REWARDS.video
): Promise<XPAwardResult> {
  // Update video progress
  await supabase
    .from('child_video_progress')
    .upsert({
      child_id: childId,
      video_id: videoId,
      is_completed: true,
      completion_percentage: 100,
      completed_at: new Date().toISOString(),
      xp_earned: xpReward,
    }, {
      onConflict: 'child_id,video_id',
    });

  // Award XP
  return await awardXP(childId, xpReward, 'video');
}

/**
 * Record quiz completion with XP award
 */
export async function recordQuizCompletion(
  childId: string,
  videoId: string,
  score: number,
  totalQuestions: number,
  xpReward: number = XP_REWARDS.quiz
): Promise<XPAwardResult> {
  const isPerfect = score === totalQuestions;
  const scorePercent = Math.round((score / totalQuestions) * 100);

  // Update video progress with quiz info
  await supabase
    .from('child_video_progress')
    .update({
      quiz_attempted: true,
      quiz_score: scorePercent,
      quiz_passed: scorePercent >= 70,
      quiz_completed_at: new Date().toISOString(),
    })
    .eq('child_id', childId)
    .eq('video_id', videoId);

  // Award XP
  return await awardXP(childId, xpReward, 'quiz', { isPerfect });
}

/**
 * Record game completion with XP award
 */
export async function recordGameCompletion(
  childId: string,
  gameId: string,
  score: number,
  maxScore: number,
  results: any[],
  xpReward: number = XP_REWARDS.game
): Promise<XPAwardResult> {
  const scorePercent = Math.round((score / maxScore) * 100);

  // Get game info
  const { data: game } = await supabase
    .from('learning_games')
    .select('game_type')
    .eq('id', gameId)
    .single();

  // Save game result
  await supabase.from('child_game_results').insert({
    child_id: childId,
    game_id: gameId,
    game_type: game?.game_type || 'unknown',
    score,
    max_score: maxScore,
    score_percent: scorePercent,
    rounds_completed: results.length,
    rounds_total: results.length,
    results,
    xp_earned: xpReward,
  });

  // Award XP
  return await awardXP(childId, xpReward, 'game');
}

/**
 * Record reading completion with XP award
 */
export async function recordReadingCompletion(
  childId: string,
  passageId: string,
  wpm: number,
  targetWpm: number,
  scores: {
    clarity: number;
    fluency: number;
    expression: number;
    overall: number;
  },
  xpReward: number = XP_REWARDS.reading
): Promise<XPAwardResult> {
  const aboveTarget = wpm >= targetWpm;

  // Save reading result
  await supabase.from('child_reading_results').insert({
    child_id: childId,
    passage_id: passageId,
    wpm,
    clarity_score: scores.clarity,
    fluency_score: scores.fluency,
    expression_score: scores.expression,
    overall_score: scores.overall,
    xp_earned: xpReward + (aboveTarget ? XP_REWARDS.reading_above_target : 0),
  });

  // Award XP
  return await awardXP(childId, xpReward, 'reading', { aboveTarget });
}
