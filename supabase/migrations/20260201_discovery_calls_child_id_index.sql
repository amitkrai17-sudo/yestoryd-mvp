-- ============================================================
-- Migration: Index on discovery_calls.child_id + backfill
-- child_id column already exists; this adds index and backfills
-- unlinked records by matching parent_email to children table
-- ============================================================

-- Index for child_id lookups
CREATE INDEX IF NOT EXISTS idx_discovery_calls_child_id
  ON discovery_calls(child_id) WHERE child_id IS NOT NULL;

-- Backfill: link unlinked discovery_calls to children by parent_email match
UPDATE discovery_calls dc
SET child_id = c.id,
    updated_at = now()
FROM children c
WHERE dc.child_id IS NULL
  AND dc.parent_email = c.parent_email
  AND dc.child_name = c.child_name;
