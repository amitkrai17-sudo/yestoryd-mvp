---
name: supabase-query
description: >
  Yestoryd Supabase query patterns and database access conventions.
  Use when writing database queries, RLS policies, or data access logic.
  Trigger on: "query", "select", "insert", "update", "supabase", "database",
  "RLS", "row level security", "data fetch", "site_settings", "learning_events",
  "embedding", "vector search", "hybrid search", or any database operation.
  Enforces: typed clients, child_id isolation, site_settings patterns,
  embedding queries, and proper error handling.
---

# Supabase Query Skill — Yestoryd

## Client Selection

| Context | Client | Import |
|---------|--------|--------|
| API routes (user auth) | `createRouteHandlerClient<Database>({ cookies })` | `@supabase/auth-helpers-nextjs` |
| Server components | `createServerComponentClient<Database>({ cookies })` | `@supabase/auth-helpers-nextjs` |
| Crons/webhooks (no user) | `createClient(url, serviceKey)` | `@supabase/supabase-js` |
| Client components | `createClientComponentClient<Database>()` | `@supabase/auth-helpers-nextjs` |

**Always type with `<Database>`** from `lib/supabase/types.ts`.

## site_settings Pattern (CRITICAL)

site_settings is the single source of truth for ALL configuration:

```typescript
// Correct: Read from site_settings with hardcoded fallback
const { data: setting } = await supabase
  .from('site_settings')
  .select('setting_value')
  .eq('setting_key', 'your_key')
  .single();

const value = setting?.setting_value ?? 'hardcoded_fallback';
```

For pricing config, use the shared loader:
```typescript
import { getPricingConfig } from '@/lib/config/pricing-config';
const pricing = await getPricingConfig(); // 5-min cache
```

**Cache invalidation:** When admin saves settings, invalidate via the admin save route. 3 site_settings caches are wired to admin save invalidation.

## Child Data Isolation (MANDATORY)

**NEVER expose cross-user data.** Always filter:

```typescript
// Parent accessing child data — verify ownership
const { data: children } = await supabase
  .from('children')
  .select('*')
  .eq('parent_id', user.id); // ALWAYS filter by parent

// Coach accessing child data — verify assignment
const { data: sessions } = await supabase
  .from('scheduled_sessions')
  .select('*, children(*)')
  .eq('coach_id', user.id); // ALWAYS filter by coach
```

## Embedding / Vector Search

```typescript
// Vector similarity search (768-dim, cosine distance)
const { data } = await supabase.rpc('hybrid_match_learning_events', {
  query_embedding: embedding,        // 768-dim float array
  match_threshold: 0.7,
  match_count: 10,
  filter_child_id: childId,          // ALWAYS filter by child
  filter_keywords: keywords,         // Optional keyword boost
});
```

- Embedding model: `gemini-embedding-001` (768 dimensions)
- Index type: HNSW (`vector_cosine_ops`) — better recall than IVFFlat
- `content_for_embedding` column stores the text that gets embedded
- High-confidence signals get boosted in hybrid search

## Common Query Patterns

### Paginated List
```typescript
const pageSize = 20;
const { data, count } = await supabase
  .from('table')
  .select('*', { count: 'exact' })
  .eq('filter_col', value)
  .order('created_at', { ascending: false })
  .range(page * pageSize, (page + 1) * pageSize - 1);
```

### Upsert with Conflict
```typescript
const { data, error } = await supabase
  .from('table')
  .upsert(
    { id: existingId, ...updates },
    { onConflict: 'id' }
  )
  .select()
  .single();
```

### Join with Related Tables
```typescript
const { data } = await supabase
  .from('enrollments')
  .select(`
    *,
    children (id, name, age, parent_id),
    coaches (id, name, email),
    pricing_plans (name, sessions_count)
  `)
  .eq('status', 'active');
```

## Error Handling

```typescript
const { data, error } = await supabase.from('table').select('*');

if (error) {
  console.error('[Feature] Supabase error:', error.message);
  // For critical paths: return 500 to trigger retry
  return NextResponse.json({ error: 'Database error' }, { status: 500 });
}

if (!data || data.length === 0) {
  // Handle empty state gracefully
}
```

## Troubleshooting

- **ECONNRESET errors:** Check Supabase status page FIRST before debugging code
- **Port 6543** for connection pooling (production)
- **Types mismatch:** Run `npx supabase gen types` after any migration
