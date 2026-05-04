-- 20260504_drain_worker_2a_schema.sql
--
-- Drain Worker — sub-block 2A: schema migration + close historical bucket
--
-- Context: 69 deferred messages accumulated in communication_logs since
-- 2026-04-20 (oldest 13 days old at time of writing). Drain Worker Phase 0
-- audit (2026-05-03) confirmed no drainer ever existed. This migration:
--   1. Prepares communication_queue schema for future deferral writes
--      (Drain-2B will switch notify.ts deferral target from
--      communication_logs to communication_queue).
--   2. Closes out the 69 historical stranded rows in communication_logs
--      with error_message='drained_expired'. They stay in communication_logs
--      for traceability but are never re-sent.
--
-- Future deferrals will land in communication_queue and be drained by
-- Drain-2C cron daily at 08:05 IST.

BEGIN;

-- 1. Allow phone-shaped recipients in communication_queue.
--    Existing recipient_id is uuid NOT NULL — fine for parent/coach/admin
--    UUID-routed sends, but deferred messages historically carry phone-only
--    recipients (e.g., admin_daily_health_v3 routes to a phone with no
--    admin uuid table). New recipient_phone column supports phone-only
--    recipients. recipient_id dropped to nullable.
ALTER TABLE public.communication_queue
  ADD COLUMN recipient_phone TEXT;

ALTER TABLE public.communication_queue
  ALTER COLUMN recipient_id DROP NOT NULL;

-- 2. Require at least one routing field. Prevents accidental
--    null-on-both inserts.
ALTER TABLE public.communication_queue
  ADD CONSTRAINT communication_queue_recipient_required
  CHECK (recipient_id IS NOT NULL OR recipient_phone IS NOT NULL);

-- 3. Drop duplicate status index. Phase 0 found two btree(status) indexes
--    (idx_comm_queue_status + idx_communication_queue_status) with
--    identical definitions. Keep the canonical-named one.
DROP INDEX IF EXISTS public.idx_comm_queue_status;

-- 4. Close out the 69 historical stranded rows in communication_logs.
--    All 69 rows are 3+ days past their deferred_until (latest 2026-05-01).
--    Per Drain-2A design D4: any row with deferred_until < NOW() - 48h
--    is considered drained_expired and never re-sent.
--
--    Breakdown verified at Phase 0:
--      coach_report_deadline_v3       46
--      coach_session_reminder_1h_v3   18
--      admin_daily_health_v3           4
--      parent_tuition_low_balance_v3   1
--                                    ───
--                                     69
--
--    Update is idempotent: if re-applied, no rows change because
--    error_message is already 'drained_expired'.
UPDATE public.communication_logs
   SET error_message = 'drained_expired'
 WHERE error_message = 'deferred_quiet_hours'
   AND wa_sent = false
   AND deferred_until < NOW() - INTERVAL '48 hours';

-- 5. Sanity check: verify the close-out matched the expected backlog.
--    If a different number is matched, this migration has been applied
--    against a drifted database state — abort and investigate.
DO $$
DECLARE
  closed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO closed_count
    FROM public.communication_logs
   WHERE error_message = 'drained_expired';

  IF closed_count < 69 THEN
    RAISE EXCEPTION 'Drain-2A close-out matched only % rows (expected >= 69). Investigate before retrying.', closed_count;
  END IF;

  RAISE NOTICE 'Drain-2A close-out complete: % rows now drained_expired.', closed_count;
END $$;

COMMIT;
