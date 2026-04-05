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

    // Fetch photo_urls (column added via migration, not yet in generated types)
    const { data: taskPhotos } = await supabase
      .from('parent_daily_tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    const currentPhotos = ((taskPhotos as any)?.photo_urls as any[] | null) || [];
    if (currentPhotos.length >= 3) {
      return NextResponse.json(
        { error: 'Maximum 3 photos per task' },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage using admin client
    const adminSupabase = createAdminClient();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === 'image/heic' ? 'heic' : file.type.split('/')[1];
    const photoIndex = currentPhotos.length; // 0, 1, or 2
    const storagePath = `homework/${childId}/${taskId}_${photoIndex}.${ext}`;

    const { error: uploadError } = await adminSupabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
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

    // Append to photo_urls array + update legacy photo_url with latest
    const newPhoto = {
      url: storagePath,
      uploaded_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('parent_daily_tasks')
      .update({
        photo_urls: [...currentPhotos, newPhoto] as any, // column added via migration
        photo_url: storagePath, // legacy compat — always latest
      } as any)
      .eq('id', taskId);

    if (updateError) {
      console.error('Task photo_urls update error:', updateError.message);
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
          // Update analysis on the specific photo in the array
          const updatedPhotos = [...currentPhotos, { ...newPhoto, analysis }];
          await supabase
            .from('parent_daily_tasks')
            .update({
              photo_urls: updatedPhotos as any, // column added via migration
              photo_analysis: JSON.parse(JSON.stringify(analysis)), // legacy compat
            } as any)
            .eq('id', taskId);
        }
      }).catch(err => console.error('Photo analysis background error:', err.message));
    }

    return NextResponse.json({
      success: true,
      photo_url: photoUrl,
      storage_path: storagePath,
      photo_count: currentPhotos.length + 1,
      max_photos: 3,
    });
  } catch (error: any) {
    console.error('Homework photo upload error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
