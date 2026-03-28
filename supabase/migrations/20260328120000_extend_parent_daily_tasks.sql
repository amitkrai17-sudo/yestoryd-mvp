-- Assignment tracking unification: add session traceability + photo support
-- Also adds practice_completed event type for learning_events

-- 1. Add session_id FK (nullable — existing rows won't have it)
ALTER TABLE parent_daily_tasks
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES scheduled_sessions(id) ON DELETE SET NULL;

-- 2. Add photo_url for physical homework verification
ALTER TABLE parent_daily_tasks
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 3. Update source CHECK to include 'parent_summary'
ALTER TABLE parent_daily_tasks DROP CONSTRAINT IF EXISTS parent_daily_tasks_source_check;
ALTER TABLE parent_daily_tasks ADD CONSTRAINT parent_daily_tasks_source_check
  CHECK (source IN ('template_generated', 'ai_recommended', 'coach_assigned', 'system', 'parent_summary'));

-- 4. Index for session lookup
CREATE INDEX IF NOT EXISTS idx_parent_daily_tasks_session
  ON parent_daily_tasks(session_id) WHERE session_id IS NOT NULL;

-- 5. Composite index for parent portal query pattern (child + not completed + recent)
CREATE INDEX IF NOT EXISTS idx_parent_daily_tasks_child_active
  ON parent_daily_tasks(child_id, is_completed, created_at DESC);

-- 6. Add 'practice_completed' to learning_events event_type CHECK
ALTER TABLE learning_events DROP CONSTRAINT IF EXISTS learning_events_event_type_check;
ALTER TABLE learning_events ADD CONSTRAINT learning_events_event_type_check
  CHECK (event_type IN (
    'session', 'session_completed', 'session_cancelled', 'session_rescheduled', 'session_missed', 'session_feedback',
    'assessment', 'diagnostic_assessment', 'exit_assessment',
    'structured_capture',
    'elearning', 'video', 'quiz', 'badge', 'streak', 'level_up',
    'group_class_observation', 'group_class_response', 'group_class_verbal',
    'group_class_quiz', 'group_class_micro_insight', 'group_class_parent_feedback',
    'parent_inquiry', 'parent_session_summary', 'parent_feedback', 'parent_practice_observation',
    'milestone', 'season_completion',
    'daily_recommendations', 'progress_pulse', 'breakthrough',
    'whatsapp_lead', 'lead_conversation', 'discovery_notes', 'nps_feedback',
    'micro_assessment', 'mini_challenge_completed',
    'session_companion_log', 'activity_struggle_flag', 'parent_practice_assigned',
    'practice_completed'
  ));

-- 7. Add 'parent_whatsapp' to signal_source CHECK (referenced in TS type but missing from DB)
ALTER TABLE learning_events DROP CONSTRAINT IF EXISTS chk_signal_source;
ALTER TABLE learning_events ADD CONSTRAINT chk_signal_source
  CHECK (signal_source IS NULL OR signal_source IN (
    'transcript_analysis', 'structured_capture', 'structured_capture_audio',
    'companion_panel', 'instructor_observation', 'child_artifact',
    'micro_assessment', 'diagnostic_assessment', 'parent_observation',
    'parent_chat', 'parent_whatsapp', 'system_generated', 'coach_form', 'tuition_completion',
    'elearning_system', 'elearning', 'whatsapp_webhook', 'nps_survey', 'discovery_call',
    'group_class', 'unknown'
  ));

-- 8. Add 'online_group' to session_modality CHECK (referenced in TS type but missing from DB)
ALTER TABLE learning_events DROP CONSTRAINT IF EXISTS chk_session_modality;
ALTER TABLE learning_events ADD CONSTRAINT chk_session_modality
  CHECK (session_modality IS NULL OR session_modality IN (
    'online', 'online_1on1', 'in_person', 'tuition',
    'hybrid', 'group_class', 'practice', 'assessment', 'elearning', 'online_group'
  ));

-- Rollback:
-- ALTER TABLE parent_daily_tasks DROP COLUMN IF EXISTS session_id;
-- ALTER TABLE parent_daily_tasks DROP COLUMN IF EXISTS photo_url;
-- DROP INDEX IF EXISTS idx_parent_daily_tasks_session;
-- DROP INDEX IF EXISTS idx_parent_daily_tasks_child_active;
