-- Seed site_settings.leadbot_live_sends — Phase B kill-switch for Lead Bot Meta Cloud direct outbound.
-- Reads via lib/communication/leadbot.ts (5-min cache via site-settings-loader.ts).
INSERT INTO site_settings (category, key, value, description) VALUES
  ('communication', 'leadbot_live_sends', 'false'::jsonb,
   'Phase B kill-switch for Lead Bot Meta Cloud direct outbound. When false (default), leadbot.ts forces dry-run regardless of caller isDryRun option. Set to true to enable real sends. 5-min cache TTL — for immediate effect, flip channel=aisensy on affected templates.')
ON CONFLICT (key) DO NOTHING;
