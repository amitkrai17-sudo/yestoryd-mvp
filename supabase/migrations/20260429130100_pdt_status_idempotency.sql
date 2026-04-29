-- ============================================================
-- PR 1 — parent_daily_tasks status enum + idempotency_key
-- Adds the foundation for unified writer contract (PR 2).
-- During the transition, is_completed and status stay in sync via trigger.
-- ============================================================

ALTER TABLE parent_daily_tasks
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  ADD COLUMN idempotency_key TEXT;

-- Backfill status from existing data.
-- Note: the 20260429120000 backfill already auto-completed tasks older than
-- 7 days. Those rows land in 'completed' here; the 'expired' branch will be
-- empty on a database that ran that prior migration. Going forward, the
-- expire-stale-tasks cron is the populator of 'expired'.
UPDATE parent_daily_tasks
  SET status = 'completed'
  WHERE is_completed = true;

UPDATE parent_daily_tasks
  SET status = 'expired'
  WHERE is_completed = false
    AND task_date < CURRENT_DATE - INTERVAL '7 days';

-- Indexes for the new world.
-- Partial unique index — writers that don't pass a key are unaffected.
CREATE UNIQUE INDEX idx_pdt_idempotency
  ON parent_daily_tasks(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Hot path for cap checks and parent dashboard reads (active-only lookups).
CREATE INDEX idx_pdt_active_lookup
  ON parent_daily_tasks(child_id, status, task_date)
  WHERE status = 'active';

-- Keep is_completed in sync with status for the transition period.
-- PR 2.5 migrates readers to status; PR 3 drops is_completed.
CREATE OR REPLACE FUNCTION fn_pdt_status_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.is_completed = false THEN
    NEW.is_completed := true;
    IF NEW.completed_at IS NULL THEN NEW.completed_at := NOW(); END IF;
  ELSIF NEW.is_completed = true AND NEW.status NOT IN ('completed', 'cancelled') THEN
    NEW.status := 'completed';
    IF NEW.completed_at IS NULL THEN NEW.completed_at := NOW(); END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pdt_status_sync
  BEFORE INSERT OR UPDATE ON parent_daily_tasks
  FOR EACH ROW EXECUTE FUNCTION fn_pdt_status_sync();
