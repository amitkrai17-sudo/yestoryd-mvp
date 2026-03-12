// =============================================================================
// FILE: lib/books/recommendation-engine.ts
// PURPOSE: rAI Book Recommendation Engine — 3-layer personalized book picks
// PATTERN: Follows lib/elearning/recommendation-engine.ts
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/rai/embeddings';
import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';
import { getChildReadBookTitles } from './book-utils';

const supabase = createAdminClient();

// ─── Types ───

export interface BookCandidate {
  id: string;
  title: string;
  author: string;
  slug: string | null;
  cover_image_url: string | null;
  reading_level: string | null;
  age_min: number | null;
  age_max: number | null;
  skills_targeted: string[] | null;
  genres: string[] | null;
  vote_count: number | null;
  rucha_review: string | null;
  is_available_for_kahani_times: boolean | null;
  is_featured: boolean | null;
  embedding: string | null;
}

export interface BookRecommendation {
  book: BookCandidate;
  reason: string;
  relevance_score: number;
}

interface ChildProfile {
  id: string;
  child_name: string | null;
  age: number | null;
  reading_level: string | null;
  learning_profile: Record<string, unknown> | null;
  areas_to_improve: string[] | null;
  latest_assessment_score: number | null;
  assessment_wpm: number | null;
  learning_needs: string[] | null;
}

interface SkillRating {
  skill_name: string;
  rating: string; // 'advanced' | 'proficient' | 'developing' | 'emerging' | 'struggling'
  confidence: string;
}

// ─── In-memory cache (1 hour TTL) ───

const cache = new Map<string, { data: BookRecommendation[]; expires: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(childId: string): BookRecommendation[] | null {
  const entry = cache.get(childId);
  if (entry && Date.now() < entry.expires) return entry.data;
  cache.delete(childId);
  return null;
}

function setCache(childId: string, data: BookRecommendation[]): void {
  cache.set(childId, { data, expires: Date.now() + CACHE_TTL_MS });
}

// ─── Reading Level Adjacency ───

const LEVEL_ORDER = ['pre-reader', 'beginner', 'early reader', 'developing', 'intermediate', 'advanced'];

function getLevelIndex(level: string | null): number {
  if (!level) return -1;
  return LEVEL_ORDER.findIndex(l => l.toLowerCase() === level.toLowerCase());
}

function isLevelWithinRange(bookLevel: string | null, childLevel: string | null): boolean {
  if (!bookLevel || !childLevel) return true; // No level data = include
  const bookIdx = getLevelIndex(bookLevel);
  const childIdx = getLevelIndex(childLevel);
  if (bookIdx === -1 || childIdx === -1) return true;
  return Math.abs(bookIdx - childIdx) <= 1;
}

// ─── Skill Weakness Detection ───

const WEAKNESS_THRESHOLD_RATINGS = new Set(['struggling', 'emerging', 'developing']);

function getWeakSkills(
  areasToImprove: string[] | null,
  skillRatings: SkillRating[] | null
): Set<string> {
  const weak = new Set<string>();

  // From assessment areas_to_improve
  (areasToImprove || []).forEach(a => weak.add(a.toLowerCase()));

  // From intelligence profile skill_ratings
  (skillRatings || []).forEach(sr => {
    if (WEAKNESS_THRESHOLD_RATINGS.has(sr.rating.toLowerCase())) {
      weak.add(sr.skill_name.toLowerCase());
    }
  });

  return weak;
}

function getMediumSkills(skillRatings: SkillRating[] | null): Set<string> {
  const medium = new Set<string>();
  (skillRatings || []).forEach(sr => {
    if (sr.rating.toLowerCase() === 'proficient') {
      medium.add(sr.skill_name.toLowerCase());
    }
  });
  return medium;
}

// ─── Cosine Similarity ───

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// =============================================================================
// MAIN ENGINE
// =============================================================================

export async function getBookRecommendations(
  childId: string,
  limit: number = 5
): Promise<BookRecommendation[]> {
  // Check cache first
  const cached = getCached(childId);
  if (cached) return cached.slice(0, limit);

  try {
    // ── Fetch child profile ──
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age, overall_reading_level, learning_profile, areas_to_improve, latest_assessment_score, assessment_wpm, learning_needs')
      .eq('id', childId)
      .single();

    if (!child) return [];

    const childProfile: ChildProfile = {
      ...child,
      reading_level: child.overall_reading_level,
    };

    // ── Fetch intelligence profile (if exists) ──
    const { data: intellProfile } = await supabase
      .from('child_intelligence_profiles')
      .select('skill_ratings, overall_reading_level')
      .eq('child_id', childId)
      .order('last_synthesized_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const skillRatings: SkillRating[] = intellProfile?.skill_ratings
      ? parseSkillRatings(intellProfile.skill_ratings)
      : [];

    // Use intelligence profile reading level if child doesn't have one
    const effectiveReadingLevel = childProfile.reading_level
      || intellProfile?.overall_reading_level
      || null;

    const age = childProfile.age || 6;

    // ── Layer 1: Filter Pool ──
    const { data: allBooks } = await supabase
      .from('books')
      .select('id, title, author, slug, cover_image_url, reading_level, age_min, age_max, skills_targeted, genres, vote_count, rucha_review, is_available_for_kahani_times, is_featured, embedding')
      .eq('is_active', true)
      .lte('age_min', age + 1)
      .gte('age_max', age - 1)
      .order('vote_count', { ascending: false, nullsFirst: false })
      .limit(200);

    if (!allBooks || allBooks.length === 0) return [];

    // Filter by reading level (±1 level)
    let candidates = allBooks.filter((b: Record<string, unknown>) =>
      isLevelWithinRange(b.reading_level as string | null, effectiveReadingLevel)
    ) as BookCandidate[];

    // If too few results, use all age-matched books
    if (candidates.length < 5) {
      candidates = allBooks as BookCandidate[];
    }

    // Exclude books already read
    const readTitles = await getChildReadBookTitles(childId);
    candidates = candidates.filter(b => !readTitles.has(b.title.toLowerCase()));

    if (candidates.length === 0) return [];

    // ── Layer 2: Skill Gap Matching ──
    const weakSkills = getWeakSkills(childProfile.areas_to_improve, skillRatings);
    const mediumSkills = getMediumSkills(skillRatings);

    const scored: { book: BookCandidate; score: number; matchedSkills: string[] }[] = candidates.map(book => {
      let score = 0;
      const matchedSkills: string[] = [];
      const bookSkills = (book.skills_targeted || []).map(s => s.toLowerCase());

      for (const skill of bookSkills) {
        // Check each word of the skill against weakness sets
        const skillWords = skill.split(/[\s,]+/);
        const isWeak = skillWords.some(w => weakSkills.has(w)) || weakSkills.has(skill);
        const isMedium = skillWords.some(w => mediumSkills.has(w)) || mediumSkills.has(skill);

        if (isWeak) {
          score += 3;
          matchedSkills.push(skill);
        } else if (isMedium) {
          score += 1;
        } else {
          score += 0.5;
        }
      }

      // Bonus for featured books
      if (book.is_featured) score += 1;

      // Bonus for Rucha review
      if (book.rucha_review) score += 0.5;

      // Small bonus for popularity
      score += Math.min(1, (book.vote_count || 0) / 20);

      return { book, score, matchedSkills };
    });

    // ── Layer 3: Semantic Similarity (Vector) ──
    const childEmbedding = await getChildAverageEmbedding(childId);
    if (childEmbedding) {
      for (const item of scored) {
        if (item.book.embedding) {
          try {
            const bookEmb = typeof item.book.embedding === 'string'
              ? JSON.parse(item.book.embedding)
              : item.book.embedding;
            if (Array.isArray(bookEmb) && bookEmb.length === 768) {
              const similarity = cosineSimilarity(childEmbedding, bookEmb);
              // Boost 0-2 points based on similarity
              item.score += similarity * 2;
            }
          } catch {
            // Skip invalid embedding
          }
        }
      }
    }

    // Sort by score desc, take top N
    scored.sort((a, b) => b.score - a.score);
    const topBooks = scored.slice(0, limit);

    // ── Generate Reasons ──
    const recommendations: BookRecommendation[] = await Promise.all(
      topBooks.map(async ({ book, score, matchedSkills }) => {
        const reason = await generateReason(book, childProfile, matchedSkills, effectiveReadingLevel);
        // Strip embedding from output
        const { embedding: _emb, ...bookWithoutEmbedding } = book;
        return {
          book: bookWithoutEmbedding as BookCandidate,
          reason,
          relevance_score: Math.round(score * 10) / 10,
        };
      })
    );

    setCache(childId, recommendations);
    return recommendations;
  } catch (error) {
    console.error('[BOOK_RECO] Engine error:', error);
    return fallbackRecommendations(childId, limit);
  }
}

// =============================================================================
// LAYER 3 HELPER: Average embedding from child's learning events
// =============================================================================

async function getChildAverageEmbedding(childId: string): Promise<number[] | null> {
  const { data: events } = await supabase
    .from('learning_events')
    .select('embedding')
    .eq('child_id', childId)
    .not('embedding', 'is', null)
    .order('event_date', { ascending: false })
    .limit(20);

  if (!events || events.length < 3) return null; // Not enough data

  const vectors: number[][] = [];
  for (const evt of events) {
    try {
      const emb = typeof evt.embedding === 'string' ? JSON.parse(evt.embedding) : evt.embedding;
      if (Array.isArray(emb) && emb.length === 768) {
        vectors.push(emb);
      }
    } catch {
      // Skip invalid
    }
  }

  if (vectors.length < 3) return null;

  // Compute element-wise average
  const avg = new Array(768).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < 768; i++) {
      avg[i] += vec[i];
    }
  }
  for (let i = 0; i < 768; i++) {
    avg[i] /= vectors.length;
  }

  return avg;
}

// =============================================================================
// REASON GENERATION
// =============================================================================

async function generateReason(
  book: BookCandidate,
  child: ChildProfile,
  matchedSkills: string[],
  readingLevel: string | null
): Promise<string> {
  // Try structured reason first
  const structuredReason = buildStructuredReason(book, child, matchedSkills, readingLevel);
  if (structuredReason) return structuredReason;

  // Fall back to Gemini for reason
  try {
    return await generateGeminiReason(book, child);
  } catch {
    return book.rucha_review
      ? 'Expert pick'
      : 'Popular with similar age group';
  }
}

function buildStructuredReason(
  book: BookCandidate,
  child: ChildProfile,
  matchedSkills: string[],
  readingLevel: string | null
): string | null {
  const name = child.child_name || 'your child';

  // Matched weak skills — most specific reason
  if (matchedSkills.length > 0) {
    const skillLabel = matchedSkills.slice(0, 2).join(' & ');
    const score = child.latest_assessment_score;
    if (score != null && score < 6) {
      return `Builds ${skillLabel} — ${name}'s assessment showed room for growth here`;
    }
    return `Targets ${skillLabel} — a great match for ${name}'s learning goals`;
  }

  // Reading level match
  if (readingLevel && book.reading_level) {
    return `Matches ${name}'s current reading level (${readingLevel})`;
  }

  // Rucha review
  if (book.rucha_review) {
    return `Expert pick — ${book.rucha_review.slice(0, 60)}${book.rucha_review.length > 60 ? '...' : ''}`;
  }

  // Featured
  if (book.is_featured) {
    return `Featured pick for ages ${book.age_min}-${book.age_max}`;
  }

  return null; // Fall to Gemini
}

async function generateGeminiReason(book: BookCandidate, child: ChildProfile): Promise<string> {
  const model = getGenAI().getGenerativeModel({ model: getGeminiModel('content_generation') });

  const prompt = `In one sentence, explain why this book is a good fit for this child's reading development. Be specific about the skill it targets.

CHILD DATA (use ONLY this data, do not invent any scores or observations):
- Name: ${child.child_name || 'Unknown'}
- Age: ${child.age || 'Unknown'}
- Reading level: ${child.reading_level || 'Not assessed'}
- Assessment score: ${child.latest_assessment_score != null ? `${child.latest_assessment_score}/10` : 'Not available'}
- Reading speed: ${child.assessment_wpm != null ? `${child.assessment_wpm} WPM` : 'Not measured'}
- Areas to improve: ${(child.areas_to_improve || []).join(', ') || 'None identified'}

BOOK DATA:
- Title: ${book.title}
- Author: ${book.author}
- Skills: ${(book.skills_targeted || []).join(', ') || 'General reading'}
- Level: ${book.reading_level || 'Not specified'}
- Ages: ${book.age_min}-${book.age_max}

RULES:
- ONLY reference data provided above
- Do NOT invent scores, observations, or data not listed
- Keep to exactly one sentence
- Start with the skill or benefit, not the child's name

Return ONLY the one-sentence reason, nothing else.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  // Sanitize — max 120 chars, remove quotes
  return text.replace(/^["']|["']$/g, '').slice(0, 120);
}

// =============================================================================
// FALLBACK: Age + popularity when no assessment data
// =============================================================================

async function fallbackRecommendations(
  childId: string,
  limit: number
): Promise<BookRecommendation[]> {
  const { data: child } = await supabase
    .from('children')
    .select('age')
    .eq('id', childId)
    .single();

  const age = child?.age || 6;

  const { data: books } = await supabase
    .from('books')
    .select('id, title, author, slug, cover_image_url, reading_level, age_min, age_max, skills_targeted, genres, vote_count, rucha_review, is_available_for_kahani_times, is_featured')
    .eq('is_active', true)
    .lte('age_min', age + 1)
    .gte('age_max', age - 1)
    .order('is_featured', { ascending: false, nullsFirst: false })
    .order('vote_count', { ascending: false, nullsFirst: false })
    .limit(limit);

  return (books || []).map((book: Record<string, unknown>) => ({
    book: book as unknown as BookCandidate,
    reason: 'Popular with similar age group',
    relevance_score: (book.vote_count as number || 0) / 10,
  }));
}

// =============================================================================
// HELPERS
// =============================================================================

function parseSkillRatings(raw: unknown): SkillRating[] {
  if (!raw || typeof raw !== 'object') return [];

  // Handle both array and object formats
  if (Array.isArray(raw)) {
    return raw.filter((r: Record<string, unknown>) => r.skill_name && r.rating).map((r: Record<string, unknown>) => ({
      skill_name: String(r.skill_name),
      rating: String(r.rating),
      confidence: String(r.confidence || 'medium'),
    }));
  }

  // Object format: { "Phonics": { rating: "proficient", ... } }
  return Object.entries(raw as Record<string, unknown>).map(([key, val]) => {
    const v = val as Record<string, unknown> | null;
    return {
      skill_name: (v?.skill_name as string) || key,
      rating: (v?.rating as string) || 'developing',
      confidence: (v?.confidence as string) || 'medium',
    };
  });
}
