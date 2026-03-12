// ============================================================
// E-Learning Session Builder
// ============================================================
// Core engine: intelligence profile → content selection →
// Gemini fallback generation → assembled SessionPlan.
//
// Pipeline:
//   1. Parallel fetch child + intelligence + recent events
//   2. Build IntelligenceContext (profile-based or age fallback)
//   3. Content selection (DB first, Gemini fallback per segment)
//   4. Assemble 4-segment SessionPlan
// ============================================================

import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';
import { getServiceSupabase } from '@/lib/api-auth';
import type { ProfileSkillRating } from '@/lib/intelligence/types';
import {
  buildWarmUpWordsPrompt,
  buildStoryPrompt,
  buildComprehensionQuestionsPrompt,
  buildCreativePromptPrompt,
} from '@/lib/gemini/elearning-prompts';
import type {
  SessionPlan,
  IntelligenceContext,
  WarmUpWord,
  WarmUpSegment,
  ReadingSegment,
  ComprehensionQuestion,
  ComprehensionSegment,
  CreativeSegment,
  ContentSource,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────

function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

/** Age-calibrated target word count for reading passages. */
function getTargetWordCount(age: number): number {
  if (age <= 5) return 50;
  if (age <= 6) return 70;
  if (age <= 7) return 90;
  if (age <= 8) return 110;
  if (age <= 9) return 130;
  if (age <= 10) return 150;
  return 180;
}

/** Derive a reading level string from age when no profile exists. */
function getDefaultReadingLevel(age: number): string {
  if (age <= 5) return 'pre_reader';
  if (age <= 6) return 'beginner';
  if (age <= 7) return 'developing';
  if (age <= 9) return 'developing';
  if (age <= 11) return 'fluent';
  return 'advanced';
}

/** Estimate session duration based on age. */
function getEstimatedMinutes(age: number): number {
  if (age <= 6) return 12;
  if (age <= 8) return 15;
  if (age <= 10) return 18;
  return 20;
}

// ─── Main Builder ─────────────────────────────────────────────

export async function buildELearningSession(childId: string): Promise<SessionPlan> {
  const supabase = getServiceSupabase();

  // ─── 1. Parallel fetch ───
  const [childResult, profileResult, eventsResult] = await Promise.all([
    supabase
      .from('children')
      .select('id, child_name, age, favorite_topics, learning_challenges, struggling_phonemes, phonics_focus, current_reading_level, primary_focus_area')
      .eq('id', childId)
      .single(),
    supabase
      .from('child_intelligence_profiles')
      .select('skill_ratings, overall_reading_level, narrative_profile, engagement_pattern, freshness_status')
      .eq('child_id', childId)
      .single(),
    supabase
      .from('learning_events')
      .select('event_type, event_subtype, event_data, created_at')
      .eq('child_id', childId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const child = childResult.data;
  if (!child) {
    throw new Error(`Child not found: ${childId}`);
  }

  const childName = child.child_name || 'Reader';
  const childAge = child.age || 8;
  const profile = profileResult.data;

  // ─── 2. Build IntelligenceContext ───
  const intelligenceContext = buildIntelligenceContext(profile, childAge);
  const readingLevel = profile?.overall_reading_level || getDefaultReadingLevel(childAge);
  const targetSkill = intelligenceContext.weakest_skill || child.primary_focus_area || 'phonics';
  const interests = child.favorite_topics || [];
  const weakAreas = intelligenceContext.areas_for_growth;

  // ─── 3. Content selection (DB-first, Gemini-fallback) ───
  const contentSources: SessionPlan['content_sources'] = {
    warmup: 'database',
    reading: 'database',
    comprehension: 'database',
    creative: 'generated', // always generated
  };

  // Track which content IDs were used from DB
  const contentIdsUsed: string[] = [];

  // --- Warm-up ---
  let warmUpWords: WarmUpWord[];
  const warmupFromDb = await fetchWarmUpContent(supabase, targetSkill, childAge);
  if (warmupFromDb) {
    warmUpWords = warmupFromDb.words;
    contentIdsUsed.push(warmupFromDb.contentId);
  } else {
    contentSources.warmup = 'generated';
    warmUpWords = await generateWarmUpWords(childName, childAge, targetSkill, weakAreas);
  }

  // --- Reading passage ---
  let readingSegment: ReadingSegment;
  const readingFromDb = await fetchReadingContent(supabase, readingLevel, childAge);
  if (readingFromDb) {
    readingSegment = readingFromDb.segment;
    contentIdsUsed.push(readingFromDb.contentId);
  } else {
    contentSources.reading = 'generated';
    readingSegment = await generateReadingPassage(
      childName, childAge, readingLevel, [targetSkill], interests,
    );
  }

  // --- Comprehension + Creative (can run in parallel) ---
  const passageSummary = readingSegment.passage.substring(0, 200);

  // Check DB for comprehension questions linked to the reading content
  let comprehensionQuestions: ComprehensionQuestion[] | null = null;
  if (contentIdsUsed.length > 0) {
    const linkedQuestions = await fetchLinkedComprehension(supabase, contentIdsUsed);
    if (linkedQuestions) {
      comprehensionQuestions = linkedQuestions;
    }
  }

  // Parallel: generate what's needed
  const questionCount = childAge <= 7 ? 2 : 3;
  const [compResult, creativeResult] = await Promise.all([
    comprehensionQuestions
      ? Promise.resolve(comprehensionQuestions)
      : generateComprehensionQuestions(
          childName, childAge, readingSegment.passage, readingSegment.title, questionCount,
        ).then(q => { contentSources.comprehension = 'generated'; return q; }),
    generateCreativePrompt(childName, childAge, readingSegment.title, passageSummary, readingLevel),
  ]);

  if (!comprehensionQuestions) {
    contentSources.comprehension = 'generated';
  }

  // ─── 4. Assemble SessionPlan ───
  const warmupSegment: WarmUpSegment = {
    type: 'warmup',
    words: warmUpWords,
    target_skill: targetSkill,
    instructions: `Let's warm up! Try saying each word out loud. Focus on the ${targetSkill} sounds.`,
  };

  const comprehensionSegment: ComprehensionSegment = {
    type: 'comprehension',
    questions: compResult,
    passage_title: readingSegment.title,
  };

  const creativeSegment: CreativeSegment = {
    type: 'creative',
    ...creativeResult,
  };

  const sessionPlan: SessionPlan = {
    version: '1.0',
    child_id: childId,
    child_name: childName,
    child_age: childAge,
    segments: [warmupSegment, readingSegment, comprehensionSegment, creativeSegment],
    intelligence_context: intelligenceContext,
    content_sources: contentSources,
    estimated_minutes: getEstimatedMinutes(childAge),
  };

  return sessionPlan;
}

// ─── Intelligence Context Builder ─────────────────────────────

function buildIntelligenceContext(
  profile: {
    skill_ratings: unknown;
    overall_reading_level: string | null;
    narrative_profile: unknown;
    engagement_pattern: string | null;
    freshness_status: string | null;
  } | null,
  childAge: number,
): IntelligenceContext {
  if (!profile || !profile.skill_ratings) {
    return {
      weakest_skill: null,
      strongest_skill: null,
      areas_for_growth: [],
      reading_level: getDefaultReadingLevel(childAge),
      engagement_pattern: null,
      age_based_fallback: true,
    };
  }

  const ratings = profile.skill_ratings as Record<string, ProfileSkillRating>;
  const entries = Object.values(ratings);

  let weakest: ProfileSkillRating | null = null;
  let strongest: ProfileSkillRating | null = null;

  const ratingOrder: Record<string, number> = {
    struggling: 0, developing: 1, proficient: 2, advanced: 3,
  };

  for (const entry of entries) {
    const val = ratingOrder[entry.rating] ?? 1;
    if (!weakest || val < (ratingOrder[weakest.rating] ?? 1)) weakest = entry;
    if (!strongest || val > (ratingOrder[strongest.rating] ?? 1)) strongest = entry;
  }

  const areasForGrowth = entries
    .filter(e => e.rating === 'struggling' || e.rating === 'developing')
    .map(e => e.skillName);

  const narrative = profile.narrative_profile as { areasForGrowth?: string[] } | null;

  return {
    weakest_skill: weakest?.skillName || null,
    strongest_skill: strongest?.skillName || null,
    areas_for_growth: areasForGrowth.length > 0
      ? areasForGrowth
      : (narrative?.areasForGrowth || []),
    reading_level: profile.overall_reading_level || getDefaultReadingLevel(childAge),
    engagement_pattern: profile.engagement_pattern || null,
    age_based_fallback: false,
  };
}

// ─── DB Content Fetchers ──────────────────────────────────────

type SupabaseClient = ReturnType<typeof getServiceSupabase>;

async function fetchWarmUpContent(
  supabase: SupabaseClient,
  targetSkill: string,
  childAge: number,
): Promise<{ words: WarmUpWord[]; contentId: string } | null> {
  // Look for interactive content items tagged with the target skill
  const { data: tagged } = await supabase
    .from('el_content_tags')
    .select('content_item_id, el_skills!inner(name, skill_tag)')
    .or(`sub_skill_tag.ilike.%${targetSkill}%`)
    .limit(5);

  if (!tagged || tagged.length === 0) return null;

  const contentIds = tagged.map((t: { content_item_id: string }) => t.content_item_id);
  const { data: items } = await supabase
    .from('el_content_items')
    .select('id, title, metadata, intelligence_tags')
    .in('id', contentIds)
    .eq('content_type', 'interactive')
    .eq('is_active', true)
    .limit(1);

  if (!items || items.length === 0) return null;

  const item = items[0];
  // Try to extract words from metadata
  const meta = item.metadata as { words?: WarmUpWord[] } | null;
  if (meta?.words && Array.isArray(meta.words) && meta.words.length >= 3) {
    return { words: meta.words.slice(0, 5), contentId: item.id };
  }

  return null;
}

async function fetchReadingContent(
  supabase: SupabaseClient,
  readingLevel: string,
  childAge: number,
): Promise<{ segment: ReadingSegment; contentId: string } | null> {
  // Look for content items that could serve as reading passages
  const { data: items } = await supabase
    .from('el_content_items')
    .select('id, title, description, metadata, difficulty_level')
    .in('content_type', ['interactive', 'worksheet'])
    .eq('is_active', true)
    .limit(5);

  if (!items || items.length === 0) return null;

  // Find one with passage text in metadata
  for (const item of items) {
    const meta = item.metadata as { passage?: string; word_count?: number } | null;
    if (meta?.passage && typeof meta.passage === 'string' && meta.passage.length > 30) {
      return {
        segment: {
          type: 'reading',
          title: item.title,
          passage: meta.passage,
          word_count: meta.word_count || meta.passage.split(/\s+/).filter(Boolean).length,
          reading_level: item.difficulty_level || readingLevel,
        },
        contentId: item.id,
      };
    }
  }

  return null;
}

async function fetchLinkedComprehension(
  supabase: SupabaseClient,
  contentIds: string[],
): Promise<ComprehensionQuestion[] | null> {
  // Check if any content items have linked questions in metadata
  const { data: items } = await supabase
    .from('el_content_items')
    .select('metadata')
    .in('id', contentIds);

  if (!items) return null;

  for (const item of items) {
    const meta = item.metadata as { comprehension_questions?: ComprehensionQuestion[] } | null;
    if (meta?.comprehension_questions && Array.isArray(meta.comprehension_questions) && meta.comprehension_questions.length >= 2) {
      return meta.comprehension_questions;
    }
  }

  return null;
}

// ─── Gemini Generation Helpers ────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: getGeminiModel('content_generation') });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function generateWarmUpWords(
  childName: string,
  childAge: number,
  targetSkill: string,
  weakAreas: string[],
): Promise<WarmUpWord[]> {
  const count = childAge <= 6 ? 3 : 5;
  const prompt = buildWarmUpWordsPrompt(childName, childAge, targetSkill, weakAreas, [], count);
  const text = await callGemini(prompt);
  const words = parseJsonResponse<WarmUpWord[]>(text);

  // Validate and ensure correct difficulty values
  return words.map(w => ({
    word: String(w.word || ''),
    phonics_focus: String(w.phonics_focus || targetSkill),
    hint: String(w.hint || ''),
    difficulty: (['easy', 'medium', 'hard'].includes(w.difficulty) ? w.difficulty : 'medium') as WarmUpWord['difficulty'],
  }));
}

async function generateReadingPassage(
  childName: string,
  childAge: number,
  readingLevel: string,
  targetSkills: string[],
  interests: string[],
): Promise<ReadingSegment> {
  const wordCountTarget = getTargetWordCount(childAge);
  const prompt = buildStoryPrompt(childName, childAge, readingLevel, targetSkills, interests, wordCountTarget);
  const text = await callGemini(prompt);
  const story = parseJsonResponse<{ title: string; passage: string; word_count: number }>(text);

  return {
    type: 'reading',
    title: String(story.title || 'Reading Time'),
    passage: String(story.passage || ''),
    word_count: story.word_count || story.passage.split(/\s+/).filter(Boolean).length,
    reading_level: readingLevel,
  };
}

async function generateComprehensionQuestions(
  childName: string,
  childAge: number,
  passage: string,
  passageTitle: string,
  questionCount: number,
): Promise<ComprehensionQuestion[]> {
  const prompt = buildComprehensionQuestionsPrompt(childName, childAge, passage, passageTitle, questionCount);
  const text = await callGemini(prompt);
  const questions = parseJsonResponse<ComprehensionQuestion[]>(text);

  return questions.map(q => ({
    question: String(q.question || ''),
    type: (['literal', 'inferential', 'evaluative'].includes(q.type) ? q.type : 'literal') as ComprehensionQuestion['type'],
    expected_answer_hint: String(q.expected_answer_hint || ''),
    options: Array.isArray(q.options) ? q.options.map(String) : undefined,
  }));
}

async function generateCreativePrompt(
  childName: string,
  childAge: number,
  passageTitle: string,
  passageSummary: string,
  skillLevel: string,
): Promise<Omit<CreativeSegment, 'type'>> {
  const prompt = buildCreativePromptPrompt(childName, childAge, passageTitle, passageSummary, skillLevel);
  const text = await callGemini(prompt);
  const creative = parseJsonResponse<{ prompt_text: string; prompt_type: string; word_limit_hint: number }>(text);

  const validTypes = ['retell', 'alternate_ending', 'character_letter', 'opinion', 'continuation'];

  return {
    prompt_text: String(creative.prompt_text || ''),
    prompt_type: (validTypes.includes(creative.prompt_type) ? creative.prompt_type : 'retell') as CreativeSegment['prompt_type'],
    word_limit_hint: creative.word_limit_hint || (childAge <= 7 ? 30 : 60),
  };
}
