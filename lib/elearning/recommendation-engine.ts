/**
 * E-learning recommendation engine
 * Extracted from app/api/elearning/recommendations/route.ts
 *
 * Contains: Gemini-powered video selection, smart sort fallback,
 * focus keyword extraction, carousel building, progress helpers.
 */

import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';

// ==================== TYPES ====================

export interface VideoForRecommendation {
  id: string;
  title: string;
  description: string | null;
  keyConcepts: string[] | null;
  moduleName: string | null;
  hasQuiz: boolean | null;
  isCompleted: boolean;
  needsQuizRetry: boolean | null;
  quizScore: number | null;
}

export interface SessionContext {
  date: string;
  focusArea: string | undefined;
  concerns: string | undefined;
  skillsWorked: string | undefined;
}

export interface RecommendationResult {
  videoIds: string[];
  focusArea: string;
  focusReason: string;
}

export interface CarouselItem {
  id: string;
  type: 'video';
  title: string;
  description: string;
  thumbnail_url: string | null;
  video_id: string | null;
  video_source: string | null;
  duration_seconds: number;
  xp_reward: number;
  has_quiz: boolean;
  is_locked: boolean;
  module_name: string | null;
  is_completed: boolean;
  needs_quiz_retry: boolean;
  quiz_passed: boolean;
}

// ==================== GEMINI AI RECOMMENDATIONS ====================

export async function getGeminiRecommendations(
  child: { child_name: string; age: number },
  sessions: SessionContext[],
  videos: VideoForRecommendation[],
  completedCount: number,
  quizPendingCount: number
): Promise<RecommendationResult | null> {
  const model = getGenAI().getGenerativeModel({ model: getGeminiModel('content_generation') });

  const focusFromSession = sessions[0]?.focusArea?.toLowerCase() || '';
  const concernsFromSession = sessions[0]?.concerns?.toLowerCase() || '';

  const focusKeywords = extractFocusKeywords(focusFromSession, concernsFromSession);

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

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in Gemini response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.videoIds || !Array.isArray(parsed.videoIds) || parsed.videoIds.length === 0) {
      console.error('Invalid videoIds in Gemini response:', parsed);
      return null;
    }

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

// ==================== SMART SORT FALLBACK ====================

export function extractFocusKeywords(focusArea: string, concerns: string): string[] {
  const combined = `${focusArea} ${concerns}`.toLowerCase();
  const keywords: string[] = [];

  if (combined.includes('digraph') || combined.includes('th') || combined.includes('sh') || combined.includes('ch')) {
    keywords.push('th', 'sh', 'ch', 'wh', 'ph', 'digraph');
  }
  if (combined.includes('blend')) {
    keywords.push('blend', 'bl', 'cl', 'fl', 'br', 'cr', 'dr', 'st', 'sp', 'sk');
  }
  if (combined.includes('phonics') || combined.includes('letter') || combined.includes('sound')) {
    keywords.push('letter', 'sound', 'phonics');
  }
  if (combined.includes('sight')) {
    keywords.push('sight', 'word');
  }
  if (combined.includes('vowel')) {
    keywords.push('vowel', 'short', 'long');
  }
  if (combined.includes('fluency') || combined.includes('reading')) {
    keywords.push('fluency', 'reading', 'practice');
  }

  if (keywords.length === 0) {
    return ['sound', 'letter', 'word', 'reading', 'practice'];
  }

  return keywords;
}

export function isRelevantToFocus(title: string, keywords: string[]): boolean {
  const titleLower = title.toLowerCase();
  return keywords.some(keyword => titleLower.includes(keyword));
}

export function smartSortVideos(
  allVideos: any[],
  completedVideoIds: Set<string>,
  quizPendingVideoIds: Set<string>,
  sessions: SessionContext[]
): RecommendationResult {
  const focusArea = sessions[0]?.focusArea || 'Reading Practice';
  const focusReason = sessions[0]?.concerns || 'Continue your learning journey';

  const needsRetry: any[] = [];
  const uncompleted: any[] = [];
  const completed: any[] = [];

  for (const video of allVideos) {
    if (video.has_quiz && quizPendingVideoIds.has(video.id)) {
      needsRetry.push(video);
    } else if (completedVideoIds.has(video.id)) {
      completed.push(video);
    } else {
      uncompleted.push(video);
    }
  }

  const result: string[] = [];
  needsRetry.slice(0, 3).forEach(v => result.push(v.id));
  uncompleted.slice(0, 3).forEach(v => result.push(v.id));
  const remaining = 8 - result.length;
  completed.slice(0, remaining).forEach(v => result.push(v.id));

  return { videoIds: result, focusArea, focusReason };
}

// ==================== CAROUSEL BUILDING ====================

export function buildCarousel(
  recommendedVideoIds: string[],
  allVideos: any[],
  completedVideoIds: Set<string>,
  quizPendingVideoIds: Set<string>,
  progressMap: Map<string, any>,
  maxItems: number = 8
): CarouselItem[] {
  const carousel: CarouselItem[] = [];
  let firstUncompletedFound = false;

  for (const videoId of recommendedVideoIds.slice(0, maxItems)) {
    const video = allVideos.find(v => v.id === videoId);
    if (!video) continue;

    const progressData = progressMap.get(video.id);
    const isCompleted = completedVideoIds.has(video.id);
    const needsQuizRetry = video.has_quiz && quizPendingVideoIds.has(video.id);
    const quizPassed = progressData?.quiz_passed === true;

    let isLocked = false;
    if (!isCompleted && !needsQuizRetry) {
      if (firstUncompletedFound) {
        isLocked = true;
      } else {
        firstUncompletedFound = true;
      }
    }

    let xpAvailable = 0;
    if (!isCompleted) {
      xpAvailable = video.xp_reward || 10;
    } else if (needsQuizRetry) {
      xpAvailable = 50;
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
      module_name: (video as any).skill?.[0]?.name || (video as any).skill?.name,
      is_completed: isCompleted,
      needs_quiz_retry: needsQuizRetry,
      quiz_passed: quizPassed,
    });
  }

  return carousel;
}

// ==================== PROGRESS HELPERS ====================

export function buildProgressSets(progress: any[] | null) {
  const progressMap = new Map<string, any>();
  progress?.forEach(p => {
    if (!p.video_id) return;
    progressMap.set(p.video_id, {
      is_completed: p.is_completed || false,
      quiz_passed: p.quiz_passed,
      quiz_attempted: p.quiz_attempted || false,
      best_quiz_score: p.best_quiz_score,
      completed_at: p.completed_at,
    });
  });

  const completedVideoIds = new Set<string>(
    (progress?.filter(p => p.is_completed).map(p => p.video_id).filter(Boolean) || []) as string[]
  );

  const quizPendingVideoIds = new Set<string>(
    (progress?.filter(p => p.is_completed && p.quiz_passed !== true)
      .map(p => p.video_id).filter(Boolean) || []) as string[]
  );

  return { progressMap, completedVideoIds, quizPendingVideoIds };
}

/**
 * Score and sort videos for a specific focus request (POST handler).
 */
export function scoreAndSortForFocus(
  allVideos: any[],
  focusKeywords: string[],
  completedVideoIds: Set<string>,
  quizPendingVideoIds: Set<string>,
  progressMap: Map<string, any>,
  maxItems: number = 8
): CarouselItem[] {
  const scoredVideos = allVideos.map(video => {
    let score = 0;
    const titleLower = video.title.toLowerCase();
    const keyConcepts = (video.key_concepts || []).map((k: string) => k.toLowerCase());

    for (const keyword of focusKeywords) {
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

  const sorted = scoredVideos
    .filter(v => v.score > 0 || v.needsQuizRetry)
    .sort((a, b) => {
      if (a.needsQuizRetry && !b.needsQuizRetry) return -1;
      if (!a.needsQuizRetry && b.needsQuizRetry) return 1;
      if (!a.isCompleted && b.isCompleted) return -1;
      if (a.isCompleted && !b.isCompleted) return 1;
      return b.score - a.score;
    })
    .slice(0, maxItems);

  const carousel: CarouselItem[] = [];
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
      module_name: (video as any).skill?.[0]?.name || (video as any).skill?.name,
      is_completed: isCompleted,
      needs_quiz_retry: needsQuizRetry,
      quiz_passed: progressData?.quiz_passed === true,
    });
  }

  return carousel;
}

// ==================== FOCUS AREA MAP ====================

export const FOCUS_AREA_MAP: Record<string, { area: string; keywords: string[] }> = {
  phonics: { area: 'Phonics', keywords: ['phonics', 'letter', 'sound'] },
  sight_words: { area: 'Sight Words', keywords: ['sight', 'word', 'high frequency'] },
  fluency: { area: 'Reading Fluency', keywords: ['fluency', 'reading', 'speed'] },
  blends: { area: 'Consonant Blends', keywords: ['blend', 'bl', 'cr', 'st', 'br'] },
  digraphs: { area: 'Digraphs', keywords: ['digraph', 'th', 'sh', 'ch', 'wh'] },
  vowels: { area: 'Vowel Sounds', keywords: ['vowel', 'short', 'long'] },
};
