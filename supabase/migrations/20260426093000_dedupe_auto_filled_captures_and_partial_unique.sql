-- Migration: Dedupe auto_filled structured_capture_responses + partial UNIQUE index
-- ================================================================
-- Problem:
--   11 sessions have 2 auto_filled captures each (22 rows total). Pattern:
--   pairs created ~15 min apart = one dispatcher cycle. SELECT-then-INSERT
--   in 3 fallback paths (capture-reminders / recall-reconciliation /
--   process-session sibling fanout) has a race window with no DB-level
--   safety net. All 22 rows are coach_confirmed=false (verified pre-flight).
--
-- Dedup direction:
--   scheduled_sessions.capture_id points to the OLDER row in 11/11 cases.
--   Strategy: KEEP OLDER, DELETE NEWER. Preserves FK pointers.
--
-- Safety net:
--   Partial UNIQUE index on (session_id) WHERE capture_method='auto_filled'.
--   Coexists with manual_structured / voice_to_structured / instructor_console
--   rows for the same session — only the auto_filled subset is constrained.

BEGIN;

-- ----------------------------------------------------------------
-- 1. Pre-flight assertion: confirm no CONFIRMED captures in dup set
--    (would indicate intelligence loss if we delete one).
-- ----------------------------------------------------------------
DO $$
DECLARE
  dup_session_count INTEGER;
  total_dup_rows INTEGER;
  any_confirmed_dup INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_session_count
  FROM (
    SELECT session_id FROM structured_capture_responses
    WHERE capture_method = 'auto_filled'
    GROUP BY session_id HAVING COUNT(*) > 1
  ) AS d;

  SELECT COUNT(*) INTO total_dup_rows
  FROM structured_capture_responses scr
  WHERE scr.capture_method = 'auto_filled'
    AND scr.session_id IN (
      SELECT session_id FROM structured_capture_responses
      WHERE capture_method = 'auto_filled'
      GROUP BY session_id HAVING COUNT(*) > 1
    );

  SELECT COUNT(*) INTO any_confirmed_dup
  FROM structured_capture_responses scr
  WHERE scr.capture_method = 'auto_filled'
    AND scr.coach_confirmed = TRUE
    AND scr.session_id IN (
      SELECT session_id FROM structured_capture_responses
      WHERE capture_method = 'auto_filled'
      GROUP BY session_id HAVING COUNT(*) > 1
    );

  IF any_confirmed_dup > 0 THEN
    RAISE EXCEPTION
      'ABORT: % CONFIRMED captures present in duplicate set — manual review required',
      any_confirmed_dup;
  END IF;

  RAISE NOTICE 'Pre-flight OK: % dup sessions, % total rows, % confirmed (must be 0)',
    dup_session_count, total_dup_rows, any_confirmed_dup;
END $$;

-- ----------------------------------------------------------------
-- 2. Delete NEWER duplicate per session.
--    KEEP rn=1 (OLDEST), DELETE rn>1.
-- ----------------------------------------------------------------
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at ASC) AS rn
  FROM structured_capture_responses
  WHERE capture_method = 'auto_filled'
    AND session_id IN (
      SELECT session_id FROM structured_capture_responses
      WHERE capture_method = 'auto_filled'
      GROUP BY session_id HAVING COUNT(*) > 1
    )
)
DELETE FROM structured_capture_responses
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ----------------------------------------------------------------
-- 3. Post-delete assertion: zero remaining duplicates.
-- ----------------------------------------------------------------
DO $$
DECLARE
  remaining_dups INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_dups
  FROM (
    SELECT session_id FROM structured_capture_responses
    WHERE capture_method = 'auto_filled'
    GROUP BY session_id HAVING COUNT(*) > 1
  ) AS d;

  IF remaining_dups > 0 THEN
    RAISE EXCEPTION 'Dedupe failed: % duplicate sessions remain', remaining_dups;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 4. Add partial UNIQUE index — DB-level race safety net.
--    Future concurrent INSERTs that bypass the application's pre-check
--    will fail with 23505; application code is updated to catch and log.
-- ----------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS structured_capture_responses_session_id_auto_filled_unique
  ON structured_capture_responses (session_id)
  WHERE capture_method = 'auto_filled';

COMMIT;
