// ============================================================
// FILE: app/api/parent/tasks/[childId]/complete/route.ts
// PURPOSE: Mark a daily task as complete + update streak
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { childId } = await params;
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Verify parent owns this child
    const { data: child } = await supabase
      .from('children')
      .select('id, parent_id, parent_email, current_streak, longest_streak, last_task_completed_date')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    if (child.parent_email !== auth.email) {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', auth.email ?? '')
        .maybeSingle();

      if (!parent || child.parent_id !== parent.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    // Verify task belongs to this child and isn't already completed
    const { data: task } = await supabase
      .from('parent_daily_tasks')
      .select('id, child_id, is_completed, task_date')
      .eq('id', taskId)
      .eq('child_id', childId)
      .single();

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.is_completed) {
      return NextResponse.json({ success: true, message: 'Already completed' });
    }

    // Mark task as completed
    const { error: updateError } = await supabase
      .from('parent_daily_tasks')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to mark task complete' }, { status: 500 });
    }

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const lastCompleted = child.last_task_completed_date;
    let currentStreak = child.current_streak || 0;
    let longestStreak = child.longest_streak || 0;

    if (lastCompleted === today) {
      // Already completed a task today — streak stays the same
    } else if (lastCompleted === yesterday) {
      // Consecutive day — increment streak
      currentStreak += 1;
    } else {
      // Gap in completion — reset streak to 1
      currentStreak = 1;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    // Update children table with streak data
    await supabase
      .from('children')
      .update({
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_task_completed_date: today,
      })
      .eq('id', childId);

    console.log(JSON.stringify({
      requestId,
      event: 'task_completed',
      childId,
      taskId,
      streak: currentStreak,
      by: auth.email,
    }));

    return NextResponse.json({
      success: true,
      message: 'Task completed!',
      streak: {
        current: currentStreak,
        longest: longestStreak,
      },
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'task_complete_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
