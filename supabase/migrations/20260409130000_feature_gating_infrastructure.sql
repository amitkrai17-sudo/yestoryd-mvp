-- ============================================================
-- Feature Gating Infrastructure
-- Two-layer system:
--   Layer 1: product_features (defaults per product type)
--   Layer 2: children.feature_overrides (per-child retention lever)
-- Resolution: override wins → product default → disabled
-- ============================================================

-- Layer 1: Product-level feature defaults
CREATE TABLE product_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL,  -- 'coaching', 'tuition', 'workshop'
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_type, feature_key)
);

-- RLS: Admin write, authenticated read
ALTER TABLE product_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read product_features" ON product_features FOR SELECT USING (true);
CREATE POLICY "Service role can manage product_features" ON product_features FOR ALL USING (auth.role() = 'service_role');

-- Seed defaults based on product matrix
INSERT INTO product_features (product_type, feature_key, enabled) VALUES
  -- Coaching: full access
  ('coaching', 'smart_practice', true),
  ('coaching', 'elearning_access', true),
  ('coaching', 'reading_tests', true),
  ('coaching', 'recall_recording', true),
  ('coaching', 'rai_chat', true),
  ('coaching', 'homework_tracking', true),
  ('coaching', 'detailed_analysis', true),
  ('coaching', 'progress_cards', true),
  ('coaching', 'whatsapp_full', true),
  ('coaching', 'free_workshops', true),
  ('coaching', 'gamification', true),
  ('coaching', 'activity_calendar', true),
  ('coaching', 'book_library', true),

  -- English Classes (tuition): moderate access
  ('tuition', 'smart_practice', false),
  ('tuition', 'elearning_access', false),
  ('tuition', 'reading_tests', false),
  ('tuition', 'recall_recording', false),
  ('tuition', 'rai_chat', true),
  ('tuition', 'homework_tracking', true),
  ('tuition', 'detailed_analysis', false),
  ('tuition', 'progress_cards', false),
  ('tuition', 'whatsapp_full', false),
  ('tuition', 'free_workshops', false),
  ('tuition', 'gamification', false),
  ('tuition', 'activity_calendar', true),
  ('tuition', 'book_library', true),

  -- Workshops: minimal (mostly standalone events)
  ('workshop', 'smart_practice', false),
  ('workshop', 'elearning_access', false),
  ('workshop', 'reading_tests', false),
  ('workshop', 'recall_recording', false),
  ('workshop', 'rai_chat', false),
  ('workshop', 'homework_tracking', false),
  ('workshop', 'detailed_analysis', false),
  ('workshop', 'progress_cards', false),
  ('workshop', 'whatsapp_full', false),
  ('workshop', 'free_workshops', false),
  ('workshop', 'gamification', false),
  ('workshop', 'activity_calendar', false),
  ('workshop', 'book_library', true);

CREATE INDEX idx_product_features_type ON product_features(product_type);
CREATE INDEX idx_product_features_key ON product_features(feature_key);

-- Layer 2: Per-child feature overrides (retention lever)
-- Admin can grant/revoke individual features for any child
-- regardless of their product subscription
ALTER TABLE children ADD COLUMN IF NOT EXISTS feature_overrides JSONB DEFAULT '{}';

COMMENT ON COLUMN children.feature_overrides IS 'Per-child feature overrides. Keys match product_features.feature_key. Values are boolean. Overrides product-level defaults. Used for churn prevention / retention.';

-- Rollback:
-- DROP TABLE IF EXISTS product_features;
-- ALTER TABLE children DROP COLUMN IF EXISTS feature_overrides;
