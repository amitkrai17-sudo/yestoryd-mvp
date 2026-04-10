// =============================================================================
// FILE: app/api/elearning/recommendations/route.ts
// PURPOSE: rAI Brain - Gemini-powered personalized learning recommendations
// Thin orchestrator — logic in lib/elearning/recommendation-engine.ts
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireFeature } from '@/lib/features/require-feature';
import { insertLearningEvent } from '@/lib/rai/learning-events';
import {
  getGeminiRecommendations,
  smartSortVideos,
  buildCarousel,
  buildProgressSets,
  scoreAndSortForFocus,
  FOCUS_AREA_MAP,
  type SessionContext,
} from '@/lib/elearning/recommendation-engine';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// GET: Fetch personalized recommendations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');
    const forceRefresh = searchParams.get('refresh') === 'true';
    const useAI = searchParams.get('useAI') !== 'false';

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    const denied = await requireFeature('elearning_access', childId);
    if (denied) return denied;

    // STEP 1: Get child info
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('id, child_name, age, lead_status')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    if (child.lead_status !== 'enrolled') {
      return NextResponse.json({
        error: 'E-learning is only available for enrolled children',
        lead_status: child.lead_status,
      }, { status: 403 });
    }

    // STEP 1.5: Check cache
    const today = new Date().toISOString().split('T')[0];

    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('learning_events')
        .select('event_data')
        .eq('child_id', childId)
        .eq('event_type', 'daily_recommendations')
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (cached && cached.length > 0 && (cached[0].event_data as any)?.carousel) {
        return serveCachedResponse(childId, cached[0].event_data as any);
      }
    }

    // STEP 2: Get coaching session insights
    const { data: sessions } = await supabase
      .from('learning_events')
      .select('event_data, created_at')
      .eq('child_id', childId)
      .eq('event_type', 'session')
      .order('created_at', { ascending: false })
      .limit(3);

    // STEP 3: Get video progress
    const { data: progress } = await supabase
      .from('el_child_video_progress')
      .select('video_id, is_completed, quiz_passed, quiz_attempted, best_quiz_score, completed_at')
      .eq('child_id', childId);

    const { progressMap, completedVideoIds, quizPendingVideoIds } = buildProgressSets(progress);

    // STEP 4: Get all videos
    const { data: allVideos } = await supabase
      .from('el_videos')
      .select(`
        id, title, slug, description, video_source, video_id,
        thumbnail_url, duration_seconds, xp_reward, has_quiz,
        key_concepts,
        skill:el_skills(id, name, category)
      `)
      .eq('status', 'published')
      .order('display_order');

    if (!allVideos || allVideos.length === 0) {
      return NextResponse.json({
        success: true,
        child: { id: child.id, name: child.child_name || 'Learner', age: child.age || 7 },
        focus: { area: 'Getting Started', reason: 'No videos available', source: 'System' },
        carousel: [],
        total_xp_available: 0,
        estimated_time_minutes: 0,
      });
    }

    // STEP 5: Get AI recommendations or fallback
    const sessionContext: SessionContext[] = sessions?.map(s => ({
      date: s.created_at ? new Date(s.created_at).toLocaleDateString() : '',
      focusArea: (s.event_data as any)?.focus_area,
      concerns: (s.event_data as any)?.concerns,
      skillsWorked: (s.event_data as any)?.skills_worked_on,
    })) || [];

    let recommendedVideoIds: string[] = [];
    let focusArea = 'General Practice';
    let focusReason = 'Continue your learning journey';
    let focusSource = 'rAI recommendation';

    if (useAI && process.env.GEMINI_API_KEY) {
      try {
        const aiResult = await getGeminiRecommendations(
          { child_name: child.child_name || 'Learner', age: child.age || 7 },
          sessionContext,
          allVideos.map(v => ({
            id: v.id,
            title: v.title,
            description: v.description,
            keyConcepts: v.key_concepts,
            moduleName: (v as any).skill?.[0]?.name || (v as any).skill?.name,
            hasQuiz: v.has_quiz,
            isCompleted: completedVideoIds.has(v.id),
            needsQuizRetry: v.has_quiz && quizPendingVideoIds.has(v.id),
            quizScore: progressMap.get(v.id)?.best_quiz_score,
          })),
          completedVideoIds.size,
          quizPendingVideoIds.size
        );

        if (aiResult) {
          recommendedVideoIds = aiResult.videoIds;
          focusArea = aiResult.focusArea;
          focusReason = aiResult.focusReason;
          focusSource = 'rAI Intelligence';
        }
      } catch (aiError) {
        console.error('Gemini AI error, falling back to smart sort:', aiError);
      }
    }

    if (recommendedVideoIds.length === 0) {
      const smartSorted = smartSortVideos(allVideos, completedVideoIds, quizPendingVideoIds, sessionContext);
      recommendedVideoIds = smartSorted.videoIds;
      focusArea = smartSorted.focusArea;
      focusReason = smartSorted.focusReason;
      focusSource = sessionContext[0]?.focusArea
        ? `Session on ${sessionContext[0].date}`
        : 'Learning path';
    }

    // STEP 6: Build carousel
    const carousel = buildCarousel(recommendedVideoIds, allVideos, completedVideoIds, quizPendingVideoIds, progressMap);

    const totalXP = carousel.reduce((sum, r) => sum + (r.xp_reward || 0), 0);
    const totalMinutes = Math.ceil(carousel.reduce((sum, r) => sum + (r.duration_seconds || 180), 0) / 60);

    const responseData = {
      success: true,
      child: { id: child.id, name: child.child_name || 'Learner', age: child.age || 7 },
      focus: { area: focusArea, reason: focusReason, source: focusSource },
      carousel,
      total_xp_available: totalXP,
      estimated_time_minutes: totalMinutes,
    };

    // Cache (fire-and-forget)
    insertLearningEvent({
      childId,
      eventType: 'daily_recommendations',
      eventData: responseData as Record<string, unknown>,
      contentForEmbedding: `Daily recommendations for child ${childId}`,
      signalSource: 'system_generated',
      signalConfidence: 'low',
    }).then((result) => {
      if (!result) console.error('Failed to cache recommendations');
    });

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Recommendations API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to get recommendations' }, { status: 500 });
  }
}

// POST: Request different content (Ask rAI)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { childId, requestType, customRequest } = body;

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    const denied = await requireFeature('elearning_access', childId);
    if (denied) return denied;

    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    const { data: progress } = await supabase
      .from('el_child_video_progress')
      .select('video_id, is_completed, quiz_passed, quiz_attempted')
      .eq('child_id', childId);

    const { progressMap, completedVideoIds, quizPendingVideoIds } = buildProgressSets(progress);

    const focus = FOCUS_AREA_MAP[requestType] || {
      area: customRequest || 'General Practice',
      keywords: customRequest ? [customRequest.toLowerCase()] : [],
    };

    const { data: allVideos } = await supabase
      .from('el_videos')
      .select(`
        id, title, description, video_source, video_id,
        thumbnail_url, duration_seconds, xp_reward, has_quiz,
        key_concepts, skill:el_skills(name)
      `)
      .eq('status', 'published')
      .order('display_order');

    if (!allVideos) {
      return NextResponse.json({
        success: true,
        child: { id: child.id, name: child.child_name, age: child.age },
        focus: { area: focus.area, reason: `You asked for ${focus.area}`, source: 'Your request' },
        carousel: [],
        total_xp_available: 0,
        estimated_time_minutes: 0,
      });
    }

    const carousel = scoreAndSortForFocus(allVideos, focus.keywords, completedVideoIds, quizPendingVideoIds, progressMap);

    const totalXP = carousel.reduce((sum, r) => sum + r.xp_reward, 0);
    const totalMinutes = Math.ceil(carousel.reduce((sum, r) => sum + (r.duration_seconds || 180), 0) / 60);

    return NextResponse.json({
      success: true,
      child: { id: child.id, name: child.child_name || 'Learner', age: child.age || 7 },
      focus: { area: focus.area, reason: `You asked to practice ${focus.area}`, source: 'Your request' },
      carousel,
      total_xp_available: totalXP,
      estimated_time_minutes: totalMinutes,
    });
  } catch (error: any) {
    console.error('Recommendations POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ==================== CACHE HELPER ====================

async function serveCachedResponse(childId: string, cachedEventData: any) {
  const { data: progress } = await supabase
    .from('el_child_video_progress')
    .select('video_id, is_completed, quiz_passed, quiz_attempted')
    .eq('child_id', childId);

  const completedVideoIds = new Set(
    progress?.filter(p => p.is_completed).map(p => p.video_id) || []
  );
  const quizPendingVideoIds = new Set(
    progress?.filter(p => p.is_completed && p.quiz_passed !== true).map(p => p.video_id) || []
  );

  const videoIds = cachedEventData.carousel.map((c: any) => c.id);
  const { data: videos } = await supabase
    .from('el_videos')
    .select('id, has_quiz')
    .in('id', videoIds);

  const videoHasQuiz = new Map(videos?.map(v => [v.id, v.has_quiz]) || []);

  const updatedCarousel = cachedEventData.carousel.map((item: any) => {
    const isCompleted = completedVideoIds.has(item.id);
    const hasQuiz = videoHasQuiz.get(item.id);
    const needsQuizRetry = hasQuiz && quizPendingVideoIds.has(item.id);
    const progressData = progress?.find(p => p.video_id === item.id);

    return {
      ...item,
      is_completed: isCompleted,
      needs_quiz_retry: needsQuizRetry,
      quiz_passed: progressData?.quiz_passed === true,
      xp_reward: isCompleted && !needsQuizRetry ? 0 : (needsQuizRetry ? 50 : item.xp_reward),
    };
  });

  const totalXP = updatedCarousel.reduce((sum: number, r: any) => sum + (r.xp_reward || 0), 0);

  return NextResponse.json({
    ...cachedEventData,
    carousel: updatedCarousel,
    total_xp_available: totalXP,
    cached: true,
  });
}
