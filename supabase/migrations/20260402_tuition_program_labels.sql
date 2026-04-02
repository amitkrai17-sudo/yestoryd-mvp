-- Migration: 20260402_tuition_program_labels
-- Purpose: Add category_id to tuition_onboarding and program_description to enrollments
--          so parent-facing communications are enrollment-type-aware.
-- Author: Amit / Claude Code
-- Related: Audit of 64 hardcoded "reading coaching program" references

-- ═══════════════════════════════════════════════════
-- 1. tuition_onboarding.category_id (FK to skill_categories)
-- ═══════════════════════════════════════════════════

ALTER TABLE tuition_onboarding
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES skill_categories(id);

COMMENT ON COLUMN tuition_onboarding.category_id IS
  'FK to skill_categories — the subject this tuition is for. Used in parent-facing communications via parent_label.';

-- ═══════════════════════════════════════════════════
-- 2. enrollments.program_description
-- ═══════════════════════════════════════════════════

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS program_description TEXT;

COMMENT ON COLUMN enrollments.program_description IS
  'Human-readable program name for communications. Auto-populated: tuition uses skill_categories.parent_label + "Sessions", coaching uses "English Coaching Program". Fallback for comms if category lookup fails.';

-- ═══════════════════════════════════════════════════
-- 3. Backfill coaching enrollments
-- ═══════════════════════════════════════════════════

-- Backfill coaching enrollments only (prepaid_season)
-- Tuition (prepaid_sessions) left NULL — resolved dynamically via category lookup
UPDATE enrollments
SET program_description = 'English Coaching Program'
WHERE billing_model = 'prepaid_season'
  AND program_description IS NULL;
