// =============================================================================
// FILE: app/api/elearning/recommendations/route.ts
// PURPOSE: rAI Brain - Gemini-powered personalized learning recommendations
// VERSION: AI-powered with intelligent video selection
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// GET: Fetch personalized recommendations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');
    const forceRefresh = searchParams.get('refresh') === 'true'; // Force new recommendations
    const useAI = searchParams.get('useAI') !== 'false'; // Default to using AI

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

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
        lead_status: child.lead_status 
      }, { status: 403 });
    }

    // STEP 1.5: Check for cached recommendations (unless force refresh)
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

      if (cached && cached.length > 0 && cached[0].event_data?.carousel) {
        
        // Get fresh progress data to update completion status
        const { data: progress } = await supabase
          .from('child_video_progress')
          .select('video_id, is_completed, quiz_passed, quiz_attempted')
          .eq('child_id', childId);

        const completedVideoIds = new Set(
          progress?.filter(p => p.is_completed).map(p => p.video_id) || []
        );
        const quizPendingVideoIds = new Set(
          progress?.filter(p => p.is_completed && p.quiz_passed !== true)
            .map(p => p.video_id) || []
        );

        // Get video details for has_quiz check
        const videoIds = cached[0].event_data.carousel.map((c: any) => c.id);
        const { data: videos } = await supabase
          .from('learning_videos')
          .select('id, has_quiz')
          .in('id', videoIds);

        const videoHasQuiz = new Map(videos?.map(v => [v.id, v.has_quiz]) || []);

        // Update carousel items with fresh completion status
        const updatedCarousel = cached[0].event_data.carousel.map((item: any) => {
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

        // Recalculate totals
        const totalXP = updatedCarousel.reduce((sum: number, r: any) => sum + (r.xp_reward || 0), 0);

        return NextResponse.json({
          ...cached[0].event_data,
          carousel: updatedCarousel,
          total_xp_available: totalXP,
          cached: true,
        });
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
      .from('child_video_progress')
      .select('video_id, is_completed, quiz_passed, quiz_attempted, best_quiz_score, completed_at')
      .eq('child_id', childId);

    // Build progress lookup map
    const progressMap = new Map<string, any>();
    progress?.forEach(p => {
      progressMap.set(p.video_id, {
        is_completed: p.is_completed || false,
        quiz_passed: p.quiz_passed,
        quiz_attempted: p.quiz_attempted || false,
        best_quiz_score: p.best_quiz_score,
        completed_at: p.completed_at,
      });
    });

    const completedVideoIds = new Set(
      progress?.filter(p => p.is_completed).map(p => p.video_id) || []
    );
    
    // Videos needing quiz action: completed but quiz not passed yet
    // This includes: quiz never attempted OR quiz attempted but failed
    const quizPendingVideoIds = new Set(
      progress?.filter(p => p.is_completed && p.quiz_passed !== true)
        .map(p => p.video_id) || []
    );

    // STEP 4: Get all videos
    const { data: allVideos } = await supabase
      .from('learning_videos')
      .select(`
        id, title, slug, description, video_source, video_id, 
        thumbnail_url, duration_seconds, xp_reward, has_quiz,
        key_concepts,
        module:learning_modules(id, name, level_id)
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

    // STEP 5: Get AI recommendations or fallback to smart sorting
    let recommendedVideoIds: string[] = [];
    let focusArea = 'General Practice';
    let focusReason = 'Continue your learning journey';
    let focusSource = 'rAI recommendation';

    // Extract session context
    const sessionContext = sessions?.map(s => ({
      date: new Date(s.created_at).toLocaleDateString(),
      focusArea: s.event_data?.focus_area,
      concerns: s.event_data?.concerns,
      skillsWorked: s.event_data?.skills_worked_on,
    })) || [];

    if (useAI && process.env.GEMINI_API_KEY) {
      try {
        const aiResult = await getGeminiRecommendations(
          child,
          sessionContext,
          allVideos.map(v => ({
            id: v.id,
            title: v.title,
            description: v.description,
            keyConcepts: v.key_concepts,
            moduleName: v.module?.[0]?.name,
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

    // Fallback: Smart sorting if AI didn't work
    if (recommendedVideoIds.length === 0) {
      const smartSorted = smartSortVideos(
        allVideos,
        completedVideoIds,
        quizPendingVideoIds,
        sessionContext
      );
      recommendedVideoIds = smartSorted.videoIds;
      focusArea = smartSorted.focusArea;
      focusReason = smartSorted.focusReason;
      focusSource = sessionContext[0]?.focusArea 
        ? `Session on ${sessionContext[0].date}` 
        : 'Learning path';
    }

    // STEP 6: Build carousel from recommended video IDs
    const carousel: any[] = [];
    let firstUncompletedFound = false;

    for (const videoId of recommendedVideoIds.slice(0, 8)) {
      const video = allVideos.find(v => v.id === videoId);
      if (!video) continue;

      const progressData = progressMap.get(video.id);
      const isCompleted = completedVideoIds.has(video.id);
      // Only mark as needing quiz retry if video HAS a quiz AND quiz not passed
      const needsQuizRetry = video.has_quiz && quizPendingVideoIds.has(video.id);
      const quizPassed = progressData?.quiz_passed === true;

      // Sequential unlock for uncompleted videos only
      let isLocked = false;
      if (!isCompleted && !needsQuizRetry) {
        if (firstUncompletedFound) {
          isLocked = true;
        } else {
          firstUncompletedFound = true;
        }
      }

      // Calculate XP available
      let xpAvailable = 0;
      if (!isCompleted) {
        xpAvailable = video.xp_reward || 10;
      } else if (needsQuizRetry) {
        xpAvailable = 50; // Quiz XP still available
      }

      carousel.push({
        id: video.id,
        type: 'video',
        title: video.title,
        description: video.description || '',
        thumbnail_url: video.video_source === 'youtube' && video.video_id
          ? `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`
          : video.thumbnail_url,
        video_id: video.video_id,
        video_source: video.video_source,
        duration_seconds: video.duration_seconds || 180,
        xp_reward: xpAvailable,
        has_quiz: video.has_quiz,
        is_locked: isLocked,
        module_name: video.module?.[0]?.name,
        // Explicit status
        is_completed: isCompleted,
        needs_quiz_retry: needsQuizRetry,
        quiz_passed: quizPassed,
      });
    }

    // Calculate totals
    const totalXP = carousel.reduce((sum, r) => sum + (r.xp_reward || 0), 0);
    const totalMinutes = Math.ceil(
      carousel.reduce((sum, r) => sum + (r.duration_seconds || 180), 0) / 60
    );


    const responseData = {
      success: true,
      child: {
        id: child.id,
        name: child.child_name || 'Learner',
        age: child.age || 7,
      },
      focus: {
        area: focusArea,
        reason: focusReason,
        source: focusSource,
      },
      carousel,
      total_xp_available: totalXP,
      estimated_time_minutes: totalMinutes,
    };

    // SAVE to cache for today (don't await to keep response fast)
    supabase
      .from('learning_events')
      .insert({
        child_id: childId,
        event_type: 'daily_recommendations',
        event_data: responseData,
      })
      .then(({ error }) => {
        if (error) console.error('Failed to cache recommendations:', error);
      });

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Recommendations API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get recommendations' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GEMINI AI RECOMMENDATIONS
// =============================================================================
async function getGeminiRecommendations(
  child: any,
  sessions: any[],
  videos: any[],
  completedCount: number,
  quizPendingCount: number
): Promise<{ videoIds: string[]; focusArea: string; focusReason: string } | null> {
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  // Determine focus area from sessions
  const focusFromSession = sessions[0]?.focusArea?.toLowerCase() || '';
  const concernsFromSession = sessions[0]?.concerns?.toLowerCase() || '';
  
  // Pre-filter videos relevant to focus
  const focusKeywords = extractFocusKeywords(focusFromSession, concernsFromSession);
  
  // Categorize videos
  const quizPendingVideos = videos.filter(v => v.needsQuizRetry);
  const relevantNewVideos = videos.filter(v => 
    !v.isCompleted && !v.needsQuizRetry && isRelevantToFocus(v.title, focusKeywords)
  );
  const relevantDoneVideos = videos.filter(v => 
    v.isCompleted && !v.needsQuizRetry && isRelevantToFocus(v.title, focusKeywords)
  );

  const prompt = `You are rAI, selecting videos for a child's learning session.

CHILD: ${child.child_name}, ${child.age} years old
FOCUS AREA: ${sessions[0]?.focusArea || 'Reading Practice'}
CONCERN: ${sessions[0]?.concerns || 'General practice'}

I have pre-filtered videos relevant to the focus area. Select from these ONLY:

QUIZ PENDING (must include ALL - show as orange):
${quizPendingVideos.length > 0 
  ? quizPendingVideos.map(v => `${v.id} | ${v.title}`).join('\n')
  : 'None'}

RELEVANT NEW VIDEOS (select 1-2):
${relevantNewVideos.length > 0 
  ? relevantNewVideos.slice(0, 10).map(v => `${v.id} | ${v.title}`).join('\n')
  : 'None available'}

RELEVANT COMPLETED VIDEOS (select 3-5 for review):
${relevantDoneVideos.length > 0 
  ? relevantDoneVideos.slice(0, 15).map(v => `${v.id} | ${v.title}`).join('\n')
  : 'None'}

RULES:
- ONLY select video IDs from the lists above
- Include ALL quiz pending videos first
- Then add 1-2 new videos if available
- Fill remaining slots with completed videos
- Total should be 6-8 videos

Return ONLY valid JSON:
{
  "focusArea": "${sessions[0]?.focusArea || 'Reading Practice'}",
  "focusReason": "${sessions[0]?.concerns || 'Continue practicing'}",
  "videoIds": ["id1", "id2", ...]
}`;

  try {
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in Gemini response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate response
    if (!parsed.videoIds || !Array.isArray(parsed.videoIds) || parsed.videoIds.length === 0) {
      console.error('Invalid videoIds in Gemini response:', parsed);
      return null;
    }

    // Filter to only valid video IDs
    const validVideoIds = videos.map(v => v.id);
    const filteredIds = parsed.videoIds.filter((id: string) => validVideoIds.includes(id));


    if (filteredIds.length < 3) {
      console.error('Too few valid video IDs from Gemini');
      return null;
    }

    return {
      videoIds: filteredIds,
      focusArea: parsed.focusArea || 'Reading Practice',
      focusReason: parsed.focusReason || 'Continue your learning journey',
    };
  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}

// =============================================================================
// SMART SORT FALLBACK (No AI)
// =============================================================================

// Helper: Extract keywords from focus area
function extractFocusKeywords(focusArea: string, concerns: string): string[] {
  const combined = `${focusArea} ${concerns}`.toLowerCase();
  const keywords: string[] = [];
  
  // Digraphs
  if (combined.includes('digraph') || combined.includes('th') || combined.includes('sh') || combined.includes('ch')) {
    keywords.push('th', 'sh', 'ch', 'wh', 'ph', 'digraph');
  }
  
  // Blends
  if (combined.includes('blend')) {
    keywords.push('blend', 'bl', 'cl', 'fl', 'br', 'cr', 'dr', 'st', 'sp', 'sk');
  }
  
  // Phonics / Letters
  if (combined.includes('phonics') || combined.includes('letter') || combined.includes('sound')) {
    keywords.push('letter', 'sound', 'phonics');
  }
  
  // Sight words
  if (combined.includes('sight')) {
    keywords.push('sight', 'word');
  }
  
  // Vowels
  if (combined.includes('vowel')) {
    keywords.push('vowel', 'short', 'long');
  }
  
  // Fluency
  if (combined.includes('fluency') || combined.includes('reading')) {
    keywords.push('fluency', 'reading', 'practice');
  }
  
  // If no specific keywords found, be more permissive
  if (keywords.length === 0) {
    return ['sound', 'letter', 'word', 'reading', 'practice'];
  }
  
  return keywords;
}

// Helper: Check if video title is relevant to focus keywords
function isRelevantToFocus(title: string, keywords: string[]): boolean {
  const titleLower = title.toLowerCase();
  return keywords.some(keyword => titleLower.includes(keyword));
}

function smartSortVideos(
  allVideos: any[],
  completedVideoIds: Set<string>,
  quizPendingVideoIds: Set<string>,
  sessions: any[]
): { videoIds: string[]; focusArea: string; focusReason: string } {
  
  // Get focus area from sessions
  const focusArea = sessions[0]?.focusArea || 'Reading Practice';
  const focusReason = sessions[0]?.concerns || 'Continue your learning journey';

  // Categorize videos
  const needsRetry: any[] = [];
  const uncompleted: any[] = [];
  const completed: any[] = [];

  for (const video of allVideos) {
    // Only mark as needing retry if video has a quiz AND quiz not passed
    if (video.has_quiz && quizPendingVideoIds.has(video.id)) {
      needsRetry.push(video);
    } else if (completedVideoIds.has(video.id)) {
      completed.push(video);
    } else {
      uncompleted.push(video);
    }
  }

  // Build final list: retry first, then some uncompleted, then some completed
  const result: string[] = [];

  // Add all retry videos (max 3)
  needsRetry.slice(0, 3).forEach(v => result.push(v.id));

  // Add uncompleted videos (max 3)
  uncompleted.slice(0, 3).forEach(v => result.push(v.id));

  // Add completed videos for review (fill up to 8)
  const remaining = 8 - result.length;
  completed.slice(0, remaining).forEach(v => result.push(v.id));

  return {
    videoIds: result,
    focusArea,
    focusReason,
  };
}

// =============================================================================
// POST: Request different content (Ask rAI)
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { childId, requestType, customRequest } = body;

    if (!childId) {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 });
    }

    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // Get progress
    const { data: progress } = await supabase
      .from('child_video_progress')
      .select('video_id, is_completed, quiz_passed, quiz_attempted')
      .eq('child_id', childId);

    const progressMap = new Map();
    progress?.forEach(p => progressMap.set(p.video_id, p));

    const completedVideoIds = new Set(
      progress?.filter(p => p.is_completed).map(p => p.video_id) || []
    );
    const quizPendingVideoIds = new Set(
      progress?.filter(p => p.is_completed && p.quiz_passed !== true)
        .map(p => p.video_id) || []
    );

    // Map request type to focus
    const focusAreaMap: Record<string, { area: string; keywords: string[] }> = {
      'phonics': { area: 'Phonics', keywords: ['phonics', 'letter', 'sound'] },
      'sight_words': { area: 'Sight Words', keywords: ['sight', 'word', 'high frequency'] },
      'fluency': { area: 'Reading Fluency', keywords: ['fluency', 'reading', 'speed'] },
      'blends': { area: 'Consonant Blends', keywords: ['blend', 'bl', 'cr', 'st', 'br'] },
      'digraphs': { area: 'Digraphs', keywords: ['digraph', 'th', 'sh', 'ch', 'wh'] },
      'vowels': { area: 'Vowel Sounds', keywords: ['vowel', 'short', 'long'] },
    };

    const focus = focusAreaMap[requestType] || {
      area: customRequest || 'General Practice',
      keywords: customRequest ? [customRequest.toLowerCase()] : [],
    };

    // Get videos matching request
    const { data: allVideos } = await supabase
      .from('learning_videos')
      .select(`
        id, title, description, video_source, video_id, 
        thumbnail_url, duration_seconds, xp_reward, has_quiz,
        key_concepts, module:learning_modules(name)
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

    // Score and sort videos
    const scoredVideos = allVideos.map(video => {
      let score = 0;
      const titleLower = video.title.toLowerCase();
      const keyConcepts = (video.key_concepts || []).map((k: string) => k.toLowerCase());

      for (const keyword of focus.keywords) {
        if (titleLower.includes(keyword)) score += 10;
        if (keyConcepts.some((k: string) => k.includes(keyword))) score += 15;
      }

      return {
        ...video,
        score,
        isCompleted: completedVideoIds.has(video.id),
        needsQuizRetry: video.has_quiz && quizPendingVideoIds.has(video.id),
      };
    });

    // Sort: retry first, then uncompleted with score, then completed
    const sorted = scoredVideos
      .filter(v => v.score > 0 || v.needsQuizRetry)
      .sort((a, b) => {
        if (a.needsQuizRetry && !b.needsQuizRetry) return -1;
        if (!a.needsQuizRetry && b.needsQuizRetry) return 1;
        if (!a.isCompleted && b.isCompleted) return -1;
        if (a.isCompleted && !b.isCompleted) return 1;
        return b.score - a.score;
      })
      .slice(0, 8);

    // Build carousel
    const carousel: any[] = [];
    let firstUncompletedFound = false;

    for (const video of sorted) {
      const isCompleted = video.isCompleted;
      const needsQuizRetry = video.needsQuizRetry;
      const progressData = progressMap.get(video.id);

      let isLocked = false;
      if (!isCompleted && !needsQuizRetry && firstUncompletedFound) {
        isLocked = true;
      }
      if (!isCompleted && !needsQuizRetry && !firstUncompletedFound) {
        firstUncompletedFound = true;
      }

      carousel.push({
        id: video.id,
        type: 'video',
        title: video.title,
        description: video.description || '',
        thumbnail_url: video.video_source === 'youtube' && video.video_id
          ? `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`
          : video.thumbnail_url,
        video_id: video.video_id,
        video_source: video.video_source,
        duration_seconds: video.duration_seconds || 180,
        xp_reward: isCompleted && !needsQuizRetry ? 0 : (needsQuizRetry ? 50 : (video.xp_reward || 10)),
        has_quiz: video.has_quiz,
        is_locked: isLocked,
        module_name: video.module?.[0]?.name,
        is_completed: isCompleted,
        needs_quiz_retry: needsQuizRetry,
        quiz_passed: progressData?.quiz_passed === true,
      });
    }

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
