---
name: yestoryd-supabase
description: "Yestoryd Supabase / Postgres specialist — covers data access (queries, RLS, embeddings, vector / hybrid search, site_settings, learning_events, child_id isolation) AND schema work (migrations, new tables, indexes, RLS policies, drop / add columns). Trigger on: 'query', 'select', 'insert', 'update', 'RLS', 'row level security', 'embedding', 'vector search', 'hybrid search', 'site_settings', 'learning_events', 'migration', 'add table', 'alter column', 'add index', 'drop table', 'add field', 'schema', 'database', 'pgvector', 'supabase'. Enforces: typed <Database> clients, child_id isolation, table-alias prefixes on joins, .limit(1) over .single(), CHECK-constraint pre-validation, phone normalization, information_schema verification, idempotent migrations, types regeneration after schema change."
metadata:
  version: 1.0.0
---

# Yestoryd Supabase

Single skill covering both **data access** (queries, RLS, embeddings, hybrid search, child isolation, error handling) and **schema work** (migrations, RLS policies, indexes, embedding columns, type regeneration) for Yestoryd's ~145-table Postgres schema.

## Infrastructure

| Resource | Value |
|----------|-------|
| Project ID | `agnfzrkrpuwmtjulbbpd` |
| Region | `ap-northeast-1` |
| Plan | Free tier (Pro upgrade prioritized) |
| Embedding model | `gemini-embedding-001` (768-dim MRL) |
| Vector extension | pgvector with HNSW indexes (`vector_cosine_ops`) |
| Embedding coverage | 126 / 126 embedding-bearing tables at 100% |
| Schema size | 142 tables (post-March-2026 cleanup from 151), 52 operational empties kept |

## Client selection

| Context | Client | Import |
|---------|--------|--------|
| API routes (user auth) | `createRouteHandlerClient<Database>({ cookies })` | `@supabase/auth-helpers-nextjs` |
| Server components | `createServerComponentClient<Database>({ cookies })` | `@supabase/auth-helpers-nextjs` |
| Crons / webhooks (no user) | `createAdminClient()` from `lib/supabase/admin.ts` | (canonical helper — see CLAUDE.md "Operational pointers" → Destructive ops) |
| Client components | `createClientComponentClient<Database>()` | `@supabase/auth-helpers-nextjs` |

**Always type with `<Database>`** from `lib/supabase/types.ts`. Never inline `new createClient(URL, key)` in route files — use the canonical helper.

## Critical query patterns

### 1. Always prefix columns with table aliases on joins

Supabase throws `ERROR 42702: column reference is ambiguous` when joining tables that share column names (`id`, `created_at`, `status`).

```typescript
// BAD — fails on joins
const { data } = await supabase
  .from('enrollments')
  .select('id, status, children(id, name)')

// GOOD — explicit aliases prevent ambiguity
const { data } = await supabase
  .from('enrollments')
  .select(`
    enrollments:id,
    enrollments:status,
    children!inner(children:id, children:name)
  `)
```

For raw SQL via `execute_sql`:
```sql
-- BAD
SELECT id, name, status FROM enrollments e JOIN children c ON c.id = e.child_id;
-- GOOD
SELECT e.id, c.name, e.status FROM enrollments e JOIN children c ON c.id = e.child_id;
```

### 2. Use `.limit(1)` instead of `.single()`

`.single()` throws on 0 or 2+ rows. Phone lookups frequently have duplicates from normalization history. `.limit(1)` returns an empty array (safe) or the first match.

```typescript
// BAD
const { data } = await supabase.from('parents').select('*').eq('phone', p).single()
// GOOD
const { data } = await supabase.from('parents').select('*').eq('phone', p).limit(1)
const parent = data?.[0] || null
```

### 3. CHECK constraints silently reject

PostgreSQL CHECK constraints don't surface errors via the Supabase JS client — the INSERT silently returns `null`. Pre-validate every value bound to a CHECK constraint.

```typescript
const VALID_EVENT_TYPES = [
  'session_observation', 'assessment', 'homework_completion',
  'parent_feedback', 'structured_capture', 'recall_transcript',
  // ... 22+ valid types
] as const

if (!VALID_EVENT_TYPES.includes(eventType)) {
  throw new Error(`Invalid event_type: ${eventType}`)
}
```

**Known affected tables:** `learning_events.event_type`, `communication_templates.category`, `scheduled_sessions.status`, `payments.status`.

### 4. Check `information_schema` before assuming columns exist

Schema evolves with migrations. Never assume.

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'your_table'
ORDER BY ordinal_position;
```

Always run this in Phase 0 before modifying a table.

### 5. Phone normalization is 3-layer

- **Layer 1 — DB triggers** auto-normalize on INSERT / UPDATE for `parents.phone`, `coaches.phone`, `children.parent_phone`.
- **Layer 2 — app-level** `normalizePhone()` from `lib/utils/phone.ts` at every insert point.
- **Layer 3 — flexible lookups** `.or()` with multiple formats:

```typescript
import { normalizePhone } from '@/lib/utils/phone'
const phone = normalizePhone(rawPhone)   // → +91XXXXXXXXXX
const digits10 = phone.replace('+91', '')
const digits12 = phone.replace('+', '')

const { data } = await supabase
  .from('parents')
  .select('*')
  .or(`phone.eq.${phone},phone.eq.${digits10},phone.eq.${digits12}`)
  .limit(1)
```

- **Canonical format:** `+91XXXXXXXXXX` (E.164, 13 chars).
- **WhatsApp API format:** `91XXXXXXXXXX` (no `+`) — used in `wa_leads.phone_number`.

### 6. `execute_sql` requires fully qualified references

- Always specify `public.table_name`.
- Use parameterized queries where possible.
- Always alias joined tables.
- Test with `EXPLAIN` on anything non-trivial.

### Common query shapes

**Paginated list:**
```typescript
const pageSize = 20
const { data, count } = await supabase
  .from('table')
  .select('*', { count: 'exact' })
  .eq('filter_col', value)
  .order('created_at', { ascending: false })
  .range(page * pageSize, (page + 1) * pageSize - 1)
```

**Upsert with conflict:**
```typescript
const { data, error } = await supabase
  .from('table')
  .upsert({ id: existingId, ...updates }, { onConflict: 'id' })
  .select()
  .single()
```

**Join with related tables:**
```typescript
const { data } = await supabase
  .from('enrollments')
  .select(`*, children (id, name, age, parent_id),
                coaches (id, name, email),
                pricing_plans (name, sessions_count)`)
  .eq('status', 'active')
```

### Error handling

```typescript
const { data, error } = await supabase.from('table').select('*')
if (error) {
  console.error('[Feature] Supabase error:', error.message)
  return NextResponse.json({ error: 'Database error' }, { status: 500 })
}
if (!data || data.length === 0) { /* handle empty */ }
```

## Child data isolation (MANDATORY)

Never expose cross-user data. Always filter by ownership.

```typescript
// Parent reading child data
const { data: children } = await supabase
  .from('children').select('*')
  .eq('parent_id', user.id)

// Coach reading child data
const { data: sessions } = await supabase
  .from('scheduled_sessions').select('*, children(*)')
  .eq('coach_id', user.id)
```

## site_settings pattern

`site_settings` is the single source of truth for dynamic configuration (NOT pricing — that's `pricing_plans`).

### Reading

```typescript
const { data } = await supabase
  .from('site_settings')
  .select('value')
  .eq('key', 'your_key')
  .limit(1)

const value = data?.[0]?.value ?? HARDCODED_FALLBACK
```

Cached readers exist (`getSiteSetting()` from `lib/config/site-settings-loader.ts`, 5-min cache). Prefer those over raw queries.

### Writing (INSERT / UPSERT shape) — exact form required

- **Required NOT NULL columns:** `category`, `key`, `value`, `description`. Omitting any returns "null value in column ... violates not-null constraint".
- **`value` is JSONB** — always cast literals: `'3'::jsonb`, `'"text"'::jsonb`, `'true'::jsonb`. Bare `'3'` is treated as text and the cast fails.
- **`ON CONFLICT` target is `(key)`** — unique constraint on `key` alone. `ON CONFLICT (category, key)` will fail with "no unique or exclusion constraint matching".
- **`updated_at` does NOT auto-update** — no trigger; include `updated_at = NOW()` in `DO UPDATE SET` to refresh.

Canonical upsert:

```sql
INSERT INTO site_settings (category, key, value, description)
VALUES ('tasks', 'task_max_pending', '2'::jsonb,
        'Max active parent_daily_tasks per child for auto-generated content.')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();
```

**Why this matters:** PR 1 migration 2 (a8bc9d35 → cb45b7e7 fixup) and Phase 7 Policy Change 3 (2026-04-30) both wasted time on wrong-shape SQL that looked correct from training data. Match this shape exactly.

## Embeddings / vector search

- **Only embedding model:** `gemini-embedding-001` (768-dim MRL). Never use `text-embedding-004` (shut down 2026-01-14).
- **Index:** HNSW (`vector_cosine_ops`) — better recall than IVFFlat.
- **`content_for_embedding`** column stores the text that gets embedded; embedding is generated server-side before insert.
- **All writes to `learning_events` go through `insertLearningEvent()`** — single canonical write path.

### Querying — hybrid search RPC

```typescript
const { data } = await supabase.rpc('hybrid_match_learning_events', {
  query_embedding: embedding,    // float[768]
  match_threshold: 0.7,
  match_count: 10,
  filter_child_id: childId,      // ALWAYS filter by child
  filter_keywords: keywords,     // optional keyword boost
})
```

Raw SQL form:
```sql
SELECT * FROM hybrid_match_learning_events(
  query_embedding := $1,  -- vector(768)
  filter_child_id := $2,
  match_count := 20
);
```

High-confidence signals get boosted in hybrid search.

## Migrations / schema work

### MANDATORY: migration file discipline

ALL schema changes go through migration files in `supabase/migrations/`. NEVER use the Supabase Dashboard for schema changes.

### Pre-flight (run before writing a migration)

```bash
# 1. Existing references to the table you're touching
grep -r "TABLE_NAME" supabase/migrations/ --include="*.sql"
# 2. How the table is used in code
grep -r "TABLE_NAME" app/ lib/ components/ --include="*.ts" --include="*.tsx" -l
# 3. Similar / competing tables
grep -r "SIMILAR_KEYWORD" supabase/migrations/ --include="*.sql" | head -20
# 4. Recent migrations for naming style
ls -la supabase/migrations/ | tail -10
```

Report findings before drafting the migration. Watch for table bloat — `children` already has 95 columns and `scheduled_sessions` 110. Consider whether new data belongs in an existing table before adding another.

### File naming

`supabase/migrations/YYYYMMDD_description.sql` — e.g. `20260411_add_batch_id_to_sessions.sql`.

### Template

```sql
-- Migration: YYYYMMDD_description
-- Purpose: Brief description
-- Author: Amit / Claude Code
-- Related: link to feature or issue if applicable

-- ═══════════════════════════════════════════════════
-- NEW TABLES
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.your_table (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  -- ... columns
);

-- ═══════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_your_table_column
  ON public.your_table (column_name);

-- ═══════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════

ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON public.your_table FOR SELECT
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════
-- TRIGGERS (updated_at)
-- ═══════════════════════════════════════════════════

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.your_table
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- ═══════════════════════════════════════════════════
-- BACKFILL (separate transaction if large)
-- ═══════════════════════════════════════════════════

UPDATE public.your_table SET new_column = 'default'
WHERE new_column IS NULL;
```

### Migration rules

1. **Idempotent always** — `IF NOT EXISTS` / `IF EXISTS` on every statement.
2. **Never drop columns in production directly** — add a `DEPRECATED` comment, switch readers off, drop after a full release cycle. See CLAUDE.md → Destructive Operation Discipline (Tier-1 / `IF EXISTS` typo anti-pattern).
3. **One logical change per migration** — don't mix schema changes with data backfills in the same statement block. Backfills go in their own transaction.
4. **RLS on every new table** — even internal ones get a basic policy.
5. **UUID primary keys** via `gen_random_uuid()`.
6. **Always include `created_at` + `updated_at` with defaults.**
7. **Foreign keys** — reference parent tables explicitly.
8. **Naming:** `snake_case` for tables/columns, `idx_table_column` for indexes.

### Embedding-bearing tables

If the table stores AI-searchable content, add the embedding stack:

```sql
ALTER TABLE public.your_table
  ADD COLUMN IF NOT EXISTS embedding vector(768);

ALTER TABLE public.your_table
  ADD COLUMN IF NOT EXISTS content_for_embedding TEXT;

CREATE INDEX IF NOT EXISTS idx_your_table_embedding
  ON public.your_table USING hnsw (embedding vector_cosine_ops);
```

### After every migration — REGENERATE TYPES

```bash
npx supabase gen types typescript --project-id agnfzrkrpuwmtjulbbpd > lib/supabase/types.ts
```

TypeScript types must match the DB shape. Stale types cause silent runtime failures (the 2026-04-25 four-template alignment incident — see `scripts/verify-change.ps1` header).

**PowerShell note:** `>` redirect creates UTF-16 BOM files. Use `Set-Content -Encoding ASCII` when writing the types file via PowerShell.

## Key tables by domain

### Intelligence & learning
| Table | Purpose | Notes |
|-------|---------|-------|
| `learning_events` | All learning signals | child_id, event_type, event_data (JSONB), embedding (vector 768), content_for_embedding |
| `child_intelligence_profiles` | Per-child intelligence summary | narrative_profile, freshness_status |
| `el_skills` | Skill taxonomy (SSOT) | name, slug, category, is_active |
| `skill_categories` | Category taxonomy (SSOT) | 10 rows, 3-level tree |
| `el_content_items` | E-learning content | embedding (vector 768) |
| `books` | Reading library | embedding (vector 768) |

### Coaching & sessions
| Table | Purpose | Notes |
|-------|---------|-------|
| `scheduled_sessions` | All coaching sessions | 110 cols — partitioning candidate; `batch_id` for English classes |
| `session_captures` | Post-session structured data | SCF primary capture |
| `enrollments` | Active enrollments | child → pricing_plan link |
| `children` | Child profiles | 95 cols — partitioning candidate; `learning_profile` JSONB DEPRECATED → use `child_intelligence_profiles` |
| `coaches` | Coach profiles | FK target of 52 tables — see CLAUDE.md → Destructive ops Tier-2 |

### Communication
| Table | Purpose | Notes |
|-------|---------|-------|
| `communication_templates` | WA / email templates | ~70 rows — Tier-3 protected |
| `communication_logs` | Sent messages | channel, cost tracking |
| `wa_leads` | Lead Bot leads | phone_number = `91XXXXXXXXXX` (no `+`) |

### Payments
| Table | Purpose | Notes |
|-------|---------|-------|
| `payments` | Razorpay payments | amounts in paise (multiply by 100); Tier-2 protected |
| `pricing_plans` | Plan pricing (SSOT) | NEVER read prices from site_settings; ~4 rows Tier-3 |
| `payout_config` | Revenue split | 3-component: Lead + Coach + Platform |

### Watch / careful with
- `site_settings` — Tier-3 protected, ~269 rows, don't add columns — add rows.
- `coupon_usages` — unified March 2026 (NOT `coupon_uses`).
- `activity_log` — append-only audit log, OK to truncate.

## QStash / cron notes
- 22 crons consolidated into 1 dispatcher (every 15 min) + `goals-capture` (every 5 min) = 2 QStash slots.
- All cron results log to `activity_log` (NOT `cron_logs` — deprecated).
- Use QStash for any async post-capture orchestration.

## Common gotchas

| Gotcha | Fix |
|--------|-----|
| `ERROR 42702: ambiguous column` | Prefix ALL columns with table aliases |
| `.single()` throws on 0 / 2+ rows | Use `.limit(1)` and check `data?.[0]` |
| CHECK constraint silent rejection | Pre-validate event_type / status before INSERT |
| Phone format mismatch | `normalizePhone()` + `.or()` with 3 formats |
| Missing column assumption | Query `information_schema.columns` first |
| `execute_sql` ambiguous refs | Qualify with `public.` + aliases |
| Stale Supabase types | Regenerate after every migration |
| `>` in PowerShell → UTF-16 | Use `Set-Content -Encoding ASCII` |
| Vercel build-time fetch fails | Add `export const dynamic = 'force-dynamic'` |
| ECONNRESET | Check Supabase status page FIRST before debugging code |
| Port confusion | `6543` for connection pooling (production) |

## Smoke-test rules
- Read-only checks only — never create synthetic data in production.
- Verify with `SELECT COUNT(*)` or `SELECT EXISTS()`.
- Use `EXPLAIN ANALYZE` for performance tests.

## Destructive operations

Any `DROP`, `TRUNCATE`, `DELETE` not pinned to a single PK, or mutation of a Tier-1 table (`children`, `enrollments`, `parents`) requires the `PROCEED-DESTRUCTIVE` protocol. Full rules: `docs/DESTRUCTIVE-OPS.md`.
