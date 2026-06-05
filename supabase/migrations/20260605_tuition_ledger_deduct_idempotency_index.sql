-- ============================================================
-- 20260605_tuition_ledger_deduct_idempotency_index.sql
-- PURPOSE: Repo record of the partial UNIQUE index enforcing one deduct row per
--          session on tuition_session_ledger. Backs the INSERT-FIRST idempotency
--          guard in lib/tuition/balance-tracker.ts (deductTuitionBalance, Phase 2B.1).
--
-- STATUS: ALREADY APPLIED to production via Supabase MCP (Claude Web, verified
--         2026-06-05; V3 audit returned ZERO duplicate deduct rows, so creation
--         succeeded with no cleanup). This file is the REPO RECORD ONLY — the
--         `IF NOT EXISTS` clause makes re-application a safe no-op. Do NOT re-run.
--
-- EFFECT: A repeated deduct for the same session_id (reason='session_completed')
--         now collides on this index → Postgres 23505 → deductTuitionBalance skips
--         the balance decrement and returns { idempotentSkip: true } (no throw).
--
-- Partial + session_id-only is deliberate: tuition_session_ledger.session_id is
-- NULLABLE and balance-ADD rows (initial_purchase / renewal / top_up / admin_*)
-- carry session_id = NULL with a different `reason`; scoping to
-- reason='session_completed' AND session_id IS NOT NULL leaves those untouched.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tuition_ledger_deduct_session
  ON public.tuition_session_ledger (session_id)
  WHERE reason = 'session_completed' AND session_id IS NOT NULL;

-- Rollback (manual; not part of normal flow):
-- DROP INDEX IF EXISTS public.uniq_tuition_ledger_deduct_session;
