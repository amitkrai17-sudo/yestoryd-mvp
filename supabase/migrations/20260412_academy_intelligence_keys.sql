-- ============================================================
-- Migration: Academy intelligence + assumption keys
--
-- Adds 3 site_settings keys for the academy page redesign:
--
-- 1. academy_sessions_per_month_assumption — marketing framing
--    decoupled from real age_band_config. Defaults to 6 so the
--    earnings narrative matches what a coach sees in a typical
--    coaching + tuition practice.
--
-- 2. academy_intelligence_stat_value / _label — one concrete
--    number in the intelligence section (e.g. "<2 min avg
--    post-session admin time"). Real operational data: SCF
--    submit is sub-200ms and the parent summary dispatches via
--    QStash within minutes. Admin can swap later.
-- ============================================================

INSERT INTO site_settings (key, value, category) VALUES
  ('academy_sessions_per_month_assumption', to_jsonb(6),                                     'academy'),
  ('academy_intelligence_stat_value',       to_jsonb('< 2 min'::text),                       'academy'),
  ('academy_intelligence_stat_label',       to_jsonb('avg post-session admin time'::text),   'academy')
ON CONFLICT (key) DO NOTHING;
