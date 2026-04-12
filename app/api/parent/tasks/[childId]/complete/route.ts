// ============================================================
// FILE: app/api/parent/tasks/[childId]/complete/route.ts
// PURPOSE: Mark a daily task as complete + update streak
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { insertLearningEvent } from '@/lib/rai/learning-events';
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
    const { taskId, difficulty_rating, practice_duration } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    // Validate optional micro-feedback
    const validDifficulty = ['easy', 'just_right', 'struggled'];
    const validDuration = ['under_5', '5_to_15', '15_to_30', 'over_30'];
    if (difficulty_rating && !validDifficulty.includes(difficulty_rating)) {
      return NextResponse.json({ error: 'Invalid difficulty_rating' }, { status: 400 });
    }
    if (practice_duration && !validDuration.includes(practice_duration)) {
      return NextResponse.json({ error: 'Invalid practice_duration' }, { status: 400 });
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
      .select('id, child_id, is_completed, task_date, title, description, linked_skill, session_id, enrollment_id, created_at')
      .eq('id', taskId)
      .eq('child_id', childId)
      .single();

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.is_completed) {
      return NextResponse.json({ success: true, message: 'Already completed' });
    }

    // Mark task as completed with optional micro-feedback
    const { error: updateError } = await supabase
      .from('parent_daily_tasks')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        ...(difficulty_rating && { difficulty_rating }),
        ...(practice_duration && { practice_duration }),
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

    // Generate learning_event for intelligence (UIP B4 fix)
    try {
      const daysToComplete = Math.max(1, Math.ceil(
        (Date.now() - new Date(task.created_at).getTime()) / 86400000
      ));

      // Re-fetch photo_url (may have been set by upload-photo route moments before)
      const { data: freshTask } = await supabase
        .from('parent_daily_tasks')
        .select('photo_url')
        .eq('id', taskId)
        .single();
      const photoUrl = freshTask?.photo_url || null;

      // Look up billing_model from enrollment if available
      let billingModel = 'coaching';
      if (task.enrollment_id) {
        const { data: enr } = await supabase
          .from('enrollments')
          .select('enrollment_type')
          .eq('id', task.enrollment_id)
          .single();
        if (enr?.enrollment_type === 'tuition') billingModel = 'tuition';
      }

      // Determine signal confidence based on evidence level
      let signalConfidence: 'low' | 'medium' | 'high' = 'low';
      if (difficulty_rating || practice_duration) signalConfidence = 'medium';
      if (photoUrl && difficulty_rating) signalConfidence = 'medium';

      await insertLearningEvent({
        childId,
        eventType: 'practice_completed',
        eventDate: new Date().toISOString(),
        sessionId: task.session_id || undefined,
        eventData: {
          task_id: task.id,
          task_type: task.linked_skill || 'reading',
          title: task.title,
          description: task.description || '',
          days_to_complete: daysToComplete,
          difficulty_rating: difficulty_rating || null,
          practice_duration: practice_duration || null,
          has_photo: !!photoUrl,
          photo_url: photoUrl,
          session_id: task.session_id,
          billing_model: billingModel,
          streak_after: currentStreak,
        },
        signalConfidence,
        signalSource: 'parent_observation',
        contentForEmbedding: `Practice completed: ${task.title}. ${task.description || ''}. Skill: ${task.linked_skill || 'reading'}. ${difficulty_rating ? `Parent reports difficulty: ${difficulty_rating.replace('_', ' ')}.` : ''} ${practice_duration ? `Practice duration: ${practice_duration.replace(/_/g, ' ')} minutes.` : ''} ${photoUrl ? 'Photo evidence of completed work submitted.' : ''} Completed ${daysToComplete} day${daysToComplete > 1 ? 's' : ''} after assignment. Streak: ${currentStreak}.`,
      });
    } catch (leErr: any) {
      // Non-blocking — learning event failure should never block task completion
      console.error(JSON.stringify({ requestId, event: 'practice_learning_event_error', error: leErr.message }));
      Sentry.captureException(leErr, {
        tags: {
          route: 'parent/tasks/complete',
          event: 'practice_learning_event_error',
        },
      });
    }

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
