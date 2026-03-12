-- ============================================================================
-- DROP REDUNDANT TABLES — Schema Cleanup Phase 2
-- Date: 2026-03-06
-- Evidence: _temp/empty-tables-categorized.md
-- ============================================================================
-- Each table below has been verified as GENUINELY REDUNDANT:
--   - Zero application code references, OR
--   - Replaced by a canonical table that the codebase actively uses
-- ============================================================================

-- ── Views first (dependency order) ──

-- book_popularity depends on book_requests
DROP VIEW IF EXISTS book_popularity CASCADE;

-- ── Redundant / dead tables ──

-- phone_backup_20260117: Date-suffixed backup table, 17 rows, 0 code refs
DROP TABLE IF EXISTS phone_backup_20260117 CASCADE;

-- child_rag_profiles: 0 rows, superseded by child_intelligence_profiles (14 files)
-- assessment/final/submit migrated to use child_intelligence_profiles
DROP TABLE IF EXISTS child_rag_profiles CASCADE;

-- termination_logs: 0 rows, 0 code refs. Superseded by enrollment_terminations (3 files)
DROP TABLE IF EXISTS termination_logs CASCADE;

-- coach_earnings: 0 rows, 0 code refs. Superseded by coach_payouts (9 files)
DROP TABLE IF EXISTS coach_earnings CASCADE;

-- book_reads: 0 rows, 0 code refs. Content tracking done by el_child_video_progress
DROP TABLE IF EXISTS book_reads CASCADE;

-- coupon_uses: 0 rows, split-brain duplicate of coupon_usages (3 files)
-- payment/create migrated to use coupon_usages
DROP TABLE IF EXISTS coupon_uses CASCADE;

-- book_requests: 0 rows, 0 code refs, 16-column orphaned feature (book recommendations)
DROP TABLE IF EXISTS book_requests CASCADE;

-- reading_goals: 0 rows, 0 code refs, orphaned feature (goal tracking)
DROP TABLE IF EXISTS reading_goals CASCADE;

-- parent_communications: 0 rows, 0 code refs, orphaned feature
-- Previous audit (20260214) marked "NOT DROPPING — may be future feature"
-- Confirmed dead after full code + view + trigger audit
DROP TABLE IF EXISTS parent_communications CASCADE;
