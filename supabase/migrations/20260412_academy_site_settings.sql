-- ============================================================
-- Migration: Academy page content in site_settings
--
-- Moves hardcoded copy on /yestoryd-academy into site_settings so
-- marketing can tune batch messaging, stats, and the time-commitment
-- line without code changes. Empty-string values are treated as
-- "hide this element" by the page.
-- ============================================================

INSERT INTO site_settings (key, value, category) VALUES
  ('academy_badge_text',             to_jsonb('Yestoryd Academy'::text),        'academy'),
  ('academy_batch_text',             to_jsonb(''::text),                        'academy'),
  ('academy_batch_urgency',          to_jsonb(''::text),                        'academy'),
  ('academy_hero_stat_1_value',      to_jsonb('100+'::text),                    'academy'),
  ('academy_hero_stat_1_label',      to_jsonb('Families Helped'::text),         'academy'),
  ('academy_hero_stat_2_value',      to_jsonb('4.9★'::text),                    'academy'),
  ('academy_hero_stat_2_label',      to_jsonb('Parent Satisfaction'::text),     'academy'),
  ('academy_hero_stat_3_value',      to_jsonb('AI-Powered'::text),              'academy'),
  ('academy_hero_stat_3_label',      to_jsonb('Progress Tracking'::text),       'academy'),
  ('academy_coach_time_commitment',  to_jsonb('3-4 hours per child/month'::text), 'academy')
ON CONFLICT (key) DO NOTHING;
