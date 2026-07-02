-- ALREADY APPLIED to prod via MCP 2026-06-30. Repo parity. DO NOT re-run.
-- Removes the gen_random_uuid() default so batch_id can never be silently populated with an
-- id that has no tuition_batches row (post-2A: batch_id is NOT NULL + FK -> tuition_batches).
-- The create path (createTuitionOnboarding) now always supplies a real batch_id.
-- ROLLBACK: ALTER TABLE tuition_onboarding ALTER COLUMN batch_id SET DEFAULT gen_random_uuid();
--
-- Idempotent: DROP DEFAULT is a no-op if the default is already dropped — no guard needed.

ALTER TABLE tuition_onboarding ALTER COLUMN batch_id DROP DEFAULT;
