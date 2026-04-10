// ============================================================
// FILE: app/api/coach/children/[id]/homework/route.ts
// PURPOSE: CRUD homework tasks for a child (coach-facing)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { sendCommunication } from '@/lib/communication';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- Helpers ---

async function verifyCoachOwnsChild(
  supabase: ReturnType<typeof getServiceSupabase>,
  childId: string,
  coachEmail: string,
): Promise<boolean> {
  // Check if the coach has an active enrollment with this child
  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('email', coachEmail)
    .single();

  if (!coach) return false;

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('child_id', childId)
    .eq('coach_id', coach.id)
    .in('status', ['active', 'completed', 'paused'])
    .limit(1)
    .maybeSingle();

  return !!enrollment;
}

async function signPhotoUrls(
  supabase: ReturnType<typeof getServiceSupabase>,
  photoUrls: any[] | null,
  photoUrl: string | null,
): Promise<string[]> {
  const photos = photoUrls || [];
  if (photos.length > 0) {
    const signed = await Promise.all(photos.map(async (p: any) => {
      const url = p?.url;
      if (!url || url.startsWith('http')) return url || null;
      try {
        const { data } = await supabase.storage
          .from('child-artifacts')
          .createSignedUrl(url, 3600);
        return data?.signedUrl || null;
      } catch { return null; }
    }));
    return signed.filter(Boolean) as string[];
  }
  // Legacy fallback
  if (photoUrl && !photoUrl.startsWith('http')) {
    try {
      const { data } = await supabase.storage
        .from('child-artifacts')
        .createSignedUrl(photoUrl, 3600);
      return data?.signedUrl ? [data.signedUrl] : [];
    } catch { return []; }
  }
  return photoUrl ? [photoUrl] : [];
}

// --- GET: Fetch homework for a child ---

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: childId } = await params;
    const supabase = getServiceSupabase();

    const { data: tasks, error } = await supabase
      .from('parent_daily_tasks')
      .select(`
        id, session_id, task_date, title, description, coach_notes,
        linked_skill, source, is_completed, completed_at,
        photo_url, photo_urls, difficulty_rating, practice_duration,
        content_item_id, duration_minutes, created_at
      `)
      .eq('child_id', childId)
      .order('task_date', { ascending: false })
      .limit(30);

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'homework_fetch_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch homework' }, { status: 500 });
    }

    // Enrich with signed photo URLs + quiz results
    const contentItemIds = (tasks || [])
      .filter(t => t.content_item_id && t.is_completed)
      .map(t => t.content_item_id as string);

    // Fetch quiz attempt results for SmartPractice tasks
    let quizResults: Record<string, { score: number; correct: number; total: number }> = {};
    if (contentItemIds.length > 0) {
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('quiz_id, score, total')
        .in('quiz_id', contentItemIds)
        .eq('child_id', childId)
        .order('created_at', { ascending: false });

      if (attempts) {
        for (const a of attempts) {
          if (a.quiz_id && !quizResults[a.quiz_id]) {
            quizResults[a.quiz_id] = {
              score: a.score || 0,
              correct: Math.round(((a.score || 0) / 100) * (a.total || 0)),
              total: a.total || 0,
            };
          }
        }
      }
    }

    const tasksWithPhotos = await Promise.all((tasks || []).map(async (t) => {
      const signedUrls = await signPhotoUrls(supabase, t.photo_urls as any[] | null, t.photo_url);
      const quizResult = t.content_item_id ? quizResults[t.content_item_id] || null : null;
      return { ...t, photo_signed_urls: signedUrls, quiz_result: quizResult };
    }));

    // Separate active vs past
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const active = tasksWithPhotos.filter(t => !t.is_completed && t.task_date >= weekAgoStr);
    const past = tasksWithPhotos.filter(t => t.is_completed || t.task_date < weekAgoStr);

    // Stats
    const total = tasksWithPhotos.length;
    const completed = tasksWithPhotos.filter(t => t.is_completed).length;
    const withPhotos = tasksWithPhotos.filter(t => t.photo_signed_urls.length > 0).length;

    return NextResponse.json({
      success: true,
      active,
      past,
      stats: {
        total,
        completed,
        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        with_photos: withPhotos,
      },
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'homework_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// --- POST: Assign new homework ---

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: childId } = await params;
    const supabase = getServiceSupabase();

    const body = await request.json();
    if (!body.description || body.description.trim().length < 10) {
      return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 });
    }

    // Find active enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('child_id', childId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    // Simplify coach homework text for parent
    const { simplifyHomework } = await import('@/lib/homework/simplify-homework');
    const { data: childForHW } = await supabase
      .from('children')
      .select('child_name, age')
      .eq('id', childId)
      .single();
    const { simplified, original } = await simplifyHomework(
      body.description.trim(),
      childForHW?.child_name || 'your child',
      childForHW?.age || 7,
    );

    const { data: task, error } = await supabase
      .from('parent_daily_tasks')
      .insert({
        child_id: childId,
        enrollment_id: enrollment?.id || null,
        task_date: body.due_date || new Date().toISOString().split('T')[0],
        title: body.title || 'Practice Activity',
        description: simplified,
        coach_notes: original,
        linked_skill: body.linked_skill || null,
        source: 'coach_assigned',
        is_completed: false,
        duration_minutes: 15,
      })
      .select('id')
      .single();

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'homework_create_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to create homework' }, { status: 500 });
    }

    // Send P22 WhatsApp notification (non-blocking)
    try {
      const { data: child } = await supabase
        .from('children')
        .select('child_name, parent_phone, parent_email, parent_name, parent_id')
        .eq('id', childId)
        .single();

      if (child && (child.parent_phone || child.parent_email)) {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';
        await sendCommunication({
          templateCode: 'P22_practice_tasks_assigned',
          recipientType: 'parent',
          recipientId: child.parent_id || undefined,
          recipientPhone: child.parent_phone || undefined,
          recipientEmail: child.parent_email || undefined,
          recipientName: child.parent_name || undefined,
          variables: {
            parent_first_name: (child.parent_name || 'Parent').split(' ')[0],
            child_name: child.child_name || 'your child',
            task_count: '1',
            dashboard_link: `${baseUrl}/parent/dashboard`,
          },
        });
      }
    } catch (notifyErr: any) {
      console.error(JSON.stringify({ requestId, event: 'homework_p22_error', error: notifyErr.message }));
    }

    // SmartPractice: generate interactive quiz if enabled via feature gate (non-blocking)
    const { getChildFeatures } = await import('@/lib/features/get-child-features');
    const { features: childFeatures } = await getChildFeatures(childId);
    if (task?.id && childFeatures.smart_practice && childForHW) {
      import('@/lib/homework/generate-smart-practice').then(({ generateSmartPractice }) => {
        generateSmartPractice({
          coachNotes: original,
          childName: childForHW.child_name || 'Child',
          childAge: childForHW.age || 7,
          skillSlug: body.linked_skill || 'reading_comprehension',
          childId,
          taskId: task.id,
          supabase,
        }).catch(err => console.error('[SmartPractice] bg generation failed:', err));
      });
    }

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'homework_post_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// --- PATCH: Edit existing homework (only if not completed) ---

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: childId } = await params;
    const supabase = getServiceSupabase();
    const body = await request.json();

    if (!body.taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    // Verify task belongs to child and is not completed
    const { data: existing } = await supabase
      .from('parent_daily_tasks')
      .select('is_completed')
      .eq('id', body.taskId)
      .eq('child_id', childId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (existing.is_completed) {
      return NextResponse.json({ error: 'Cannot edit completed homework' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (body.title) updates.title = body.title;
    if (body.description) updates.description = body.description;
    if (body.linked_skill !== undefined) updates.linked_skill = body.linked_skill;
    if (body.due_date) updates.task_date = body.due_date;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { error } = await supabase
      .from('parent_daily_tasks')
      .update(updates)
      .eq('id', body.taskId)
      .eq('child_id', childId);

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'homework_patch_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to update homework' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'homework_patch_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// --- DELETE: Remove homework (only if not completed) ---

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: childId } = await params;
    const supabase = getServiceSupabase();

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'taskId query param is required' }, { status: 400 });
    }

    // Verify task belongs to child and is not completed
    const { data: existing } = await supabase
      .from('parent_daily_tasks')
      .select('is_completed')
      .eq('id', taskId)
      .eq('child_id', childId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (existing.is_completed) {
      return NextResponse.json({ error: 'Cannot delete completed homework' }, { status: 400 });
    }

    const { error } = await supabase
      .from('parent_daily_tasks')
      .delete()
      .eq('id', taskId)
      .eq('child_id', childId);

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'homework_delete_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to delete homework' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'homework_delete_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
