-- Migration: Add hybrid_match_learning_events function for rAI v2.0
-- This enables semantic search with keyword boost

-- 1. Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to learning_events if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'learning_events' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE learning_events ADD COLUMN embedding vector(768);
  END IF;
END $$;

-- 3. Create HNSW index for fast similarity search (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'learning_events_embedding_hnsw_idx'
  ) THEN
    CREATE INDEX learning_events_embedding_hnsw_idx 
    ON learning_events 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  END IF;
END $$;

-- 4. Create hybrid search function
CREATE OR REPLACE FUNCTION hybrid_match_learning_events(
  query_embedding vector(768),
  filter_child_id uuid DEFAULT NULL,
  filter_coach_id uuid DEFAULT NULL,
  filter_date_from timestamptz DEFAULT NULL,
  filter_date_to timestamptz DEFAULT NULL,
  filter_event_type text DEFAULT NULL,
  filter_keywords text[] DEFAULT NULL,
  match_threshold float DEFAULT 0.4,
  match_count int DEFAULT 15
) RETURNS TABLE (
  id uuid,
  child_id uuid,
  coach_id uuid,
  event_type text,
  event_date timestamptz,
  event_data jsonb,
  ai_summary text,
  content_for_embedding text,
  similarity float,
  keyword_boost float,
  final_score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    le.id,
    le.child_id,
    le.coach_id,
    le.event_type,
    le.event_date,
    le.event_data,
    le.ai_summary,
    le.content_for_embedding,
    (1 - (le.embedding <=> query_embedding))::float as similarity,
    -- Keyword boost: +0.1 for each keyword match
    COALESCE(
      (SELECT COUNT(*)::float * 0.1 
       FROM unnest(filter_keywords) kw 
       WHERE le.content_for_embedding ILIKE '%' || kw || '%'),
      0
    )::float as keyword_boost,
    -- Final score = similarity + keyword boost
    ((1 - (le.embedding <=> query_embedding)) + 
    COALESCE(
      (SELECT COUNT(*)::float * 0.1 
       FROM unnest(filter_keywords) kw 
       WHERE le.content_for_embedding ILIKE '%' || kw || '%'),
      0
    ))::float as final_score
  FROM learning_events le
  WHERE 
    -- Must have embedding
    le.embedding IS NOT NULL
    -- Role-based filtering (CRITICAL for security)
    AND (filter_child_id IS NULL OR le.child_id = filter_child_id)
    AND (filter_coach_id IS NULL OR le.coach_id = filter_coach_id)
    -- Date filtering
    AND (filter_date_from IS NULL OR le.event_date >= filter_date_from)
    AND (filter_date_to IS NULL OR le.event_date <= filter_date_to)
    -- Event type filtering
    AND (filter_event_type IS NULL OR le.event_type = filter_event_type)
    -- Similarity threshold
    AND (1 - (le.embedding <=> query_embedding)) > match_threshold
  ORDER BY final_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Set HNSW search parameter for better accuracy
-- This can be adjusted per-session if needed
-- ALTER DATABASE SET hnsw.ef_search = 100;

COMMENT ON FUNCTION hybrid_match_learning_events IS 'rAI v2.0 hybrid search: combines vector similarity with keyword boost and SQL filters';
