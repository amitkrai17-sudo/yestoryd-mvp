-- ============================================================
-- FILE: supabase/migrations/20260413_learning_events_event_type_close_ts_gap.sql
-- PURPOSE: Close the long-standing app-vs-DB gap on learning_events.event_type.
-- The TypeScript LearningEventType union (lib/rai/learning-events.ts) includes
-- 6 values that the DB CHECK constraint doesn't. Inserts of those values would
-- silently fail (caught and swallowed by insertLearningEvent's retry path).
--
-- Adds: child_artifact, reading_log, elearning_interaction,
--       unit_completed, note, handwritten
--
-- Constraint was widened from 22 → 41 values previously; this brings it to 47.
-- ============================================================

ALTER TABLE learning_events
  DROP CONSTRAINT IF EXISTS learning_events_event_type_check;

ALTER TABLE learning_events
  ADD CONSTRAINT learning_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'session','session_completed','session_cancelled','session_rescheduled','session_missed',
    'session_feedback','assessment','diagnostic_assessment','exit_assessment','structured_capture',
    'elearning','video','quiz','badge','streak','level_up','group_class_observation',
    'group_class_response','group_class_verbal','group_class_quiz','group_class_micro_insight',
    'group_class_parent_feedback','parent_inquiry','parent_session_summary','parent_feedback',
    'parent_practice_observation','milestone','season_completion','daily_recommendations',
    'progress_pulse','breakthrough','whatsapp_lead','lead_conversation','discovery_notes',
    'nps_feedback','micro_assessment','mini_challenge_completed','session_companion_log',
    'activity_struggle_flag','parent_practice_assigned','practice_completed','recall_enrichment',
    'child_artifact','reading_log','elearning_interaction','unit_completed','note','handwritten'
  ]::text[]));
