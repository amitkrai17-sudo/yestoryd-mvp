# Session Manifest: Embedding Infrastructure Fix
**Date:** 2026-03-13
**Trigger:** Deep Embedding Audit (March 13, 2026)
**Scope:** Fix all gaps identified in audit — indexes, missing embeddings, test data, source text preservation

## Key Decision
**Model: `gemini-embedding-001` @ 768-dim is the locked standard.**
`text-embedding-004` was shut down by Google on Jan 14, 2026. The prior strategy doc was incorrect. No model migration needed — all 126 vectors are consistent.

## Changes Made

### Phase 1: Strategy Doc + Code Comment
- Updated `lib/rai/embeddings.ts` header comment to document locked model standard and deprecation notice
- Grep confirmed zero references to `text-embedding-004` in codebase

### Phase 2: Source Text Preservation (el_learning_units)
- **Migration:** `20260313_add_content_for_embedding_el_learning_units.sql`
- Added `content_for_embedding TEXT` column to `el_learning_units`
- Backfilled 69/69 rows from existing fields (name, description, skill name, coach_guidance, etc.)
- Avg text length: 217 chars (min 151, max 1385)
- Updated `generate-content-embeddings` route to persist text on future embedding generation

### Phase 3: Database Indexes
- **Migration:** `20260313_embedding_indexes.sql`
- Added GIN tsvector index `idx_le_content_tsvector` on `learning_events.content_for_embedding`
- Upgraded `child_rag_profiles` from IVFFlat to HNSW (`idx_child_rag_profiles_embedding_hnsw`, m=16, ef=64)
- Dropped 4 duplicate indexes on `learning_events` (saved write overhead + storage)
- Composite index `idx_le_child_type_date` already existed — skipped

### Phase 4: Clean Test Data + Book Embeddings
- Deleted test book "s" by "s" (slug: `s`, 7-char garbage search_text)
- Generated embeddings for all 6 remaining books (768-dim, `gemini-embedding-001`)
- Script: `scripts/generate-book-embeddings.ts`

### Phase 5: Fill Missing Embeddings
- Backfilled 2 `learning_events` (daily_recommendations + progress_pulse)
- Backfilled 3 `el_content_items` (Rhyming Pairs, Letter-Sound Cards, Grammar Detectives Presentation)
- Script: `scripts/backfill-missing-embeddings.ts`

### Phase 6: match_learning_events RPC
- Confirmed NOT called in application code (only `hybrid_match_learning_events` is used)
- Column alias bug (`data` vs `event_data`) is harmless — skipped fix

### Phase 7: Consolidate Backfill Routes
- `/api/admin/generate-embeddings` (GET) = canonical (targets NULL only, dry-run, zod)
- `/api/admin/backfill-embeddings` (POST) = deprecated comment added, retained for model migration

### Phase 8: Types Regenerated
- `lib/database.types.ts` regenerated (15,330 lines, includes new `content_for_embedding` column)

## Final State

| Table | Total | Embedded | Dims | Index Type |
|-------|-------|----------|------|------------|
| learning_events | 43 | 43 | 768 | HNSW + GIN (tsvector) |
| el_content_items | 8 | 8 | 768 | HNSW + GIN (tsvector) |
| el_learning_units | 69 | 69 | 768 | HNSW |
| books | 6 | 6 | 768 | HNSW |
| child_rag_profiles | 0 | 0 | — | HNSW (upgraded from IVFFlat) |

**Total vectors: 126/126 (100% coverage)**
**Dimensions: 768 consistently across all tables**
**Model: gemini-embedding-001 (single source of truth in lib/rai/embeddings.ts)**
**Zero references to dead text-embedding-004 model**

## Files Changed
| File | Change |
|------|--------|
| `lib/rai/embeddings.ts` | Updated comment: locked model standard documentation |
| `supabase/migrations/20260313_add_content_for_embedding_el_learning_units.sql` | New migration |
| `supabase/migrations/20260313_embedding_indexes.sql` | New migration |
| `app/api/admin/generate-content-embeddings/route.ts` | Persist `content_for_embedding` on embed |
| `app/api/admin/backfill-embeddings/route.ts` | Deprecation comment |
| `lib/database.types.ts` | Regenerated |
| `scripts/generate-book-embeddings.ts` | New script |
| `scripts/backfill-missing-embeddings.ts` | New script |
