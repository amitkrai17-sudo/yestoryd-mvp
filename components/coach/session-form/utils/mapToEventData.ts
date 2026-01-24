// =============================================================================
// FILE: components/coach/session-form/utils/mapToEventData.ts
// PURPOSE: Data mapping utilities for learning_events
// CRITICAL: This is the single source of truth for rAI queries
// =============================================================================

import {
  SessionFormState,
  LearningEventData,
  ChildSessionSummary,
  FocusAreaKey,
} from '../types';
import { FOCUS_AREAS } from '../constants';

/**
 * Maps form state to learning_events.event_data JSONB
 * CRITICAL: This is the single source of truth for rAI
 */
export function mapFormToEventData(
  formState: SessionFormState,
  sessionId: string,
  sessionNumber: number,
  sessionType: 'coaching' | 'parent_checkin' | 'skill_booster' = 'coaching'
): LearningEventData {
  if (!formState.primaryFocus || !formState.overallRating) {
    throw new Error('Required form fields missing: primaryFocus and overallRating are required');
  }

  return {
    // Core identifiers
    session_id: sessionId,
    session_number: sessionNumber,
    session_type: sessionType,

    // Ratings (Step 1)
    overall_rating: formState.overallRating,
    focus_area: formState.primaryFocus,

    // Skills & Progress (Step 2)
    skills_worked_on: formState.skillsPracticed,
    progress_rating: formState.focusProgress!,
    engagement_level: formState.engagementLevel!,
    highlights: formState.highlights,
    challenges: formState.challenges,

    // Planning (Step 3)
    next_session_focus: formState.nextSessionFocus!,
    next_session_activities: formState.nextSessionActivities,
    homework_assigned: formState.homeworkAssigned,
    homework_items: formState.homeworkItems,
    parent_update_needed: formState.parentUpdateNeeded,
    parent_update_type: formState.parentUpdateType,

    // Meta
    coach_notes: formState.additionalNotes,
    completed_at: new Date().toISOString(),
    form_version: '2.0',
  };
}

/**
 * Maps form state to children.last_session_summary (cached for quick parent queries)
 */
export function mapFormToChildSummary(
  formState: SessionFormState
): ChildSessionSummary {
  if (!formState.primaryFocus) {
    throw new Error('primaryFocus is required for child summary');
  }

  return {
    date: new Date().toISOString(),
    focus: FOCUS_AREAS[formState.primaryFocus].label,
    progress: formState.focusProgress || 'improved',
    highlights: formState.highlights,
    next_focus: formState.nextSessionFocus || '',
    homework: formState.homeworkItems,
  };
}

/**
 * Builds searchable content for embedding (RAG)
 * This text will be embedded for semantic search by rAI
 */
export function buildContentForEmbedding(
  formState: SessionFormState,
  childName: string
): string {
  if (!formState.primaryFocus) {
    throw new Error('primaryFocus is required for embedding content');
  }

  const focusLabel = FOCUS_AREAS[formState.primaryFocus].label;

  const parts: string[] = [
    `${childName} coaching session`,
    `Focus: ${focusLabel}`,
  ];

  if (formState.skillsPracticed.length > 0) {
    parts.push(`Skills: ${formState.skillsPracticed.join(', ')}`);
  }

  if (formState.focusProgress) {
    parts.push(`Progress: ${formState.focusProgress.replace('_', ' ')}`);
  }

  if (formState.engagementLevel) {
    parts.push(`Engagement: ${formState.engagementLevel}`);
  }

  if (formState.highlights.length > 0) {
    parts.push(`Highlights: ${formState.highlights.join(', ')}`);
  }

  if (formState.challenges.length > 0) {
    parts.push(`Challenges: ${formState.challenges.join(', ')}`);
  }

  if (formState.nextSessionFocus) {
    parts.push(`Next session: ${formState.nextSessionFocus}`);
  }

  if (formState.homeworkAssigned && formState.homeworkItems.length > 0) {
    parts.push(`Homework: ${formState.homeworkItems.join(', ')}`);
  }

  if (formState.additionalNotes) {
    parts.push(`Notes: ${formState.additionalNotes}`);
  }

  return parts.join('\n').trim();
}

/**
 * Validates that form state is complete enough for submission
 */
export function validateFormState(formState: SessionFormState): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Step 1 validation
  if (!formState.overallRating) {
    errors.push('Overall rating is required');
  }
  if (!formState.primaryFocus) {
    errors.push('Primary focus area is required');
  }

  // Step 2 validation
  if (formState.skillsPracticed.length === 0) {
    errors.push('At least one skill must be selected');
  }
  if (formState.highlights.length === 0) {
    errors.push('At least one highlight is required');
  }
  if (!formState.focusProgress) {
    errors.push('Progress rating is required');
  }
  if (!formState.engagementLevel) {
    errors.push('Engagement level is required');
  }

  // Step 3 validation
  if (!formState.nextSessionFocus) {
    errors.push('Next session focus is required');
  }
  if (formState.homeworkAssigned && formState.homeworkItems.length === 0) {
    errors.push('Homework items are required when homework is assigned');
  }
  if (formState.parentUpdateNeeded && !formState.parentUpdateType) {
    errors.push('Parent update type is required when update is needed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Gets the focus area label from key
 */
export function getFocusAreaLabel(key: FocusAreaKey): string {
  return FOCUS_AREAS[key]?.label || key;
}

/**
 * Converts progress level to human-readable text
 */
export function getProgressLabel(progress: string): string {
  const labels: Record<string, string> = {
    breakthrough: 'Breakthrough!',
    significant_improvement: 'Great Progress',
    improved: 'Good Progress',
    same: 'Steady',
    declined: 'Needs Attention',
  };
  return labels[progress] || progress;
}

/**
 * Converts engagement level to human-readable text
 */
export function getEngagementLabel(engagement: string): string {
  const labels: Record<string, string> = {
    high: 'Highly Engaged',
    medium: 'Moderately Engaged',
    low: 'Low Engagement',
  };
  return labels[engagement] || engagement;
}
