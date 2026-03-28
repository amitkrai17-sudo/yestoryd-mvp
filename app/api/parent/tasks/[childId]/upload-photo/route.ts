// ============================================================
// FILE: app/api/parent/tasks/[childId]/upload-photo/route.ts
// PURPOSE: Upload homework photo → Supabase Storage → update task
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeHomeworkPhoto } from '@/lib/homework/analyze-photo';

export const dynamic = 'force-dynamic';

const STORAGE_BUCKET = 'child-artifacts';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { childId } = await params;
    const supabase = getServiceSupabase();

    // Verify parent owns this child
    const { data: child } = await supabase
      .from('children')
      .select('id, parent_id, parent_email, child_name, age')
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

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const taskId = formData.get('taskId') as string | null;

    if (!file || !taskId) {
      return NextResponse.json({ error: 'file and taskId are required' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: JPEG, PNG, WebP, HEIC` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 5 MB` },
        { status: 400 }
      );
    }

    // Verify task belongs to this child
    const { data: task } = await supabase
      .from('parent_daily_tasks')
      .select('id, child_id, title, linked_skill')
      .eq('id', taskId)
      .eq('child_id', childId)
      .single();

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Upload to Supabase Storage using admin client
    const adminSupabase = createAdminClient();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === 'image/heic' ? 'heic' : file.type.split('/')[1];
    const storagePath = `homework/${childId}/${taskId}.${ext}`;

    const { error: uploadError } = await adminSupabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true, // Allow re-upload if parent wants to replace photo
      });

    if (uploadError) {
      console.error('Homework photo upload error:', uploadError.message);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // Generate signed URL (1 hour expiry for immediate display)
    const { data: signedData } = await adminSupabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    const photoUrl = signedData?.signedUrl || storagePath;

    // Update task with photo path (store the storage path, not signed URL)
    const { error: updateError } = await supabase
      .from('parent_daily_tasks')
      .update({ photo_url: storagePath })
      .eq('id', taskId);

    if (updateError) {
      console.error('Task photo_url update error:', updateError.message);
      // Upload succeeded but DB update failed — not ideal but photo is saved
    }

    // Fire-and-forget: analyze photo with Gemini Vision
    if (signedData?.signedUrl) {
      analyzeHomeworkPhoto(signedData.signedUrl, {
        childName: child.child_name || 'Child',
        age: child.age || 6,
        taskTitle: task.title || 'Practice task',
        linkedSkill: task.linked_skill,
      }).then(async (analysis) => {
        if (analysis) {
          await supabase
            .from('parent_daily_tasks')
            .update({ photo_analysis: JSON.parse(JSON.stringify(analysis)) })
            .eq('id', taskId);
        }
      }).catch(err => console.error('Photo analysis background error:', err.message));
    }

    return NextResponse.json({
      success: true,
      photo_url: photoUrl,
      storage_path: storagePath,
    });
  } catch (error: any) {
    console.error('Homework photo upload error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
