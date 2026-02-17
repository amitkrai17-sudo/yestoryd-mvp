// app/api/elearning/videos/[videoId]/progress/route.ts
// API for tracking video watch progress

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// POST - Update video progress
export async function POST(
  request: NextRequest,
  { params }: { params: { videoId: string } }
) {
  try {
    // supabase already initialized above
    const videoId = params.videoId;
    const body = await request.json();

    const { childId, unitId, watchPercent, watchTimeSeconds } = body;

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    // Get video details
    const { data: video } = await supabase
      .from('el_videos')
      .select('id, title, xp_reward, duration_seconds')
      .eq('id', videoId)
      .single();

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check for existing progress
    const { data: existing } = await supabase
      .from('el_child_video_progress')
      .select('*')
      .eq('child_id', childId)
      .eq('video_id', videoId)
      .single();

    const isFirstCompletion = !existing?.completed && watchPercent >= 90;
    const xpToAward = isFirstCompletion ? (video.xp_reward || 10) : 0;
    const coinsToAward = isFirstCompletion ? 5 : 0;

    let progress;

    if (existing) {
      // Update existing progress
      const { data, error } = await supabase
        .from('el_child_video_progress')
        .update({
          watch_percent: Math.max(existing.watch_percent ?? 0, watchPercent),
          watch_time_seconds: Math.max(existing.watch_time_seconds ?? 0, watchTimeSeconds),
          completed: existing.completed || watchPercent >= 90,
          completed_at: (watchPercent >= 90 && !existing.completed)
            ? new Date().toISOString()
            : existing.completed_at,
          xp_earned: (existing.xp_earned ?? 0) + xpToAward,
          times_watched: watchPercent >= 90 ? (existing.times_watched ?? 0) + 1 : (existing.times_watched ?? 0),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      progress = data;
    } else {
      // Create new progress record
      const { data, error } = await supabase
        .from('el_child_video_progress')
        .insert({
          child_id: childId,
          video_id: videoId,
          unit_id: unitId || null,
          watch_percent: watchPercent,
          watch_time_seconds: watchTimeSeconds,
          completed: watchPercent >= 90,
          completed_at: watchPercent >= 90 ? new Date().toISOString() : null,
          xp_earned: xpToAward,
          times_watched: watchPercent >= 90 ? 1 : 0
        })
        .select()
        .single();

      if (error) throw error;
      progress = data;
    }

    // Update gamification stats if first completion
    if (isFirstCompletion) {
      const { data: gamification } = await supabase
        .from('el_child_gamification')
        .select('*')
        .eq('child_id', childId)
        .single();

      if (gamification) {
        await supabase
          .from('el_child_gamification')
          .update({
            total_xp: (gamification.total_xp ?? 0) + xpToAward,
            total_coins: (gamification.total_coins ?? 0) + coinsToAward,
            videos_watched: (gamification.videos_watched ?? 0) + 1,
            last_activity_date: new Date().toISOString().split('T')[0]
          })
          .eq('child_id', childId);
      }

      // Update unit progress if provided
      if (unitId) {
        const { data: unitProgress } = await supabase
          .from('el_child_unit_progress')
          .select('*')
          .eq('child_id', childId)
          .eq('unit_id', unitId)
          .single();

        if (unitProgress) {
          await supabase
            .from('el_child_unit_progress')
            .update({
              video_watch_percent: watchPercent,
              xp_earned: (unitProgress.xp_earned ?? 0) + xpToAward,
              coins_earned: (unitProgress.coins_earned ?? 0) + coinsToAward,
              current_step: (unitProgress.current_step ?? 0) + 1,
              status: 'in_progress',
              started_at: unitProgress.started_at || new Date().toISOString(),
              last_activity_at: new Date().toISOString()
            })
            .eq('id', unitProgress.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        progress: {
          watchPercent: progress.watch_percent,
          completed: progress.completed,
          timesWatched: progress.times_watched
        },
        rewards: isFirstCompletion ? {
          xp: xpToAward,
          coins: coinsToAward,
          message: '🎬 Video completed! Great job!'
        } : null
      }
    });

  } catch (error) {
    console.error('Video progress error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
