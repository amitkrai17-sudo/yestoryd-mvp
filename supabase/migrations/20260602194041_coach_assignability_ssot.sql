-- Migration: coach_assignability_ssot
-- Purpose: Single source of truth for coach auto-assignment eligibility.
--   Adds manual_hold / manual_hold_reason columns to coaches, and a
--   get_assignable_coaches() SQL function that encodes the full eligibility
--   predicate (active, available, accepting, onboarded, not exiting, not on
--   manual hold, has capacity, application approved, not on leave for the date).
-- NOTE: Already applied to production via Supabase MCP. This file is the
--   repo artifact and is fully idempotent (safe to re-run).
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
--   DROP FUNCTION IF EXISTS get_assignable_coaches(date);
--   ALTER TABLE coaches DROP COLUMN IF EXISTS manual_hold_reason;
--   ALTER TABLE coaches DROP COLUMN IF EXISTS manual_hold;
-- ============================================================================

ALTER TABLE coaches
  ADD COLUMN IF NOT EXISTS manual_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_hold_reason text;

CREATE OR REPLACE FUNCTION get_assignable_coaches(p_date date DEFAULT current_date)
RETURNS TABLE (id uuid, name text, email text, last_assigned_at timestamptz,
               current_children integer, max_children integer)
LANGUAGE sql STABLE AS $$
  SELECT c.id, c.name, c.email, c.last_assigned_at, c.current_children, c.max_children
  FROM coaches c
  LEFT JOIN coach_applications ca ON ca.id = c.application_id
  WHERE c.is_active = true AND c.is_available = true AND c.is_accepting_new = true
    AND c.onboarding_complete = true AND c.exit_status IS NULL AND c.manual_hold = false
    AND COALESCE(c.current_children, 0) < COALESCE(c.max_children, 0)
    AND (c.application_id IS NULL OR ca.status = 'approved')
    AND NOT EXISTS (
      SELECT 1 FROM coach_availability cav
      WHERE cav.coach_id = c.id AND cav.type = 'unavailable'
        AND cav.status <> 'cancelled'
        AND cav.start_date <= p_date AND cav.end_date >= p_date)
  ORDER BY c.last_assigned_at ASC NULLS FIRST;
$$;
