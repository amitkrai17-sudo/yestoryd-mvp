import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { LEARNING_GOALS, isValidGoal, LearningGoalId } from '@/lib/constants/goals';

export const dynamic = 'force-dynamic';

/**
 * POST /api/children/goals
 * Save parent goals for a child (from results page)
 */
export async function POST(request: Request) {
  try {
    const { childId, goals, captureMethod } = await request.json();

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    if (!goals || !Array.isArray(goals)) {
      return NextResponse.json({ error: 'goals must be an array' }, { status: 400 });
    }

    // Validate goals
    const validGoals = goals.filter((g: string) => isValidGoal(g)) as LearningGoalId[];

    if (validGoals.length === 0) {
      return NextResponse.json({ error: 'No valid goals provided' }, { status: 400 });
    }

    // Get existing goals to merge (don't overwrite)
    const { data: child, error: fetchError } = await supabaseAdmin
      .from('children')
      .select('parent_goals, goals_captured_at')
      .eq('id', childId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch child:', fetchError);
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    const existingGoals: string[] = child?.parent_goals || [];
    const mergedGoals = Array.from(new Set([...existingGoals, ...validGoals]));

    // Update child record
    const { error: updateError } = await supabaseAdmin
      .from('children')
      .update({
        parent_goals: mergedGoals,
        goals_captured_at: child?.goals_captured_at || new Date().toISOString(),
        goals_capture_method: captureMethod || 'results_page',
      })
      .eq('id', childId);

    if (updateError) {
      console.error('Failed to update goals:', updateError);
      return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      goals: mergedGoals,
    });
  } catch (error) {
    console.error('Save goals error:', error);
    return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 });
  }
}

/**
 * GET /api/children/goals?childId=xxx
 * Retrieve goals for a child
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('children')
      .select('parent_goals, goals_captured_at, goals_capture_method')
      .eq('id', childId)
      .single();

    if (error) {
      console.error('Failed to fetch goals:', error);
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    return NextResponse.json({
      goals: data.parent_goals || [],
      capturedAt: data.goals_captured_at,
      captureMethod: data.goals_capture_method,
    });
  } catch (error) {
    console.error('Get goals error:', error);
    return NextResponse.json({ error: 'Failed to get goals' }, { status: 500 });
  }
}
