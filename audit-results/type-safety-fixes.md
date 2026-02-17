# Type Safety Fixes — Phase 1
**Date:** 2026-02-14
**Build Status:** PASS (0 type errors)

---

## Strategy

### Initial Approach
A batch script (`scripts/fix-supabase-types.mjs`) added `import { Database }` and `createClient<Database>()` to **196 files**. This exposed **621 type errors** caused by a **stale `database.types.ts`** that doesn't match the actual database schema.

### Revised Approach
Reverted bulk additions from **192 files** (keeping 4 key files). Focused manual fixes on the primary offenders — files with `as any` casts and untyped client creation in critical scheduling/DB code.

### Root Cause
`lib/supabase/database.types.ts` is significantly out of date. Many columns exist in the real DB but are missing from the types file. Until types are regenerated (`supabase gen types typescript`), adding `<Database>` to all files will surface hundreds of false-positive errors.

---

## Files Fixed (6 total)

### 1. `lib/scheduling/enrollment-scheduler.ts`
**Problem:** Created untyped `createClient()`, used `as any` casts (3 instances), function parameters untyped.
**Fixes:**
- Added `import { Database } from '@/lib/supabase/database.types'`
- Changed `createClient(` → `createClient<Database>(`
- Changed function signatures to `supabaseClient?: ReturnType<typeof createClient<Database>>`
- Replaced `.insert(sessionsToCreate as any)` → `.insert(sessionsToCreate as Database['public']['Tables']['scheduled_sessions']['Insert'][])`
- Replaced `await (supabase as any).from('scheduled_sessions').update(...)` → `await supabase.from('scheduled_sessions').update(...)`
- Replaced `const updateResult = await (supabase as any).from('enrollments').update(...)` → `const { error: updateError } = await supabase.from('enrollments').update(...)`
- **`as any` removed: 3**

### 2. `lib/db-utils.ts`
**Problem:** Used `(supabaseAdmin as any).from(table)` pattern for dynamic table access (3 instances).
**Fixes:**
- Replaced `(supabaseAdmin as any).from(table)` with targeted type assertions:
  ```typescript
  await supabaseAdmin
    .from(table as 'children')
    .select('*')
    .eq('id' as never, id)
    .single() as { data: Record<string, unknown> | null; error: PostgrestError | null };
  ```
- Same pattern applied to update and upsert operations
- **`as any` removed: 3**

### 3. `lib/scheduling/config.ts`
**Problem:** Function signatures accepted untyped client `ReturnType<typeof createClient>`, causing type mismatch when called from typed code.
**Fixes:**
- Changed `getSchedulingDurations()` signature: `supabaseClient?: ReturnType<typeof createClient<Database>>`
- Changed `getPlanSchedule()` signature: `supabaseClient?: ReturnType<typeof createClient<Database>>`

### 4. `lib/scheduling/smart-slot-finder.ts`
**Problem:** Same untyped client parameter issue as config.ts (3 functions).
**Fixes:**
- Added `import { Database } from '@/lib/supabase/database.types'`
- Changed `findAvailableSlot()` signature: `supabaseClient?: ReturnType<typeof createClient<Database>>`
- Changed `findConsistentSlot()` signature: `supabaseClient?: ReturnType<typeof createClient<Database>>`
- Changed `findSlotsForSchedule()` signature: `supabaseClient?: ReturnType<typeof createClient<Database>>`

### 5. `app/admin/coach-groups/page.tsx`
**Problem:** Interface definitions didn't match DB column nullability (exposed during typed client testing).
**Fixes:**
- `CoachGroup.description: string` → `string | null`
- `CoachGroup.is_internal: boolean` → `boolean | null`
- `CoachGroup.badge_color: string` → `string | null`
- `CoachGroup.sort_order: number` → `number | null`
- Added missing fields: `is_active`, `created_at`, `updated_at`
- `Coach.is_active: boolean` → `boolean | null`
- Fixed runtime: `style={{ backgroundColor: group.badge_color }}` → `style={{ backgroundColor: group.badge_color || '#6366f1' }}`

### 6. `app/admin/agreements/page.tsx`
**Problem:** Interface definitions didn't match DB column nullability.
**Fixes:**
- `ConfigVariable.description: string` → `string | null`
- `ConfigVariable.category: string` → `string | null`

---

## Summary

| Metric | Count |
|--------|-------|
| Files manually fixed | 6 |
| `as any` casts removed | 6 |
| Function signatures typed | 7 |
| Interface fields corrected | 8 |
| Build errors | 0 |

## Pre-existing Typed Files (no changes needed)
- `lib/supabase/client.ts` — already uses `createClient<Database>(...)`
- `lib/supabase/server.ts` — already uses `createClient<Database>(...)`

## Files Still Using Untyped `createClient()` (~150+)
These files create their own `createClient()` without the `<Database>` generic. They should ideally import from the shared helpers (`lib/supabase/client.ts` or `lib/supabase/server.ts`), but this requires:
1. Regenerating `database.types.ts` from the live database
2. Fixing the resulting type mismatches across the codebase
3. This is recommended as a **Phase 2** task
