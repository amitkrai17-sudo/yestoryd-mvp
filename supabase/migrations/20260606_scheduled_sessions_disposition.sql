-- =============================================================================
-- scheduled_sessions.disposition — canonical FAULT axis for session close.
--
-- 2B.3 LOCKED MATRIX (see docs/PRODUCTS.md "Canonical counters" sibling rule):
--   delivered       -> deduct1 + pay + summary       status='completed' disposition='delivered'
--   parent_no_show  -> deduct1 + pay + NO summary     status='missed'    disposition='parent_no_show'
--   coach_no_show   -> no deduct, no pay, no summary   status='cancelled' disposition='coach_no_show'
--   coach_cancelled -> no deduct, no pay, no summary   status='cancelled' disposition='coach_cancelled'
--
-- Orthogonal to `status` (which stays free-text: completed|missed|cancelled|...). Fault lives
-- HERE so the many status-based admin readers are undisturbed. Nullable until a session is
-- closed; historical/never-closed rows stay NULL.
--
-- Additive only — no CHECK constraint (status has none either; values are enforced in the
-- application close path, not the DB, to match the existing free-text status convention).
-- Idempotent (ADD COLUMN IF NOT EXISTS). No data backfill here — the historical-9 sweep and
-- any backfill are separate, explicitly gated steps.
-- =============================================================================

ALTER TABLE scheduled_sessions
  ADD COLUMN IF NOT EXISTS disposition text;

COMMENT ON COLUMN scheduled_sessions.disposition IS
  'Canonical fault axis at session close: delivered | parent_no_show | coach_no_show | coach_cancelled. Nullable until close. Orthogonal to status. Balance/counters never move from this column — it records WHO, not the side effect (deduct via ledger, no-show count via orchestrator dispatch).';
