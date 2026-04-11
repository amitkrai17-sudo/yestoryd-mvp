-- ============================================================
-- Add skill_id to session_activity_log
-- Enables deterministic skill→observation mapping in SCF pre-fill
-- Existing rows stay NULL (no backfill guessing)
-- ============================================================

ALTER TABLE session_activity_log
  ADD COLUMN IF NOT EXISTS skill_id UUID REFERENCES el_skills(id);

CREATE INDEX idx_session_activity_log_skill
  ON session_activity_log(skill_id)
  WHERE skill_id IS NOT NULL;

-- Rollback:
-- ALTER TABLE session_activity_log DROP COLUMN IF EXISTS skill_id;
