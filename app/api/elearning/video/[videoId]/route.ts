export const dynamic = 'force-dynamic';

// =============================================================================
// VIDEO API
// Fetch video details by ID
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();
export async function GET(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    const videoId = params.videoId;
    
    if (!videoId) {
      return NextResponse.json(
        { success: false, error: 'Video ID required' },
        { status: 400 }
      );
    }
    
    // Fetch video from el_videos table
    const { data: video, error } = await supabase
      .from('el_videos')
      .select('*')
      .eq('id', videoId)
      .single();
    
    if (error || !video) {
      return NextResponse.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      video: {
        id: video.id,
        title: video.title,
        description: video.description,
        video_url: video.video_url,
        thumbnail_url: video.thumbnail_url,
        duration_seconds: video.duration_seconds,
        key_concepts: video.key_concepts,
      },
    });
    
  } catch (error: any) {
    console.error('Video API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

