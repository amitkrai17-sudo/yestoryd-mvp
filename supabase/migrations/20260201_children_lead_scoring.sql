-- ============================================================
-- Migration: Add lead scoring columns to children table
-- ============================================================

ALTER TABLE children
  ADD COLUMN IF NOT EXISTS lead_score INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_score_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_children_lead_score
  ON children(lead_score DESC) WHERE lead_score > 0;
