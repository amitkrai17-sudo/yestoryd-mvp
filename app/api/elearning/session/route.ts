// =============================================================================
// E-LEARNING SESSION API
// Single endpoint that returns everything the child page needs
// With graceful fallbacks for missing tables
// =============================================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Level configuration
const LEVEL_TITLES: Record<number, string> = {
  1: 'Beginner', 2: 'Explorer', 3: 'Learner', 4: 'Reader',
  5: 'Star Reader', 6: 'Super Reader', 7: 'Champion',
  8: 'Master', 9: 'Legend', 10: 'Genius'
};

// Calculate level from XP
function calculateLevel(xp: number): { level: number; xpToNext: number } {
  let level = 1;
  let xpNeeded = 100;
  let totalXpForLevel = 0;
  
  while (xp >= totalXpForLevel + xpNeeded && level < 10) {
    totalXpForLevel += xpNeeded;
    level++;
    xpNeeded = level * 100;
  }
  
  const xpInCurrentLevel = xp - totalXpForLevel;
  const xpToNext = xpNeeded - xpInCurrentLevel;
  
  return { level, xpToNext };
}

// Safe query helper - returns null if table doesn't exist
async function safeQuery(query: any) {
  try {
    const result = await query;
    return result;
  } catch (error: any) {
    console.warn('Query failed (table may not exist):', error.message);
    return { data: null, error };
  }
}

// GET: Fetch session data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');
    
    if (!childId) {
      return NextResponse.json({ success: false, error: 'Child ID required' }, { status: 400 });
    }
    
    console.log('[Session API] Fetching for childId:', childId);
    
    // Fetch child info first (this table definitely exists)
    const childResult = await supabase
      .from('children')
      .select('id, child_name, name, age, parent_email')
      .eq('id', childId)
      .single();
    
    const child = childResult.data;
    if (!child) {
      return NextResponse.json({ 
        success: false, 
        error: 'Child not found',
        childId 
      }, { status: 404 });
    }
    
    console.log('[Session API] Found child:', child.child_name || child.name);
    
    // Safely fetch from tables that may not exist yet
    const [
      gamificationResult,
      unitsResult,
      progressResult,
      dailyGoalResult,
    ] = await Promise.all([
      // Gamification - may use child_gamification table
      safeQuery(
        supabase
          .from('el_child_gamification')
          .select('*')
          .eq('child_id', childId)
          .single()
      ),
      
      // E-learning units - new table from migration
      safeQuery(
        supabase
          .from('el_learning_units')
          .select(`
            *,
            skill:el_skills(id, name, slug, category)
          `)
          .eq('status', 'published')
          .order('display_order')
      ),
      
      // Child's unit progress - new table from migration
      safeQuery(
        supabase
          .from('el_child_unit_progress')
          .select('*')
          .eq('child_id', childId)
      ),
      
      // Today's daily goal - new table from migration
      safeQuery(
        supabase
          .from('child_daily_goals')
          .select('*')
          .eq('child_id', childId)
          .eq('goal_date', new Date().toISOString().split('T')[0])
          .single()
      ),
    ]);
    
    // Use defaults if tables don't exist
    const gamification = gamificationResult.data || {
      total_xp: 0,
      total_coins: 0,
      current_streak_days: 0,
      total_videos_completed: 0,
      total_quizzes_completed: 0,
    };
    
    const { level, xpToNext } = calculateLevel(gamification.total_xp || 0);
    
    // Units and progress (may be empty if migration hasn't run)
    const units = unitsResult.data || [];
    const progressMap = new Map(
      (progressResult.data || []).map((p: any) => [p.unit_id, p])
    );
    
    // Daily goal with defaults
    const dailyGoal = dailyGoalResult.data || {
      target_activities: 3,
      completed_activities: 0,
      is_achieved: false,
      xp_bonus: 25,
    };
    
    // Build queue with unlock status
    const queue = units.map((unit: any) => {
      const progress = progressMap.get(unit.id);
      return {
        unit,
        progress: progress || null,
        isUnlocked: true, // Simplified - all units unlocked for now
        isReview: false,
      };
    });
    
    // Build session response
    const childName = child.child_name || child.name || 'Learner';
    
    const session = {
      child: {
        id: child.id,
        name: childName,
        displayName: childName.split(' ')[0],
        age: child.age || 7,
        level,
      },
      
      // No focus unit if no units exist yet
      todaysFocus: units.length > 0 ? {
        unit: units[0],
        reason: 'Continue your learning journey!',
        source: 'rAI recommendation',
      } : null,
      
      queue,
      reviewDue: [],
      
      dailyGoal: {
        target: dailyGoal.target_activities || 3,
        completed: dailyGoal.completed_activities || 0,
        isAchieved: dailyGoal.is_achieved || false,
        xpBonus: dailyGoal.xp_bonus || 25,
      },
      
      gamification: {
        totalXP: gamification.total_xp || 0,
        level,
        levelTitle: LEVEL_TITLES[level] || 'Learner',
        xpToNextLevel: xpToNext,
        coins: gamification.total_coins || 0,
        streak: gamification.current_streak_days || 0,
        todayCompleted: dailyGoal.completed_activities || 0,
      },
      
      stats: {
        videosWatched: gamification.total_videos_completed || 0,
        gamesPlayed: 0,
        quizzesCompleted: gamification.total_quizzes_completed || 0,
        perfectScores: 0,
      },
      
      // Debug info
      _debug: {
        unitsFound: units.length,
        tablesChecked: {
          el_child_gamification: !!gamificationResult.data,
          el_learning_units: !!unitsResult.data,
          el_child_unit_progress: !!progressResult.data,
          child_daily_goals: !!dailyGoalResult.data,
        }
      }
    };
    
    console.log('[Session API] Returning session with', units.length, 'units');
    
    return NextResponse.json({ success: true, session });
    
  } catch (error: any) {
    console.error('[Session API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// POST: Ask rAI for different content (simplified)
export async function POST(request: NextRequest) {
  try {
    const { childId, topic } = await request.json();
    
    if (!childId || !topic) {
      return NextResponse.json(
        { success: false, error: 'Child ID and topic required' },
        { status: 400 }
      );
    }
    
    // Simplified: just acknowledge the request
    return NextResponse.json({
      success: true,
      session: {
        todaysFocus: {
          unit: null,
          reason: `Looking for ${topic} content...`,
          source: 'Your request',
        },
      },
      message: `Searching for ${topic} units. Units will appear once content is added.`
    });
    
  } catch (error: any) {
    console.error('[Ask rAI] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

