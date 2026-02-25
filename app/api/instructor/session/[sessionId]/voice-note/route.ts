// ============================================================
// FILE: app/api/instructor/session/[sessionId]/voice-note/route.ts
// ============================================================
// Voice Note Upload — Stores audio in Supabase Storage
// Bucket: group-class-voice-notes/[sessionId]/[childId].webm
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { sessionId } = await context.params;

    if (!z.string().uuid().safeParse(sessionId).success) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const childId = formData.get('childId') as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!childId || !z.string().uuid().safeParse(childId).success) {
      return NextResponse.json({ error: 'Invalid child ID' }, { status: 400 });
    }

    console.log(JSON.stringify({ requestId, event: 'voice_note_upload', sessionId, childId, size: audioFile.size }));

    const supabase = getServiceSupabase();

    // Verify session exists and instructor is assigned
    const { data: session } = await supabase
      .from('group_sessions')
      .select('id, instructor_id, coach_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (auth.role !== 'admin') {
      const isAssigned = session.instructor_id === auth.coachId || session.coach_id === auth.coachId;
      if (!isAssigned) {
        return NextResponse.json({ error: 'Not assigned to this session' }, { status: 403 });
      }
    }

    // Convert File to ArrayBuffer then Buffer for upload
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const extension = audioFile.type.includes('webm') ? 'webm' : audioFile.type.includes('mp3') ? 'mp3' : 'webm';
    const filePath = `${sessionId}/${childId}.${extension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('group-class-voice-notes')
      .upload(filePath, buffer, {
        contentType: audioFile.type || 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error(JSON.stringify({ requestId, event: 'voice_note_upload_error', error: uploadError.message }));
      return NextResponse.json({ error: 'Failed to upload: ' + uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('group-class-voice-notes')
      .getPublicUrl(filePath);

    console.log(JSON.stringify({ requestId, event: 'voice_note_upload_success', path: uploadData.path }));

    return NextResponse.json({
      success: true,
      requestId,
      path: uploadData.path,
      publicUrl: urlData.publicUrl,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'voice_note_upload_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
