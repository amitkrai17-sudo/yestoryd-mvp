# Tech Debt Backlog (read-on-demand)

Extracted from CLAUDE.md on 2026-05-29. Low-priority items to fix organically when next touching the affected files.

---

## Debt log — createAdminClient cleanup (low priority)

Three style/documentation inconsistencies found during the Apr 24 hypothesis test. None are correctness or scale issues. Fix organically on clean days when touching these files; no dedicated sprint.

- **D1 — Doc canon conflict:** `lib/supabase/admin.ts:9-10` comment says "For a singleton, use supabaseAdmin from './server'." `lib/supabase/server.ts:4` comment says "CANONICAL PATTERN: Use createAdminClient() from '@/lib/supabase/admin'." These contradict. Pick one canonical pattern and update the other file's comment to reference it.

- **D2 — Single bypass:** `app/api/cron/daily-health-check/route.ts:39` calls `createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)` inline instead of using the `createAdminClient()` helper. Not a security issue (same env vars, same scope), but inconsistent. Migrate when next touching that cron.

- **D3 — Mixed instantiation pattern:** Some callers use module-level `const` (per-worker singleton); others construct per-function. No functional difference given Supabase SDK is stateless. Choose one convention, document in this file, migrate organically.

- **D4 — Three parallel `database.types.ts` files:** `lib/database.types.ts`, `lib/supabase/database.types.ts`, and `types/database.ts` all hold the same generated types but drift independently. Currently kept in sync via Copy-Item. Consolidate to a single source with re-exports from the other two paths. Required before PR 2 (writer migration touches all three import roots).
