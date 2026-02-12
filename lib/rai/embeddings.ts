// file: lib/rai/embeddings.ts
// rAI v2.0 - Embedding generation utilities

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generate embedding vector for text using Google's gemini-embedding-001
 * Returns 768-dimensional vector (via outputDimensionality)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    const result = await model.embedContent({
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    } as any);
    return result.embedding.values;
  } catch (error) {
    console.error('Embedding generation error:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Build searchable content string for learning events
 * Optimized for semantic search relevance
 */
export function buildSearchableContent(
  eventType: string,
  childName: string,
  data: Record<string, unknown>,
  aiSummary?: string
): string {
  const parts: string[] = [];
  
  parts.push(`${childName}`);
  parts.push(`${eventType} event`);
  
  switch (eventType) {
    case 'assessment':
      parts.push(`reading assessment`);
      if (data.score) parts.push(`score: ${data.score}/10`);
      if (data.wpm) parts.push(`reading speed: ${data.wpm} words per minute`);
      if (data.fluency) parts.push(`fluency: ${data.fluency}`);
      if (data.pronunciation) parts.push(`pronunciation: ${data.pronunciation}`);
      if (data.feedback) parts.push(String(data.feedback));
      if (Array.isArray(data.errors) && data.errors.length) parts.push(`errors: ${data.errors.join(', ')}`);
      break;
      
    case 'session':
      parts.push(`coaching session`);
      if (data.focus_area) parts.push(`focus: ${data.focus_area}`);
      if (Array.isArray(data.skills_worked_on) && data.skills_worked_on.length) {
        parts.push(`skills: ${data.skills_worked_on.join(', ')}`);
      }
      if (data.progress_rating) parts.push(`progress: ${data.progress_rating}`);
      if (data.engagement_level) parts.push(`engagement: ${data.engagement_level}`);
      if (data.breakthrough_moment) parts.push(`breakthrough: ${data.breakthrough_moment}`);
      if (data.concerns_noted) parts.push(`concerns: ${data.concerns_noted}`);
      if (data.homework_assigned && data.homework_description) {
        parts.push(`homework: ${data.homework_description}`);
      }
      if (Array.isArray(data.key_observations) && data.key_observations.length) {
        parts.push(`observations: ${data.key_observations.join(', ')}`);
      }
      if (data.coach_talk_ratio) {
        parts.push(`coach talk ratio: ${data.coach_talk_ratio}%`);
      }
      if (Array.isArray(data.child_reading_samples) && data.child_reading_samples.length) {
        parts.push(`reading samples: ${data.child_reading_samples.join(', ')}`);
      }
      break;
      
    case 'quiz':
      parts.push(`quiz`);
      if (data.topic) parts.push(`topic: ${data.topic}`);
      if (data.score !== undefined && data.total) {
        parts.push(`score: ${data.score}/${data.total}`);
      }
      break;
      
    case 'milestone':
      parts.push(`milestone achievement`);
      if (data.title) parts.push(String(data.title));
      if (data.description) parts.push(String(data.description));
      break;
      
    case 'note':
      if (data.content || data.note) {
        parts.push(String(data.content || data.note));
      }
      break;
      
    default:
      Object.values(data).forEach(value => {
        if (typeof value === 'string' && value.length > 0) {
          parts.push(value);
        }
      });
  }
  
  if (aiSummary) {
    parts.push(aiSummary);
  }
  
  return parts.join(' ').trim();
}

/**
 * Build searchable content specifically for session events
 */
export function buildSessionSearchableContent(
  childName: string,
  analysis: {
    session_type?: string;
    focus_area?: string;
    skills_worked_on?: string[];
    progress_rating?: string;
    engagement_level?: string;
    breakthrough_moment?: string;
    concerns_noted?: string;
    homework_assigned?: boolean;
    homework_description?: string;
    next_session_focus?: string;
    key_observations?: string[];
    coach_talk_ratio?: number;
    child_reading_samples?: string[];
    summary?: string;
  }
): string {
  const parts: string[] = [
    `${childName} coaching session`,
    `Focus: ${analysis.focus_area || 'general reading'}`,
  ];
  
  if (analysis.skills_worked_on?.length) {
    parts.push(`Skills: ${analysis.skills_worked_on.join(', ')}`);
  }
  
  if (analysis.progress_rating) {
    parts.push(`Progress: ${analysis.progress_rating}`);
  }
  
  if (analysis.engagement_level) {
    parts.push(`Engagement: ${analysis.engagement_level}`);
  }
  
  if (analysis.coach_talk_ratio) {
    parts.push(`Coach talk ratio: ${analysis.coach_talk_ratio}%`);
  }
  
  if (analysis.breakthrough_moment) {
    parts.push(`Breakthrough: ${analysis.breakthrough_moment}`);
  }
  
  if (analysis.concerns_noted) {
    parts.push(`Concerns: ${analysis.concerns_noted}`);
  }
  
  if (analysis.homework_assigned && analysis.homework_description) {
    parts.push(`Homework: ${analysis.homework_description}`);
  }
  
  if (analysis.next_session_focus) {
    parts.push(`Next session: ${analysis.next_session_focus}`);
  }
  
  if (analysis.child_reading_samples?.length) {
    parts.push(`Reading samples: ${analysis.child_reading_samples.join(', ')}`);
  }
  
  if (analysis.key_observations?.length) {
    parts.push(`Observations: ${analysis.key_observations.join(', ')}`);
  }
  
  if (analysis.summary) {
    parts.push(analysis.summary);
  }

  return parts.join(' ').trim();
}

/**
 * Content unit type for embedding text generation
 */
export interface ContentUnitForEmbedding {
  name: string;
  description?: string | null;
  tags?: string[] | null;
  coach_guidance?: {
    key_concepts?: string[];
    red_flags?: string[];
    warm_up?: string;
    wrap_up?: string;
    [key: string]: unknown;
  } | null;
  parent_instruction?: string | null;
  arc_stage?: string | null;
  content_code?: string | null;
  difficulty?: string | null;
  quest_title?: string | null;
  quest_description?: string | null;
  skill_name?: string;
}

/**
 * Build searchable text for a content unit (el_learning_units)
 * Optimized for matching coach queries like:
 * - "child struggles with passive voice"
 * - "need phonics blending activity"
 * - "fun grammar game for 7 year old"
 */
export function buildContentSearchableText(unit: ContentUnitForEmbedding): string {
  const parts: string[] = [];

  // Core identity
  parts.push(unit.name);
  if (unit.content_code) parts.push(`code: ${unit.content_code}`);
  if (unit.skill_name) parts.push(`skill: ${unit.skill_name}`);

  // Description
  if (unit.description) parts.push(unit.description);

  // Arc stage context
  if (unit.arc_stage) {
    const stageLabels: Record<string, string> = {
      assess: 'assessment and diagnostic',
      remediate: 'remediation and practice',
      celebrate: 'celebration and mastery',
    };
    parts.push(`stage: ${stageLabels[unit.arc_stage] || unit.arc_stage}`);
  }

  // Difficulty
  if (unit.difficulty) parts.push(`difficulty: ${unit.difficulty}`);

  // Tags — high semantic value
  if (unit.tags?.length) {
    parts.push(`topics: ${unit.tags.join(', ')}`);
  }

  // Coach guidance — rich pedagogical content
  if (unit.coach_guidance) {
    const g = unit.coach_guidance;
    if (g.key_concepts?.length) {
      parts.push(`key concepts: ${g.key_concepts.join(', ')}`);
    }
    if (g.red_flags?.length) {
      parts.push(`watch for: ${g.red_flags.join(', ')}`);
    }
    if (g.warm_up) parts.push(`warm up: ${g.warm_up}`);
    if (g.wrap_up) parts.push(`wrap up: ${g.wrap_up}`);
  }

  // Parent instruction
  if (unit.parent_instruction) {
    parts.push(`parent guidance: ${unit.parent_instruction}`);
  }

  // Quest context
  if (unit.quest_title) parts.push(`quest: ${unit.quest_title}`);
  if (unit.quest_description) parts.push(unit.quest_description);

  return parts.join(' ').trim();
}
