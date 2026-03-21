-- Enrollment switching metadata
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS switched_from_enrollment_id UUID REFERENCES enrollments(id);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS switch_reason TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS resume_eligible_until TIMESTAMPTZ;

-- Add index for quickly finding paused enrollments per child
CREATE INDEX IF NOT EXISTS idx_enrollments_child_status ON enrollments(child_id, status) WHERE status IN ('active', 'paused', 'payment_pending');

-- Add index for resume eligibility checks
CREATE INDEX IF NOT EXISTS idx_enrollments_resume_eligible ON enrollments(resume_eligible_until) WHERE status = 'paused';
