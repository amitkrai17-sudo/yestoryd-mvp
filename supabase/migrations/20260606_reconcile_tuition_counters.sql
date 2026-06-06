-- =============================================================================
-- reconcile_tuition_counters — rebuild the DERIVED enrollment counters
-- (sessions_remaining, sessions_completed) from the CANONICAL tuition_session_ledger.
--
-- Option A (2B.2 — see docs/PRODUCTS.md "Canonical counters"): tuition_session_ledger
-- is the single source of truth for tuition balance + billed-session count.
-- enrollments.sessions_remaining / sessions_completed are a derived cache, written
-- only inside the ledger-writing path (deductTuitionBalance / addTuitionBalance) and
-- rebuildable anytime by this function.
--
--   sessions_completed ≡ BILLED   = COUNT(ledger WHERE reason='session_completed')
--   sessions_remaining ≡ NET      = SUM(ledger.change_amount)   (COALESCE 0)
--
-- delivered / billed / delivered_minus_billed / overdue_open are CROSS-CHECK reports
-- only — never folded into the counters.
--
-- p_apply=false (default) -> dry run, never writes (apply_skipped_reason='dry_run').
-- p_apply=true            -> writes ONLY a live, active, non-paused, non-switched,
--                            non-terminated tuition enrollment; otherwise returns the
--                            computed values with apply_skipped_reason set, writes nothing.
--
-- Idempotent / re-runnable (CREATE OR REPLACE; recompute is a pure projection).
-- One enrollment per call — caller loops/aggregates.
-- SECURITY: standard (INVOKER) — intended for service-role callers. No side effects
-- beyond the single guarded counter UPDATE.
-- =============================================================================

CREATE OR REPLACE FUNCTION reconcile_tuition_counters(
  p_enrollment_id uuid,
  p_apply boolean DEFAULT false
)
RETURNS TABLE (
  enrollment_id            uuid,
  old_completed            int,
  new_completed            int,
  old_remaining            int,
  new_remaining            int,
  delivered                int,   -- COUNT(scheduled_sessions status='completed')
  billed                   int,   -- COUNT(ledger reason='session_completed')  == new_completed
  delivered_minus_billed   int,
  overdue_open             int,   -- COUNT(scheduled_sessions status='scheduled' AND scheduled_date < CURRENT_DATE)
  apply_skipped_reason     text   -- NULL if written; else why the guard blocked the write
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_enr            enrollments%ROWTYPE;
  v_old_completed  int;
  v_old_remaining  int;
  v_new_completed  int;
  v_new_remaining  int;
  v_delivered      int;
  v_billed         int;
  v_overdue        int;
  v_skip           text;
BEGIN
  -- Load the enrollment (guard columns + current cached counters)
  SELECT * INTO v_enr FROM enrollments WHERE id = p_enrollment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reconcile_tuition_counters: enrollment % not found', p_enrollment_id;
  END IF;

  v_old_completed := COALESCE(v_enr.sessions_completed, 0);
  v_old_remaining := COALESCE(v_enr.sessions_remaining, 0);

  -- CANONICAL recompute from the ledger (the source of truth)
  SELECT COUNT(*)::int
    INTO v_new_completed
    FROM tuition_session_ledger l
   WHERE l.enrollment_id = p_enrollment_id
     AND l.reason = 'session_completed';

  SELECT COALESCE(SUM(l.change_amount), 0)::int
    INTO v_new_remaining
    FROM tuition_session_ledger l
   WHERE l.enrollment_id = p_enrollment_id;

  -- CROSS-CHECK (report only — NEVER folded into the counters)
  SELECT COUNT(*)::int
    INTO v_delivered
    FROM scheduled_sessions s
   WHERE s.enrollment_id = p_enrollment_id
     AND s.status = 'completed';

  v_billed := v_new_completed;  -- billed == ledger deduct count, by definition

  SELECT COUNT(*)::int
    INTO v_overdue
    FROM scheduled_sessions s
   WHERE s.enrollment_id = p_enrollment_id
     AND s.status = 'scheduled'
     AND s.scheduled_date < CURRENT_DATE;

  -- WRITE RULE: dry-run, type/state guards, else apply.
  IF NOT p_apply THEN
    v_skip := 'dry_run';
  ELSIF v_enr.enrollment_type IS DISTINCT FROM 'tuition' THEN
    -- safety: recompute is from the TUITION ledger; never project it onto a
    -- non-tuition enrollment (would zero a coaching enrollment's counters).
    v_skip := 'not_tuition';
  ELSIF v_enr.status IS DISTINCT FROM 'active' THEN
    v_skip := 'status_not_active';
  ELSIF COALESCE(v_enr.is_paused, false) THEN
    v_skip := 'paused';
  ELSIF v_enr.switched_from_enrollment_id IS NOT NULL THEN
    v_skip := 'switched';
  ELSIF v_enr.terminated_at IS NOT NULL THEN
    v_skip := 'terminated';
  ELSE
    v_skip := NULL;
    UPDATE enrollments
       SET sessions_completed = v_new_completed,
           sessions_remaining = v_new_remaining,
           updated_at         = now()
     WHERE id = p_enrollment_id;
  END IF;

  RETURN QUERY SELECT
    p_enrollment_id,
    v_old_completed,
    v_new_completed,
    v_old_remaining,
    v_new_remaining,
    v_delivered,
    v_billed,
    v_delivered - v_billed,
    v_overdue,
    v_skip;
END;
$$;
