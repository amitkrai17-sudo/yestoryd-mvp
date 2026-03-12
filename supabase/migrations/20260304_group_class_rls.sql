-- ============================================================
-- FILE: supabase/migrations/20260304_group_class_rls.sql
-- PURPOSE: Enable RLS + defense-in-depth policies for group class tables
-- ============================================================
-- NOTE: API routes handle auth at the application level (requireAdmin,
-- QStash verification, etc). These RLS policies are a second layer of
-- defense. Service role operations (crons, webhooks, admin APIs) bypass
-- RLS by default. These policies protect against direct client access.
-- ============================================================

-- ── group_class_types: public data, admin writes ──

ALTER TABLE group_class_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read class types"
  ON group_class_types FOR SELECT
  USING (true);

CREATE POLICY "Service role manages class types"
  ON group_class_types FOR ALL
  USING (auth.role() = 'service_role');

-- ── group_sessions: public read, admin/instructor writes ──

ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sessions"
  ON group_sessions FOR SELECT
  USING (true);

CREATE POLICY "Service role manages sessions"
  ON group_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- ── group_session_participants: parents see own children, admin manages ──

ALTER TABLE group_session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents see own registrations"
  ON group_session_participants FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR parent_id = auth.uid()
  );

CREATE POLICY "Authenticated users can register"
  ON group_session_participants FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
  );

CREATE POLICY "Service role manages participants"
  ON group_session_participants FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role deletes participants"
  ON group_session_participants FOR DELETE
  USING (auth.role() = 'service_role');

-- ── group_class_blueprints: instructors + admin read, admin writes ──

ALTER TABLE group_class_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read blueprints"
  ON group_class_blueprints FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
  );

CREATE POLICY "Service role manages blueprints"
  ON group_class_blueprints FOR ALL
  USING (auth.role() = 'service_role');

-- ── group_class_certificates: parents see own, admin manages ──

ALTER TABLE group_class_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents see own certificates"
  ON group_class_certificates FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR child_id IN (
      SELECT id FROM children WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages certificates"
  ON group_class_certificates FOR ALL
  USING (auth.role() = 'service_role');

-- ── group_class_waitlist: parents see own, authenticated can insert ──

ALTER TABLE group_class_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents see own waitlist entries"
  ON group_class_waitlist FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR parent_id = auth.uid()
  );

CREATE POLICY "Authenticated users can join waitlist"
  ON group_class_waitlist FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
  );

CREATE POLICY "Service role manages waitlist"
  ON group_class_waitlist FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role deletes waitlist"
  ON group_class_waitlist FOR DELETE
  USING (auth.role() = 'service_role');

-- ── group_class_coupons: public read (for validation), admin writes ──

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_class_coupons') THEN
    EXECUTE 'ALTER TABLE group_class_coupons ENABLE ROW LEVEL SECURITY';

    -- Check if policy already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'group_class_coupons' AND policyname = 'Anyone can read coupons'
    ) THEN
      EXECUTE 'CREATE POLICY "Anyone can read coupons" ON group_class_coupons FOR SELECT USING (true)';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'group_class_coupons' AND policyname = 'Service role manages coupons'
    ) THEN
      EXECUTE 'CREATE POLICY "Service role manages coupons" ON group_class_coupons FOR ALL USING (auth.role() = ''service_role'')';
    END IF;
  END IF;
END $$;
