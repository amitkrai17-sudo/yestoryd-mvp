-- ============================================================
-- Migration: Lead Bot scale indices (Phase 1a + 1d support)
--
-- 1a: idx_children_parent_phone — enrolled-parent lookup on every inbound
--     WhatsApp message. At 12 rows today it's a seq scan (fine). Added now
--     so behavior is unchanged as we grow past ~5k children.
--
-- 1d: idx_wa_lead_conversations_last_message_at — nightly cleanup cron
--     queries WHERE last_message_at < now() - interval '30 days'. Index
--     keeps the sweep cheap as conversation count grows.
--
-- NOTE: 1b (normalization trigger on children.parent_phone) already shipped
-- in 20260406_phone_normalization_trigger.sql — no-op here.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_children_parent_phone
  ON children (parent_phone)
  WHERE parent_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_lead_conversations_last_message_at
  ON wa_lead_conversations (last_message_at);
