-- Recall Reconciliation Logs
-- Tracks reconciliation attempts for sessions with missing transcripts

CREATE TABLE IF NOT EXISTS recall_reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES scheduled_sessions(id) ON DELETE CASCADE,
  bot_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('recovered', 'no_transcript', 'bot_not_found', 'no_bot', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reconciliation_logs_session_id ON recall_reconciliation_logs(session_id);
CREATE INDEX idx_reconciliation_logs_status ON recall_reconciliation_logs(status);
CREATE INDEX idx_reconciliation_logs_created_at ON recall_reconciliation_logs(created_at);
