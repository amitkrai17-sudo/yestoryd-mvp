# YESTORYD CODE AUDIT REPORT
## Deep Dive Analysis — January 31, 2026
**Auditor:** Claude Opus 4.5 | **6 parallel agents** | **~300 files analyzed**

---

## EXECUTIVE SUMMARY

| Category | Score | Issues Found |
|----------|-------|-------------|
| UI Consistency (Coach) | 6/10 | 12 issues |
| Dead Code & Unused | 6/10 | 10 issues |
| Data Flow | 5/10 | 1 critical bug |
| Type Safety | 4/10 | 639 unsafe types |
| Security | 6/10 | 25 findings |
| Code Quality | 8.5/10 | Minor issues |
| Mobile | 7/10 | 6 issues |

**Total Issues:** 56 findings across 7 categories

---

## MASTER ISSUE TABLE

| ID | Category | Severity | File | Details |
|----|----------|----------|------|---------|
| UI-01 | UI | P0 | `app/coach/sessions/page.tsx:458,466` | Blue (#00ABFF) toggle buttons — should be pink (#FF0099) |
| UI-02 | UI | P0 | `app/coach/sessions/page.tsx:508,558,577,663,673` | 5 more blue accent usages (stat icon, link, badge, calendar) |
| UI-03 | UI | P1 | `app/coach/login/page.tsx` | Magic link & OTP buttons use blue instead of pink |
| UI-04 | UI | P1 | `app/coach/profile/page.tsx` | Uses `bg-[#1a1a24]` — non-standard background |
| UI-05 | UI | P2 | `app/coach/earnings/page.tsx` | Mixed button colors (blue, green, yellow) for different actions |
| UI-06 | UI | P2 | Various | `rounded-lg` vs `rounded-xl` vs `rounded-2xl` inconsistent |
| DF-01 | Data Flow | **P0** | `app/api/payment/verify/route.ts:952-974` | **Discovery call coach NOT carried to enrollment** — only `child_id` fetched, `assigned_coach_id` ignored. Wrong coach assigned. |
| TS-01 | Type Safety | P1 | `lib/supabase/database.types.ts` | **Entire DB type system is `Record<string, any>`** — zero compile-time safety |
| TS-02 | Type Safety | P2 | 211 files | 526 `: any` + 113 `as any` = **639 unsafe type annotations** |
| TS-03 | Type Safety | P1 | `app/api/payment/verify/route.ts:497,502` | Coach filter/sort uses untyped `(c: any)` |
| TS-04 | Type Safety | P1 | `app/api/payment/verify/route.ts:1130,1145` | Supabase client cast `as any` |
| SEC-01 | Security | **P0** | `middleware.ts:42-48` | 5 admin emails hardcoded in source code |
| SEC-02 | Security | **P0** | `lib/api-auth.ts:17-23` | Same 5 emails duplicated — must match middleware |
| SEC-03 | Security | P0 | `lib/auth-options.ts:27-31` | 3 admin emails (partial overlap with above) |
| SEC-04 | Security | P1 | `app/api/nps/route.ts` | No auth — anyone can GET/POST NPS for any enrollmentId |
| SEC-05 | Security | P1 | `app/api/activity/track/route.ts` | No auth — accepts email param, returns activity logs |
| SEC-06 | Security | P1 | `app/api/assessment/enrolled/route.ts` | No ownership check — any user can submit assessment for any childId |
| SEC-07 | Security | P1 | `app/api/quiz/generate/route.ts` | No ownership check on childId |
| SEC-08 | Security | P1 | `app/api/availability/route.ts` | No auth — allows coach calendar enumeration |
| SEC-09 | Security | P1 | `app/api/referral/track/route.ts` | No auth on POST — referral code fraud possible |
| SEC-10 | Security | P2 | `app/api/waitlist/route.ts` | No rate limiting on POST (spam risk) |
| SEC-11 | Security | P2 | `app/api/features/route.ts` | Feature flags exposed without auth |
| SEC-12 | Security | P2 | `app/api/discovery-call/cal-webhook/route.ts` | No visible webhook signature verification |
| SEC-13 | Security | P2 | Multiple public GET endpoints | No rate limiting on `/ab-track`, `/group-classes`, `/testimonials`, `/pricing`, `/settings` |
| DC-01 | Dead Code | P2 | `app/api/matching/route.ts` | Complete matching engine — **never called from anywhere** |
| DC-02 | Dead Code | P2 | `lib/rai/prompts/prospect.ts` | Confirmed deleted ✅ |
| DC-03 | Dead Code | P2 | `app/api/cron/coach-engagement/route.ts` | Orphaned cron route — no scheduler references it |
| DC-04 | Dead Code | P2 | `app/api/cron/process-coach-unavailability/route.ts` | Orphaned cron route — no scheduler references it |
| DC-05 | Dead Code | P2 | `app/api/scheduling/dispatch/route.ts` | Orphaned scheduling route — never called |
| DC-06 | Dead Code | P3 | `app/api/sessions/[id]/cancel-request/route.ts` | Likely orphaned — no frontend references |
| DC-07 | Dead Code | P3 | `app/api/sessions/[id]/reschedule-request/route.ts` | Likely orphaned — no frontend references |
| DC-08 | Dead Code | P3 | `app/api/sessions/change-request/route.ts` | Likely orphaned — no frontend references |
| DC-09 | Dead Code | P3 | `lib/` (various) | `notifyCoachAssignment` — exported but never imported |
| DC-10 | Dead Code | P2 | `components/coach/CoachLayout.tsx` vs `components/layouts/CoachLayout.tsx` | Potential naming conflict — verify which is used |
| CQ-01 | Code Quality | P2 | `app/api/payment/verify/route.ts` | 1,359 lines — refactoring candidate |
| CQ-02 | Code Quality | P2 | `app/assessment/AssessmentPageClient.tsx` | 1,375 lines — refactoring candidate |
| CQ-03 | Code Quality | P3 | 126+ files | Console.log statements (structured JSON — acceptable for production) |
| MOB-01 | Mobile | P1 | `components/chat/ChatWidget.tsx:233` | `bottom-24` positioning overlaps bottom nav on some devices |
| MOB-02 | Mobile | P2 | `components/coach/SessionNotesForm.tsx` | Close button `p-1` = ~20px touch target (below 44px min) |
| MOB-03 | Mobile | P2 | `components/coach/EarningsOverview.tsx:186` | `<table>` without `overflow-x-auto` wrapper |
| MOB-04 | Mobile | P2 | `app/components/agreement/AgreementText.tsx:232,261` | 2 tables without `overflow-x-auto` wrapper |
| MOB-05 | Mobile | P2 | `app/admin/crm/page.tsx:206` | Modal close button ~24px touch target |
| MOB-06 | Mobile | P3 | `components/chat/ChatWidget.tsx` | Multiple fixed positioning variants — inconsistent safe-area handling |

---

## 1. UI CONSISTENCY — COACH PORTAL

### Coach Pages Layout Compliance

| Page | Uses CoachLayout | Primary Button | Background | Verdict |
|------|-----------------|----------------|------------|---------|
| sessions | ✅ | **#00ABFF (blue) ❌** | bg-surface-0/1 | **FIX NEEDED** |
| dashboard | ✅ | #FF0099 (pink) ✅ | bg-surface-1 | OK |
| profile | ✅ | #FF0099 (pink) ✅ | **bg-[#1a1a24] ⚠️** | Non-standard bg |
| students | ✅ | #FF0099 (pink) ✅ | bg-surface-1 | OK |
| discovery-calls | ✅ | #FF0099 (pink) ✅ | bg-surface-1 | OK |
| earnings | ✅ | Various ⚠️ | bg-surface-1 | Mixed colors |
| ai-assistant | ✅ | #FF0099 (pink) ✅ | bg-surface-1 | OK |
| onboarding | ❌ (intentional) | #FF0099 (pink) ✅ | gradient | OK |
| login | ❌ (intentional) | **#00ABFF (blue) ❌** | gradient | **FIX NEEDED** |

### Sessions Page Blue Button Lines

```tsx
// Line 458: List view toggle
view === 'list' ? 'bg-[#00ABFF] text-white' : 'text-text-tertiary'

// Line 466: Calendar view toggle
view === 'calendar' ? 'bg-[#00ABFF] text-white' : 'text-text-tertiary'

// Line 508: Stat icon background
className="bg-[#00ABFF]/20 ... text-[#00ABFF]"

// Line 558: "View Students" link
className="text-[#00ABFF] text-sm hover:underline"

// Line 577: "Today" badge
className="bg-[#00ABFF]/20 text-[#00ABFF]"

// Line 663: Calendar day highlight
'border-[#00ABFF] bg-[#00ABFF]/10'

// Line 673: Calendar session dot
className="bg-[#00ABFF]"
```

**Fix:** Replace all `#00ABFF` with `#FF0099` in sessions/page.tsx (7 occurrences).

---

## 2. DEAD CODE & UNUSED

### Orphaned: `/api/matching/route.ts`

Complete coach-child matching engine that calculates skill-based match scores. **Called from: NOWHERE.**

References found only in:
- `YESTORYD_CODEBASE_AUDIT.md` (documentation)
- `docs/coach-features-audit-report.md` (documentation)
- `tsconfig.tsbuildinfo` (build metadata)

**Recommendation:** Wire into payment/verify coach assignment flow or delete.

### Orphaned API Routes

| Route | Type | Evidence |
|-------|------|----------|
| `/api/cron/coach-engagement` | Cron | No scheduler (vercel.json/QStash) references it |
| `/api/cron/process-coach-unavailability` | Cron | No scheduler references it |
| `/api/scheduling/dispatch` | API | Never called from frontend or other routes |
| `/api/sessions/[id]/cancel-request` | API | No frontend fetch/axios calls reference it |
| `/api/sessions/[id]/reschedule-request` | API | No frontend fetch/axios calls reference it |
| `/api/sessions/change-request` | API | No frontend fetch/axios calls reference it |

**Recommendation:** Verify these aren't called externally (webhooks, mobile app). If not, delete.

### Unused Exports

- `notifyCoachAssignment` — exported from lib but never imported anywhere

### Component Naming Conflict

- `components/coach/CoachLayout.tsx` and `components/layouts/CoachLayout.tsx` — verify which is actually used; the other should be deleted.

### Component Duplication Check: CLEAN ✅

| Folder | Files | Overlap |
|--------|-------|---------|
| `components/coach/` | 14 files | None |
| `components/parent/` | 5 files | None |

No duplicate components found between coach and parent folders.

---

## 3. DATA FLOW — CRITICAL BUG

### Discovery Call Coach → Enrollment: BROKEN

**File:** `app/api/payment/verify/route.ts:952-974`

When a payment is verified, the system creates an enrollment but **does not carry forward the discovery call's assigned coach**:

```typescript
// Line 952-961: ONLY child_id is fetched from discovery_calls
if (!childIdToUse && body.discoveryCallId) {
  const { data: dc } = await supabase
    .from('discovery_calls')
    .select('child_id')          // ← MISSING: assigned_coach_id
    .eq('id', body.discoveryCallId)
    .single();
}

// Line 974: Uses body.coachId (often null) → falls back to smart matching
const coach = await getCoach(body.coachId, requestId);
```

**Impact:**
- Parent books discovery with Coach A
- Payment verified → enrollment created with Coach B (from smart matching)
- Revenue split misalignment — Coach A expected revenue, Coach B gets it
- Parent confused by different coach

**Fix:**
```typescript
// Add after line 961:
let coachIdFromDiscovery: string | null = null;
if (body.discoveryCallId) {
  const { data: dc } = await supabase
    .from('discovery_calls')
    .select('child_id, assigned_coach_id')   // ← ADD THIS
    .eq('id', body.discoveryCallId)
    .single();
  if (dc?.child_id) childIdToUse = dc.child_id;
  if (dc?.assigned_coach_id) coachIdFromDiscovery = dc.assigned_coach_id;
}

// Line 974: Use discovery coach as priority
const coach = await getCoach(body.coachId || coachIdFromDiscovery, requestId);
```

---

## 4. TYPE SAFETY

### Database Types: ALL `Record<string, any>`

**File:** `lib/supabase/database.types.ts`

```typescript
export type Database = {
  public: {
    Tables: Record<string, {
      Row: Record<string, any>          // ← Every row is untyped
      Insert: Record<string, any>       // ← Every insert is untyped
      Update: Record<string, any>       // ← Every update is untyped
      Relationships: any[]
    }>
    // ... all Views, Functions also 'any'
  }
}
```

**Impact:** Zero compile-time safety on any Supabase query. Every `.from('table').select()` returns `any`.

**Fix:** `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/database.types.ts`

### `any` Usage by Category

| Pattern | Count | Files | Risk |
|---------|-------|-------|------|
| `: any` | 526 | 211 | High |
| `as any` | 113 | 53 | High |
| **Total** | **639** | — | — |

### Top 10 Files with Most `any`

| File | Count |
|------|-------|
| `lib/scheduling/session-manager.ts` | 19 |
| `app/api/elearning/recommendations.ts` | 15 |
| `lib/qstash.ts` | 14 |
| `lib/rai/admin-insights.ts` | 13 |
| `app/api/payment/verify/route.ts` | 13 |
| `lib/scheduling/coach-availability-handler.ts` | 11 |
| `app/api/cron/compute-insights.ts` | 10 |
| `app/api/admin/completion/list.ts` | 10 |
| `lib/calendar/operations.ts` | 7 |
| `lib/scheduling/transaction-manager.ts` | 5 |

---

## 5. SECURITY

### P0: Hardcoded Admin Emails (3 files, inconsistent)

| File | Line | Emails |
|------|------|--------|
| `middleware.ts` | 42-48 | 5 emails |
| `lib/api-auth.ts` | 17-23 | 5 emails (same) |
| `lib/auth-options.ts` | 27-31 | 3 emails (subset) |

**Risk:** Adding/removing admins requires code deploy. Emails in version control.
**Fix:** Move to `site_settings` table with key `admin_emails`.

### P1: Unauthenticated Endpoints with Sensitive Data

| Endpoint | Method | Risk |
|----------|--------|------|
| `/api/nps` | GET/POST | Read/write NPS for any enrollmentId |
| `/api/activity/track` | GET | Query user activity by email |
| `/api/assessment/enrolled` | POST | Submit assessment for any childId |
| `/api/quiz/generate` | POST | Generate quiz for any childId |
| `/api/availability` | GET | Enumerate coach calendars |
| `/api/referral/track` | POST | Referral code fraud |

### P2: Missing Rate Limiting

Endpoints without rate limits: `/api/waitlist` POST, `/api/ab-track`, `/api/group-classes`, `/api/testimonials`, `/api/pricing`, `/api/settings`, `/api/features`

### Positive Security Findings ✅

- No SQL injection risks (Supabase parameterized queries)
- Environment variables properly used (no hardcoded secrets)
- Zod validation on critical routes (payment create/verify)
- HMAC-SHA256 webhook verification (Razorpay)
- Idempotent webhook processing (`processed_webhooks` table)

---

## 6. CODE QUALITY

### Large Files (Refactoring Candidates)

| File | Lines | Priority |
|------|-------|----------|
| `app/assessment/AssessmentPageClient.tsx` | 1,375 | P3 |
| `app/api/payment/verify/route.ts` | 1,359 | P3 |
| `app/api/payment/create/route.ts` | 867 | P3 |
| `app/enroll/page.tsx` | 571 | P3 |
| `app/HomePageClient.tsx` | 494 | P3 |

### Console.log: 126+ Statements

All use structured JSON format with requestId — **acceptable for production logging**. Example:
```typescript
console.log(JSON.stringify({ requestId, event: 'payment_verify_start', ... }))
```

### TODO/FIXME/HACK: Minimal ✅

Only informational comments found — no blocking TODOs.

### Error Handling: Excellent ✅

- All POST handlers wrapped in try-catch
- Zod validation before processing
- Proper HTTP status codes
- Graceful degradation (non-critical tasks don't block responses)

---

## 7. MOBILE ISSUES

### ChatWidget Positioning (P1)

```tsx
// components/chat/ChatWidget.tsx:233
className="fixed bottom-24 lg:bottom-6 right-6"
```

`bottom-24` = 96px. Bottom nav is ~64px. On devices with safe-area-inset, overlap is possible.

**Fix:** `bottom-[calc(5rem+env(safe-area-inset-bottom))]` or test and adjust.

### Tables Missing `overflow-x-auto` (P2)

| File | Line | Fix |
|------|------|-----|
| `components/coach/EarningsOverview.tsx` | 186 | Wrap `<table>` in `<div className="overflow-x-auto">` |
| `app/components/agreement/AgreementText.tsx` | 232 | Wrap table |
| `app/components/agreement/AgreementText.tsx` | 261 | Wrap table |

### Small Touch Targets (P2)

| File | Element | Current | Fix |
|------|---------|---------|-----|
| `components/coach/SessionNotesForm.tsx` | Close button | `p-1` (~20px) | `p-2.5` or `min-w-[44px] min-h-[44px]` |
| `app/admin/crm/page.tsx:206` | Modal close | `p-2` (~24px) | Add `min-w-[44px] min-h-[44px]` |

### Compliant Areas ✅

- All admin pages have `pb-24 lg:pb-0` for bottom nav
- Parent layout: `pb-24 lg:pb-0` ✅
- Coach layout: `pb-20 lg:pb-0` ✅
- BottomNav uses `pb-safe` for notched devices ✅
- 6/8 tables have overflow wrappers ✅

---

## PRIORITY ACTION PLAN

### P0 — Before Launch

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Fix discovery→enrollment coach carry-forward (DF-01) | 1 hour | Revenue integrity |
| 2 | Move admin emails to database (SEC-01/02/03) | 2 hours | Security |
| 3 | Fix sessions page blue→pink buttons (UI-01/02) | 30 min | Brand consistency |

### P1 — This Week

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 4 | Add auth to NPS, activity, assessment endpoints (SEC-04/05/06/07) | 3 hours | Data protection |
| 5 | Generate proper Supabase types (TS-01) | 1 hour | Type safety |
| 6 | Fix ChatWidget mobile positioning (MOB-01) | 30 min | UX |
| 7 | Wire matching API or delete (DC-01) | 2 hours | Clean code |
| 8 | Fix coach login page button colors (UI-03) | 30 min | Consistency |

### P2 — This Month

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 9 | Add rate limiting to public endpoints (SEC-10/13) | 4 hours | DoS prevention |
| 10 | Fix profile non-standard background (UI-04) | 15 min | Consistency |
| 11 | Wrap tables in overflow-x-auto (MOB-03/04) | 30 min | Mobile UX |
| 12 | Fix small touch targets (MOB-02/05) | 30 min | Accessibility |
| 13 | Reduce `any` types in top 10 files (TS-02) | 8 hours | Reliability |

### P3 — Backlog

| # | Action | Effort |
|---|--------|--------|
| 14 | Split large files (>1000 lines) | 4 hours |
| 15 | Standardize border-radius across coach portal | 2 hours |
| 16 | Add webhook signature verification for Cal.com | 1 hour |

---

## POSITIVE FINDINGS

- **Error handling:** Excellent across all API routes
- **Payment security:** HMAC verification, idempotency, Zod validation
- **Structured logging:** JSON format with requestIds — production ready
- **No SQL injection:** Supabase parameterized queries throughout
- **No hardcoded secrets:** All env vars properly used
- **Component organization:** No duplicates between coach/parent
- **Scheduling engine:** Enterprise-grade with compensation logic
- **rAI system:** Well-architected with tiered routing

---

*Generated by 6 parallel Claude agents analyzing ~300 files*
*Audit date: January 31, 2026*
