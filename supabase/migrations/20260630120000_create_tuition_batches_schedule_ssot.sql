-- ============================================================================
-- ALREADY APPLIED to prod via MCP 2026-06-30. File for repo parity. DO NOT re-run.
-- ============================================================================
-- Creates tuition_batches as the SSOT for a tuition batch's shared schedule
-- (days / times / default_time / duration / mode / classroom meet_link), backfills
-- it from the existing tuition_onboarding.batch_id + schedule_preference rows, wires
-- batch_id FKs from tuition_onboarding + scheduled_sessions, and pins
-- tuition_onboarding.batch_id NOT NULL.
--
-- Tables/objects created:
--   - TABLE  tuition_batches
--   - FK     tuition_onboarding_batch_id_fkey   (tuition_onboarding.batch_id  -> tuition_batches.id)
--   - FK     scheduled_sessions_batch_id_fkey   (scheduled_sessions.batch_id  -> tuition_batches.id)
--   - NOT NULL on tuition_onboarding.batch_id
--
-- IDEMPOTENCY: the statements below are the EXACT DDL applied to prod, wrapped in
-- repo-parity guards so a fresh `db reset`/replay is safe and a re-run is a no-op:
--   - CREATE TABLE IF NOT EXISTS
--   - backfill INSERT ... ON CONFLICT (id) DO NOTHING   (PK is the batch id)
--   - FK adds via DO-block existence check (Postgres has no ADD CONSTRAINT IF NOT EXISTS for FKs)
--   - SET NOT NULL via DO-block (only when the column is still nullable)
-- The backfill CTE logic itself is preserved verbatim.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tuition_batches (
  id                 uuid PRIMARY KEY,
  coach_id           uuid NOT NULL,
  status             text NOT NULL DEFAULT 'active',
  days               text[] NOT NULL DEFAULT '{}',
  times              jsonb  NOT NULL DEFAULT '{}'::jsonb,
  default_time       time,
  duration_minutes   integer,
  session_mode       text NOT NULL DEFAULT 'offline',
  meet_link          text,
  schedule_confirmed boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

WITH parsed AS (
  SELECT o.batch_id, o.coach_id, o.created_at,
         o.default_session_mode, o.session_duration_minutes, o.meet_link,
         COALESCE(ARRAY(SELECT jsonb_array_elements_text((o.schedule_preference::jsonb)->'days')),'{}') AS days_arr,
         COALESCE((o.schedule_preference::jsonb)->'times','{}'::jsonb) AS times_obj,
         NULLIF((o.schedule_preference::jsonb)->>'defaultTime','') AS dtime
  FROM tuition_onboarding o
  WHERE o.batch_id IS NOT NULL
),
day_union AS (
  SELECT batch_id, array_agg(DISTINCT d) AS days
  FROM (SELECT batch_id, unnest(days_arr) AS d FROM parsed) x GROUP BY batch_id
),
anchor AS (
  SELECT DISTINCT ON (batch_id) batch_id, coach_id, default_session_mode,
         session_duration_minutes, meet_link, times_obj, dtime
  FROM parsed ORDER BY batch_id, created_at
),
counts AS (SELECT batch_id, COUNT(*) AS members FROM parsed GROUP BY batch_id)
INSERT INTO tuition_batches
  (id, coach_id, status, days, times, default_time, duration_minutes, session_mode, meet_link, schedule_confirmed)
SELECT a.batch_id, a.coach_id, 'active',
       COALESCE(du.days,'{}'), a.times_obj, a.dtime::time, a.session_duration_minutes,
       COALESCE(a.default_session_mode,'offline'),
       NULLIF(a.meet_link,''),
       COALESCE(
         (c.members = 1 AND array_length(COALESCE(du.days,'{}'),1) >= 1
           AND (a.dtime IS NOT NULL OR a.times_obj <> '{}'::jsonb))
       , false)
FROM anchor a
LEFT JOIN day_union du USING (batch_id)
JOIN counts c USING (batch_id)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tuition_onboarding_batch_id_fkey'
      AND conrelid = 'public.tuition_onboarding'::regclass
  ) THEN
    ALTER TABLE tuition_onboarding
      ADD CONSTRAINT tuition_onboarding_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES tuition_batches(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scheduled_sessions_batch_id_fkey'
      AND conrelid = 'public.scheduled_sessions'::regclass
  ) THEN
    ALTER TABLE scheduled_sessions
      ADD CONSTRAINT scheduled_sessions_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES tuition_batches(id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tuition_onboarding'
      AND column_name = 'batch_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE tuition_onboarding ALTER COLUMN batch_id SET NOT NULL;
  END IF;
END $$;
