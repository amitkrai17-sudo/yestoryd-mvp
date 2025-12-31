// =============================================================================
// FILE: app/api/elearning/gamification/route.ts
// PURPOSE: Get child's gamification state (XP, level, streak, badges)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic - disable Next.js caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const XP_LEVELS = [
  { level: 1, name: 'Beginner', minXP: 0, maxXP: 100 },
  { level: 2, name: 'Explorer', minXP: 100, maxXP: 250 },
  { level: 3, name: 'Learner', minXP: 250, maxXP: 500 },
  { level: 4, name: 'Achiever', minXP: 500, maxXP: 1000 },
  { level: 5, name: 'Star', minXP: 1000, maxXP: 2000 },
  { level: 6, name: 'Champion', minXP: 2000, maxXP: 3500 },
  { level: 7, name: 'Master', minXP: 3500, maxXP: 5500 },
  { level: 8, name: 'Expert', minXP: 5500, maxXP: 8000 },
  { level: 9, name: 'Genius', minXP: 8000, maxXP: 11000 },
  { level: 10, name: 'Legend', minXP: 11000, maxXP: 999999 },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    const trimmedChildId = childId.trim();

    // Get gamification record
    const { data: gamificationRecords, error: fetchError } = await supabase
      .from('child_gamification')
      .select('*')
      .eq('child_id', trimmedChildId);

    if (fetchError) {
      throw fetchError;
    }

    let gamification = gamificationRecords?.[0];

    if (!gamification) {
      // Create new gamification record
      const { data: newRecord, error: createError } = await supabase
        .from('child_gamification')
        .insert({
          child_id: trimmedChildId,
          total_xp: 0,
          current_level: 1,
          current_streak_days: 0,
          longest_streak_days: 0,
          total_videos_completed: 0,
          total_quizzes_completed: 0,
          total_games_completed: 0,
          perfect_quiz_count: 0,
          last_activity_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      gamification = newRecord;
    }

    // Get badges
    const { data: badges } = await supabase
      .from('child_badges')
      .select('id, badge_name, badge_icon, badge_description, badge_category, earned_at')
      .eq('child_id', trimmedChildId)
      .order('earned_at', { ascending: false });

    const levelInfo = calculateLevel(gamification.total_xp);

    const response = {
      success: true,
      xp: {
        current: gamification.total_xp,
        level: levelInfo.level,
        levelName: levelInfo.name,
        xpInCurrentLevel: levelInfo.xpInLevel,
        xpRequiredForLevel: levelInfo.xpRequired,
        progressPercent: levelInfo.progressPercent,
        xpToNextLevel: levelInfo.xpToNext,
      },
      streak: {
        current: gamification.current_streak_days,
        longest: gamification.longest_streak_days,
        lastActivityDate: gamification.last_activity_date,
        isActiveToday: gamification.last_activity_date === new Date().toISOString().split('T')[0],
      },
      stats: {
        totalVideosCompleted: gamification.total_videos_completed,
        totalQuizzesPassed: gamification.total_quizzes_completed,
        totalGamesCompleted: gamification.total_games_completed,
        perfectScores: gamification.perfect_quiz_count,
        totalTimeMinutes: gamification.total_time_minutes || 0,
      },
      badges: {
        earned: badges?.map(b => ({
          id: b.id,
          earnedAt: b.earned_at,
          name: b.badge_name,
          icon: b.badge_icon,
          description: b.badge_description,
          category: b.badge_category,
        })) || [],
        unearned: [],
        total: badges?.length || 0,
      },
    };

    // Return with no-cache headers
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    console.error('Gamification API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get gamification data' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

function calculateLevel(totalXP: number) {
  let currentLevel = XP_LEVELS[0];
  
  for (const level of XP_LEVELS) {
    if (totalXP >= level.minXP) {
      currentLevel = level;
    } else {
      break;
    }
  }

  const xpInLevel = totalXP - currentLevel.minXP;
  const xpRequired = currentLevel.maxXP - currentLevel.minXP;
  const progressPercent = Math.min(100, Math.round((xpInLevel / xpRequired) * 100));
  const xpToNext = currentLevel.maxXP - totalXP;

  return {
    level: currentLevel.level,
    name: currentLevel.name,
    xpInLevel,
    xpRequired,
    progressPercent,
    xpToNext: Math.max(0, xpToNext),
  };
}
