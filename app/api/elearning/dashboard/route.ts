// app/api/elearning/dashboard/route.ts
// Main API for child's e-learning dashboard

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // supabase already initialized above
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    // 1. Get child's basic info
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, name, age, parent_id')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // 2. Get child's avatar (or null if not created)
    const { data: avatar } = await supabase
      .from('el_child_avatars')
      .select('*')
      .eq('child_id', childId)
      .single();

    // 3. Get child's identity (for personalization)
    const { data: identity } = await supabase
      .from('el_child_identity')
      .select('*')
      .eq('child_id', childId)
      .single();

    // 4. Get child's gamification stats
    let { data: gamification } = await supabase
      .from('el_child_gamification')
      .select('*')
      .eq('child_id', childId)
      .single();

    // Create gamification record if doesn't exist
    if (!gamification) {
      const { data: newGamification } = await supabase
        .from('el_child_gamification')
        .insert({ child_id: childId })
        .select()
        .single();
      gamification = newGamification;
    }

    // 5. Get child's earned badges
    const { data: earnedBadges } = await supabase
      .from('el_child_badges')
      .select(`
        *,
        badge:el_badges(*)
      `)
      .eq('child_id', childId)
      .order('earned_at', { ascending: false });

    // 6. Get appropriate stage based on child's age
    const childAge = child.age || 6; // Default to 6 if not set
    const { data: stage } = await supabase
      .from('el_stages')
      .select('*')
      .lte('min_age', childAge)
      .gte('max_age', childAge)
      .single();

    // 7. Get recommended learning unit (rAI will decide, for now get first incomplete)
    const { data: recommendedUnit } = await supabase
      .from('el_learning_units')
      .select(`
        *,
        skill:el_skills(
          *,
          module:el_modules(
            *,
            stage:el_stages(*)
          )
        )
      `)
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .limit(1)
      .single();

    // 8. Get unit progress for recommended unit
    let unitProgress = null;
    if (recommendedUnit) {
      const { data: progress } = await supabase
        .from('el_child_unit_progress')
        .select('*')
        .eq('child_id', childId)
        .eq('unit_id', recommendedUnit.id)
        .single();
      
      unitProgress = progress;

      // Create progress record if doesn't exist
      if (!progress) {
        const { data: newProgress } = await supabase
          .from('el_child_unit_progress')
          .insert({
            child_id: childId,
            unit_id: recommendedUnit.id,
            status: 'available'
          })
          .select()
          .single();
        unitProgress = newProgress;
      }
    }

    // 9. Get videos for recommended unit
    let unitVideos = [];
    if (recommendedUnit?.video_ids?.length > 0) {
      const { data: videos } = await supabase
        .from('el_videos')
        .select('*')
        .in('id', recommendedUnit.video_ids);
      unitVideos = videos || [];
    }

    // 10. Get game content for recommended unit's skill
    let gameContent = [];
    if (recommendedUnit?.skill?.id) {
      const { data: games } = await supabase
        .from('el_game_content')
        .select(`
          *,
          engine:el_game_engines(*)
        `)
        .eq('skill_id', recommendedUnit.skill.id)
        .eq('is_active', true);
      gameContent = games || [];
    }

    // 11. Build the sequence rAI would recommend
    const sequence = buildLearningSequence(unitProgress, gameContent, unitVideos);

    // 12. Get all available units for "more quests" section
    const { data: allUnits } = await supabase
      .from('el_learning_units')
      .select(`
        id,
        name,
        quest_title,
        quest_description,
        xp_reward,
        coins_reward,
        estimated_minutes,
        difficulty,
        world_theme,
        skill:el_skills(
          name,
          skill_tag,
          module:el_modules(
            name,
            stage:el_stages(name, slug)
          )
        )
      `)
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .limit(10);

    // 13. Get progress for all units
    const { data: allProgress } = await supabase
      .from('el_child_unit_progress')
      .select('unit_id, status, overall_mastery_percent')
      .eq('child_id', childId);

    // Map progress to units
    const unitsWithProgress = (allUnits || []).map(unit => {
      const progress = allProgress?.find(p => p.unit_id === unit.id);
      return {
        ...unit,
        progress: progress || { status: 'locked', overall_mastery_percent: 0 }
      };
    });

    // Calculate greeting based on time
    const hour = new Date().getHours();
    let greeting = 'Hello';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    // Use nickname if available
    const displayName = identity?.nickname || child.name?.split(' ')[0] || 'Explorer';

    return NextResponse.json({
      success: true,
      data: {
        child: {
          id: child.id,
          name: child.name,
          displayName,
          age: childAge,
          greeting: `${greeting}, ${displayName}!`
        },
        avatar,
        identity,
        gamification: gamification || {
          total_xp: 0,
          total_coins: 0,
          current_level: 1,
          current_streak_days: 0
        },
        earnedBadges: earnedBadges || [],
        stage,
        currentQuest: recommendedUnit ? {
          unit: recommendedUnit,
          progress: unitProgress,
          videos: unitVideos,
          games: gameContent,
          sequence
        } : null,
        moreQuests: unitsWithProgress.slice(1) // Exclude current quest
      }
    });

  } catch (error) {
    console.error('E-learning dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to build learning sequence based on progress
function buildLearningSequence(
  progress: any,
  gameContent: any[],
  videos: any[]
): Array<{ type: string; id: string; name: string; status: string }> {
  const sequence: Array<{ type: string; id: string; name: string; status: string }> = [];
  
  // Find warmup game
  const warmupGame = gameContent.find(g => g.is_warmup);
  if (warmupGame) {
    sequence.push({
      type: 'game',
      id: warmupGame.id,
      name: warmupGame.engine?.name || 'Warm-up Game',
      status: 'ready'
    });
  }

  // Add video
  const introVideo = videos.find(v => v.is_intro) || videos[0];
  if (introVideo) {
    sequence.push({
      type: 'video',
      id: introVideo.id,
      name: introVideo.title,
      status: warmupGame ? 'locked' : 'ready'
    });
  }

  // Find practice game
  const practiceGame = gameContent.find(g => g.is_practice && !g.is_warmup);
  if (practiceGame) {
    sequence.push({
      type: 'game',
      id: practiceGame.id,
      name: practiceGame.engine?.name || 'Practice Game',
      status: 'locked'
    });
  }

  // Quiz placeholder (when quizzes are built)
  sequence.push({
    type: 'quiz',
    id: 'placeholder',
    name: 'Challenge Quiz',
    status: 'locked'
  });

  // Update statuses based on actual progress
  if (progress) {
    const currentStep = progress.current_step || 0;
    sequence.forEach((item, index) => {
      if (index < currentStep) {
        item.status = 'completed';
      } else if (index === currentStep) {
        item.status = 'ready';
      } else {
        item.status = 'locked';
      }
    });
  }

  return sequence;
}
