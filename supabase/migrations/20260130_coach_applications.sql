-- ============================================================================
-- Migration: 20260130_coach_applications
-- Description: Complete coach application and recruitment system
-- ============================================================================

-- ============================================
-- TABLE: coach_applications
-- ============================================

CREATE TABLE IF NOT EXISTS coach_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number TEXT UNIQUE,

    -- Personal Information
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp_phone TEXT,
    city TEXT,
    state TEXT,
    profile_photo_url TEXT,

    -- Professional Background
    education_level TEXT,
    teaching_experience_years INTEGER DEFAULT 0,
    current_occupation TEXT,
    organization_name TEXT,
    certifications JSONB DEFAULT '[]',

    -- Qualification Checklist
    qualification_responses JSONB,
    resume_url TEXT,

    -- Audio Statement
    audio_statement_url TEXT,
    audio_duration_seconds INTEGER,

    -- AI Assessment
    ai_assessment_status TEXT DEFAULT 'pending',
    ai_assessment_started_at TIMESTAMPTZ,
    ai_assessment_completed_at TIMESTAMPTZ,
    ai_responses JSONB DEFAULT '[]',
    ai_total_score DECIMAL(4,2),
    ai_score_breakdown JSONB,

    -- Interview (Human)
    interview_scheduled_at TIMESTAMPTZ,
    interview_notes TEXT,
    google_event_id TEXT,
    google_meet_link TEXT,
    interview_completed_at TIMESTAMPTZ,
    interview_score INTEGER,
    interview_feedback JSONB,
    interview_outcome TEXT,

    -- Application Status
    status TEXT DEFAULT 'started' CHECK (status IN (
        'started', 'applied', 'ai_assessment_in_progress', 'ai_assessment_complete',
        'qualified', 'not_qualified',
        'interview_scheduled', 'interview_completed',
        'approved', 'rejected', 'on_hold', 'withdrawn'
    )),

    -- Admin Review
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,

    -- Links
    coach_id UUID,

    -- Source Tracking
    source TEXT DEFAULT 'organic',
    referral_code_used TEXT,

    -- Notification tracking
    approved_notification_sent BOOLEAN DEFAULT false,
    approved_notification_date TIMESTAMPTZ,
    rejected_notification_sent BOOLEAN DEFAULT false,
    rejected_notification_date TIMESTAMPTZ,
    qualified_notification_sent BOOLEAN DEFAULT false,
    qualified_notification_date TIMESTAMPTZ,
    hold_notification_sent BOOLEAN DEFAULT false,
    hold_notification_date TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_coach_applications_status ON coach_applications(status);
CREATE INDEX IF NOT EXISTS idx_coach_applications_email ON coach_applications(email);
CREATE INDEX IF NOT EXISTS idx_coach_applications_created_at ON coach_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_applications_ai_score ON coach_applications(ai_total_score DESC);

-- ============================================
-- APPLICATION NUMBER SEQUENCE
-- ============================================

CREATE SEQUENCE IF NOT EXISTS coach_application_seq START 1;

CREATE OR REPLACE FUNCTION generate_coach_application_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.application_number IS NULL THEN
        NEW.application_number := 'YA-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
                                  LPAD(nextval('coach_application_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_coach_application_number ON coach_applications;
CREATE TRIGGER set_coach_application_number
    BEFORE INSERT ON coach_applications
    FOR EACH ROW
    EXECUTE FUNCTION generate_coach_application_number();

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_coach_app_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_coach_applications_updated_at ON coach_applications;
CREATE TRIGGER update_coach_applications_updated_at
    BEFORE UPDATE ON coach_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_coach_app_updated_at();

-- ============================================
-- COACHES TABLE ADDITIONS
-- ============================================

ALTER TABLE coaches ADD COLUMN IF NOT EXISTS application_id UUID;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS referral_link TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS bank_ifsc TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS razorpay_contact_id TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS razorpay_fund_account_id TEXT;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS payout_enabled BOOLEAN DEFAULT false;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- ============================================
-- SITE SETTINGS FOR COACH JOURNEY
-- ============================================

INSERT INTO site_settings (key, value, category, description) VALUES
('coach_whatsapp_number', '918976287997', 'coach', 'WhatsApp number for coach support'),
('coach_earnings_yestoryd_lead', '2500', 'coach', 'Earnings per child for Yestoryd-sourced leads'),
('coach_earnings_coach_lead', '3500', 'coach', 'Earnings per child for coach-sourced leads'),
('coach_admin_email', 'engage@yestoryd.com', 'coach', 'Admin email for coach communications'),
('coach_rucha_email', 'rucha.rai@yestoryd.com', 'coach', 'Rucha email for interviews'),
('coach_interview_duration_minutes', '20', 'coach', 'Interview duration in minutes'),
('coach_assessment_pass_score', '6', 'coach', 'Minimum score to pass AI assessment (out of 10)'),
('site_base_url', 'https://yestoryd.com', 'general', 'Base URL for the site'),
('coach_from_email', 'Yestoryd Academy <academy@yestoryd.com>', 'coach', 'From email for coach communications'),
('coach_referral_bonus', '500', 'coach', 'Bonus for referring another coach')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE coach_applications ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so API routes using service key work fine.
-- These policies are for direct Supabase client access:

CREATE POLICY IF NOT EXISTS public_insert_coach_applications ON coach_applications
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY IF NOT EXISTS applicant_view_own_application ON coach_applications
    FOR SELECT TO authenticated
    USING (email = auth.jwt() ->> 'email');

CREATE POLICY IF NOT EXISTS applicant_update_own_application ON coach_applications
    FOR UPDATE TO authenticated
    USING (
        email = auth.jwt() ->> 'email'
        AND status IN ('started', 'applied', 'ai_assessment_in_progress')
    );

COMMENT ON TABLE coach_applications IS 'Coach recruitment applications for Yestoryd Academy';
