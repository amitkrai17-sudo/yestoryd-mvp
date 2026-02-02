-- Create pending_assessments table for graceful AI degradation
-- When all AI providers fail, assessments are queued here for async retry

CREATE TABLE IF NOT EXISTS pending_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name TEXT NOT NULL,
  child_age INTEGER NOT NULL,
  parent_email TEXT NOT NULL,
  parent_name TEXT,
  parent_phone TEXT,
  audio_url TEXT, -- truncated reference for logging
  audio_data TEXT NOT NULL, -- base64 audio for retry
  passage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  result JSONB, -- analysis result once completed
  ai_provider_used TEXT, -- which provider succeeded on retry
  lead_source TEXT DEFAULT 'yestoryd',
  lead_source_coach_id UUID,
  referral_code_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Index for retry queue processing
CREATE INDEX IF NOT EXISTS idx_pending_assessments_status ON pending_assessments(status) WHERE status IN ('pending', 'processing');

-- RLS: Only service role can access (cron/API routes use service key)
ALTER TABLE pending_assessments ENABLE ROW LEVEL SECURITY;
