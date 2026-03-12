# Parallel Structures Audit Report
**Date:** 2026-01-23
**Principle:** Single source of truth. No duplicate columns. Use JOINs.

---

## PHASE 1: AUDIT FINDINGS

### 1. `children.coach_id` - DUPLICATE OF `enrollments.coach_id`

**TRUTH:** `enrollments.coach_id` is the ONLY source of coach assignment.

**Files querying `children.coach_id` directly (FIXED):**
| File | Line | Status |
|------|------|--------|
| `app/coach/dashboard/page.tsx` | 121, 126 | FIXED |
| `app/coach/students/page.tsx` | 71-73 | FIXED |
| `app/coach/students/[id]/page.tsx` | 141-145 | FIXED |
| `app/coach/earnings/page.tsx` | 89-91 | FIXED |
| `app/coach/ai-assistant/page.tsx` | 74-76 | FIXED |
| `app/coach/templates/page.tsx` | 93-95 | FIXED |

**Files setting `children.coach_id` (KEEP for denormalization/migration):**
| File | Line | Notes |
|------|------|-------|
| `app/api/payment/verify/route.ts` | 401 | Sets on enrollment - OK for legacy support |

**API files querying correctly through enrollments:**
- `app/api/coach/sessions/route.ts` - Uses `scheduled_sessions.coach_id` (correct)
- `app/api/coach/earnings/route.ts` - Uses `coach_payouts.coach_id` (correct)
- `app/api/coach/availability/route.ts` - Uses `scheduled_sessions.coach_id` (correct)

---

### 2. `assigned_coach_id` - FOR DISCOVERY CALLS (DIFFERENT USE CASE)

**TRUTH:** `discovery_calls.assigned_coach_id` is for pre-enrollment coach assignment.

This is NOT a duplicate - it's a different stage in the funnel:
- `discovery_calls.assigned_coach_id` = Coach assigned to handle discovery call
- `enrollments.coach_id` = Coach assigned to handle coaching sessions

**Files using correctly:**
- `app/api/discovery/book/route.ts`
- `app/api/discovery-call/pending/route.ts`
- `app/api/scheduling/slots/route.ts`

---

### 3. `child.name` vs `child.child_name` - INCONSISTENT NAMING

**TRUTH:** Column is `child_name` in database. `name` does NOT exist.

**Files using fallback pattern `child_name || name` (28 files):**
These are defensive patterns for data that might have been migrated.

| File | Line | Pattern |
|------|------|---------|
| `app/coach/dashboard/page.tsx` | 199 | `child_name \|\| name` |
| `app/parent/dashboard/page.tsx` | 216 | `name \|\| child_name` |
| `app/parent/layout.tsx` | 523 | `child_name \|\| name` |
| `app/api/chat/route.ts` | 467 | `child_name \|\| name` |
| `app/api/quiz/submit/route.ts` | 71 | `child_name \|\| name` |
| ... and 23 more files | | |

**RECOMMENDATION:** Audit database to confirm no records have `name` set, then remove fallbacks.

---

### 4. `session_type = 'parent'` - INCORRECT VALUE

**TRUTH:** Should be `'parent_checkin'`

**Previously fixed in Phase 1 of this conversation:**
- `app/api/completion/check/[enrollmentId]/route.ts`
- `app/api/completion/report/[enrollmentId]/route.ts`
- `app/api/jobs/enrollment-complete/route.ts`

**Current search found NO remaining `session_type === 'parent'` patterns.**

---

### 5. `site_settings.program_price` - SHOULD USE `pricing_plans`

**TRUTH:** `pricing_plans` table is the source of truth for product pricing.

**Files still using `site_settings.program_price`:**
| File | Line | Status |
|------|------|--------|
| `app/coach/earnings/page.tsx` | 98 | FIXED - Now uses `enrollment.amount` |
| `app/api/coach/earnings-summary/route.ts` | 70 | NEEDS FIX |

**Note:** `enrollment.amount` is set from actual payment, which is the true amount paid.

---

### 6. `discovery_calls.child_name/child_age/assessment_score` - DENORMALIZED

**Current state:** These are stored directly on discovery_calls for convenience.

**Files accessing:**
- Searched: No direct access patterns found that don't already join to children.

**RECOMMENDATION:** These denormalized fields are acceptable for display purposes since discovery calls can exist before a child record is created.

---

## PHASE 2: FIXES APPLIED

### Coach-Student Relationship Fix

All 6 files in `app/coach/` now query through `enrollments` table:

1. **`app/coach/students/page.tsx`**
   - Before: `from('children').eq('coach_id', coachId)`
   - After: `from('enrollments').select('child:children(...)').eq('coach_id', coachId)`

2. **`app/coach/dashboard/page.tsx`**
   - Before: `from('children').eq('coach_id', coachId)` for stats
   - After: `from('enrollments').eq('coach_id', coachId)` for stats

3. **`app/coach/students/[id]/page.tsx`**
   - Before: `from('children').eq('coach_id', coachId)` for access check
   - After: `from('enrollments').eq('coach_id', coachId)` with child JOIN

4. **`app/coach/earnings/page.tsx`**
   - Before: `from('children').eq('coach_id', coachId)`
   - After: `from('enrollments').select('child:children(...)').eq('coach_id', coachId)`
   - Also: Now uses `enrollment.amount` instead of `site_settings.program_price`

5. **`app/coach/ai-assistant/page.tsx`**
   - Before: `from('children').eq('coach_id', coachId)`
   - After: `from('enrollments').select('child:children(...)').eq('coach_id', coachId)`

6. **`app/coach/templates/page.tsx`**
   - Before: `from('children').eq('coach_id', coachId)`
   - After: `from('enrollments').select('child:children(...)').eq('coach_id', coachId)`

---

## PHASE 3: REMAINING CLEANUP

### Priority 1 (Should Fix)

1. **`app/api/coach/earnings-summary/route.ts:70`**
   - Still queries `site_settings.program_price`
   - Should use `enrollment.amount` or `pricing_plans`

### Priority 2 (Consider Fixing)

1. **Remove `child.name` fallbacks** (28 files)
   - Verify no database records have `name` column populated
   - Remove fallback patterns like `child_name || name`

2. **Consider deprecating `children.coach_id` column**
   - After all queries use `enrollments.coach_id`
   - Keep for backward compatibility but don't write to it

### Priority 3 (Documentation)

1. Document in CLAUDE.md:
   - `enrollments.coach_id` is single source of truth for coach assignment
   - `children.coach_id` is deprecated/legacy
   - `discovery_calls.assigned_coach_id` is for pre-enrollment stage only

---

## Summary

| Category | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| children.coach_id queries | 6 files | 6 files | 0 |
| session_type='parent' | 3 files | 3 files (previous fix) | 0 |
| site_settings.program_price | 2 files | 1 file | 1 file |
| child.name fallbacks | 28 files | 0 | 28 files (low priority) |

**Total files modified in this audit:** 6 coach portal files
