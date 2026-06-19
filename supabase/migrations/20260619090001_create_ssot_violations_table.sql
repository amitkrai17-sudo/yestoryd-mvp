-- ALREADY APPLIED to prod via MCP on 2026-06-19; file for repo parity. DO NOT re-run.
CREATE TABLE IF NOT EXISTS public.ssot_violations (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  table_name    text        NOT NULL,
  session_id    uuid        NULL,
  band          text        NOT NULL,
  changed_cols  text[]      NOT NULL,
  col           text        NOT NULL,
  old_value     text        NULL,
  new_value     text        NULL,
  db_user       text        NOT NULL,
  txid          bigint      NOT NULL,
  noted         boolean     NOT NULL DEFAULT false
);

COMMENT ON TABLE public.ssot_violations IS
  'Step 5 advisory SSOT guard log. The trigger on scheduled_sessions records every MUTATE to a funneled column (status/mode/calendar/date). Owner-writes are logged too; analysis recognizes owner SHAPES (e.g. status+completed_at+disposition = transitionSessionStatus) to surface true bypasses. Advisory only — never blocks. Hard-enforcement deferred to Phase VI.';

CREATE INDEX IF NOT EXISTS idx_ssot_violations_occurred ON public.ssot_violations (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ssot_violations_band ON public.ssot_violations (band);
CREATE INDEX IF NOT EXISTS idx_ssot_violations_txid ON public.ssot_violations (txid);
