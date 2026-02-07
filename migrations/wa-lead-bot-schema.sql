-- ============================================================
-- WhatsApp Lead Bot Schema
-- Phone: +91 85912 87997 (Meta Cloud API)
-- ============================================================
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. wa_lead_conversations
-- One row per phone number, tracks bot state machine
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_lead_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  current_state TEXT NOT NULL DEFAULT 'GREETING'
    CHECK (current_state IN (
      'GREETING', 'QUALIFYING', 'COLLECTING_CHILD_AGE', 'COLLECTING_CONCERNS',
      'ASSESSMENT_OFFERED', 'DISCOVERY_OFFERED', 'NURTURING', 'ESCALATED', 'COMPLETED'
    )),
  collected_data JSONB NOT NULL DEFAULT '{}',
  lead_score INTEGER NOT NULL DEFAULT 0,
  is_bot_active BOOLEAN NOT NULL DEFAULT true,
  assigned_agent TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_given_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  child_id UUID REFERENCES children(id),
  discovery_call_id UUID REFERENCES discovery_calls(id)
);

CREATE INDEX IF NOT EXISTS idx_wa_lead_conv_phone ON wa_lead_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_lead_conv_state ON wa_lead_conversations(current_state);
CREATE INDEX IF NOT EXISTS idx_wa_lead_conv_active ON wa_lead_conversations(is_bot_active) WHERE is_bot_active = true;
CREATE INDEX IF NOT EXISTS idx_wa_lead_conv_last_msg ON wa_lead_conversations(last_message_at DESC);

COMMENT ON TABLE wa_lead_conversations IS 'WhatsApp Lead Bot conversations - one per phone number';
COMMENT ON COLUMN wa_lead_conversations.current_state IS 'Bot state machine state';
COMMENT ON COLUMN wa_lead_conversations.collected_data IS 'Data collected during conversation (child age, concerns, etc)';
COMMENT ON COLUMN wa_lead_conversations.is_bot_active IS 'False when escalated to human agent';

-- ============================================================
-- 2. wa_lead_messages
-- All messages in/out for the lead bot
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_lead_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES wa_lead_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'bot', 'agent')),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  wa_message_id TEXT UNIQUE,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_lead_msg_conv ON wa_lead_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_lead_msg_wa_id ON wa_lead_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_lead_msg_direction ON wa_lead_messages(direction, created_at DESC);

COMMENT ON TABLE wa_lead_messages IS 'All inbound/outbound messages for WhatsApp Lead Bot';
COMMENT ON COLUMN wa_lead_messages.wa_message_id IS 'Meta message ID for deduplication (wamid.xxx)';
COMMENT ON COLUMN wa_lead_messages.sender_type IS 'user=parent, bot=AI, agent=human coach';

-- ============================================================
-- 3. wa_leads
-- Lead CRM record - one per phone number
-- ============================================================
CREATE TABLE IF NOT EXISTS wa_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  parent_name TEXT,
  child_name TEXT,
  child_age INTEGER,
  reading_concerns TEXT,
  urgency TEXT,
  city TEXT,
  school TEXT,
  source TEXT NOT NULL DEFAULT 'whatsapp_leadbot',
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'qualifying', 'qualified', 'assessment_taken', 'discovery_booked',
                      'discovery_done', 'enrolled', 'lost', 'nurturing')),
  lead_score INTEGER NOT NULL DEFAULT 0,
  conversation_id UUID REFERENCES wa_lead_conversations(id),
  child_id UUID REFERENCES children(id),
  discovery_call_id UUID REFERENCES discovery_calls(id),
  enrollment_id UUID REFERENCES enrollments(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_leads_phone ON wa_leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_leads_status ON wa_leads(status);
CREATE INDEX IF NOT EXISTS idx_wa_leads_source ON wa_leads(source);
CREATE INDEX IF NOT EXISTS idx_wa_leads_score ON wa_leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_wa_leads_created ON wa_leads(created_at DESC);

COMMENT ON TABLE wa_leads IS 'WhatsApp Lead Bot CRM - tracks lead lifecycle';

-- ============================================================
-- 4. ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE wa_lead_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_lead_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_leads ENABLE ROW LEVEL SECURITY;

-- Service role has full access (API routes use service role key)
CREATE POLICY "service_role_all" ON wa_lead_conversations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON wa_lead_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all" ON wa_leads
  FOR ALL USING (auth.role() = 'service_role');

-- Admin read access (admin emails stored in site_settings as JSON array)
-- Checks if the authenticated user's email is in the admin_emails list
CREATE POLICY "admin_read" ON wa_lead_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM site_settings
      WHERE key = 'admin_emails'
      AND value::jsonb ? (
        SELECT lower(email) FROM auth.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "admin_read" ON wa_lead_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM site_settings
      WHERE key = 'admin_emails'
      AND value::jsonb ? (
        SELECT lower(email) FROM auth.users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "admin_read" ON wa_leads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM site_settings
      WHERE key = 'admin_emails'
      AND value::jsonb ? (
        SELECT lower(email) FROM auth.users WHERE id = auth.uid()
      )
    )
  );

-- ============================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_wa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wa_lead_conversations_updated_at
  BEFORE UPDATE ON wa_lead_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_wa_updated_at();

CREATE TRIGGER wa_leads_updated_at
  BEFORE UPDATE ON wa_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_wa_updated_at();

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('wa_lead_conversations', 'wa_lead_messages', 'wa_leads')
ORDER BY table_name, ordinal_position;
