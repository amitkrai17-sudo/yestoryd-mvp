-- 1. Enrollment columns for tuition
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS session_rate INTEGER;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS sessions_remaining INTEGER;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS billing_model TEXT DEFAULT 'prepaid_season';
CREATE INDEX IF NOT EXISTS idx_enrollments_tuition
  ON enrollments(enrollment_type, status)
  WHERE enrollment_type = 'tuition';

-- 2. Session ledger (audit trail)
CREATE TABLE IF NOT EXISTS tuition_session_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  change_amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  session_id UUID REFERENCES scheduled_sessions(id),
  payment_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tuition_ledger_enrollment
  ON tuition_session_ledger(enrollment_id, created_at DESC);

-- 3. Tuition onboarding (split form tracking)
CREATE TABLE IF NOT EXISTS tuition_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id),
  parent_id UUID REFERENCES parents(id),
  coach_id UUID NOT NULL REFERENCES coaches(id),
  child_name TEXT NOT NULL,
  child_approximate_age INTEGER,
  session_rate INTEGER NOT NULL,
  sessions_purchased INTEGER NOT NULL,
  session_duration_minutes INTEGER DEFAULT 60,
  sessions_per_week INTEGER DEFAULT 2,
  schedule_preference TEXT,
  default_session_mode TEXT DEFAULT 'offline',
  parent_phone TEXT NOT NULL,
  parent_name_hint TEXT,
  admin_notes TEXT,
  admin_filled_at TIMESTAMPTZ DEFAULT NOW(),
  admin_filled_by TEXT,
  parent_form_token TEXT NOT NULL UNIQUE,
  parent_form_token_expires_at TIMESTAMPTZ NOT NULL,
  parent_form_completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tuition_onboarding_token
  ON tuition_onboarding(parent_form_token)
  WHERE status IN ('parent_pending', 'parent_completed');
