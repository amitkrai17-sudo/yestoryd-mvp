-- Session change requests: parent-initiated cancel/reschedule requests
CREATE TABLE IF NOT EXISTS session_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES scheduled_sessions(id),
  parent_id UUID NOT NULL REFERENCES parents(id),
  request_type VARCHAR NOT NULL CHECK (request_type IN ('cancel', 'reschedule')),
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason VARCHAR NOT NULL,
  requested_date DATE NULL,
  requested_time TIME NULL,
  admin_notes TEXT NULL,
  reviewed_by UUID NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_session_change_requests_session ON session_change_requests(session_id);
CREATE INDEX idx_session_change_requests_parent ON session_change_requests(parent_id);
CREATE INDEX idx_session_change_requests_status ON session_change_requests(status);
