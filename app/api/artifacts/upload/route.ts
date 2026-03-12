// ============================================================
// FILE: app/api/artifacts/upload/route.ts
// ============================================================
// Upload child artifacts (images, PDFs, typed text).
// Auth: requireAuth() — parent or coach can upload.
// Processes file via artifact-storage utility, inserts DB record,
// queues QStash job for Gemini analysis.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { uploadArtifact } from '@/lib/storage/artifact-storage';
import { queueArtifactAnalysis } from '@/lib/qstash';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const VALID_SOURCE_TYPES = [
  'coaching_homework',
  'group_class_exercise',
  'elearning_practice',
  'self_initiated',
] as const;

type SourceType = (typeof VALID_SOURCE_TYPES)[number];

// Map source_type to artifact upload_context
function mapSourceToContext(source: SourceType): string {
  switch (source) {
    case 'coaching_homework': return 'session_homework';
    case 'group_class_exercise': return 'practice';
    case 'elearning_practice': return 'practice';
    case 'self_initiated': return 'freeform';
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // ── Auth ──
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();

    // ── Parse multipart form data ──
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    const typedText = formData.get('typed_text') as string | null;
    const childId = formData.get('child_id') as string | null;
    const sourceType = formData.get('source_type') as string | null;
    const sourceSessionId = formData.get('source_session_id') as string | null;
    const sourceGroupSessionId = formData.get('source_group_session_id') as string | null;
    const assignmentDescription = formData.get('assignment_description') as string | null;
    const title = formData.get('title') as string | null;

    // ── Validate required fields ──
    if (!childId) {
      return NextResponse.json({ error: 'child_id is required' }, { status: 400 });
    }

    if (!file && !typedText) {
      return NextResponse.json({ error: 'Either file or typed_text is required' }, { status: 400 });
    }

    if (!sourceType || !VALID_SOURCE_TYPES.includes(sourceType as SourceType)) {
      return NextResponse.json({
        error: `source_type must be one of: ${VALID_SOURCE_TYPES.join(', ')}`,
      }, { status: 400 });
    }

    // ── Verify child ownership ──
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, name, age, age_band, parent_id, parent_email')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Check ownership: parent email match OR coach access
    let uploadedBy: 'parent' | 'coach' = 'parent';
    if (child.parent_email !== auth.email) {
      // Check if authenticated user is a coach
      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', auth.email ?? '')
        .maybeSingle();

      if (coach) {
        uploadedBy = 'coach';
      } else {
        // Check parent by ID
        const { data: parent } = await supabase
          .from('parents')
          .select('id')
          .eq('email', auth.email ?? '')
          .maybeSingle();

        if (!parent || child.parent_id !== parent.id) {
          return NextResponse.json({ error: 'Not authorized for this child' }, { status: 403 });
        }
      }
    }

    console.log(JSON.stringify({
      requestId,
      event: 'artifact_upload_start',
      childId,
      uploadedBy,
      hasFile: !!file,
      hasTypedText: !!typedText,
      sourceType,
    }));

    // ── Handle typed text submission ──
    if (typedText && !file) {
      const textContent = typedText.trim();
      if (textContent.length === 0) {
        return NextResponse.json({ error: 'typed_text cannot be empty' }, { status: 400 });
      }
      if (textContent.length > 10000) {
        return NextResponse.json({ error: 'typed_text exceeds 10,000 character limit' }, { status: 400 });
      }

      // Insert record with no storage URIs — analysis job handles text directly
      const { data: artifact, error: insertErr } = await (supabase
        .from('child_artifacts' as any)
        .insert({
          child_id: childId,
          enrollment_id: sourceSessionId ? null : null,
          session_id: sourceSessionId || null,
          artifact_type: 'writing',
          title: title || 'Text Submission',
          description: assignmentDescription || null,
          uploaded_by: uploadedBy,
          upload_context: mapSourceToContext(sourceType as SourceType),
          original_uri: '__typed_text__',
          mime_type: 'text/plain',
          file_size_bytes: Buffer.byteLength(textContent, 'utf8'),
          analysis_status: 'pending',
          parent_note: textContent,
        })
        .select('id')
        .single() as any);

      if (insertErr) {
        console.error(JSON.stringify({ requestId, event: 'artifact_insert_failed', error: insertErr.message }));
        return NextResponse.json({ error: 'Failed to save artifact' }, { status: 500 });
      }

      // Queue analysis
      const qResult = await queueArtifactAnalysis({
        artifact_id: artifact.id,
        requestId,
      });

      console.log(JSON.stringify({
        requestId,
        event: 'artifact_upload_complete',
        artifactId: artifact.id,
        type: 'typed_text',
        qstashQueued: qResult.success,
      }));

      return NextResponse.json({
        success: true,
        artifact_id: artifact.id,
        status: 'pending',
        message: 'Analyzing your text...',
        requestId,
      }, { status: 201 });
    }

    // ── Handle file upload ──
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Determine artifact type from MIME
    let artifactType: 'drawing' | 'writing' | 'photo' | 'worksheet' | 'other' = 'other';
    if (file.type.startsWith('image/')) {
      artifactType = 'photo'; // Default for images; analysis may reclassify
    } else if (file.type === 'application/pdf') {
      artifactType = 'worksheet';
    }

    // Upload via storage utility (handles validation, processing, thumbnails)
    const uploadResult = await uploadArtifact({
      childId,
      fileBuffer,
      mimeType: file.type,
      fileName: file.name,
      artifactType,
      sessionId: sourceSessionId || undefined,
      enrollmentId: undefined,
    });

    if (!uploadResult.success) {
      console.error(JSON.stringify({ requestId, event: 'artifact_storage_failed', error: uploadResult.error }));
      return NextResponse.json({ error: uploadResult.error || 'Upload failed' }, { status: 400 });
    }

    // ── Insert DB record ──
    const { data: artifact, error: insertErr } = await (supabase
      .from('child_artifacts' as any)
      .insert({
        child_id: childId,
        session_id: sourceSessionId || null,
        artifact_type: artifactType,
        title: title || file.name || 'Upload',
        description: assignmentDescription || null,
        uploaded_by: uploadedBy,
        upload_context: mapSourceToContext(sourceType as SourceType),
        original_uri: uploadResult.originalUri!,
        processed_uri: uploadResult.processedUri || null,
        thumbnail_uri: uploadResult.thumbnailUri || null,
        mime_type: uploadResult.mimeType!,
        file_size_bytes: uploadResult.fileSizeBytes!,
        image_width: uploadResult.imageWidth || null,
        image_height: uploadResult.imageHeight || null,
        analysis_status: 'pending',
      })
      .select('id')
      .single() as any);

    if (insertErr) {
      console.error(JSON.stringify({ requestId, event: 'artifact_insert_failed', error: insertErr.message }));
      return NextResponse.json({ error: 'Failed to save artifact record' }, { status: 500 });
    }

    // ── Queue analysis ──
    const qResult = await queueArtifactAnalysis({
      artifact_id: artifact.id,
      requestId,
    });

    console.log(JSON.stringify({
      requestId,
      event: 'artifact_upload_complete',
      artifactId: artifact.id,
      type: 'file',
      mimeType: file.type,
      fileSizeBytes: uploadResult.fileSizeBytes,
      qstashQueued: qResult.success,
    }));

    return NextResponse.json({
      success: true,
      artifact_id: artifact.id,
      status: 'pending',
      message: 'Analyzing...',
      thumbnail_uri: uploadResult.thumbnailUri || null,
      requestId,
    }, { status: 201 });

  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'artifact_upload_error',
      error: error instanceof Error ? error.message : 'Unknown',
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
