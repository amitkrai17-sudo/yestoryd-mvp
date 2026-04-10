-- =============================================================================
-- FIX: enrollments.status CHECK constraint
-- =============================================================================
-- Context: A prior manual migration added 'payment_pending' and 'tuition_paused'
-- but dropped 'pending_start' and 'season_completed' from the allowed set.
-- 'pending_start' is written by payment/verify/route.ts:559 on INSERT and is
-- referenced in 12+ coach/cron query filters. Without it, payment verification
-- silently fails for non-immediate-start enrollments.
--
-- This migration restores the full set of statuses currently used in code:
--   active, completed, season_completed, cancelled, paused, pending,
--   pending_start, payment_pending, tuition_paused
--
-- Rollback:
--   ALTER TABLE enrollments DROP CONSTRAINT enrollments_status_check;
--   ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check
--     CHECK (status IN ('active','completed','season_completed','cancelled','paused','pending','payment_pending','tuition_paused'));
-- =============================================================================

ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;

ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check
  CHECK (status IN (
    'active',
    'completed',
    'season_completed',
    'cancelled',
    'paused',
    'pending',
    'pending_start',
    'payment_pending',
    'tuition_paused'
  ));
