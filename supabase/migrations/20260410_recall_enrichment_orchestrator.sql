-- ============================================================
-- Recall Enrichment + Post-Capture Orchestrator Infrastructure
-- P2: Recall as enrichment (not standalone captures)
-- P3: Async orchestrator for downstream automation
-- ============================================================

-- 1. Add recall_enrichment JSONB to structured_capture_responses
-- Stores: transcript_url, audio_url, integrity_score, notable_quotes, enriched_at
ALTER TABLE structured_capture_responses
  ADD COLUMN IF NOT EXISTS recall_enrichment JSONB DEFAULT NULL;

-- 2. Add recall_prefill_data JSONB to scheduled_sessions
-- Stores Recall analysis as pre-fill for SCF when coach hasn't filed yet
ALTER TABLE scheduled_sessions
  ADD COLUMN IF NOT EXISTS recall_prefill_data JSONB DEFAULT NULL;

-- 3. Add session_prep_data JSONB to scheduled_sessions
-- Stores AI-generated focus points + suggested activities for upcoming sessions
ALTER TABLE scheduled_sessions
  ADD COLUMN IF NOT EXISTS session_prep_data JSONB DEFAULT NULL;

-- 4. Add recall_enrichment to learning_events event_type CHECK constraint
-- Drop old constraint and recreate with the new value
ALTER TABLE learning_events DROP CONSTRAINT IF EXISTS learning_events_event_type_check;
ALTER TABLE learning_events ADD CONSTRAINT learning_events_event_type_check CHECK (
  event_type = ANY (ARRAY[
    'session', 'session_completed', 'session_cancelled', 'session_rescheduled',
    'session_missed', 'session_feedback', 'assessment', 'diagnostic_assessment',
    'exit_assessment', 'structured_capture', 'elearning', 'video', 'quiz',
    'badge', 'streak', 'level_up', 'group_class_observation', 'group_class_response',
    'group_class_verbal', 'group_class_quiz', 'group_class_micro_insight',
    'group_class_parent_feedback', 'parent_inquiry', 'parent_session_summary',
    'parent_feedback', 'parent_practice_observation', 'milestone', 'season_completion',
    'daily_recommendations', 'progress_pulse', 'breakthrough', 'whatsapp_lead',
    'lead_conversation', 'discovery_notes', 'nps_feedback', 'micro_assessment',
    'mini_challenge_completed', 'session_companion_log', 'activity_struggle_flag',
    'parent_practice_assigned', 'practice_completed',
    'recall_enrichment'
  ])
);

-- 5. Clean up orphan auto_filled captures (score=0, never confirmed)
DELETE FROM structured_capture_responses
WHERE capture_method = 'auto_filled'
  AND coach_confirmed = false
  AND intelligence_score = 0;

-- Rollback:
-- ALTER TABLE structured_capture_responses DROP COLUMN IF EXISTS recall_enrichment;
-- ALTER TABLE scheduled_sessions DROP COLUMN IF EXISTS recall_prefill_data;
-- ALTER TABLE scheduled_sessions DROP COLUMN IF EXISTS session_prep_data;
