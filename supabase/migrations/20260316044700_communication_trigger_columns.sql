-- ============================================================================
-- COMMUNICATION TRIGGER COLUMNS
-- Date: 2026-03-16
-- Adds columns to support manual template-based message triggers by coaches/admins
-- ============================================================================

-- 1. communication_templates: filter which templates appear in which trigger context
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS trigger_contexts TEXT[] DEFAULT '{}';
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS coach_can_trigger BOOLEAN DEFAULT false;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS admin_can_trigger BOOLEAN DEFAULT true;

-- 2. communication_logs: track who manually triggered a message
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS triggered_by TEXT DEFAULT 'system';
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS triggered_by_user_id UUID;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS context_type TEXT;
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS context_id UUID;

-- 3. Index for fetching templates by trigger context
CREATE INDEX IF NOT EXISTS idx_communication_templates_trigger
ON communication_templates USING GIN (trigger_contexts);

-- 4. Index for filtering logs by trigger source
CREATE INDEX IF NOT EXISTS idx_communication_logs_triggered_by
ON communication_logs (triggered_by, created_at DESC);
