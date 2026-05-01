---
name: yestoryd-supabase-ops
description: "When writing Supabase queries, creating migrations, debugging database issues, or working with Yestoryd's 145-table schema. Triggers on: 'Supabase query,' 'migration,' 'database,' 'SQL,' 'RLS,' 'table,' 'schema,' 'learning_events,' 'embeddings,' 'pgvector,' or any Yestoryd database operation. Enforces: table alias prefixes, .limit(1) over .single(), CHECK constraint pre-validation, phone normalization layers, information_schema checks before assumptions, and migration file discipline. For API route patterns use yestoryd-code-patterns skill."
metadata:
  version: 1.0.0
---

# Yestoryd Supabase Operations

You are a Supabase/PostgreSQL specialist for Yestoryd. The platform has ~145 tables across authentication, coaching, e-learning, communication, intelligence, and payment domains. Every query and migration must follow these battle-tested patterns.

## Infrastructure

| Resource | Value |
|----------|-------|
| Project ID | `agnfzrkrpuwmtjulbbpd` |
| Region | `ap-northeast-1` |
| Current Plan | Free tier (Pro upgrade prioritized) |
| Embedding Model | `gemini-embedding-001` (768-dim MRL) |
| Vector Extension | pgvector with HNSW indexes |
| Embedding Coverage | 126/126 tables at 100% |

## Critical Query Patterns

### 1. ALWAYS Prefix Columns with Table Aliases

Supabase throws `ERROR 42702: column reference is ambiguous` when joining tables with same column names (e.g., `id`, `created_at`, `status`).

```typescript
// BAD — will fail on joins
const { data } = await supabase
  .from('enrollments')
  .select('id, status, children(id, name)')

// GOOD — explicit aliases prevent ambiguity
const { data } = await supabase
  .from('enrollments')
  .select(`
    enrollments:id,
    enrollments:status,
    children!inner(
      children:id,
      children:name
    )
  `)
```

For raw SQL via `execute_sql`, always use table aliases:
```sql
-- BAD
SELECT id, name, status FROM enrollments e JOIN children c ON c.id = e.child_id;

-- GOOD
SELECT e.id, c.name, e.status FROM enrollments e JOIN children c ON c.id = e.child_id;
```

### 2. Use .limit(1) Instead of .single()

`.single()` throws an error if 0 or 2+ rows match. Phone lookups frequently have duplicates due to normalization history. `.limit(1)` returns empty array (safe) or first match.

```typescript
// BAD — breaks on duplicates or no match
const { data } = await supabase
  .from('parents')
  .select('*')
  .eq('phone', normalizedPhone)
  .single()

// GOOD — handles 0 or multiple gracefully
const { data } = await supabase
  .from('parents')
  .select('*')
  .eq('phone', normalizedPhone)
  .limit(1)

const parent = data?.[0] || null
```

### 3. CHECK Constraints Silently Reject

PostgreSQL CHECK constraints don't throw errors on Supabase client — the INSERT silently returns null. Pre-validate before writing.

```typescript
// BAD — silent failure, no error, no data
const { data, error } = await supabase
  .from('learning_events')
  .insert({ event_type: 'custom_invalid_type', ... })
// data = null, error = null — CHECK rejected silently

// GOOD — validate before insert
const VALID_EVENT_TYPES = [
  'session_observation', 'assessment', 'homework_completion',
  'parent_feedback', 'structured_capture', 'recall_transcript',
  // ... 22+ valid types
] as const

if (!VALID_EVENT_TYPES.includes(eventType)) {
  throw new Error(`Invalid event_type: ${eventType}`)
}

const { data, error } = await supabase
  .from('learning_events')
  .insert({ event_type: eventType, ... })
```

**Known affected tables:** `learning_events` (event_type), `communication_templates` (category), `scheduled_sessions` (status), `payments` (status).

### 4. Check information_schema Before Assuming Columns

Never assume a column exists. Schema evolves with migrations.

```sql
-- Before any ALTER or INSERT depending on a column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'your_table'
ORDER BY ordinal_position;
```

In Claude Code, always run this check in Phase 0 before modifying a table.

### 5. Phone Normalization is 3-Layer

Every phone-related query must account for format variations.

**Layer 1: DB Triggers** — Auto-normalize on INSERT/UPDATE for `parents.phone`, `coaches.phone`, `children.parent_phone`

**Layer 2: App-Level** — `normalizePhone()` from `lib/utils/phone.ts` at all insert points

**Layer 3: Flexible Lookups** — `.or()` with multiple formats:

```typescript
import { normalizePhone } from '@/lib/utils/phone'

const phone = normalizePhone(rawPhone) // → +91XXXXXXXXXX
const digits10 = phone.replace('+91', '')
const digits12 = phone.replace('+', '')

const { data } = await supabase
  .from('parents')
  .select('*')
  .or(`phone.eq.${phone},phone.eq.${digits10},phone.eq.${digits12}`)
  .limit(1)
```

**Canonical format:** `+91XXXXXXXXXX` (E.164, 13 chars)
**WhatsApp API format:** `91XXXXXXXXXX` (no +) — used in `wa_leads.phone_number`

### 6. execute_sql Requires Fully Qualified References

When using Supabase MCP's `execute_sql`:
- Always specify `public.table_name` for clarity
- Use parameterized queries where possible
- Always include table aliases in joins
- Test with `EXPLAIN` on complex queries

## Migration File Discipline

### Naming Convention
```
YYYYMMDD_description.sql
```
Example: `20260411_add_batch_id_to_sessions.sql`

### Migration Rules

1. **Never drop columns in production** — add `DEPRECATED` comment, remove after full migration
2. **Always IF NOT EXISTS / IF EXISTS** — migrations must be idempotent
3. **One logical change per migration** — don't mix schema changes with data backfills
4. **Add RLS policies** — match the pattern of the table's existing RLS
5. **Regenerate types after** — `npx supabase gen types typescript --project-id agnfzrkrpuwmtjulbbpd > src/types/supabase.ts`

### Migration Template

```sql
-- Migration: [description]
-- Date: [YYYY-MM-DD]
-- Author: [name]

-- Step 1: Schema changes
ALTER TABLE public.table_name
  ADD COLUMN IF NOT EXISTS new_column TEXT;

-- Step 2: Indexes (if needed)
CREATE INDEX IF NOT EXISTS idx_table_new_column
  ON public.table_name(new_column);

-- Step 3: RLS (if new table)
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_name" ON public.table_name
  FOR SELECT USING (auth.role() = 'authenticated');

-- Step 4: Backfill (if needed, separate transaction)
UPDATE public.table_name
SET new_column = 'default_value'
WHERE new_column IS NULL;
```

## Key Tables by Domain

### Intelligence & Learning
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `learning_events` | All learning signals | child_id, event_type, event_data (JSONB), embedding (vector 768), content_for_embedding |
| `child_intelligence_profiles` | Per-child intelligence summary | child_id, narrative_profile, freshness_status |
| `el_skills` | Skill taxonomy (SSOT) | name, slug, category, is_active |
| `skill_categories` | Category taxonomy (SSOT) | slug, label, scope, color |
| `el_content_items` | E-learning content | embedding (vector 768) |
| `books` | Reading library | embedding (vector 768) |

### Coaching & Sessions
| Table | Purpose | Notes |
|-------|---------|-------|
| `scheduled_sessions` | All coaching sessions | batch_id for English classes |
| `session_captures` | Post-session structured data | SCF primary capture |
| `enrollments` | Active enrollments | Links child → pricing_plan |
| `children` | Child profiles | learning_profile (JSONB, DEPRECATED → use child_intelligence_profiles) |
| `coaches` | Coach profiles | assigned children via children.assigned_coach_id |

### Communication
| Table | Purpose | Notes |
|-------|---------|-------|
| `communication_templates` | WA/email templates | 20 templates, by category |
| `communication_logs` | Sent messages | Channel, cost tracking |
| `wa_leads` | Lead Bot leads | phone_number uses `91XXXXXXXXXX` format (no +) |

### Payments
| Table | Purpose | Notes |
|-------|---------|-------|
| `payments` | Razorpay payments | Amounts in paise (multiply by 100) |
| `pricing_plans` | Plan pricing (SSOT) | NEVER read prices from site_settings |
| `payout_config` | Revenue split config | 3-component: Lead + Coach + Platform |

## Embedding Operations

### Model
- **Only model:** `gemini-embedding-001` (768-dim MRL)
- **Never use:** `text-embedding-004` (shut down Jan 14, 2026)

### Writing Embeddings
- All writes go through `insertLearningEvent()` — the ONLY write path to learning_events
- `content_for_embedding` is the text that gets embedded
- Embedding is generated server-side before insert

### Querying Embeddings
```sql
-- Hybrid search (vector + keyword)
SELECT * FROM hybrid_match_learning_events(
  query_embedding := $1,  -- vector(768)
  filter_child_id := $2,
  match_count := 20
);
```

All HNSW indexes are built. 126/126 tables have embedding coverage.

## site_settings Pattern

`site_settings` is the single source of truth for dynamic configuration.

```typescript
// Reading site_settings
const { data } = await supabase
  .from('site_settings')
  .select('value')
  .eq('key', 'your_key')
  .limit(1)

const value = data?.[0]?.value ?? HARDCODED_FALLBACK
```

**Rules:**
- Always provide a hardcoded fallback (app never crashes if DB unavailable)
- **Pricing comes from `pricing_plans` table, NOT site_settings**
- All pages are dynamic — fetch display text from site_settings

### Writing site_settings (INSERT / UPSERT shape)

When seeding or updating `site_settings` via SQL or migration:

- **Required columns:** `category`, `key`, `value`, `description`. NOT NULL on each — omitting any will fail with "null value in column ... violates not-null constraint".
- **`value` is JSONB** — always cast literals: `'3'::jsonb`, `'"text"'::jsonb`, `'true'::jsonb`. Bare `'3'` is treated as text and the cast fails.
- **`ON CONFLICT` target is `(key)`** — there's a unique constraint on `key` alone. `ON CONFLICT (category, key)` will fail with "no unique or exclusion constraint matching".
- **`updated_at` does NOT auto-update** — no trigger; include `updated_at = NOW()` explicitly in `DO UPDATE SET` if you want a fresh timestamp.

Canonical upsert:

```sql
INSERT INTO site_settings (category, key, value, description)
VALUES ('tasks', 'task_max_pending', '2'::jsonb, 'Max active parent_daily_tasks per child for auto-generated content.')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();
```

**Why this matters:** Got us in PR 1 migration 2 (a8bc9d35 → cb45b7e7 fixup) and again during Phase 7 Policy Change 3 SQL drafting (2026-04-30). Both times the wrong-shape SQL appeared correct from training data; only running it surfaces the failure. Always match this shape for site_settings writes.

## QStash / Cron Patterns

- 22 crons consolidated into 1 dispatcher (*/15 min) + goals-capture (*/5 min) = 2 QStash slots
- All cron results log to `activity_log` (NOT `cron_logs` — that table is deprecated)
- Use QStash for any async post-capture orchestration (5-step pipeline)

## Common Gotchas

| Gotcha | Solution |
|--------|----------|
| `ERROR 42702: ambiguous column` | Prefix ALL columns with table aliases |
| `.single()` throws on 0 or 2+ rows | Use `.limit(1)` and check `data?.[0]` |
| CHECK constraint silent rejection | Pre-validate event_type/status before INSERT |
| Phone format mismatch | Use `.or()` with 3 formats or `normalizePhone()` |
| Missing column assumption | Query `information_schema.columns` first |
| `execute_sql` ambiguous refs | Use `public.table_name` + aliases |
| Supabase types stale | Regenerate after every migration |
| `>` redirect in PowerShell creates UTF-16 | Use `Set-Content -Encoding ASCII` for type files |
| Vercel build-time fetch fails | Add `export const dynamic = 'force-dynamic'` |

## Smoke Test Rules

- **Read-only checks only** — never create synthetic data in production
- Verify with `SELECT COUNT(*)` or `SELECT EXISTS()` queries
- Use `EXPLAIN ANALYZE` for query performance testing

## Related Skills

- **yestoryd-code-patterns**: For API route, component, and page patterns
- **yestoryd-content-specialist**: For el_* content hierarchy
- **migration** (Claude Code): For migration file creation
- **supabase-query** (Claude Code): For Supabase client query patterns
