-- Migration: Add vector embeddings to el_learning_units for rAI content discovery
-- Date: 2026-02-12
-- Depends on: pgvector extension (created in 002_hybrid_search_function.sql)

-- 1. Ensure pgvector extension exists
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to el_learning_units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'el_learning_units' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE el_learning_units ADD COLUMN embedding vector(768);
  END IF;
END $$;

-- 3. Create HNSW index for fast similarity search
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'el_learning_units_embedding_hnsw_idx'
  ) THEN
    CREATE INDEX el_learning_units_embedding_hnsw_idx
    ON el_learning_units
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  END IF;
END $$;

-- 4. Create content unit matching function
CREATE OR REPLACE FUNCTION match_content_units(
  query_embedding vector(768),
  filter_skill_id uuid DEFAULT NULL,
  filter_min_age int DEFAULT NULL,
  filter_max_age int DEFAULT NULL,
  filter_arc_stage text DEFAULT NULL,
  filter_tags text[] DEFAULT NULL,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10
) RETURNS TABLE (
  id uuid,
  name text,
  content_code text,
  description text,
  skill_id uuid,
  skill_name text,
  arc_stage text,
  min_age int,
  max_age int,
  difficulty text,
  tags text[],
  coach_guidance jsonb,
  parent_instruction text,
  video_count bigint,
  worksheet_count bigint,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.content_code,
    u.description,
    u.skill_id,
    s.name AS skill_name,
    u.arc_stage,
    u.min_age,
    u.max_age,
    u.difficulty,
    u.tags,
    u.coach_guidance,
    u.parent_instruction,
    -- Count videos linked via video_ids array (uuid[] column)
    (SELECT COUNT(*) FROM el_videos v
     WHERE u.video_ids IS NOT NULL AND v.id = ANY(u.video_ids) AND (v.is_active IS NULL OR v.is_active = true)) AS video_count,
    -- Count worksheets linked via unit_id FK
    (SELECT COUNT(*) FROM el_worksheets w
     WHERE w.unit_id = u.id AND (w.is_active IS NULL OR w.is_active = true)) AS worksheet_count,
    (1 - (u.embedding <=> query_embedding))::float AS similarity
  FROM el_learning_units u
  LEFT JOIN el_skills s ON s.id = u.skill_id
  WHERE
    -- Must have embedding
    u.embedding IS NOT NULL
    -- Only active/published units
    AND (u.is_active = true OR u.status = 'published')
    -- Filters
    AND (filter_skill_id IS NULL OR u.skill_id = filter_skill_id)
    AND (filter_min_age IS NULL OR u.min_age IS NULL OR u.min_age <= filter_min_age + 2)
    AND (filter_max_age IS NULL OR u.max_age IS NULL OR u.max_age >= filter_max_age - 2)
    AND (filter_arc_stage IS NULL OR u.arc_stage = filter_arc_stage)
    AND (filter_tags IS NULL OR u.tags && filter_tags)
    -- Similarity threshold
    AND (1 - (u.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION match_content_units IS 'rAI content discovery: semantic search on el_learning_units with age/skill/arc filtering';
