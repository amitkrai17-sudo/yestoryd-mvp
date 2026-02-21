// ============================================================
// FILE: app/api/coach/sessions/[id]/upload-audio/route.ts
// PURPOSE: Upload coach voice note or child reading clip
//          for offline sessions to Supabase Storage
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const STORAGE_BUCKET = 'session-audio';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIME_TYPES = new Set([
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/wav',
]);

// Map MIME type to file extension
function getExtension(mimeType: string): string {
  const extMap: Record<string, string> = {
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  };
  return extMap[mimeType] || 'webm';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    // 1. Auth check
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id: sessionId } = await params;
    const supabase = getServiceSupabase();
    const coachId = auth.coachId;

    if (!coachId) {
      return NextResponse.json({ error: 'Coach identity required' }, { status: 403 });
    }

    // 2. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (!type || !['voice_note', 'reading_clip'].includes(type)) {
      return NextResponse.json({ error: 'type must be "voice_note" or "reading_clip"' }, { status: 400 });
    }

    // 3. Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}` },
        { status: 400 }
      );
    }

    // 4. Verify session: exists, belongs to coach, is offline & approved
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select('id, coach_id, session_mode, offline_request_status, coach_voice_note_path, child_reading_clip_path')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.coach_id !== coachId && auth.role !== 'admin') {
      return NextResponse.json({ error: 'Session does not belong to this coach' }, { status: 403 });
    }

    if (session.session_mode !== 'offline') {
      return NextResponse.json({ error: 'Audio upload is only for offline sessions' }, { status: 400 });
    }

    const approvedStatuses = ['approved', 'auto_approved'];
    if (!session.offline_request_status || !approvedStatuses.includes(session.offline_request_status)) {
      return NextResponse.json(
        { error: 'Offline session must be approved before uploading audio' },
        { status: 400 }
      );
    }

    // 5. Upload to Supabase Storage
    const ext = getExtension(file.type);
    const timestamp = Date.now();
    const storagePath = `${sessionId}/${type}_${timestamp}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error(JSON.stringify({ requestId, event: 'audio_upload_error', error: uploadError.message }));
      return NextResponse.json({ error: 'Failed to upload audio file' }, { status: 500 });
    }

    // 6. Update scheduled_sessions with storage path
    const updateField = type === 'voice_note' ? 'coach_voice_note_path' : 'child_reading_clip_path';

    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        [updateField]: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error(JSON.stringify({ requestId, event: 'session_update_error', error: updateError.message }));
      return NextResponse.json({ error: 'File uploaded but failed to update session record' }, { status: 500 });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'audio_uploaded',
      sessionId,
      type,
      storagePath,
      sizeBytes: file.size,
      mimeType: file.type,
    }));

    return NextResponse.json({
      success: true,
      type,
      storage_path: storagePath,
      size_bytes: file.size,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error(JSON.stringify({ requestId, event: 'upload_audio_error', error: message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
