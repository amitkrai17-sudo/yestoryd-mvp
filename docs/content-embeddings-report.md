# Content Embeddings: rAI Content Discovery via Semantic Search

## Date: 2026-02-12

## Objective
Add vector embeddings to `el_learning_units` so rAI can discover content via semantic search, enabling coaches and the AI to recommend specific learning activities based on child needs.

---

## Pre-Implementation Verification

| Check | Finding |
|-------|---------|
| Existing embedding infrastructure | `learning_events.embedding` (vector 768) + `hybrid_match_learning_events` RPC |
| Embedding model | Google `text-embedding-004` (768-dim) via `@google/generative-ai` |
| `el_learning_units.embedding` column | **Not found** — new column needed |
| Content search RPC | **Not found** — `match_content_units` to be created |
| `buildContentSearchableText` | **Not found** — new function needed |
| ai-suggestion content awareness | **Not found** — uses only SQL history + learning_profile |
| chat route content awareness | **Not found** — uses only `hybridSearch` on learning_events |
| Admin embedding generation | **Exists** for learning_events (`generate-embeddings`); new route needed for content |

---

## Task 1: Migration — `20260212_content_embeddings.sql`

### Schema Changes
- `ALTER TABLE el_learning_units ADD COLUMN embedding vector(768)`
- HNSW index: `el_learning_units_embedding_hnsw_idx` (cosine similarity, m=16, ef_construction=64)

### New RPC Function: `match_content_units`

**Parameters:**
| Param | Type | Default | Purpose |
|-------|------|---------|---------|
| `query_embedding` | vector(768) | required | Semantic search vector |
| `filter_skill_id` | UUID | NULL | Filter by skill |
| `filter_min_age` | INT | NULL | Child's age (±2 year tolerance) |
| `filter_max_age` | INT | NULL | Child's age (±2 year tolerance) |
| `filter_arc_stage` | TEXT | NULL | 'assess', 'remediate', 'celebrate' |
| `filter_tags` | TEXT[] | NULL | Array overlap match |
| `match_threshold` | FLOAT | 0.3 | Minimum cosine similarity |
| `match_count` | INT | 10 | Max results |

**Returns:**
`id, name, content_code, description, skill_id, skill_name, arc_stage, min_age, max_age, difficulty, tags, coach_guidance, parent_instruction, video_count, worksheet_count, similarity`

**Joins:**
- `el_skills` for `skill_name`
- `el_videos` counted via `video_ids` array overlap
- `el_worksheets` counted via `unit_id` FK

---

## Task 2: Embedding Text Generator

### New function: `buildContentSearchableText(unit)`

**Location:** `lib/rai/embeddings.ts`

**Combines these fields into searchable text:**
1. `name` — unit name
2. `content_code` — identifier like GR-ACTPAS-01
3. `skill_name` — from joined el_skills
4. `description` — unit description
5. `arc_stage` — mapped to human-readable labels
6. `difficulty` — difficulty level
7. `tags` — semantic keywords
8. `coach_guidance.key_concepts` — pedagogical concepts
9. `coach_guidance.red_flags` — things to watch for
10. `coach_guidance.warm_up` / `wrap_up` — activity descriptions
11. `parent_instruction` — home practice guidance
12. `quest_title` / `quest_description` — gamification context

**Design rationale:** Heavy weighting on coach_guidance and tags because those match coach queries like "child struggles with passive voice" or "need phonics blending activity".

---

## Task 3: Admin Embedding Generation API

### New: `app/api/admin/generate-content-embeddings/route.ts`

| Method | Mode | Description |
|--------|------|-------------|
| POST | Null only | Generates embeddings for units where `embedding IS NULL` |
| PUT | Force refresh | Regenerates ALL embeddings (even existing ones) |

**Features:**
- Admin auth required (`requireAdmin()`)
- Rate limiting: 100ms delay between Gemini API calls
- Audit logging to `activity_log`
- Per-unit error handling (one failure doesn't stop batch)
- Returns: `{ success, total, success_count, failed_count, errors, duration_ms }`

---

## Task 4: rAI Integration

### Modified: `lib/rai/hybrid-search.ts`

**New exports:**
- `searchContentUnits(options)` — calls `match_content_units` RPC with query embedding
- `formatContentUnitsForContext(units)` — formats matches for Gemini prompt injection
- `ContentUnitMatch` interface — typed return from RPC

### Modified: `app/api/coach/ai-suggestion/route.ts`

**Changes:**
1. Added import of `searchContentUnits` and `formatContentUnitsForContext`
2. Hoisted `profile` variable to outer scope for content search access
3. New step 2b: Build search query from `primaryFocus + challenges + highlights + skillsPracticed + struggle_areas`
4. Calls `searchContentUnits` with child age and 0.25 threshold (lower than default for broader matches)
5. Injects top 3 content units into Gemini prompt as `RECOMMENDED CONTENT UNITS FROM LIBRARY`
6. Updated guideline #5: "reference them by name and content code when relevant"
7. Wrapped in try-catch — failure is non-blocking (AI suggestion still generates)

**Example Gemini prompt now includes:**
```
RECOMMENDED CONTENT UNITS FROM LIBRARY:
[1] Grammar Detectives (GR-ACTPAS-01)
   Skill: Grammar & Syntax
   Active vs Passive Voice detective game with Zombie Rule
   Stage: remediate
   Key concepts: active voice, passive voice, zombie rule
   Assets: 2 videos, 1 worksheet
   Match: 87%
```

### Modified: `app/api/chat/route.ts`

**Changes:**
1. Added imports for `searchContentUnits` and `formatContentUnitsForContext`
2. In `handleLearning()`: after `hybridSearch()` on learning_events, also searches content units
3. Appends content context to system prompt before Gemini call
4. Non-blocking: content search failure doesn't affect chat response

**Result:** rAI can now answer "what content should I use for passive voice?" with actual content library results.

---

## Task 5: Generate Embeddings for Existing Content

**Status:** Migration must be applied first.

**Steps after migration:**
1. Apply migration: `supabase db push` or run SQL directly
2. Regenerate types: `npx supabase gen types typescript --project-id agnfzrkrpuwmtjulbbpd --schema public > lib/supabase/database.types.ts`
3. Call POST `/api/admin/generate-content-embeddings` to embed all units

---

## Session Manifest

### Files Created (2)
| File | Purpose |
|------|---------|
| `supabase/migrations/20260212_content_embeddings.sql` | Migration: embedding column, HNSW index, match_content_units RPC |
| `app/api/admin/generate-content-embeddings/route.ts` | Admin API to generate/refresh content embeddings |

### Files Modified (4)
| File | Changes |
|------|---------|
| `lib/rai/embeddings.ts` | Added `ContentUnitForEmbedding` interface, `buildContentSearchableText()` function |
| `lib/rai/hybrid-search.ts` | Added `searchContentUnits()`, `formatContentUnitsForContext()`, `ContentUnitMatch` interface |
| `app/api/coach/ai-suggestion/route.ts` | Added content unit search (step 2b), injected into Gemini prompt, updated guidelines |
| `app/api/chat/route.ts` | Added content unit search in `handleLearning()`, appended to system prompt |

### Database Changes
| Change | Details |
|--------|---------|
| New column | `el_learning_units.embedding` vector(768) |
| New index | `el_learning_units_embedding_hnsw_idx` (HNSW, cosine) |
| New function | `match_content_units` RPC (vector similarity + filters) |

### Build Status
- TypeScript compilation: PASS (0 errors)
- Next.js build: PASS (all routes compile)
- Migration: NOT YET APPLIED (SQL file ready)

### Post-Migration Steps Required
1. Apply `20260212_content_embeddings.sql` to remote database
2. Regenerate database types
3. Call `POST /api/admin/generate-content-embeddings` to populate embeddings
4. Verify with `PUT` (force refresh) after any content library changes
