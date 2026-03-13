-- Migration: 20260313_embedding_indexes
-- Purpose: Add GIN index for keyword search, upgrade child_rag_profiles to HNSW,
--          drop duplicate indexes on learning_events.
-- Author: Amit / Claude Code
-- Related: Deep Embedding Audit March 13, 2026

-- ═══════════════════════════════════════════════════
-- GIN index for keyword search in hybrid_match_learning_events
-- The RPC uses ILIKE on content_for_embedding which table-scans.
-- This enables ts_vector search for future optimization.
-- ═══════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_le_content_tsvector
  ON learning_events USING GIN(to_tsvector('english', COALESCE(content_for_embedding, '')));

COMMENT ON INDEX idx_le_content_tsvector
  IS 'GIN index for keyword search in hybrid_match_learning_events. Audit March 2026.';

-- ═══════════════════════════════════════════════════
-- Upgrade child_rag_profiles from IVFFlat to HNSW
-- 0 rows currently, safe to drop+recreate.
-- HNSW has better recall and no retraining requirement.
-- ═══════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_child_rag_profiles_embedding;

CREATE INDEX IF NOT EXISTS idx_child_rag_profiles_embedding_hnsw
  ON child_rag_profiles
  USING hnsw (profile_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON INDEX idx_child_rag_profiles_embedding_hnsw
  IS 'HNSW vector index for RAG profile similarity search. Replaces IVFFlat. Audit March 2026.';

-- ═══════════════════════════════════════════════════
-- Drop duplicate indexes on learning_events
-- Audit found 4 pairs of identical indexes:
--   idx_learning_events_child = idx_learning_events_child_id (both btree child_id)
--   idx_learning_events_data = idx_learning_events_event_data (both GIN event_data)
--   idx_learning_events_date = idx_learning_events_event_date (both btree event_date DESC)
--   idx_learning_events_event_type = idx_learning_events_type (both btree event_type)
-- Keep the more descriptive name in each pair.
-- ═══════════════════════════════════════════════════

DROP INDEX IF EXISTS idx_learning_events_child;
DROP INDEX IF EXISTS idx_learning_events_data;
DROP INDEX IF EXISTS idx_learning_events_date;
DROP INDEX IF EXISTS idx_learning_events_type;
