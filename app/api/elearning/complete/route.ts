// =============================================================================
// COMPLETE API
// Finalize unit completion, check for level-ups and badges
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Level thresholds
const LEVEL_THRESHOLDS = [
  0,     // Level 1: 0 XP
  100,   // Level 2: 100 XP
  300,   // Level 3: 300 XP
  600,   // Level 4: 600 XP
  1000,  // Level 5: 1000 XP
  1500,  // Level 6: 1500 XP
  2100,  // Level 7: 2100 XP
  2800,  // Level 8: 2800 XP
  3600,  // Level 9: 3600 XP
  4500,  // Level 10: 4500 XP
];

function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

export async function POST(request: NextRequest) {
  try {
    const { childId, unitId, totalXP, score, isPerfect } = await request.json();
    
    if (!childId || !unitId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Update unit progress to completed
    const { error: progressError } = await supabase
      .from('child_unit_progress')
      .update({
        status: 'completed',
        completion_percentage: 100,
        best_score: score,
        completed_at: new Date().toISOString(),
        // Set next review using spaced repetition (first review in 1 day)
        next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        review_count: 0,
        interval_days: 1,
      })
      .eq('child_id', childId)
      .eq('unit_id', unitId);
    
    if (progressError) {
      console.error('Progress update error:', progressError);
    }
    
    // Get current gamification state
    const { data: gamification } = await supabase
      .from('child_gamification')
      .select('*')
      .eq('child_id', childId)
      .single();
    
    const currentXP = gamification?.total_xp || 0;
    const currentLevel = calculateLevel(currentXP);
    const newXP = currentXP + totalXP;
    const newLevel = calculateLevel(newXP);
    
    const levelUp = newLevel > currentLevel;
    
    // Update gamification
    const { error: gamificationError } = await supabase
      .from('child_gamification')
      .upsert({
        child_id: childId,
        total_xp: newXP,
        current_level: newLevel,
        total_units_completed: (gamification?.total_units_completed || 0) + 1,
        total_perfect_scores: (gamification?.total_perfect_scores || 0) + (isPerfect ? 1 : 0),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'child_id',
      });
    
    if (gamificationError) {
      console.error('Gamification update error:', gamificationError);
    }
    
    // Check daily goal
    const today = new Date().toISOString().split('T')[0];
    const { data: dailyGoal } = await supabase
      .from('child_daily_goals')
      .select('*')
      .eq('child_id', childId)
      .eq('goal_date', today)
      .single();
    
    let dailyGoalAchieved = false;
    if (dailyGoal && !dailyGoal.is_achieved) {
      const newCompleted = dailyGoal.completed_activities + 1;
      if (newCompleted >= dailyGoal.target_activities) {
        dailyGoalAchieved = true;
        await supabase
          .from('child_daily_goals')
          .update({
            completed_activities: newCompleted,
            is_achieved: true,
            achieved_at: new Date().toISOString(),
          })
          .eq('id', dailyGoal.id);
        
        // Add daily goal bonus XP
        await supabase
          .from('child_gamification')
          .update({
            total_xp: newXP + (dailyGoal.xp_bonus || 25),
            total_coins: (gamification?.total_coins || 0) + 10,
          })
          .eq('child_id', childId);
      }
    }
    
    // Check for badges
    let newBadge = null;
    
    // First unit badge
    if ((gamification?.total_units_completed || 0) === 0) {
      newBadge = { name: 'First Steps', icon: '🌟' };
      await awardBadge(childId, 'first-steps', 'First Steps', '🌟');
    }
    
    // Perfect score badge
    if (isPerfect && (gamification?.total_perfect_scores || 0) === 0) {
      newBadge = { name: 'Perfectionist', icon: '💯' };
      await awardBadge(childId, 'perfectionist', 'Perfectionist', '💯');
    }
    
    // 5 units badge
    if ((gamification?.total_units_completed || 0) + 1 === 5) {
      newBadge = { name: 'Quick Learner', icon: '📚' };
      await awardBadge(childId, 'quick-learner', 'Quick Learner', '📚');
    }
    
    // Log to learning events for RAG
    await supabase.from('learning_events').insert({
      child_id: childId,
      event_type: 'unit_completed',
      event_data: {
        unit_id: unitId,
        score,
        xp_earned: totalXP,
        is_perfect: isPerfect,
        level_up: levelUp,
        new_level: newLevel,
      },
    });
    
    return NextResponse.json({
      success: true,
      levelUp,
      newLevel,
      newXP,
      newBadge,
      dailyGoalAchieved,
    });
    
  } catch (error: any) {
    console.error('Complete API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Helper to award badge
async function awardBadge(childId: string, slug: string, name: string, icon: string) {
  try {
    // Check if already has badge
    const { data: existing } = await supabase
      .from('child_badges')
      .select('id')
      .eq('child_id', childId)
      .eq('badge_slug', slug)
      .single();
    
    if (!existing) {
      await supabase.from('child_badges').insert({
        child_id: childId,
        badge_slug: slug,
        badge_name: name,
        badge_icon: icon,
        earned_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('Award badge error:', err);
  }
}
