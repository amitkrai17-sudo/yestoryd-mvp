-- ============================================================
-- Unify template_code = wa_template_name across communication_templates
-- ============================================================
-- Context: template_code and wa_template_name drifted apart for legacy
-- rows (e.g. C9_session_reminder vs coach_session_reminder_1h_v3),
-- causing repeated template_not_found bugs when callers passed one
-- name where the DB expected the other.
--
-- After this migration: template_code = wa_template_name for every
-- row — single source of truth, also identical to the AiSensy
-- campaign name.
--
-- Preflight verified:
-- - No duplicate wa_template_names (would collide with UNIQUE(template_code))
-- - No cross-row swap collisions (no row's wa_template_name equals another
--   row's current template_code)
-- - UPDATE is a single statement; Postgres checks UNIQUE at end-of-statement
-- ============================================================

UPDATE communication_templates
SET template_code = wa_template_name
WHERE template_code IS DISTINCT FROM wa_template_name
  AND wa_template_name IS NOT NULL;

-- Verification (run after UPDATE; must return 0):
-- SELECT COUNT(*) FROM communication_templates
-- WHERE template_code IS DISTINCT FROM wa_template_name
--   AND wa_template_name IS NOT NULL;
