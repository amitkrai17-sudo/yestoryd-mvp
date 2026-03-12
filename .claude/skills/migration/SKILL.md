---
name: migration
description: >
  Generate Supabase migration files for Yestoryd database schema changes.
  Use when adding tables, columns, indexes, RLS policies, functions, or any schema modification.
  Trigger on: "migration", "add table", "alter column", "add index", "RLS policy",
  "database change", "schema", "new table", "drop table", "add field",
  or any database modification work for Yestoryd.
  Enforces: migration file naming, types regeneration, existing table audit,
  and single-source-of-truth principles.
---

# Migration Skill — Yestoryd

## MANDATORY: Migration File Discipline

ALL schema changes go through migration files. NEVER use Supabase Dashboard for schema changes.

## Before Any Schema Change

```bash
# 1. Check if table/column already exists
grep -r "TABLE_NAME" supabase/migrations/ --include="*.sql"
# 2. Check how the table is used in code
grep -r "TABLE_NAME" app/ lib/ components/ --include="*.ts" --include="*.tsx" -l
# 3. Check for similar/competing tables
grep -r "SIMILAR_KEYWORD" supabase/migrations/ --include="*.sql" | head -20
# 4. List recent migrations
ls -la supabase/migrations/ | tail -10
```

**Report findings before creating migration.** Check for table bloat — `children` has 95 cols, `scheduled_sessions` has 110 cols. Consider if data belongs in an existing table.

## Migration File Template

**Naming:** `supabase/migrations/YYYYMMDD_description.sql`

```sql
-- Migration: YYYYMMDD_description
-- Purpose: Brief description of what this migration does
-- Author: Amit / Claude Code
-- Related: Link to feature or issue if applicable

-- ═══════════════════════════════════════════════════
-- NEW TABLES
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS your_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  -- ... columns
);

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_your_table_column
  ON your_table (column_name);

-- ═══════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════

ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON your_table FOR SELECT
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════
-- TRIGGERS (updated_at)
-- ═══════════════════════════════════════════════════

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON your_table
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);
```

## After Migration

**ALWAYS remind to regenerate types:**
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/types.ts
```

This is critical — TypeScript types must match the DB schema.

## Embedding Columns

If the table stores AI-searchable content:
```sql
-- Add embedding column (768-dim, matches gemini-embedding-001)
ALTER TABLE your_table ADD COLUMN IF NOT EXISTS
  embedding vector(768);

-- Add content_for_embedding for text that gets embedded
ALTER TABLE your_table ADD COLUMN IF NOT EXISTS
  content_for_embedding TEXT;

-- HNSW index for vector search (better recall than IVFFlat)
CREATE INDEX IF NOT EXISTS idx_your_table_embedding
  ON your_table USING hnsw (embedding vector_cosine_ops);
```

## Key Conventions

1. **Use `IF NOT EXISTS` / `IF EXISTS`** — migrations must be idempotent
2. **Always add `created_at` + `updated_at`** with defaults
3. **UUID primary keys** — `gen_random_uuid()`
4. **RLS on every table** — even internal tables get basic policies
5. **Foreign keys** — reference parent tables explicitly
6. **Naming:** `snake_case` for tables and columns, `idx_table_column` for indexes
7. **Don't drop tables casually** — check all code references first

## Tables to Watch (Large/Critical)

| Table | Cols | Notes |
|-------|------|-------|
| `children` | 95 | Candidate for vertical partitioning |
| `scheduled_sessions` | 110 | Candidate for partitioning |
| `site_settings` | Config store | Don't add columns here, add rows |
| `learning_events` | 19 + embedding | RAG backbone, has HNSW index |
| `coach_groups` | Revenue tiers | Source of truth for payouts |

## Current Schema State

- 142 tables (after March 2026 cleanup from 151)
- 52 empty tables kept (operational, pre-launch)
- `skill_categories` table: 10 rows, 3-level tree
- Coupon system unified to `coupon_usages` (not `coupon_uses`)
