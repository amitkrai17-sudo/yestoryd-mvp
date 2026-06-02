-- Migration: coach_pointer_cleanup_partA
-- Purpose: Final cutover of the coach-pointer model. children.assigned_coach_id is dropped
--   (phantom: zero writers, always NULL); children.coach_id is demoted to lead-stage only
--   (enrolled children backfilled to NULL); the enrolled coach is canonical in
--   enrollments.coach_id. Coach RLS policies are repointed from the broken children pointers
--   to active enrollments, and the dead get_coach_students_events() function is removed.
--
-- NOTE: Already applied to production via Supabase MCP (Claude Web), in the order below. This
--   file is the local audit-trail artifact. Idempotent (IF EXISTS / DROP-before-CREATE) so it
--   is safe to re-run. The RLS CREATE POLICY bodies are transcribed from the predicates applied
--   via MCP; if byte-exactness matters, verify against prod with
--   `SELECT pg_get_policydef(oid) ...` / `pg_policies`.
--
-- Shared coach->students predicate used by all three policies:
--   child_id IN (SELECT e.child_id FROM enrollments e
--                JOIN coaches co ON co.id = e.coach_id
--                WHERE e.status = 'active' AND co.user_id = auth.uid())

-- ============================================================================
-- 1. Drop dead function get_coach_students_events (zero callers; filtered on the
--    now-demoted children.coach_id, so it would return empty for every coach).
-- ============================================================================
DROP FUNCTION IF EXISTS get_coach_students_events(uuid, integer);

-- ============================================================================
-- 2. Backfill: NULL children.coach_id for every enrolled child (demote to lead-only).
--    Non-reversible by snapshot (no stored prior values) but reconstructable from
--    enrollments.coach_id if ever needed. Idempotent (re-running NULLs nothing new).
-- ============================================================================
UPDATE children
   SET coach_id = NULL, updated_at = now()
 WHERE id IN (SELECT DISTINCT child_id FROM enrollments WHERE child_id IS NOT NULL)
   AND coach_id IS NOT NULL;

-- ============================================================================
-- 3. Repoint coach RLS policies from the broken children pointers to active enrollments.
-- ============================================================================
DROP POLICY IF EXISTS messages_coach_policy ON messages;
CREATE POLICY messages_coach_policy ON messages
  FOR ALL
  USING (
    sender_id = auth.uid()
    OR child_id IN (
      SELECT e.child_id FROM enrollments e
      JOIN coaches co ON co.id = e.coach_id
      WHERE e.status = 'active' AND co.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cip_coach_read ON child_intelligence_profiles;
CREATE POLICY cip_coach_read ON child_intelligence_profiles
  FOR SELECT TO authenticated
  USING (
    child_id IN (
      SELECT e.child_id FROM enrollments e
      JOIN coaches co ON co.id = e.coach_id
      WHERE e.status = 'active' AND co.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS micro_coach_read ON micro_assessments;
CREATE POLICY micro_coach_read ON micro_assessments
  FOR SELECT TO authenticated
  USING (
    child_id IN (
      SELECT e.child_id FROM enrollments e
      JOIN coaches co ON co.id = e.coach_id
      WHERE e.status = 'active' AND co.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. Drop the phantom column (zero writers, always NULL — see Phase 2C-c R5 proof).
-- ============================================================================
ALTER TABLE children DROP COLUMN IF EXISTS assigned_coach_id;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- 4 (column): re-add the phantom column (no data to restore; it was always NULL):
--   ALTER TABLE children ADD COLUMN IF NOT EXISTS assigned_coach_id uuid REFERENCES coaches(id);
--
-- 3 (policies): restore the ORIGINAL (broken) bodies, for the record only — these were the
--   pre-cutover definitions that read the now-removed/demoted children pointers:
--   messages_coach_policy  USING ( sender_id = auth.uid()
--     OR child_id IN (SELECT children.id ... ) )  -- original keyed off children.assigned_coach_id:
--     -- child_id IN (SELECT c.id FROM children c WHERE c.assigned_coach_id IN
--     --   (SELECT coaches.id FROM coaches WHERE coaches.user_id = auth.uid()))
--   cip_coach_read   USING ( child_id IN (SELECT c.id FROM children c
--     WHERE c.assigned_coach_id = auth.uid()) )   -- BROKEN: assigned_coach_id (coaches.id) vs auth.uid() ID-space mismatch
--   micro_coach_read ON micro_assessments USING ( child_id IN (SELECT c.id FROM children c
--     WHERE c.assigned_coach_id = auth.uid()) )   -- BROKEN: same ID-space mismatch
--   (Do not actually restore these — they reference a dropped column and were non-functional.)
--
-- 2 (backfill): re-derive children.coach_id from enrollments if ever needed (no snapshot):
--   UPDATE children c SET coach_id = e.coach_id
--   FROM (SELECT DISTINCT ON (child_id) child_id, coach_id FROM enrollments
--         WHERE status = 'active' ORDER BY child_id, created_at DESC) e
--   WHERE e.child_id = c.id;
--
-- 1 (function): authoritative prior body (filtered on children.coach_id), captured Phase 2C-c Part A:
--   CREATE OR REPLACE FUNCTION get_coach_students_events(coach_uuid uuid, event_limit integer)
--   RETURNS TABLE(id uuid, child_id uuid, child_name text, event_type text,
--                 event_date timestamptz, ai_summary text)
--   LANGUAGE sql AS $$
--     SELECT le.id, le.child_id, COALESCE(c.name, c.child_name), le.event_type,
--            le.event_date, le.ai_summary
--     FROM learning_events le
--     JOIN children c ON le.child_id = c.id
--     WHERE c.coach_id = coach_uuid
--     ORDER BY le.event_date DESC
--     LIMIT event_limit;
--   $$;
--   -- NOTE: if restored, repoint WHERE to an EXISTS on active enrollments (see Phase 2C-c Part A
--   --   audit) — the c.coach_id filter is dead post-backfill.
-- ============================================================================
