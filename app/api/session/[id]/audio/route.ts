// app/api/session/[id]/audio/route.ts
// API endpoint for parents to access session audio recordings
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAudioSignedUrl } from '@/lib/audio-storage';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SessionRecording {
  sessionId: string;
  audioUrl: string | null;
  videoUrl: string | null;
  videoExpiresAt: string | null;
  videoExpired: boolean;
  transcript: string | null;
  aiSummary: string | null;
  duration: number | null;
  sessionDate: string;
  sessionType: string;
  childName: string;
  coachName: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get session details with audio/video info
    const { data: session, error } = await supabase
      .from('scheduled_sessions')
      .select(`
        id,
        session_type,
        scheduled_date,
        scheduled_time,
        duration_minutes,
        audio_url,
        audio_storage_path,
        video_url,
        video_expires_at,
        tldv_transcript,
        ai_summary,
        tldv_ai_summary,
        status,
        child:children (
          id,
          name,
          child_name,
          parent_id
        ),
        coach:coaches (
          id,
          name
        )
      `)
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if session is completed
    if (session.status !== 'completed') {
      return NextResponse.json(
        { 
          error: 'Recording not available',
          reason: session.status === 'scheduled' 
            ? 'Session has not occurred yet' 
            : `Session status: ${session.status}`
        },
        { status: 400 }
      );
    }

    // Get fresh signed URL for audio if we have a storage path
    let audioUrl = session.audio_url;
    if (session.audio_storage_path) {
      const freshUrl = await getAudioSignedUrl(session.audio_storage_path);
      if (freshUrl) {
        audioUrl = freshUrl;
      }
    }

    // Check if video has expired
    const videoExpired = session.video_expires_at 
      ? new Date(session.video_expires_at) < new Date()
      : true;

    // Handle Supabase array returns for joins
    const child = Array.isArray(session.child) ? session.child[0] : session.child;
    const coach = Array.isArray(session.coach) ? session.coach[0] : session.coach;

    const response: SessionRecording = {
      sessionId: session.id,
      audioUrl: audioUrl,
      videoUrl: videoExpired ? null : session.video_url,
      videoExpiresAt: session.video_expires_at,
      videoExpired: videoExpired,
      transcript: session.tldv_transcript,
      aiSummary: session.ai_summary || session.tldv_ai_summary,
      duration: session.duration_minutes,
      sessionDate: session.scheduled_date,
      sessionType: session.session_type,
      childName: child?.child_name || child?.name || 'Child',
      coachName: coach?.name || 'Coach',
    };

    return NextResponse.json({
      success: true,
      recording: response,
      message: videoExpired && session.video_url
        ? 'Video recording has expired (7-day limit). Audio is available permanently.'
        : undefined,
    });

  } catch (error: any) {
    console.error('Session audio API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Request audio refresh (if signed URL expired)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    // Get storage path
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('audio_storage_path')
      .eq('id', sessionId)
      .single();

    if (!session?.audio_storage_path) {
      return NextResponse.json(
        { error: 'No audio recording found for this session' },
        { status: 404 }
      );
    }

    // Generate fresh signed URL (1 hour validity)
    const freshUrl = await getAudioSignedUrl(session.audio_storage_path);

    if (!freshUrl) {
      return NextResponse.json(
        { error: 'Failed to generate audio URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      audioUrl: freshUrl,
      expiresIn: '1 hour',
    });

  } catch (error: any) {
    console.error('Audio refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
