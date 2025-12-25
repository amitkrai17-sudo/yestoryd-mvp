// file: app/api/session/[id]/audio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAudioSignedUrl } from '@/lib/audio-storage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    const { data: session, error } = await supabase
      .from('scheduled_sessions')
      .select('id, audio_storage_path, audio_url, video_url, video_expires_at, ai_summary, duration_seconds, status')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const videoExpired = session.video_expires_at 
      ? new Date(session.video_expires_at) < new Date()
      : true;

    let audioUrl = session.audio_url;
    if (session.audio_storage_path) {
      const freshUrl = await getAudioSignedUrl(session.audio_storage_path);
      if (freshUrl) audioUrl = freshUrl;
    }

    let videoDaysRemaining = 0;
    if (session.video_expires_at && !videoExpired) {
      const expiresAt = new Date(session.video_expires_at);
      videoDaysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }

    return NextResponse.json({
      sessionId: session.id,
      audioUrl,
      hasAudio: !!audioUrl,
      videoUrl: videoExpired ? null : session.video_url,
      videoExpired,
      videoDaysRemaining,
      parentSummary: session.ai_summary,
      status: session.status,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}