-- ============================================================================
-- Migration: Create content warehouse tables
-- Date: 2026-02-21
-- Purpose: el_content_items (unified content), el_content_tags (skill links),
--          el_unit_content (unit-to-content bridge)
-- Depends on: pgvector extension, el_skills table, el_learning_units table
-- ============================================================================

-- Ensure pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. el_content_items — unified content table
-- ============================================================================
CREATE TABLE IF NOT EXISTS el_content_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  content_type  TEXT NOT NULL CHECK (content_type IN ('video', 'worksheet', 'game', 'audio', 'interactive', 'parent_guide')),
  description   TEXT,
  asset_url     TEXT,
  asset_format  TEXT,
  thumbnail_url TEXT,
  yrl_level     TEXT CHECK (yrl_level IS NULL OR yrl_level ~ '^[FBM][1-4]$'),
  arc_stage     TEXT CHECK (arc_stage IS NULL OR arc_stage IN ('assess', 'remediate', 'celebrate')),
  difficulty_level TEXT CHECK (difficulty_level IS NULL OR difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  coach_guidance   TEXT,
  parent_instruction TEXT,
  child_label      TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,  -- duration_seconds lives inside metadata
  search_text   TEXT,
  embedding     vector(768),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_items_type      ON el_content_items (content_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_content_items_yrl       ON el_content_items (yrl_level)    WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_content_items_arc       ON el_content_items (arc_stage)     WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_content_items_active    ON el_content_items (is_active);
CREATE INDEX IF NOT EXISTS idx_content_items_search    ON el_content_items USING gin (to_tsvector('english', coalesce(search_text, '')));

-- HNSW index for embedding similarity search
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_items_embedding_hnsw'
  ) THEN
    CREATE INDEX idx_content_items_embedding_hnsw
    ON el_content_items
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  END IF;
END $$;

-- ============================================================================
-- 2. el_content_tags — skill tagging for content items
-- ============================================================================
CREATE TABLE IF NOT EXISTS el_content_tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id    UUID NOT NULL REFERENCES el_content_items(id) ON DELETE CASCADE,
  skill_id      UUID NOT NULL REFERENCES el_skills(id) ON DELETE CASCADE,
  sub_skill_tag TEXT,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (content_item_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_content_tags_content ON el_content_tags (content_item_id);
CREATE INDEX IF NOT EXISTS idx_content_tags_skill   ON el_content_tags (skill_id);

-- ============================================================================
-- 3. el_unit_content — bridge between el_learning_units and el_content_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS el_unit_content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       UUID NOT NULL REFERENCES el_learning_units(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES el_content_items(id) ON DELETE CASCADE,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (unit_id, content_item_id)
);

CREATE INDEX IF NOT EXISTS idx_unit_content_unit    ON el_unit_content (unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_content_content ON el_unit_content (content_item_id);

-- ============================================================================
-- 4. RPC: search_content_items — semantic + text search
-- ============================================================================
CREATE OR REPLACE FUNCTION search_content_items(
  query_embedding vector(768),
  query_text      TEXT DEFAULT NULL,
  filter_type     TEXT DEFAULT NULL,
  filter_yrl      TEXT DEFAULT NULL,
  filter_arc      TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.3,
  match_count     INT DEFAULT 10
) RETURNS TABLE (
  id              UUID,
  title           TEXT,
  content_type    TEXT,
  description     TEXT,
  asset_url       TEXT,
  yrl_level       TEXT,
  arc_stage       TEXT,
  difficulty_level TEXT,
  coach_guidance  TEXT,
  metadata        JSONB,
  similarity      FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id,
    ci.title,
    ci.content_type,
    ci.description,
    ci.asset_url,
    ci.yrl_level,
    ci.arc_stage,
    ci.difficulty_level,
    ci.coach_guidance,
    ci.metadata,
    (1 - (ci.embedding <=> query_embedding))::FLOAT AS similarity
  FROM el_content_items ci
  WHERE
    ci.is_active = true
    AND ci.embedding IS NOT NULL
    AND (filter_type IS NULL OR ci.content_type = filter_type)
    AND (filter_yrl  IS NULL OR ci.yrl_level = filter_yrl)
    AND (filter_arc  IS NULL OR ci.arc_stage = filter_arc)
    AND (1 - (ci.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_content_items IS 'Content warehouse: semantic search on el_content_items with type/level/arc filtering';
