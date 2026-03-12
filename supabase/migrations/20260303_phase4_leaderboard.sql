-- =============================================================================
-- MIGRATION: Phase 4 — Featured Coach badge support
-- Date: 2026-03-03
-- =============================================================================

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;
