-- ============================================================================
-- Migration: 20260130_coach_selection_enhancements
-- Description: Engagement log, waitlist status, red flag columns, reapply tracking
-- ============================================================================

-- ============================================
-- 1. COACH ENGAGEMENT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS coach_engagement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL,
  trigger_event TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  channel TEXT NOT NULL,
  template TEXT NOT NULL,
  condition TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  skip_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_pending
  ON coach_engagement_log(status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_engagement_coach
  ON coach_engagement_log(coach_id);

-- ============================================
-- 2. UPDATE coach_applications STATUS CHECK
--    Add 'waitlist' and 'borderline' statuses
-- ============================================

ALTER TABLE coach_applications
  DROP CONSTRAINT IF EXISTS coach_applications_status_check;

ALTER TABLE coach_applications
  ADD CONSTRAINT coach_applications_status_check
  CHECK (status IN (
    'started', 'applied', 'ai_assessment_in_progress', 'ai_assessment_complete',
    'qualified', 'not_qualified', 'waitlist', 'borderline',
    'interview_scheduled', 'interview_completed',
    'approved', 'rejected', 'on_hold', 'withdrawn'
  ));

-- ============================================
-- 3. RED FLAG COLUMNS
-- ============================================

ALTER TABLE coach_applications ADD COLUMN IF NOT EXISTS
  has_red_flags BOOLEAN DEFAULT false;
ALTER TABLE coach_applications ADD COLUMN IF NOT EXISTS
  red_flag_summary TEXT[];
ALTER TABLE coach_applications ADD COLUMN IF NOT EXISTS
  red_flag_severity TEXT;

-- ============================================
-- 4. REAPPLY TRACKING
-- ============================================

ALTER TABLE coach_applications ADD COLUMN IF NOT EXISTS
  can_reapply_after TIMESTAMPTZ;
ALTER TABLE coach_applications ADD COLUMN IF NOT EXISTS
  reapply_count INTEGER DEFAULT 0;
ALTER TABLE coach_applications ADD COLUMN IF NOT EXISTS
  previous_application_id UUID;

-- ============================================
-- 5. REFERRAL TRACKING ON APPLICATION
-- ============================================

ALTER TABLE coach_applications ADD COLUMN IF NOT EXISTS
  referred_by_coach_id UUID;
ALTER TABLE coach_applications ADD COLUMN IF NOT EXISTS
  referral_code_used TEXT;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE coach_engagement_log IS 'Automated engagement messages for coaches post-approval';
COMMENT ON COLUMN coach_applications.has_red_flags IS 'True if AI assessment detected behavioral concerns';
COMMENT ON COLUMN coach_applications.red_flag_severity IS 'low, medium, high, or critical';
COMMENT ON COLUMN coach_applications.can_reapply_after IS 'Earliest date candidate can reapply';
