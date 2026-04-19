-- ============================================================
-- MIGRATION: WhatsApp Engine Unification
-- Date: 2026-04-16
-- Purpose: Add channel routing, idempotency, cost tracking, and
--          quiet-hours deferral to the communication pipeline.
-- ============================================================
--
-- Columns already present (NOT touched by this migration):
--   communication_templates.is_active          (boolean, default true)
--   communication_templates.wa_template_category (cost category source)
--   communication_templates.wa_variables        (ordered param list — text[])
--   communication_templates.meta_category       (legacy, left as tech-debt)
--
-- What this migration adds:
--   communication_templates: channel, cost_per_send
--   communication_logs:      idempotency_key, cost_per_send,
--                            deferred_until, channel
-- Plus 3 supporting indexes.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- communication_templates: channel + cost_per_send
-- ------------------------------------------------------------

ALTER TABLE communication_templates
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'aisensy';

ALTER TABLE communication_templates
  ADD CONSTRAINT communication_templates_channel_check
  CHECK (channel IN ('aisensy', 'leadbot', 'openclaw'));

ALTER TABLE communication_templates
  ADD COLUMN IF NOT EXISTS cost_per_send numeric(6,4);

COMMENT ON COLUMN communication_templates.channel IS
  'Send provider: aisensy (outbound templates), leadbot (Meta Cloud inbound replies), openclaw (future). Routed by sendNotification().';
COMMENT ON COLUMN communication_templates.cost_per_send IS
  'Per-send cost in INR. Utility ≈ 0.1450, marketing ≈ 1.0900, authentication ≈ 0.1000. Used for attribution + billing math.';

-- ------------------------------------------------------------
-- communication_logs: idempotency_key, cost_per_send, deferred_until, channel
-- ------------------------------------------------------------

ALTER TABLE communication_logs
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE communication_logs
  ADD CONSTRAINT communication_logs_idempotency_key_key UNIQUE (idempotency_key);

ALTER TABLE communication_logs
  ADD COLUMN IF NOT EXISTS cost_per_send numeric(6,4);

ALTER TABLE communication_logs
  ADD COLUMN IF NOT EXISTS deferred_until timestamptz;

ALTER TABLE communication_logs
  ADD COLUMN IF NOT EXISTS channel text;

COMMENT ON COLUMN communication_logs.idempotency_key IS
  'sha256(template_code + recipient_phone + IST_date + first_param). Prevents duplicate sends on QStash retry or double-fire.';
COMMENT ON COLUMN communication_logs.cost_per_send IS
  'Snapshot of template.cost_per_send at send time — protects historical billing from later template price edits.';
COMMENT ON COLUMN communication_logs.deferred_until IS
  'Set when a send is queued into quiet-hours deferral. Row logged immediately with wa_sent=false; actual send happens at this time.';
COMMENT ON COLUMN communication_logs.channel IS
  'Provider that handled the send: aisensy, leadbot, openclaw, email, sms.';

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_comm_logs_phone_date
  ON communication_logs (recipient_phone, created_at);

CREATE INDEX IF NOT EXISTS idx_comm_logs_idempotency
  ON communication_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comm_templates_channel
  ON communication_templates (channel)
  WHERE is_active = true;

COMMIT;

-- ============================================================
-- ROLLBACK (run manually if needed — NOT auto-executed)
-- ============================================================
-- BEGIN;
--
-- DROP INDEX IF EXISTS idx_comm_templates_channel;
-- DROP INDEX IF EXISTS idx_comm_logs_idempotency;
-- DROP INDEX IF EXISTS idx_comm_logs_phone_date;
--
-- ALTER TABLE communication_logs DROP COLUMN IF EXISTS channel;
-- ALTER TABLE communication_logs DROP COLUMN IF EXISTS deferred_until;
-- ALTER TABLE communication_logs DROP COLUMN IF EXISTS cost_per_send;
-- ALTER TABLE communication_logs DROP CONSTRAINT IF EXISTS communication_logs_idempotency_key_key;
-- ALTER TABLE communication_logs DROP COLUMN IF EXISTS idempotency_key;
--
-- ALTER TABLE communication_templates DROP COLUMN IF EXISTS cost_per_send;
-- ALTER TABLE communication_templates DROP CONSTRAINT IF EXISTS communication_templates_channel_check;
-- ALTER TABLE communication_templates DROP COLUMN IF EXISTS channel;
--
-- COMMIT;
-- ============================================================
