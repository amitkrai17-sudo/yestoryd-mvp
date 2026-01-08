// =============================================================================
// PROGRESS API
// Save step progress and update gamification
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { childId, unitId, stepIndex, stepType, result, xpEarned } = await request.json();

    if (!childId || !unitId || stepIndex === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get or create unit progress
    let { data: progress } = await supabase
      .from('child_unit_progress')
      .select('*')
      .eq('child_id', childId)
      .eq('unit_id', unitId)
      .single();

    if (!progress) {
      // Create new progress record
      const { data: newProgress, error: createError } = await supabase
        .from('child_unit_progress')
        .insert({
          child_id: childId,
          unit_id: unitId,
          status: 'in_progress',
          current_step: 0,
          step_progress: [],
          total_xp_earned: 0,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      progress = newProgress;
    }

    // Update step progress
    const stepProgress = progress.step_progress || [];
    stepProgress[stepIndex] = {
      step: stepIndex,
      type: stepType,
      completed: true,
      completed_at: new Date().toISOString(),
      score: result.score,
      xp_earned: xpEarned,
      time_taken_seconds: result.timeTakenSeconds,
    };

    // Get unit to calculate completion percentage
    const { data: unit } = await supabase
      .from('elearning_units')
      .select('sequence')
      .eq('id', unitId)
      .single();

    const totalSteps = unit?.sequence?.length || 1;
    const completedSteps = stepProgress.filter((s: any) => s?.completed).length;
    const completionPercentage = Math.round((completedSteps / totalSteps) * 100);

    // Update progress
    const { error: updateError } = await supabase
      .from('child_unit_progress')
      .update({
        current_step: stepIndex + 1,
        step_progress: stepProgress,
        completion_percentage: completionPercentage,
        total_xp_earned: progress.total_xp_earned + xpEarned,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', progress.id);

    if (updateError) {
      throw updateError;
    }

    // Update gamification - try RPC first, fallback to direct update
    try {
      await supabase.rpc('add_xp', {
        p_child_id: childId,
        p_xp_amount: xpEarned
      });
    } catch {
      // Fallback if RPC doesn't exist - direct update
      const { data: gamification } = await supabase
        .from('child_gamification')
        .select('total_xp')
        .eq('child_id', childId)
        .single();
      
      if (gamification) {
        await supabase
          .from('child_gamification')
          .update({ total_xp: gamification.total_xp + xpEarned })
          .eq('child_id', childId);
      }
    }

    // Update daily goal - try RPC, silently fail if not available
    try {
      await supabase.rpc('update_daily_goal_progress', {
        p_child_id: childId,
        p_activities_delta: 1,
        p_minutes_delta: Math.ceil((result.timeTakenSeconds || 60) / 60),
      });
    } catch {
      // Silently fail if RPC doesn't exist
    }

    // If it was a game, log to child_game_progress
    if (stepType === 'game' && result) {
      await supabase.from('child_game_progress').insert({
        child_id: childId,
        unit_id: unitId,
        game_engine_slug: result.gameEngineSlug || 'word-match',
        content_pool_id: result.contentPoolId,
        score: result.score || 0,
        max_score: result.maxScore || 100,
        correct_items: result.correctItems || 0,
        total_items: result.totalItems || 0,
        time_taken_seconds: result.timeTakenSeconds,
        mistakes: result.mistakes || [],
        xp_earned: xpEarned,
        is_perfect: result.isPerfect || false,
      });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Progress API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
