-- ============================================================
-- Migration: coach_specializations table
-- Links coaches to skill areas for smart matching
-- ============================================================

CREATE TABLE IF NOT EXISTS coach_specializations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  skill_area TEXT NOT NULL,
  proficiency_level INT NOT NULL DEFAULT 3 CHECK (proficiency_level BETWEEN 1 AND 5),
  certified BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_coach_skill UNIQUE (coach_id, skill_area)
);

CREATE INDEX IF NOT EXISTS idx_specializations_coach
  ON coach_specializations(coach_id);

CREATE INDEX IF NOT EXISTS idx_specializations_skill
  ON coach_specializations(skill_area);
