// file: lib/rai/embeddings.ts
// rAI v2.0 - Embedding generation utilities

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generate embedding vector for text using Google's text-embedding-004
 * Returns 768-dimensional vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
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
  data: Record<string, any>,
  aiSummary?: string
): string {
  const parts: string[] = [];
  
  // Add child name for personalization
  parts.push(`${childName}`);
  
  // Add event type context
  parts.push(`${eventType} event`);
  
  // Add structured data based on event type
  switch (eventType) {
    case 'assessment':
      parts.push(`reading assessment`);
      if (data.score) parts.push(`score: ${data.score}/10`);
      if (data.wpm) parts.push(`reading speed: ${data.wpm} words per minute`);
      if (data.fluency) parts.push(`fluency: ${data.fluency}`);
      if (data.pronunciation) parts.push(`pronunciation: ${data.pronunciation}`);
      if (data.feedback) parts.push(data.feedback);
      if (data.errors?.length) parts.push(`errors: ${data.errors.join(', ')}`);
      break;
      
    case 'session':
      parts.push(`coaching session`);
      if (data.focus_area) parts.push(`focus: ${data.focus_area}`);
      if (data.skills_worked_on?.length) {
        parts.push(`skills: ${data.skills_worked_on.join(', ')}`);
      }
      if (data.progress_rating) parts.push(`progress: ${data.progress_rating}`);
      if (data.engagement_level) parts.push(`engagement: ${data.engagement_level}`);
      if (data.breakthrough_moment) parts.push(`breakthrough: ${data.breakthrough_moment}`);
      if (data.concerns_noted) parts.push(`concerns: ${data.concerns_noted}`);
      if (data.homework_assigned && data.homework_description) {
        parts.push(`homework: ${data.homework_description}`);
      }
      if (data.key_observations?.length) {
        parts.push(`observations: ${data.key_observations.join(', ')}`);
      }
      if (data.coach_talk_ratio) {
        parts.push(`coach talk ratio: ${data.coach_talk_ratio}%`);
      }
      if (data.child_reading_samples?.length) {
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
      if (data.title) parts.push(data.title);
      if (data.description) parts.push(data.description);
      break;
      
    case 'note':
      if (data.content || data.note) {
        parts.push(data.content || data.note);
      }
      break;
      
    default:
      // Add any string values from data
      Object.values(data).forEach(value => {
        if (typeof value === 'string' && value.length > 0) {
          parts.push(value);
        }
      });
  }
  
  // Add AI summary if available
  if (aiSummary) {
    parts.push(aiSummary);
  }
  
  return parts.join(' ').trim();
}

/**
 * Build searchable content specifically for session events
 * Enhanced version with all analysis fields
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
