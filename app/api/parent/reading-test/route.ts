// ============================================================
// GET /api/parent/reading-test?taskId=...
// Returns task info + age-appropriate passage for reading test
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: 401 });

  const taskId = request.nextUrl.searchParams.get('taskId');
  if (!taskId) return NextResponse.json({ success: false, error: 'taskId required' }, { status: 400 });

  const supabase = getServiceSupabase();

  // Get task + child
  const { data: task } = await supabase
    .from('parent_daily_tasks')
    .select('id, child_id, is_completed')
    .eq('id', taskId)
    .single();

  if (!task) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });

  const { data: child } = await supabase
    .from('children')
    .select('id, child_name, age, parent_email, parent_id')
    .eq('id', task.child_id)
    .single();

  if (!child) return NextResponse.json({ success: false, error: 'Child not found' }, { status: 404 });

  // Verify parent ownership
  if (child.parent_email !== auth.email) {
    const { data: parent } = await supabase.from('parents').select('id').eq('email', auth.email ?? '').maybeSingle();
    if (!parent || child.parent_id !== parent.id) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // Get recent passage IDs to avoid repeats
  const { data: recentTests } = await supabase
    .from('micro_assessments')
    .select('passage_id')
    .eq('child_id', child.id)
    .not('passage_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const recentPassageIds = (recentTests || []).map(t => t.passage_id).filter(Boolean);

  // Select age-appropriate passage
  let query = supabase
    .from('reading_passages')
    .select('id, title, content, word_count')
    .eq('is_active', true);

  if (child.age) {
    query = query.lte('age_min', child.age).gte('age_max', child.age);
  }
  if (recentPassageIds.length > 0) {
    query = query.not('id', 'in', `(${recentPassageIds.join(',')})`);
  }

  const { data: passages } = await query.limit(5);

  // Pick a random one
  const passage = passages && passages.length > 0
    ? passages[Math.floor(Math.random() * passages.length)]
    : null;

  if (!passage) {
    // Fallback: get ANY active passage
    const { data: fallback } = await supabase
      .from('reading_passages')
      .select('id, title, content, word_count')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!fallback) return NextResponse.json({ success: false, error: 'No passages available' }, { status: 404 });

    return NextResponse.json({
      success: true,
      childName: child.child_name,
      passage: { id: fallback.id, title: fallback.title, content: fallback.content, wordCount: fallback.word_count },
    });
  }

  return NextResponse.json({
    success: true,
    childName: child.child_name,
    passage: { id: passage.id, title: passage.title, content: passage.content, wordCount: passage.word_count },
  });
}
