// ============================================================
// FILE: app/api/parent/artifacts/upload/route.ts
// PURPOSE: Unified photo upload for parent artifacts (homework, practice,
// assessment, freeform). Writes to child_artifacts (canonical) + backward
// compat to parent_daily_tasks.photo_urls when taskId provided.
// Fires Gemini Vision analysis + learning_event intelligence in background.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { uploadArtifact, getArtifactSignedUrl } from '@/lib/storage/artifact-storage';
import { analyzeHomeworkPhoto } from '@/lib/homework/analyze-photo';
import { insertLearningEvent } from '@/lib/rai/learning-events';
import type { Json } from '@/lib/database.types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // sharp processing + storage upload

// Must match lib/storage/artifact-storage.ts ALLOWED_MIME_TYPES. HEIC excluded
// until sharp/libheif is verified on Vercel runtime.
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp',
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALID_CONTEXTS = new Set(['session_homework', 'practice', 'assessment', 'freeform']);

type UploadContext = 'session_homework' | 'practice' | 'assessment' | 'freeform';

export async function POST(request: NextRequest) {
  try {
    // --- AUTH ---
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();

    // --- PARSE BODY ---
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const childId = formData.get('childId') as string | null;
    const contextTypeRaw = formData.get('contextType') as string | null;
    const taskId = (formData.get('taskId') as string | null) || null;
    const sessionId = (formData.get('sessionId') as string | null) || null;
    const enrollmentId = (formData.get('enrollmentId') as string | null) || null;
    const linkedSkill = (formData.get('linkedSkill') as string | null) || null;
    const taskTitle = (formData.get('taskTitle') as string | null) || null;

    if (!file || !childId || !contextTypeRaw) {
      return NextResponse.json(
        { error: 'file, childId, and contextType are required' },
        { status: 400 }
      );
    }

    if (!VALID_CONTEXTS.has(contextTypeRaw)) {
      return NextResponse.json(
        { error: `Invalid contextType. Must be one of: ${Array.from(VALID_CONTEXTS).join(', ')}` },
        { status: 400 }
      );
    }
    const contextType = contextTypeRaw as UploadContext;

    // --- VALIDATE FILE ---
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use JPEG, PNG, or WebP.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 5 MB` },
        { status: 400 }
      );
    }

    // --- VERIFY PARENT OWNS CHILD (same pattern as existing upload-photo route) ---
    const { data: child } = await supabase
      .from('children')
      .select('id, parent_id, parent_email, child_name, age, coach_id')
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

    // --- VERIFY TASK OWNERSHIP IF PROVIDED ---
    if (taskId) {
      const { data: task } = await supabase
        .from('parent_daily_tasks')
        .select('id, child_id')
        .eq('id', taskId)
        .single();

      if (!task || task.child_id !== childId) {
        return NextResponse.json({ error: 'Task not found or mismatched' }, { status: 404 });
      }
    }

    // --- UPLOAD + PROCESS via shared artifact-storage pipeline ---
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadArtifact({
      childId,
      fileBuffer,
      mimeType: file.type,
      fileName: file.name || `homework-photo-${Date.now()}.${file.type.split('/')[1] || 'jpg'}`,
      artifactType: 'photo',
      sessionId: sessionId || undefined,
      enrollmentId: enrollmentId || undefined,
    });

    if (!uploadResult.success || !uploadResult.originalUri) {
      return NextResponse.json(
        { error: uploadResult.error || 'Upload failed' },
        { status: 500 }
      );
    }

    // --- INSERT child_artifacts ROW (canonical) ---
    const { data: artifact, error: insertError } = await supabase
      .from('child_artifacts')
      .insert({
        child_id: childId,
        artifact_type: 'photo',
        upload_context: contextType,
        uploaded_by: 'parent',
        original_uri: uploadResult.originalUri,
        processed_uri: uploadResult.processedUri || null,
        thumbnail_uri: uploadResult.thumbnailUri || null,
        mime_type: uploadResult.mimeType || file.type,
        file_size_bytes: uploadResult.fileSizeBytes || file.size,
        image_width: uploadResult.imageWidth || null,
        image_height: uploadResult.imageHeight || null,
        session_id: sessionId || null,
        enrollment_id: enrollmentId || null,
        task_id: taskId || null,
        analysis_status: 'pending',
      })
      .select('id, thumbnail_uri, processed_uri')
      .single();

    if (insertError || !artifact) {
      console.error('[artifacts/upload] child_artifacts insert failed:', insertError?.message);
      return NextResponse.json({ error: 'Failed to save artifact' }, { status: 500 });
    }

    // --- BACKWARD COMPAT: mirror into parent_daily_tasks.photo_urls ---
    if (taskId) {
      try {
        const { data: existingTask } = await supabase
          .from('parent_daily_tasks')
          .select('photo_urls')
          .eq('id', taskId)
          .single();

        const currentPhotos = Array.isArray(existingTask?.photo_urls)
          ? (existingTask!.photo_urls as unknown as Array<Record<string, unknown>>)
          : [];

        if (currentPhotos.length < 3) {
          const newPhoto = {
            url: uploadResult.processedUri || uploadResult.originalUri,
            uploaded_at: new Date().toISOString(),
            artifact_id: artifact.id,
          };
          await supabase
            .from('parent_daily_tasks')
            .update({
              photo_urls: [...currentPhotos, newPhoto] as unknown as Json,
              photo_url: uploadResult.processedUri || uploadResult.originalUri,
            })
            .eq('id', taskId);
        }
      } catch (err) {
        // Non-blocking — backward compat must not break the new path
        console.error('[artifacts/upload] backward-compat update failed:', err);
      }
    }

    // analyzeHomeworkPhoto takes URL, not base64 — so sign the processed variant (1h).
    const processedUriForAnalysis = uploadResult.processedUri || uploadResult.originalUri;
    const signedProcessedUrl = processedUriForAnalysis
      ? await getArtifactSignedUrl(processedUriForAnalysis, 3600)
      : null;

    // --- FIRE-AND-FORGET Gemini Vision analysis ---
    if (signedProcessedUrl) {
      void analyzeHomeworkPhoto(signedProcessedUrl, {
        childName: child.child_name || 'Child',
        age: child.age || 6,
        taskTitle: taskTitle || 'Practice activity',
        linkedSkill: linkedSkill || null,
      })
        .then(async (analysis) => {
          if (analysis) {
            await supabase
              .from('child_artifacts')
              .update({
                analysis_result: analysis as unknown as Json,
                analysis_status: 'completed',
                analysis_model: 'gemini-2.5-flash',
                analyzed_at: new Date().toISOString(),
              })
              .eq('id', artifact.id);

            // Backward compat: mirror to parent_daily_tasks.photo_analysis
            if (taskId) {
              await supabase
                .from('parent_daily_tasks')
                .update({ photo_analysis: analysis as unknown as Json })
                .eq('id', taskId);
            }
          } else {
            await supabase
              .from('child_artifacts')
              .update({ analysis_status: 'failed' })
              .eq('id', artifact.id);
          }
        })
        .catch(async (err) => {
          console.error('[artifacts/upload] analysis error:', err?.message || err);
          await supabase
            .from('child_artifacts')
            .update({
              analysis_status: 'failed',
              analysis_error: err instanceof Error ? err.message : 'Analysis failed',
            })
            .eq('id', artifact.id);
        });
    }

    // Learning event insert is fire-and-forget: it generates an embedding which
    // can take 200–800ms. We don't want to block the thumbnail response on RAG.
    const contextLabel =
      contextType === 'session_homework' ? 'homework' :
      contextType === 'practice' ? 'practice work' :
      contextType === 'assessment' ? 'assessment work' :
      'work';

    void insertLearningEvent({
      childId,
      coachId: child.coach_id || null,
      sessionId: sessionId || null,
      eventType: 'child_artifact',
      signalSource: 'parent_observation',
      signalConfidence: 'medium',
      eventData: {
        artifact_id: artifact.id,
        artifact_type: 'photo',
        upload_context: contextType,
        task_id: taskId,
        session_id: sessionId,
        enrollment_id: enrollmentId,
        linked_skill: linkedSkill,
      },
      contentForEmbedding: [
        `${child.child_name || 'Child'} uploaded a photo of completed ${contextLabel}.`,
        taskTitle ? `Task: ${taskTitle}.` : '',
        linkedSkill ? `Skill area: ${linkedSkill}.` : '',
      ].filter(Boolean).join(' '),
    }).catch(err => console.error('[artifacts/upload] learning event insert failed:', err));

    // Thumbnail signed for immediate display; fallback to processed when sharp skipped thumb.
    const thumbnailPath = artifact.thumbnail_uri || artifact.processed_uri;
    const thumbnailSignedUrl = thumbnailPath
      ? await getArtifactSignedUrl(thumbnailPath, 3600)
      : null;

    return NextResponse.json({
      success: true,
      artifact: {
        id: artifact.id,
        thumbnailUrl: thumbnailSignedUrl,
        analysisStatus: 'pending',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[artifacts/upload] fatal:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
