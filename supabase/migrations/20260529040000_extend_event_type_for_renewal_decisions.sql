-- B3-FINAL-CLEANUP: extend learning_events.event_type CHECK constraint to allow parent_renewal_decision
-- Root cause: handler tried to INSERT event_type='parent_renewal_decision' which was not in the allowed list;
-- Postgres silently rejected via constraint violation, insertLearningEvent helper swallowed the error,
-- RAG signal was lost. End-to-end smoke validated all other paths but missed this insert.

-- Idempotent: drop constraint if exists, then re-add with expanded value list.
ALTER TABLE learning_events DROP CONSTRAINT IF EXISTS learning_events_event_type_check;

ALTER TABLE learning_events ADD CONSTRAINT learning_events_event_type_check CHECK (
  event_type = ANY (ARRAY[
    'session', 'session_completed', 'session_cancelled', 'session_rescheduled', 'session_missed', 'session_feedback',
    'assessment', 'diagnostic_assessment', 'exit_assessment',
    'structured_capture',
    'elearning', 'video', 'quiz', 'badge', 'streak', 'level_up',
    'group_class_observation', 'group_class_response', 'group_class_verbal', 'group_class_quiz', 'group_class_micro_insight', 'group_class_parent_feedback',
    'parent_inquiry', 'parent_session_summary', 'parent_feedback', 'parent_practice_observation', 'parent_renewal_decision',  -- NEW
    'milestone', 'season_completion',
    'daily_recommendations', 'progress_pulse', 'breakthrough',
    'whatsapp_lead', 'lead_conversation', 'discovery_notes', 'nps_feedback',
    'micro_assessment', 'mini_challenge_completed', 'session_companion_log', 'activity_struggle_flag',
    'parent_practice_assigned', 'practice_completed',
    'recall_enrichment', 'child_artifact', 'reading_log',
    'elearning_interaction', 'unit_completed',
    'note', 'handwritten'
  ]::text[])
);
