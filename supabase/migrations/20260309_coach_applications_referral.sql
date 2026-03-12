-- Add referral_code_used column to coach_applications
-- The apply form writes this field but the column was missing
ALTER TABLE coach_applications ADD COLUMN IF NOT EXISTS referral_code_used TEXT;
