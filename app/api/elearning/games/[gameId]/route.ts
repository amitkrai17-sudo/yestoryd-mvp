// app/api/elearning/games/[gameId]/route.ts
// API for fetching game content and submitting results

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

// GET - Fetch game content
export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    // supabase already initialized above
    const gameId = params.gameId;
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    // Get game content with engine details
    const { data: gameContent, error } = await supabase
      .from('el_game_content')
      .select(`
        *,
        engine:el_game_engines(*),
        skill:el_skills(
          name,
          skill_tag,
          module:el_modules(name)
        )
      `)
      .eq('id', gameId)
      .single();

    if (error || !gameContent) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Get child's identity for personalization
    const { data: identity } = await supabase
      .from('el_child_identity')
      .select('nickname, favorite_animal, favorite_color')
      .eq('child_id', childId)
      .single();

    // Get child's previous attempts at this game (for adaptive difficulty)
    const { data: previousSessions } = await supabase
      .from('el_game_sessions')
      .select('score, accuracy_percent, was_completed')
      .eq('child_id', childId)
      .eq('game_content_id', gameId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Calculate adaptive hints based on past performance
    const avgAccuracy = previousSessions?.length 
      ? previousSessions.reduce((sum, s) => sum + (s.accuracy_percent || 0), 0) / previousSessions.length
      : null;

    return NextResponse.json({
      success: true,
      data: {
        game: {
          id: gameContent.id,
          engineSlug: gameContent.engine?.slug,
          engineName: gameContent.engine?.name,
          instructions: gameContent.engine?.instructions,
          gameType: gameContent.engine?.game_type,
          content: gameContent.content_data,
          difficulty: gameContent.difficulty,
          skillName: gameContent.skill?.name,
          pointsPerCorrect: gameContent.engine?.points_per_correct || 10,
          timeLimit: gameContent.engine?.time_limit_seconds
        },
        personalization: identity ? {
          nickname: identity.nickname,
          favoriteAnimal: identity.favorite_animal,
          favoriteColor: identity.favorite_color
        } : null,
        adaptiveHints: {
          showExtraHelp: avgAccuracy !== null && avgAccuracy < 60,
          previousAttempts: previousSessions?.length || 0,
          bestScore: previousSessions?.length 
            ? Math.max(...previousSessions.map(s => s.score || 0))
            : 0
        }
      }
    });

  } catch (error) {
    console.error('Game fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Submit game results
export async function POST(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    // supabase already initialized above
    const gameId = params.gameId;
    const body = await request.json();

    const {
      childId,
      unitId,
      score,
      maxScore,
      correctCount,
      wrongCount,
      totalCount,
      timeSpentSeconds,
      mistakes
    } = body;

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    // Get game content to get engine and skill IDs
    const { data: gameContent } = await supabase
      .from('el_game_content')
      .select('game_engine_id, skill_id')
      .eq('id', gameId)
      .single();

    if (!gameContent) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Calculate accuracy
    const accuracyPercent = totalCount > 0 
      ? Math.round((correctCount / totalCount) * 100)
      : 0;

    // Determine if passed (70% threshold)
    const passed = accuracyPercent >= 70;

    // Calculate XP earned (base + bonus for accuracy)
    let xpEarned = 10; // Base XP for completing
    if (passed) xpEarned += 10;
    if (accuracyPercent === 100) xpEarned += 10; // Perfect score bonus

    // Calculate coins
    let coinsEarned = passed ? 5 : 2;
    if (accuracyPercent === 100) coinsEarned += 5;

    // Create game session record
    const { data: session, error: sessionError } = await supabase
      .from('el_game_sessions')
      .insert({
        child_id: childId,
        unit_id: unitId || null,
        game_engine_id: gameContent.game_engine_id,
        game_content_id: gameId,
        skill_id: gameContent.skill_id,
        score,
        max_score: maxScore,
        correct_count: correctCount,
        wrong_count: wrongCount,
        total_count: totalCount,
        accuracy_percent: accuracyPercent,
        time_spent_seconds: timeSpentSeconds,
        was_completed: true,
        passed,
        xp_earned: xpEarned,
        coins_earned: coinsEarned,
        mistakes,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return NextResponse.json({ error: 'Failed to save game session' }, { status: 500 });
    }

    // Update child's gamification stats
    const { data: currentStats } = await supabase
      .from('el_child_gamification')
      .select('*')
      .eq('child_id', childId)
      .single();

    if (currentStats) {
      await supabase
        .from('el_child_gamification')
        .update({
          total_xp: (currentStats.total_xp ?? 0) + xpEarned,
          total_coins: (currentStats.total_coins ?? 0) + coinsEarned,
          games_played: (currentStats.games_played ?? 0) + 1,
          games_won: passed ? (currentStats.games_won ?? 0) + 1 : (currentStats.games_won ?? 0),
          perfect_scores: accuracyPercent === 100
            ? (currentStats.perfect_scores ?? 0) + 1
            : (currentStats.perfect_scores ?? 0),
          last_activity_date: new Date().toISOString().split('T')[0]
        })
        .eq('child_id', childId);
    } else {
      // Create new gamification record
      await supabase
        .from('el_child_gamification')
        .insert({
          child_id: childId,
          total_xp: xpEarned,
          total_coins: coinsEarned,
          games_played: 1,
          games_won: passed ? 1 : 0,
          perfect_scores: accuracyPercent === 100 ? 1 : 0,
          last_activity_date: new Date().toISOString().split('T')[0]
        });
    }

    // Update unit progress if unitId provided
    if (unitId) {
      const { data: unitProgress } = await supabase
        .from('el_child_unit_progress')
        .select('*')
        .eq('child_id', childId)
        .eq('unit_id', unitId)
        .single();

      if (unitProgress) {
        await supabase
          .from('el_child_unit_progress')
          .update({
            games_played: (unitProgress.games_played ?? 0) + 1,
            games_passed: passed ? (unitProgress.games_passed ?? 0) + 1 : (unitProgress.games_passed ?? 0),
            best_game_score: Math.max(unitProgress.best_game_score || 0, score),
            xp_earned: (unitProgress.xp_earned ?? 0) + xpEarned,
            coins_earned: (unitProgress.coins_earned ?? 0) + coinsEarned,
            current_step: passed ? (unitProgress.current_step ?? 0) + 1 : (unitProgress.current_step ?? 0),
            status: 'in_progress',
            started_at: unitProgress.started_at || new Date().toISOString(),
            last_activity_at: new Date().toISOString()
          })
          .eq('id', unitProgress.id);
      }
    }

    // Check for badge achievements
    const earnedBadges = await checkAndAwardBadges(supabase, childId);

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          score,
          accuracyPercent,
          passed,
          xpEarned,
          coinsEarned
        },
        celebration: {
          type: accuracyPercent === 100 ? 'perfect' : passed ? 'success' : 'try_again',
          message: accuracyPercent === 100 
            ? '🌟 PERFECT SCORE! Amazing job!'
            : passed 
              ? '🎉 Great work! You passed!'
              : '💪 Good try! Let\'s practice more!',
          newBadges: earnedBadges
        }
      }
    });

  } catch (error) {
    console.error('Game submit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to check and award badges
async function checkAndAwardBadges(supabase: any, childId: string): Promise<any[]> {
  const earnedBadges: any[] = [];

  // Get child's current stats
  const { data: stats } = await supabase
    .from('el_child_gamification')
    .select('*')
    .eq('child_id', childId)
    .single();

  if (!stats) return earnedBadges;

  // Get all badges
  const { data: allBadges } = await supabase
    .from('el_badges')
    .select('*')
    .eq('is_active', true);

  // Get already earned badges
  const { data: alreadyEarned } = await supabase
    .from('el_child_badges')
    .select('badge_id')
    .eq('child_id', childId);

  const earnedIds = new Set(alreadyEarned?.map((b: any) => b.badge_id) || []);

  for (const badge of allBadges || []) {
    if (earnedIds.has(badge.id)) continue;

    let shouldAward = false;

    switch (badge.criteria_type) {
      case 'games_won':
        shouldAward = stats.games_won >= badge.criteria_value;
        break;
      case 'xp_total':
        shouldAward = stats.total_xp >= badge.criteria_value;
        break;
      case 'streak':
        shouldAward = stats.current_streak_days >= badge.criteria_value;
        break;
      case 'perfect_score':
        shouldAward = stats.perfect_scores >= badge.criteria_value;
        break;
      case 'video_count':
        shouldAward = stats.videos_watched >= badge.criteria_value;
        break;
    }

    if (shouldAward) {
      const { data: newBadge } = await supabase
        .from('el_child_badges')
        .insert({
          child_id: childId,
          badge_id: badge.id,
          earned_context: `Earned by achieving ${badge.criteria_value} ${badge.criteria_type}`
        })
        .select(`
          *,
          badge:el_badges(*)
        `)
        .single();

      if (newBadge) {
        earnedBadges.push(newBadge);

        // Award badge XP and coins
        await supabase
          .from('el_child_gamification')
          .update({
            total_xp: stats.total_xp + badge.xp_reward,
            total_coins: stats.total_coins + badge.coins_reward
          })
          .eq('child_id', childId);
      }
    }
  }

  return earnedBadges;
}
