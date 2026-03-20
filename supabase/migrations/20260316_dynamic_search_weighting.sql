-- ============================================================================
-- DYNAMIC SEARCH WEIGHTING
-- Date: 2026-03-16
-- Adds two new parameters to hybrid_match_learning_events:
--   keyword_weight_multiplier (default 0.1) — per-keyword boost
--   keyword_max_boost (default 0.25) — cap on total keyword boost
-- Defaults preserve backward compatibility with existing callers.
-- Also adds a LEAST cap that was previously missing.
-- ============================================================================

-- Drop old 9-param version, then create new 11-param version
DROP FUNCTION IF EXISTS public.hybrid_match_learning_events(
  vector, uuid, uuid, timestamp with time zone, timestamp with time zone, text, text[], double precision, integer
);

CREATE OR REPLACE FUNCTION public.hybrid_match_learning_events(
  query_embedding vector,
  filter_child_id uuid DEFAULT NULL::uuid,
  filter_coach_id uuid DEFAULT NULL::uuid,
  filter_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  filter_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  filter_event_type text DEFAULT NULL::text,
  filter_keywords text[] DEFAULT NULL::text[],
  match_threshold double precision DEFAULT 0.4,
  match_count integer DEFAULT 15,
  keyword_weight_multiplier double precision DEFAULT 0.1,
  keyword_max_boost double precision DEFAULT 0.25
)
RETURNS TABLE(
  id uuid,
  child_id uuid,
  coach_id uuid,
  event_type text,
  event_date timestamp with time zone,
  event_data jsonb,
  ai_summary text,
  content_for_embedding text,
  similarity double precision,
  keyword_boost double precision,
  final_score double precision
)
LANGUAGE plpgsql
STABLE
AS $function$
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
    -- Keyword boost: configurable per-match weight, capped
    LEAST(
      COALESCE(
        (SELECT COUNT(*)::float * keyword_weight_multiplier
         FROM unnest(filter_keywords) kw
         WHERE le.content_for_embedding ILIKE '%' || kw || '%'),
        0
      ),
      keyword_max_boost
    )::float as keyword_boost,
    -- Final score = similarity + capped keyword boost
    ((1 - (le.embedding <=> query_embedding)) +
    LEAST(
      COALESCE(
        (SELECT COUNT(*)::float * keyword_weight_multiplier
         FROM unnest(filter_keywords) kw
         WHERE le.content_for_embedding ILIKE '%' || kw || '%'),
        0
      ),
      keyword_max_boost
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
$function$;

COMMENT ON FUNCTION public.hybrid_match_learning_events IS
  'Hybrid vector+keyword search for learning events. keyword_weight_multiplier controls per-keyword boost (default 0.1), keyword_max_boost caps total boost (default 0.25). March 2026.';
