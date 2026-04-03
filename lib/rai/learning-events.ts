// file: lib/rai/learning-events.ts
// SINGLE SOURCE OF TRUTH for all learning_events inserts.
// Every insert goes through this function — embedding is ALWAYS generated.
// Created March 2026 to fix 6 silent embedding-missing inserts found in RAG audit.

import { createAdminClient } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/rai/embeddings';
import type { Json } from '@/lib/database.types';

// Must match the CHECK constraint on learning_events.event_type
export type LearningEventType =
  | 'session' | 'session_completed' | 'session_cancelled' | 'session_rescheduled' | 'session_missed'
  | 'assessment' | 'diagnostic_assessment'
  | 'structured_capture'
  | 'elearning' | 'video' | 'quiz' | 'badge' | 'streak' | 'level_up' | 'unit_completed'
  | 'group_class_observation' | 'group_class_response' | 'group_class_verbal'
  | 'group_class_quiz' | 'group_class_micro_insight' | 'group_class_parent_feedback'
  | 'parent_inquiry' | 'parent_session_summary' | 'parent_feedback' | 'parent_practice_observation'
  | 'daily_recommendations' | 'progress_pulse' | 'breakthrough' | 'milestone'
  | 'whatsapp_lead' | 'lead_conversation' | 'discovery_notes' | 'nps_feedback'
  | 'micro_assessment' | 'session_companion_log' | 'activity_struggle_flag' | 'parent_practice_assigned'
  | 'reading_log' | 'child_artifact' | 'exit_assessment' | 'mini_challenge_completed'
  | 'elearning_interaction' | 'session_feedback' | 'season_completion'
  | 'practice_completed'
  | 'note' | 'handwritten'; // generic types used by learning-events API

export type SignalSource =
  | 'transcript_analysis' | 'structured_capture' | 'structured_capture_audio'
  | 'companion_panel' | 'instructor_observation' | 'child_artifact'
  | 'micro_assessment' | 'diagnostic_assessment' | 'parent_observation'
  | 'parent_chat' | 'parent_whatsapp' | 'system_generated' | 'coach_form' | 'tuition_completion'
  | 'elearning_system' | 'elearning' | 'whatsapp_webhook' | 'nps_survey' | 'discovery_call'
  | 'group_class' | 'unknown';

export type SessionModality =
  | 'online' | 'online_1on1' | 'in_person' | 'tuition'
  | 'hybrid' | 'group_class' | 'practice' | 'assessment' | 'elearning'
  | 'online_group' | null;

export type SignalConfidence = 'high' | 'medium' | 'low';

interface InsertLearningEventParams {
  childId: string;
  eventType: LearningEventType;
  eventData: Record<string, unknown>;
  contentForEmbedding: string;
  sessionId?: string | null;
  coachId?: string | null;
  signalSource: SignalSource;
  signalConfidence: SignalConfidence;
  sessionModality?: SessionModality;
  eventDate?: string; // ISO string, defaults to now
  // Optional columns used by some callers
  aiSummary?: string;
  eventSubtype?: string;
  createdBy?: string;
  voiceNoteTranscript?: string;
  intelligenceScore?: number;
}

/**
 * Insert a learning event with GUARANTEED embedding generation.
 * This is the ONLY function that should insert into learning_events.
 *
 * Returns the inserted row id, or null on failure (logged to activity_log).
 */
export async function insertLearningEvent(
  params: InsertLearningEventParams
): Promise<{ id: string } | null> {
  const supabase = createAdminClient();

  try {
    // 1. ALWAYS generate embedding — this is the whole point of this function
    const embedding = await generateEmbedding(params.contentForEmbedding);

    // 2. Insert with all required fields
    const { data, error } = await supabase
      .from('learning_events')
      .insert({
        child_id: params.childId,
        event_type: params.eventType,
        event_data: params.eventData as unknown as Json,
        content_for_embedding: params.contentForEmbedding,
        embedding: JSON.stringify(embedding),
        session_id: params.sessionId || null,
        coach_id: params.coachId || null,
        signal_source: params.signalSource,
        signal_confidence: params.signalConfidence,
        session_modality: params.sessionModality || null,
        event_date: params.eventDate || new Date().toISOString(),
        // Optional columns
        ...(params.aiSummary != null ? { ai_summary: params.aiSummary } : {}),
        ...(params.eventSubtype != null ? { event_subtype: params.eventSubtype } : {}),
        ...(params.createdBy != null ? { created_by: params.createdBy } : {}),
        ...(params.voiceNoteTranscript != null ? { voice_note_transcript: params.voiceNoteTranscript } : {}),
        ...(params.intelligenceScore != null ? { intelligence_score: params.intelligenceScore } : {}),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[insertLearningEvent] DB insert failed:', error.message, error.code, error.details, error.hint);
      // Retry without embedding — better to have the event without embedding than nothing
      try {
        const { data: retryData, error: retryError } = await supabase
          .from('learning_events')
          .insert({
            child_id: params.childId,
            event_type: params.eventType,
            event_data: params.eventData as unknown as Json,
            content_for_embedding: params.contentForEmbedding,
            session_id: params.sessionId || null,
            coach_id: params.coachId || null,
            signal_source: params.signalSource,
            signal_confidence: params.signalConfidence,
            session_modality: params.sessionModality || null,
            event_date: params.eventDate || new Date().toISOString(),
            ...(params.eventSubtype != null ? { event_subtype: params.eventSubtype } : {}),
            ...(params.intelligenceScore != null ? { intelligence_score: params.intelligenceScore } : {}),
          })
          .select('id')
          .single();

        if (!retryError && retryData) {
          console.warn('[insertLearningEvent] Retry without embedding succeeded:', retryData.id);
          // Log for backfill
          try {
            await supabase.from('activity_log').insert({
              action: 'learning_event_embedding_skipped',
              user_type: 'system',
              user_email: 'system@yestoryd.com',
              metadata: {
                learning_event_id: retryData.id,
                original_error: error.message,
                error_code: error.code,
                event_type: params.eventType,
                child_id: params.childId,
              },
            });
          } catch { /* Don't fail on logging failure */ }
          return retryData;
        }
      } catch { /* Retry failed too */ }

      // Log original failure to activity_log for admin visibility
      try {
        await supabase.from('activity_log').insert({
          action: 'learning_event_insert_failed',
          user_type: 'system',
          user_email: 'system@yestoryd.com',
          metadata: {
            error: error.message,
            error_code: error.code,
            error_details: error.details,
            event_type: params.eventType,
            child_id: params.childId,
            signal_source: params.signalSource,
          },
        });
      } catch { /* Don't fail on logging failure */ }
      return null;
    }

    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[insertLearningEvent] Embedding or insert error:', message);
    try {
      await supabase.from('activity_log').insert({
        action: 'learning_event_insert_failed',
        user_type: 'system',
        user_email: 'system@yestoryd.com',
        metadata: {
          error: message,
          event_type: params.eventType,
          child_id: params.childId,
          stage: 'embedding_or_insert',
        },
      });
    } catch { /* Don't fail on logging failure */ }
    return null;
  }
}

/**
 * Batch insert learning events — each gets its own embedding.
 * Used for bulk inserts like activity struggle flags.
 * Returns count of successfully inserted events.
 */
export async function insertLearningEventsBatch(
  events: InsertLearningEventParams[]
): Promise<number> {
  let successCount = 0;
  for (const event of events) {
    const result = await insertLearningEvent(event);
    if (result) successCount++;
  }
  return successCount;
}
