-- =============================================================================
-- ADD 'terminated' to enrollments.status CHECK constraint
-- =============================================================================
-- ALREADY APPLIED TO PROD via MCP 2026-06-29 (add_terminated_to_enrollments_status_check).
-- This file is the repo-parity record — do NOT re-run against prod. Idempotent:
-- safe no-op if re-run (DROP ... IF EXISTS + re-ADD with the full current set).
--
-- Context: the lapsed-member lifecycle (2C-3) terminates a tuition enrollment by
-- writing status='terminated' (lib/tuition/remove-lapsed-member.ts). The prior
-- constraint (20260409_fix_enrollments_status_check.sql) did not include
-- 'terminated', so that write would be rejected without this change.
--
-- Restores the full set of statuses currently used in code, now including
-- 'terminated':
--   active, completed, season_completed, cancelled, paused, pending,
--   pending_start, payment_pending, tuition_paused, terminated
--
-- Rollback:
--   ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;
--   ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check
--     CHECK (status = ANY (ARRAY['active','completed','season_completed','cancelled',
--       'paused','pending','pending_start','payment_pending','tuition_paused']));
-- =============================================================================

ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check
  CHECK (status = ANY (ARRAY['active','completed','season_completed','cancelled',
    'paused','pending','pending_start','payment_pending','tuition_paused','terminated']));
