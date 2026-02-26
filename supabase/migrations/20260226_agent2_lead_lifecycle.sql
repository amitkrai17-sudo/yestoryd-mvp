-- ============================================================
-- Agent 2: Lead Lifecycle State Machine + Decision Audit Log
-- Core tables for the autonomous Lead Response Agent
-- ============================================================
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS lead_lifecycle_updated_at ON lead_lifecycle;
--   DROP FUNCTION IF EXISTS update_lead_lifecycle_updated_at();
--   DROP TABLE IF EXISTS agent_actions;
--   DROP TABLE IF EXISTS lead_lifecycle;

-- ============================================================
-- 1. lead_lifecycle — unified lead state machine
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to existing tables
  wa_lead_id UUID REFERENCES wa_leads(id),
  child_id UUID REFERENCES children(id),

  -- State machine
  current_state TEXT NOT NULL DEFAULT 'new'
    CHECK (current_state IN (
      'new', 'engaging', 'qualifying', 'assessed', 'qualified',
      'slot_offered', 'booked', 'nurturing', 'converting',
      'enrolled', 'cold', 'escalated'
    )),
  previous_state TEXT,
  state_changed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Qualification data (enriched by agent)
  child_age INTEGER,
  child_name TEXT,
  parent_concerns TEXT[],
  reading_level_estimate TEXT,
  urgency_score INTEGER CHECK (urgency_score BETWEEN 1 AND 10),
  budget_signal TEXT CHECK (budget_signal IN (
    'ready_to_pay', 'value_focused', 'price_sensitive', 'unknown'
  )),

  -- Lead scoring (enhanced)
  ai_lead_score DECIMAL(5,2) DEFAULT 0,
  score_factors JSONB DEFAULT '{}',

  -- Nurture tracking
  nurture_sequence TEXT,
  nurture_step INTEGER DEFAULT 0,
  next_nurture_at TIMESTAMPTZ,

  -- Source attribution
  lead_source TEXT DEFAULT 'whatsapp',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_lifecycle_state ON lead_lifecycle(current_state);
CREATE INDEX idx_lead_lifecycle_nurture ON lead_lifecycle(next_nurture_at)
  WHERE nurture_sequence IS NOT NULL;
CREATE INDEX idx_lead_lifecycle_score ON lead_lifecycle(ai_lead_score DESC);
CREATE INDEX idx_lead_lifecycle_wa_lead ON lead_lifecycle(wa_lead_id);

-- RLS: service_role bypass, no direct client access
ALTER TABLE lead_lifecycle ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. agent_actions — decision audit log
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL DEFAULT 'agent_2_lead_response',
  action_type TEXT NOT NULL,
  lead_lifecycle_id UUID REFERENCES lead_lifecycle(id),
  wa_lead_id UUID REFERENCES wa_leads(id),
  context_json JSONB,
  decision TEXT,
  reasoning TEXT,
  confidence_score DECIMAL(3,2),
  outcome TEXT DEFAULT 'pending',
  outcome_details JSONB,
  escalated_to_human BOOLEAN DEFAULT FALSE,
  escalation_reason TEXT,
  human_override TEXT,
  execution_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_actions_lead ON agent_actions(lead_lifecycle_id);
CREATE INDEX idx_agent_actions_type ON agent_actions(action_type, created_at DESC);
CREATE INDEX idx_agent_actions_escalated ON agent_actions(escalated_to_human)
  WHERE escalated_to_human = TRUE;

-- RLS: service_role bypass, no direct client access
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Auto-update trigger for lead_lifecycle
-- ============================================================

CREATE OR REPLACE FUNCTION update_lead_lifecycle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.current_state != OLD.current_state THEN
    NEW.previous_state = OLD.current_state;
    NEW.state_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_lifecycle_updated_at
  BEFORE UPDATE ON lead_lifecycle
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_lifecycle_updated_at();
