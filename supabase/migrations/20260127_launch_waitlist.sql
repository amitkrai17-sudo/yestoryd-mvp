-- =============================================================================
-- YESTORYD LAUNCH WAITLIST TABLE
-- Captures users interested in locked products before March 2026 launch
-- Created: 2026-01-27
-- =============================================================================

-- =============================================================================
-- ADD LOCKED COLUMNS TO PRICING_PLANS (if not exists)
-- =============================================================================

-- Add is_locked column to pricing_plans
ALTER TABLE pricing_plans
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- Add lock_message column to pricing_plans
ALTER TABLE pricing_plans
ADD COLUMN IF NOT EXISTS lock_message TEXT;

COMMENT ON COLUMN pricing_plans.is_locked IS 'Whether this product is locked (coming soon)';
COMMENT ON COLUMN pricing_plans.lock_message IS 'Custom message to show on locked products';

-- =============================================================================

-- Waitlist for users interested in locked products
CREATE TABLE IF NOT EXISTS launch_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  child_name TEXT,
  child_age INTEGER CHECK (child_age >= 4 AND child_age <= 12),
  source TEXT DEFAULT 'pricing_page',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'converted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  notes TEXT,

  -- Prevent duplicates per email + product
  UNIQUE(email, product_slug)
);

-- Add comment
COMMENT ON TABLE launch_waitlist IS 'Captures interested users for locked products before launch';

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_product ON launch_waitlist(product_slug);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON launch_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON launch_waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON launch_waitlist(created_at DESC);

-- Enable RLS
ALTER TABLE launch_waitlist ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anonymous users (public form submission)
CREATE POLICY "Anyone can join waitlist" ON launch_waitlist
  FOR INSERT WITH CHECK (true);

-- Service role can do everything (for API routes using supabaseAdmin)
CREATE POLICY "Service role full access" ON launch_waitlist
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- HELPER VIEW: Waitlist stats by product
-- =============================================================================
CREATE OR REPLACE VIEW waitlist_stats AS
SELECT
  product_slug,
  COUNT(*) as total_signups,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'notified') as notified,
  COUNT(*) FILTER (WHERE status = 'converted') as converted,
  MIN(created_at) as first_signup,
  MAX(created_at) as latest_signup
FROM launch_waitlist
GROUP BY product_slug;

-- Grant access to the view
GRANT SELECT ON waitlist_stats TO authenticated;
