// =============================================================================
// FILE: app/api/elearning/progress/route.ts
// PURPOSE: Track video completion and award XP
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { childId, videoId, watchedPercent, completed } = body;

    if (!childId || !videoId) {
      return NextResponse.json(
        { error: 'childId and videoId are required' },
        { status: 400 }
      );
    }

    // Get video info
    const { data: video, error: videoError } = await supabase
      .from('learning_videos')
      .select('id, title, xp_reward, has_quiz, module_id')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check existing progress
    const { data: existingProgress } = await supabase
      .from('child_video_progress')
      .select('*')
      .eq('child_id', childId)
      .eq('video_id', videoId)
      .single();

    const wasAlreadyCompleted = existingProgress?.is_completed;
    const xpReward = video.xp_reward || 10;

    // Upsert progress
    const now = new Date().toISOString();
    const isCompleted = completed || watchedPercent >= 90;
    
    const progressData: any = {
      child_id: childId,
      video_id: videoId,
      completion_percentage: watchedPercent || 100,
      is_completed: isCompleted,
      last_watched_at: now,
    };

    if (isCompleted && !existingProgress?.is_completed) {
      progressData.completed_at = now;
      progressData.xp_earned = xpReward;
    }

    if (existingProgress) {
      // Update watch count
      progressData.watch_count = (existingProgress.watch_count || 0) + 1;
      
      await supabase
        .from('child_video_progress')
        .update(progressData)
        .eq('id', existingProgress.id);
    } else {
      progressData.first_watched_at = now;
      progressData.watch_count = 1;
      
      await supabase
        .from('child_video_progress')
        .insert(progressData);
    }

    // Award XP only on first completion
    let xpAwarded = 0;
    let newBadges: string[] = [];

    if (isCompleted && !wasAlreadyCompleted) {
      xpAwarded = xpReward;

      // Update gamification
      let { data: gamification } = await supabase
        .from('child_gamification')
        .select('*')
        .eq('child_id', childId)
        .single();

      // Create gamification record if doesn't exist
      if (!gamification) {
        const { data: newGamification, error: createError } = await supabase
          .from('child_gamification')
          .insert({
            child_id: childId,
            total_xp: 0,
            current_level: 1,
            current_streak_days: 0,
            longest_streak_days: 0,
            total_videos_completed: 0,
            total_quizzes_completed: 0,
            perfect_quiz_count: 0,
            last_activity_date: new Date().toISOString().split('T')[0],
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Failed to create gamification record:', createError);
        } else {
          gamification = newGamification;
        }
      }

      if (gamification) {
        const today = new Date().toISOString().split('T')[0];
        const lastActivity = gamification.last_activity_date;
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Calculate new streak
        let newStreak = gamification.current_streak_days;
        if (lastActivity === yesterday) {
          newStreak += 1; // Continue streak
        } else if (lastActivity !== today) {
          newStreak = 1; // Reset streak
        }
        // If lastActivity is today, keep current streak

        const newLongestStreak = Math.max(newStreak, gamification.longest_streak_days);
        const newTotalXP = gamification.total_xp + xpAwarded;
        const newVideosCompleted = gamification.total_videos_completed + 1;

        // Calculate new level
        const newLevel = calculateLevel(newTotalXP);

        await supabase
          .from('child_gamification')
          .update({
            total_xp: newTotalXP,
            current_level: newLevel,
            current_streak_days: newStreak,
            longest_streak_days: newLongestStreak,
            last_activity_date: today,
            total_videos_completed: newVideosCompleted,
            updated_at: new Date().toISOString(),
          })
          .eq('child_id', childId);

        // Check for new badges
        newBadges = await checkAndAwardBadges(childId, {
          videosCompleted: newVideosCompleted,
          streak: newStreak,
          quizzesPassed: gamification.total_quizzes_completed,
          perfectScores: gamification.perfect_quiz_count,
        });
      }

      // Log learning event
      await supabase
        .from('learning_events')
        .insert({
          child_id: childId,
          event_type: 'el_video_complete',
          event_data: {
            video_id: videoId,
            video_title: video.title,
            xp_awarded: xpAwarded,
            module_id: video.module_id,
          },
        });
    }

    return NextResponse.json({
      success: true,
      progress: {
        videoId,
        completed: completed || watchedPercent >= 90,
        watchedPercent,
      },
      xp: {
        awarded: xpAwarded,
        isFirstCompletion: !wasAlreadyCompleted && completed,
      },
      newBadges,
      hasQuiz: video.has_quiz,
    });
  } catch (error: any) {
    console.error('Progress API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update progress' },
      { status: 500 }
    );
  }
}

// Calculate level from XP
function calculateLevel(totalXP: number): number {
  const levels = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 11000];
  let level = 1;
  for (let i = 0; i < levels.length; i++) {
    if (totalXP >= levels[i]) {
      level = i + 1;
    }
  }
  return Math.min(level, 10);
}

// Check and award badges
async function checkAndAwardBadges(
  childId: string,
  stats: {
    videosCompleted: number;
    streak: number;
    quizzesPassed: number;
    perfectScores: number;
  }
): Promise<string[]> {
  const newBadges: string[] = [];

  // Badge IDs from achievement_badges table
  const BADGE_IDS = {
    FIRST_VIDEO: '333b4e4a-617d-4aa0-9929-692d84b1724f',
    TEN_VIDEOS: '523b6fc7-3fe9-4ecb-bf59-6f4120594784',
    FIFTY_VIDEOS: '40ff7f3c-1809-44fc-a599-b0a28ad5e41d',
    STREAK_3: '528eda9d-c36d-41ab-859e-aebfce2f5f80',
    STREAK_7: '1441582a-3f0c-47da-8f0a-576f512a2447',
    STREAK_14: 'dbb0117c-6be0-4ad3-8147-b0fa0ee75a13',
    QUIZ_FIRST: '941b5961-45fd-4ced-9db5-da407d42dd76',
    QUIZ_TEN: '62764954-2c39-46ed-9271-20919c72eb3d',
    PERFECT_FIRST: 'b03899cf-ef2c-4a85-aa76-f9b77e88bd2b',
    PERFECT_FIVE: 'be082132-de02-476f-9894-70d657a8b531',
  };

  // Get existing badges
  const { data: existingBadges } = await supabase
    .from('child_badges')
    .select('badge_id')
    .eq('child_id', childId);

  const earnedIds = new Set(existingBadges?.map(b => b.badge_id) || []);

  // Badge criteria
  const badgeCriteria = [
    { id: BADGE_IDS.FIRST_VIDEO, check: () => stats.videosCompleted >= 1 },
    { id: BADGE_IDS.TEN_VIDEOS, check: () => stats.videosCompleted >= 10 },
    { id: BADGE_IDS.FIFTY_VIDEOS, check: () => stats.videosCompleted >= 50 },
    { id: BADGE_IDS.STREAK_3, check: () => stats.streak >= 3 },
    { id: BADGE_IDS.STREAK_7, check: () => stats.streak >= 7 },
    { id: BADGE_IDS.STREAK_14, check: () => stats.streak >= 14 },
    { id: BADGE_IDS.QUIZ_FIRST, check: () => stats.quizzesPassed >= 1 },
    { id: BADGE_IDS.QUIZ_TEN, check: () => stats.quizzesPassed >= 10 },
    { id: BADGE_IDS.PERFECT_FIRST, check: () => stats.perfectScores >= 1 },
    { id: BADGE_IDS.PERFECT_FIVE, check: () => stats.perfectScores >= 5 },
  ];

  for (const badge of badgeCriteria) {
    if (!earnedIds.has(badge.id) && badge.check()) {
      // Award badge
      await supabase
        .from('child_badges')
        .insert({
          child_id: childId,
          badge_id: badge.id,
          earned_at: new Date().toISOString(),
        });
      newBadges.push(badge.id);
    }
  }

  return newBadges;
}
