// ============================================================
// FILE: app/api/parent/practice/[taskId]/route.ts
// PURPOSE: Fetch SmartPractice data (passage + questions) for a task
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { taskId } = await params;
    const supabase = getServiceSupabase();

    // 1. Fetch the task
    const { data: task } = await supabase
      .from('parent_daily_tasks')
      .select('id, title, description, child_id, content_item_id, is_completed')
      .eq('id', taskId)
      .single();

    if (!task || !task.content_item_id) {
      return NextResponse.json({ success: false, error: 'Practice not found' }, { status: 404 });
    }

    // 2. Verify parent owns this child
    const { data: child } = await supabase
      .from('children')
      .select('id, parent_email, parent_id')
      .eq('id', task.child_id)
      .single();

    if (!child) {
      return NextResponse.json({ success: false, error: 'Child not found' }, { status: 404 });
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

    // 3. Fetch content item (passage metadata)
    const { data: contentItem } = await supabase
      .from('el_content_items')
      .select('id, title, metadata')
      .eq('id', task.content_item_id)
      .single();

    if (!contentItem) {
      return NextResponse.json({ success: false, error: 'Content not found' }, { status: 404 });
    }

    const metadata = contentItem.metadata as Record<string, any> | null;
    if (!metadata?.passage_text) {
      return NextResponse.json({ success: false, error: 'Practice content not ready' }, { status: 404 });
    }

    // 4. Fetch quiz questions (grouped by video_id = content_item_id)
    const { data: questions } = await supabase
      .from('video_quizzes')
      .select('id, question_text, options, correct_option_id, explanation, points')
      .eq('video_id', task.content_item_id)
      .order('display_order', { ascending: true });

    if (!questions || questions.length === 0) {
      return NextResponse.json({ success: false, error: 'Quiz questions not ready' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        child_id: task.child_id,
        content_item_id: task.content_item_id,
        is_completed: task.is_completed,
      },
      passage: {
        title: metadata.passage_title || contentItem.title || 'Reading Practice',
        text: metadata.passage_text,
        wordCount: metadata.passage_word_count || 0,
      },
      questions: questions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        options: q.options as string[],
        correct_option_id: q.correct_option_id,
        explanation: q.explanation,
        points: q.points || 10,
      })),
    });
  } catch (error: any) {
    console.error('[SmartPractice API] Error:', error.message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
