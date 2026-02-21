// file: lib/rai/hybrid-search.ts
// rAI v2.0 - Hybrid search combining SQL filters with vector similarity

import { generateEmbedding } from './embeddings';
import { extractQueryFilters } from './query-filters';
import { LearningEvent, UserRole } from './types';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

interface HybridSearchOptions {
  query: string;
  childId?: string | null;
  coachId?: string | null;
  userRole: UserRole;
  limit?: number;
  threshold?: number;
}

interface HybridSearchResult {
  events: LearningEvent[];
  filters: {
    dateRange?: { from: Date; to: Date };
    eventType?: string;
    keywords: string[];
  };
  debug: {
    queryEmbeddingGenerated: boolean;
    eventsFound: number;
    filtersApplied: string[];
  };
}

export async function hybridSearch(
  options: HybridSearchOptions
): Promise<HybridSearchResult> {
  const {
    query,
    childId,
    coachId,
    userRole,
    limit = 15,
    threshold = 0.4,
  } = options;

  const debug = {
    queryEmbeddingGenerated: false,
    eventsFound: 0,
    filtersApplied: [] as string[],
  };

  const filters = extractQueryFilters(query);
  
  if (filters.dateRange) {
    debug.filtersApplied.push(`date: ${filters.dateRange.from.toISOString().split('T')[0]} to ${filters.dateRange.to.toISOString().split('T')[0]}`);
  }
  if (filters.eventType) {
    debug.filtersApplied.push(`type: ${filters.eventType}`);
  }
  if (filters.keywords.length > 0) {
    debug.filtersApplied.push(`keywords: ${filters.keywords.join(', ')}`);
  }

  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(query);
    debug.queryEmbeddingGenerated = true;
  } catch (error) {
    console.error('Failed to generate query embedding:', error);
    return fallbackSearch(options, filters, debug);
  }

  try {
    const { data: events, error } = await supabase.rpc('hybrid_match_learning_events', {
      query_embedding: JSON.stringify(queryEmbedding),
      filter_child_id: childId || undefined,
      filter_coach_id: userRole === 'coach' ? (coachId || undefined) : undefined,
      filter_date_from: filters.dateRange?.from?.toISOString() || undefined,
      filter_date_to: filters.dateRange?.to?.toISOString() || undefined,
      filter_event_type: filters.eventType || undefined,
      filter_keywords: filters.keywords.length > 0 ? filters.keywords : undefined,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error('Hybrid search RPC error:', error);
      return fallbackSearch(options, filters, debug);
    }

    debug.eventsFound = events?.length || 0;

    return {
      events: (events || []) as LearningEvent[],
      filters,
      debug,
    };
    
  } catch (error) {
    console.error('Hybrid search error:', error);
    return fallbackSearch(options, filters, debug);
  }
}

async function fallbackSearch(
  options: HybridSearchOptions,
  filters: ReturnType<typeof extractQueryFilters>,
  debug: { queryEmbeddingGenerated: boolean; eventsFound: number; filtersApplied: string[] }
): Promise<HybridSearchResult> {
  const { childId, coachId, userRole, limit = 15 } = options;

  let query = supabase
    .from('learning_events')
    .select('*')
    .order('event_date', { ascending: false })
    .limit(limit);

  if (childId) {
    query = query.eq('child_id', childId);
  }
  if (userRole === 'coach' && coachId) {
    query = query.eq('coach_id', coachId);
  }
  if (filters.dateRange) {
    query = query.gte('event_date', filters.dateRange.from.toISOString());
    query = query.lte('event_date', filters.dateRange.to.toISOString());
  }
  if (filters.eventType) {
    query = query.eq('event_type', filters.eventType);
  }

  const { data: events, error } = await query;

  if (error) {
    console.error('Fallback search error:', error);
    return { events: [], filters, debug };
  }

  debug.eventsFound = events?.length || 0;
  debug.filtersApplied.push('fallback: SQL only');

  return {
    events: (events || []) as LearningEvent[],
    filters,
    debug,
  };
}

export async function getSessionCache(childId: string): Promise<{
  summary: string | null;
  date: Date | null;
  focus: string | null;
  isFresh: boolean;
}> {
  const { data: child, error } = await supabase
    .from('children')
    .select('last_session_summary, last_session_date, last_session_focus')
    .eq('id', childId)
    .single();

  if (error || !child) {
    return { summary: null, date: null, focus: null, isFresh: false };
  }

  const summary = child.last_session_summary as string | null;
  const date = child.last_session_date ? new Date(child.last_session_date as string) : null;
  const focus = child.last_session_focus as string | null;

  let isFresh = false;
  if (date) {
    const hoursSince = (Date.now() - date.getTime()) / (1000 * 60 * 60);
    isFresh = hoursSince < 24;
  }

  return { summary, date, focus, isFresh };
}

export function formatCachedSummary(
  summary: string,
  date: Date,
  childName: string
): string {
  const timeAgo = formatTimeAgo(date);
  return `Here's what happened in ${childName}'s session ${timeAgo}:\n\n${summary}`;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    return 'just now';
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });
  }
}

// --- Content Unit Search ---

export interface ContentUnitMatch {
  id: string;
  name: string;
  content_code: string | null;
  description: string | null;
  skill_name: string | null;
  arc_stage: string | null;
  min_age: number | null;
  max_age: number | null;
  difficulty: string | null;
  tags: string[] | null;
  coach_guidance: Record<string, unknown> | null;
  parent_instruction: string | null;
  video_count: number;
  worksheet_count: number;
  similarity: number;
}

interface ContentSearchOptions {
  query: string;
  childAge?: number | null;
  skillId?: string | null;
  arcStage?: string | null;
  tags?: string[] | null;
  limit?: number;
  threshold?: number;
}

/**
 * Search content units by semantic similarity
 * Used by rAI to recommend specific learning activities
 */
export async function searchContentUnits(
  options: ContentSearchOptions
): Promise<ContentUnitMatch[]> {
  const { query, childAge, skillId, arcStage, tags, limit = 5, threshold = 0.3 } = options;

  try {
    const queryEmbedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc('match_content_units', {
      query_embedding: JSON.stringify(queryEmbedding),
      filter_skill_id: skillId || undefined,
      filter_min_age: childAge || undefined,
      filter_max_age: childAge || undefined,
      filter_arc_stage: arcStage || undefined,
      filter_tags: tags?.length ? tags : undefined,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error('Content search RPC error:', error);
      return [];
    }

    return (data || []) as ContentUnitMatch[];
  } catch (error) {
    console.error('Content search error:', error);
    return [];
  }
}

/**
 * Format content unit matches for inclusion in Gemini prompts
 */
export function formatContentUnitsForContext(units: ContentUnitMatch[]): string {
  if (!units || units.length === 0) return '';

  const formatted = units.map((u, i) => {
    const parts = [
      `[${i + 1}] ${u.name}${u.content_code ? ` (${u.content_code})` : ''}`,
    ];
    if (u.skill_name) parts.push(`   Skill: ${u.skill_name}`);
    if (u.description) parts.push(`   ${u.description}`);
    if (u.arc_stage) parts.push(`   Stage: ${u.arc_stage}`);
    if (u.difficulty) parts.push(`   Difficulty: ${u.difficulty}`);
    if (u.tags?.length) parts.push(`   Tags: ${u.tags.join(', ')}`);
    if (u.coach_guidance) {
      const g = u.coach_guidance as Record<string, unknown>;
      if (Array.isArray(g.key_concepts) && g.key_concepts.length) {
        parts.push(`   Key concepts: ${g.key_concepts.join(', ')}`);
      }
    }
    const assets: string[] = [];
    if (u.video_count > 0) assets.push(`${u.video_count} video${u.video_count > 1 ? 's' : ''}`);
    if (u.worksheet_count > 0) assets.push(`${u.worksheet_count} worksheet${u.worksheet_count > 1 ? 's' : ''}`);
    if (assets.length) parts.push(`   Assets: ${assets.join(', ')}`);
    parts.push(`   Match: ${(u.similarity * 100).toFixed(0)}%`);
    return parts.join('\n');
  });

  return `RECOMMENDED CONTENT UNITS FROM LIBRARY:\n${formatted.join('\n\n')}`;
}

export function formatEventsForContext(events: LearningEvent[]): string {
  if (!events || events.length === 0) {
    return 'No learning events found.';
  }

  const formatted = events.map((event, index) => {
    const date = new Date(event.event_date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    
    const data = event.event_data || {};
    let details = '';

    switch (event.event_type) {
      case 'assessment':
        details = `Score: ${data.score || data.reading_score || 'N/A'}/10, WPM: ${data.wpm || 'N/A'}, Fluency: ${data.fluency || data.fluency_rating || 'N/A'}`;
        break;
        
      case 'session':
        details = `Focus: ${data.focus_area || 'General'}, Progress: ${data.progress_rating || 'N/A'}, Engagement: ${data.engagement_level || 'N/A'}`;
        if (data.breakthrough_moment) {
          details += `, Breakthrough: ${data.breakthrough_moment}`;
        }
        if (data.homework_assigned && data.homework_description) {
          details += `, Homework: ${data.homework_description}`;
        }
        break;
        
      case 'quiz':
        details = `Topic: ${data.topic || 'Reading'}, Score: ${data.score || 0}/${data.total || 10}`;
        break;
        
      case 'milestone':
        details = `${data.title || data.milestone || 'Achievement'}: ${data.description || ''}`;
        break;
        
      default:
        details = event.ai_summary || 'No details';
    }

    return `[${index + 1}] ${event.event_type.toUpperCase()} (${date}): ${details}${event.ai_summary ? `\n    Summary: ${event.ai_summary}` : ''}`;
  });

  return formatted.join('\n\n');
}
