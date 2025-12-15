-- ============================================================
-- YESTORYD ADMIN CRM - Database Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. ADD LEAD STATUS TO CHILDREN TABLE
-- ============================================================
-- Status flow: assessed → contacted → call_scheduled → call_done → enrolled → active → completed → churned

ALTER TABLE children 
ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'assessed';

ALTER TABLE children 
ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'website';

ALTER TABLE children 
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE children 
ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE children 
ADD COLUMN IF NOT EXISTS assigned_to TEXT;

ALTER TABLE children 
ADD COLUMN IF NOT EXISTS lead_notes TEXT;

-- Create index for lead status queries
CREATE INDEX IF NOT EXISTS idx_children_lead_status ON children(lead_status);
CREATE INDEX IF NOT EXISTS idx_children_next_followup ON children(next_followup_at);

-- 2. CREATE INTERACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
  
  -- Interaction details
  type TEXT NOT NULL, -- 'call', 'whatsapp', 'email', 'note', 'meeting'
  direction TEXT, -- 'inbound', 'outbound', null for notes
  status TEXT, -- 'completed', 'no_answer', 'scheduled', 'cancelled'
  
  -- Content
  summary TEXT NOT NULL,
  duration_minutes INTEGER, -- For calls/meetings
  
  -- Outcome
  outcome TEXT, -- 'interested', 'not_interested', 'callback', 'enrolled', 'no_response'
  next_action TEXT,
  next_followup_at TIMESTAMP WITH TIME ZONE,
  
  -- Meta
  logged_by TEXT NOT NULL, -- Email of person who logged
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_interactions_child ON interactions(child_id);
CREATE INDEX IF NOT EXISTS idx_interactions_parent ON interactions(parent_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);
CREATE INDEX IF NOT EXISTS idx_interactions_created ON interactions(created_at DESC);

-- 3. CREATE LEAD STATUS HISTORY TABLE (for tracking changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_history_child ON lead_status_history(child_id);

-- 4. INSERT DEFAULT LEAD STATUSES INTO SITE_SETTINGS (for reference)
-- ============================================================
INSERT INTO site_settings (category, key, value, description) VALUES
('crm', 'lead_statuses', '["assessed", "contacted", "call_scheduled", "call_done", "enrolled", "active", "completed", "churned"]', 'Available lead status options'),
('crm', 'lead_sources', '["website", "whatsapp", "referral", "social_media", "coach_lead", "other"]', 'Lead source options'),
('crm', 'interaction_types', '["call", "whatsapp", "email", "note", "meeting"]', 'Interaction type options'),
('crm', 'interaction_outcomes', '["interested", "not_interested", "callback", "enrolled", "no_response"]', 'Interaction outcome options')
ON CONFLICT (key) DO NOTHING;

-- 5. UPDATE EXISTING CHILDREN TO HAVE PROPER LEAD STATUS
-- ============================================================
-- Set enrolled children to 'active' status
UPDATE children 
SET lead_status = 'active' 
WHERE enrolled_at IS NOT NULL 
  AND lead_status = 'assessed';

-- 6. CREATE VIEW FOR CRM DASHBOARD
-- ============================================================
CREATE OR REPLACE VIEW crm_leads_view AS
SELECT 
  c.id,
  c.name AS child_name,
  c.age,
  c.lead_status,
  c.lead_source,
  c.last_contacted_at,
  c.next_followup_at,
  c.assigned_to,
  c.lead_notes,
  c.created_at AS assessed_at,
  c.enrolled_at,
  p.name AS parent_name,
  p.email AS parent_email,
  p.phone AS parent_phone,
  co.name AS coach_name,
  co.email AS coach_email,
  (
    SELECT json_agg(json_build_object(
      'id', le.id,
      'event_type', le.event_type,
      'event_data', le.event_data,
      'created_at', le.created_at
    ) ORDER BY le.created_at DESC)
    FROM learning_events le 
    WHERE le.child_id = c.id 
    AND le.event_type = 'assessment'
    LIMIT 1
  ) AS latest_assessment,
  (
    SELECT COUNT(*) 
    FROM interactions i 
    WHERE i.child_id = c.id
  ) AS interaction_count,
  (
    SELECT json_agg(json_build_object(
      'id', i.id,
      'type', i.type,
      'summary', i.summary,
      'outcome', i.outcome,
      'created_at', i.created_at
    ) ORDER BY i.created_at DESC)
    FROM interactions i 
    WHERE i.child_id = c.id
    LIMIT 5
  ) AS recent_interactions
FROM children c
LEFT JOIN parents p ON c.parent_id = p.id
LEFT JOIN coaches co ON c.coach_id = co.id
ORDER BY c.created_at DESC;

-- 7. CREATE FUNCTION FOR LEAD PIPELINE STATS
-- ============================================================
CREATE OR REPLACE FUNCTION get_lead_pipeline_stats()
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  total_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM children;
  
  RETURN QUERY
  SELECT 
    c.lead_status,
    COUNT(*)::BIGINT,
    ROUND((COUNT(*)::NUMERIC / NULLIF(total_count, 0)) * 100, 1)
  FROM children c
  GROUP BY c.lead_status
  ORDER BY 
    CASE c.lead_status
      WHEN 'assessed' THEN 1
      WHEN 'contacted' THEN 2
      WHEN 'call_scheduled' THEN 3
      WHEN 'call_done' THEN 4
      WHEN 'enrolled' THEN 5
      WHEN 'active' THEN 6
      WHEN 'completed' THEN 7
      WHEN 'churned' THEN 8
      ELSE 9
    END;
END;
$$ LANGUAGE plpgsql;

-- 8. CREATE FUNCTION FOR DAILY STATS
-- ============================================================
CREATE OR REPLACE FUNCTION get_crm_daily_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  date DATE,
  new_assessments BIGINT,
  new_enrollments BIGINT,
  interactions_logged BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.date::DATE,
    COALESCE(a.count, 0)::BIGINT AS new_assessments,
    COALESCE(e.count, 0)::BIGINT AS new_enrollments,
    COALESCE(i.count, 0)::BIGINT AS interactions_logged
  FROM generate_series(
    CURRENT_DATE - (days_back || ' days')::INTERVAL,
    CURRENT_DATE,
    '1 day'::INTERVAL
  ) AS d(date)
  LEFT JOIN (
    SELECT DATE(created_at) AS date, COUNT(*) AS count
    FROM children
    WHERE created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
    GROUP BY DATE(created_at)
  ) a ON d.date = a.date
  LEFT JOIN (
    SELECT DATE(enrolled_at) AS date, COUNT(*) AS count
    FROM children
    WHERE enrolled_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
    GROUP BY DATE(enrolled_at)
  ) e ON d.date = e.date
  LEFT JOIN (
    SELECT DATE(created_at) AS date, COUNT(*) AS count
    FROM interactions
    WHERE created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
    GROUP BY DATE(created_at)
  ) i ON d.date = i.date
  ORDER BY d.date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VERIFY CHANGES
-- ============================================================
SELECT 'Lead statuses' AS check_type, COUNT(*) AS count FROM children GROUP BY lead_status;
SELECT 'Interactions table' AS check_type, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'interactions') AS exists;
SELECT 'CRM view' AS check_type, EXISTS(SELECT 1 FROM information_schema.views WHERE table_name = 'crm_leads_view') AS exists;
