-- Allow public (anon) read access to non-internal coach groups.
-- Needed for yestoryd-academy page to display tier progression without auth.
-- Internal groups (is_internal = true) remain hidden from public.

CREATE POLICY "Public read non-internal coach_groups"
  ON coach_groups
  FOR SELECT
  USING (is_internal = false);
