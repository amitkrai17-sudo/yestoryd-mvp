-- ============================================================
-- FILE: supabase/migrations/20260304_child_artifacts.sql
-- PURPOSE: Child artifact uploads (drawings, writing, photos)
-- Creates table, indexes, and RLS policies.
-- ============================================================

-- ── Table ──

CREATE TABLE IF NOT EXISTS child_artifacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  session_id    uuid REFERENCES sessions(id) ON DELETE SET NULL,

  -- Context
  artifact_type       text NOT NULL CHECK (artifact_type IN ('drawing','writing','photo','worksheet','other')),
  title               text,
  description         text,
  uploaded_by         text NOT NULL DEFAULT 'parent' CHECK (uploaded_by IN ('parent','coach','admin','system')),
  upload_context      text CHECK (upload_context IN ('session_homework','practice','assessment','freeform')),

  -- Artifact storage (relative paths in Supabase Storage bucket "child-artifacts")
  original_uri        text NOT NULL,
  processed_uri       text,
  thumbnail_uri       text,
  mime_type           text NOT NULL,
  file_size_bytes     integer NOT NULL CHECK (file_size_bytes > 0),
  image_width         integer,
  image_height        integer,

  -- AI analysis
  analysis_status     text NOT NULL DEFAULT 'pending' CHECK (analysis_status IN ('pending','processing','completed','failed','skipped')),
  analysis_model      text,
  analysis_result     jsonb,
  analysis_error      text,
  analyzed_at         timestamptz,

  -- Coach / parent feedback
  coach_feedback      text,
  coach_feedback_at   timestamptz,
  parent_note         text,

  -- Revision tracking
  revision_of         uuid REFERENCES child_artifacts(id) ON DELETE SET NULL,
  revision_number     integer NOT NULL DEFAULT 1 CHECK (revision_number >= 1),

  -- Status
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deleted')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──

CREATE INDEX idx_child_artifacts_child       ON child_artifacts (child_id, created_at DESC);
CREATE INDEX idx_child_artifacts_session     ON child_artifacts (session_id)     WHERE session_id IS NOT NULL;
CREATE INDEX idx_child_artifacts_enrollment  ON child_artifacts (enrollment_id)  WHERE enrollment_id IS NOT NULL;
CREATE INDEX idx_child_artifacts_analysis    ON child_artifacts (analysis_status) WHERE analysis_status IN ('pending','processing');

-- ── Updated_at trigger ──

CREATE OR REPLACE FUNCTION update_child_artifacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_child_artifacts_updated_at
  BEFORE UPDATE ON child_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION update_child_artifacts_updated_at();

-- ── RLS ──

ALTER TABLE child_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents see own children artifacts"
  ON child_artifacts FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
  );

CREATE POLICY "Parents can upload artifacts"
  ON child_artifacts FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR child_id IN (SELECT id FROM children WHERE parent_id = auth.uid())
  );

CREATE POLICY "Service role manages artifacts"
  ON child_artifacts FOR ALL
  USING (auth.role() = 'service_role');
