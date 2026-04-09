# Yestoryd V2 Purpose & Method — Codebase Alignment Audit

**Generated**: 8 February 2026
**Audited Against**: Purpose & Method V2 (age-differentiated, multi-season model)
**Method**: Direct file reads, grep scans, live database inspection

---

## Executive Summary

The current codebase is built for a **flat 3-month, fixed-session coaching model** with no concept of age bands, seasons, diagnostic sessions, learning plans, or daily parent tasks. Every core flow — enrollment, scheduling, completion, pricing — assumes a single undifferentiated program structure.

**Verdict**: The V2 transition requires **modifying ~25 files** and **building ~15 new modules**. The data model needs 8-10 new columns/tables. No existing code can be reused as-is for the V2 age-band concept.

---

## Area 1: Enrollment & Pricing

### Files Found

| File | Lines | Current Purpose |
|------|-------|-----------------|
| `lib/razorpay.ts` | 128 | Package definitions + Razorpay integration |
| `lib/scheduling/config.ts` | 392 | Scheduling config with plan definitions |
| `lib/config/loader.ts` | 387 | Enterprise config loader |
| `lib/config/types.ts` | — | Config type definitions |
| `app/api/payment/verify/route.ts` | 1386 | Payment verification + enrollment creation |
| `app/api/payment/create/route.ts` | — | Create Razorpay order |
| `app/api/pricing/route.ts` | — | Get pricing plans |
| `app/enroll/page.tsx` | — | Enrollment page |
| `app/checkout/page.tsx` | — | Checkout page |

### Findings

#### ❌ `lib/razorpay.ts:15-30` — Hardcoded 6-session package
```typescript
export const PACKAGES = {
  'coaching-6': {
    name: '3-Month Coaching Program',
    sessions: 6,            // ❌ HARDCODED
    parentCheckins: 3,      // ❌ HARDCODED
    price: 0,
    description: '6 coaching sessions + 3 parent check-ins',
  },
```
**Status**: Marked `@deprecated` but still exported and referenced.
**V2 Conflict**: Foundation needs 24 sessions, Building needs 18, Mastery needs 12.
**Action**: Delete entirely. Replace with DB-driven pricing.

#### ❌ `lib/scheduling/config.ts:81-145` — Hardcoded plan structures
```typescript
export const DEFAULT_PLAN_SCHEDULES: Record<string, PlanSchedule> = {
  starter: {
    coaching: { count: 2, weekSchedule: [1, 2], durationMinutes: 45 },
    checkin:  { count: 1, weekSchedule: [4],    durationMinutes: 45 },
    totalAutoScheduled: 3,
  },
  full: {
    coaching: { count: 6, weekSchedule: [1,2,5,6,9,10], durationMinutes: 45 },
    checkin:  { count: 3, weekSchedule: [4,8,12],        durationMinutes: 45 },
    totalAutoScheduled: 9,
  },
```
**V2 Conflict**:
- All durations 45 min → V2 needs 30/45/60 by age band
- Fixed 6+3 coaching+checkin → V2 needs 24/18/12 total sessions
- No age_band parameter anywhere
- No concept of "diagnostic" session 1
**Action**: ⚠️ Modify to accept age_band parameter and derive schedule from it.

#### ❌ `lib/scheduling/config.ts:74-79` — All durations 45 min
```typescript
export const DEFAULT_DURATIONS: SchedulingDurations = {
  coaching: 45,     // V2: Foundation=30, Building=45, Mastery=60
  checkin: 45,      // V2: Same as coaching duration per age band
  skillBooster: 45,
  discovery: 30,
};
```
**Action**: ⚠️ Modify to lookup by age_band.

#### ⚠️ `lib/config/loader.ts:347-349` — Fallback defaults to 45 min
```typescript
coachingDurationMins: data.coaching_duration_mins || data.duration_coaching_mins || 45,
skillBuildingDurationMins: data.skill_building_duration_mins || data.duration_skill_mins || 45,
checkinDurationMins: data.checkin_duration_mins || data.duration_checkin_mins || 45,
```
**Action**: ⚠️ Add age_band-aware duration loading.

#### ⚠️ `app/api/payment/verify/route.ts:43` — Product codes are starter/continuation/full
```typescript
productCode: z.enum(['starter', 'continuation', 'full']).optional().nullable(),
```
**V2 Conflict**: V2 doesn't have starter/continuation/full. V2 has **seasons** per **age band**.
**Action**: ⚠️ Modify to support age-band-based product codes or add `age_band` and `season_number` fields.

#### ❌ `app/api/payment/verify/route.ts:127` — Sessions default to 9
```typescript
const sessionsTotal = parseInt(orderNotes?.sessionsTotal || '9', 10);
```
**V2 Conflict**: V2 sessions are 24 (Foundation), 18 (Building), 12 (Mastery).
**Action**: ⚠️ Calculate from age_band.

#### ❌ `app/api/payment/verify/route.ts:1033` — Session count fallback to 9
```typescript
const sessionsCount = productDetails?.sessions_included || productInfo.sessionsTotal || 9;
```
**Action**: Must come from age-band-derived pricing plan.

### What's Missing for V2
- ❌ No `age_band` field on enrollments, children, or pricing_plans
- ❌ No `season_number` concept (multi-season re-enrollment)
- ❌ No enrollment-level link to diagnostic assessment results
- ❌ No "parent oath" step in enrollment flow
- ❌ No re-enrollment flow at season end

---

## Area 2: Session Scheduling & Completion

### Files Found

| File | Lines | Current Purpose |
|------|-------|-----------------|
| `lib/scheduling/enrollment-scheduler.ts` | — | Create sessions for enrollment |
| `lib/scheduling/smart-slot-finder.ts` | — | Find available slots |
| `lib/scheduling/session-manager.ts` | — | Session CRUD |
| `lib/scheduling/orchestrator.ts` | — | Main orchestrator |
| `lib/scheduling/config.ts` | 392 | Config + session titles |
| `app/api/jobs/enrollment-complete/route.ts` | 729 | Calendar scheduling post-payment |
| `app/api/cron/enrollment-lifecycle/route.ts` | 553 | Daily lifecycle checks |
| `app/api/sessions/complete/route.ts` | — | Session completion |
| `app/api/completion/trigger/[enrollmentId]/route.ts` | — | Completion trigger |

### Findings

#### ❌ `lib/scheduling/config.ts:155-179` — Hardcoded session titles
```typescript
export const SESSION_TITLES = {
  coaching: [
    'Initial Assessment & Goals',    // V2: Session 1 is a DIAGNOSTIC, not regular coaching
    'Foundation Building',
    'Skill Development',
    'Practice & Reinforcement',
    'Advanced Techniques',
    'Confidence Building',
    'Mastery Building',
    'Final Skills Assessment',
    'Review & Consolidation',
    'Program Completion',
  ],
```
**V2 Conflict**: V2 has session templates curated by Rucha, routed by rAI — not hardcoded titles.
**Action**: ❌ Replace with `session_templates` table lookup, driven by rAI routing.

#### ❌ `app/api/jobs/enrollment-complete/route.ts:417` — Hardcoded 45/30 duration
```typescript
const isCoaching = session.session_type === 'coaching';
const duration = isCoaching ? 45 : 30;  // ❌ HARDCODED
```
**V2 Conflict**: Duration depends on age band (30/45/60).
**Action**: ⚠️ Read from enrollment's age_band.

#### ❌ `app/api/jobs/enrollment-complete/route.ts:675` — Email says "3-month program"
```typescript
<tr><td>Duration:</td><td><strong>3-month program</strong></td></tr>
```
**V2 Conflict**: Foundation is ~12 weeks (24 sessions at 2x/week), Building is ~12 weeks (18 at 1.5x), Mastery is ~12 weeks (12 at 1x). Duration varies.
**Action**: ⚠️ Dynamic based on age_band.

#### ❌ `app/api/cron/enrollment-lifecycle/route.ts:451` — Completion hardcoded to `< 9`
```typescript
if (completedCount < 9) {
  // ... alert about at-risk enrollment
  message: `Only ${completedCount}/9 sessions completed.`,
```
**V2 Conflict**: V2 has 24/18/12 sessions per age band, not 9.
**Action**: ⚠️ Read total from enrollment record.

#### ❌ `app/api/cron/payment-reconciliation/route.ts:186`
```typescript
total_sessions: 9,  // ❌ HARDCODED
```
**Action**: ⚠️ Read from enrollment.

### What's Missing for V2
- ❌ No "diagnostic Session 1" concept — Session 1 is treated like any other coaching session
- ❌ No session template routing via rAI
- ❌ No `session_template_id` linking scheduled_sessions → session_templates
- ❌ No pre-session brief that includes the assigned template
- ❌ No frequency differentiation (2x/week vs 1.5x vs 1x per age band)
- ❌ Session type is only `coaching | parent_checkin | remedial` — no `diagnostic` type
- ❌ No season-end completion flow (triggers re-enrollment, not certificate)

---

## Area 3: Assessment & Diagnostic

### Files Found

| File | Lines | Current Purpose |
|------|-------|-----------------|
| `app/api/assessment/analyze/route.ts` | — | AI reading analysis |
| `components/assessment/AssessmentForm.tsx` | — | Multi-step assessment form |
| `components/assessment/ResultsDisplay.tsx` | — | Results with pricing |
| `lib/gemini/client.ts` | — | Gemini AI for reading analysis |
| `lib/ai/provider.ts` | — | AI provider fallback |
| `app/assessment/page.tsx` | — | Assessment page |

### Findings

#### ⚠️ Assessment passages use different age groups than V2
```
scripts/update-assessment-passages.ts uses: 4-5, 6-7, 8-9, 10-12
V2 age bands:                              4-6, 7-9, 10-12
```
**Action**: ⚠️ Realign age groupings to V2 bands.

#### ✅ Assessment collects child age — this can be used to derive age_band
The assessment form collects `childAge` which is passed through the enrollment flow. This is a foundation to build on.

#### ❌ Assessment is a pre-enrollment sales tool, not a Session 1 diagnostic
Currently: Assessment → Results → Buy → Enrollment → Session 1 (regular coaching)
V2: Assessment (pre-sale) → Enrollment → **Session 1 = Diagnostic** → rAI generates roadmap

**Action**: ❌ Build new diagnostic session flow that runs as Session 1 post-enrollment.

### What's Missing for V2
- ❌ No post-enrollment diagnostic session (Session 1)
- ❌ No multi-season roadmap generation from diagnostic data
- ❌ No `learning_plan` or `roadmap` table/data structure
- ❌ rAI does not generate roadmaps — only does RAG chat and proactive notifications
- ❌ No session template recommendation engine in rAI

---

## Area 4: Coach Portal

### Files Found

| File | Lines | Current Purpose |
|------|-------|-----------------|
| `app/coach/sessions/[sessionId]/prep/page.tsx` | — | Session prep page |
| `components/coach/PreSessionBrief.tsx` | — | Pre-session brief component |
| `components/coach/PostSessionForm.tsx` | — | Post-session form |
| `components/coach/session-form/` | — | Multi-step session form (4 steps) |
| `app/api/coach/session-prep/route.ts` | — | Session prep API |
| `components/coach/SessionCard.tsx` | — | Session card |
| `components/coach/StudentCard.tsx` | — | Student card |

### Findings

#### ⚠️ `components/coach/StudentCard.tsx:65` — Hardcoded session display
```typescript
{student.sessions_completed}/{student.total_sessions} sessions
```
**V2**: Should also show age band, current season, roadmap progress.
**Action**: ⚠️ Add age_band and season info.

#### ⚠️ PreSessionBrief exists but doesn't include session template
The PreSessionBrief component shows child context from learning_events but does NOT:
- Show the assigned session template for today
- Show the rAI-recommended focus areas
- Show the child's position in the multi-season roadmap

**Action**: ⚠️ Modify to include template data and roadmap position.

#### ⚠️ PostSessionForm captures data but doesn't update roadmap
The 4-step session form (QuickPulse → DeepDive → Planning → Review) captures coaching observations, but this data doesn't feed back into a roadmap or learning plan.

**Action**: ⚠️ Modify to update learning_plan progress after submission.

### What's Missing for V2
- ❌ No session template display in coach's prep view
- ❌ No diagnostic session form (different from regular coaching form)
- ❌ No roadmap/learning plan view for coach
- ❌ No age-band-specific coaching guidance

---

## Area 5: Parent Dashboard & Communication

### Files Found

| File | Lines | Current Purpose |
|------|-------|-----------------|
| `app/parent/dashboard/page.tsx` | — | Parent dashboard |
| `app/parent/progress/page.tsx` | — | Progress view |
| `app/parent/sessions/page.tsx` | — | Session schedule |
| `app/parent/elearning/page.tsx` | — | E-learning overview |
| `components/parent/ParentLayout.tsx` | — | Layout |
| `components/parent/PauseEnrollmentCard.tsx` | — | Pause card |
| `components/parent/SessionActionsCard.tsx` | — | Session actions |
| `lib/communication/` | 4 files | Communication engine |
| `lib/notifications/admin-alerts.ts` | — | Admin alerts |
| `app/api/parent/dashboard/route.ts` | — | Dashboard API |

### Findings

#### ❌ Parent dashboard shows sessions, not roadmap or daily tasks
Current dashboard: upcoming session, coach info, sessions completed/total, e-learning link.
V2 dashboard needs: **learning roadmap, current season, daily contextual WhatsApp tasks, oath status, skill progress by area**.

**Action**: ❌ Major rebuild of parent dashboard.

#### ❌ `app/parent/sessions/page.tsx:213,342` — Duration defaults to 45
```typescript
return minutesDiff <= 10 && minutesDiff >= -(session.duration_minutes || 45);
// ...
{session.duration_minutes || 45} min
```
**Action**: ⚠️ Should read from age_band config.

#### ❌ No parent oath concept
Grep for "oath" returns zero results across the entire codebase.
**Action**: ❌ Build new oath component + storage.

#### ❌ No daily contextual WhatsApp tasks
Current communication:
- Session reminders (24h and 1h before)
- Post-session parent updates (generic: "Continue practicing reading at home for 10-15 minutes daily")
- Admin alerts
- Coach engagement nudges

V2 needs: **Daily contextual tasks sent via WhatsApp**, personalized to the child's current roadmap position, age band, and recent session data.

**Action**: ❌ Build new daily task engine + WhatsApp delivery cron.

#### ❌ No re-enrollment flow
Current completion: enrollment → certificate → done.
V2: enrollment → season complete → updated roadmap → re-enrollment offer → new season.

**Action**: ❌ Build re-enrollment flow with roadmap update.

### What's Missing for V2
- ❌ No learning roadmap display on parent dashboard
- ❌ No daily contextual WhatsApp tasks
- ❌ No parent oath at enrollment
- ❌ No season concept in parent view
- ❌ No re-enrollment flow
- ❌ Post-session parent updates are generic, not contextual

---

## Area 6: Database Schema

### Current State (from live Supabase)

#### `enrollments` table — Missing V2 columns
| Current Column | V2 Needed | Status |
|---------------|-----------|--------|
| enrollment_type (starter/continuation/full) | age_band (foundation/building/mastery) | ❌ Missing |
| sessions_purchased | sessions_total (from age band) | ⚠️ Rename/repurpose |
| program_start / program_end | season_start / season_end | ⚠️ Rename |
| — | season_number | ❌ Missing |
| — | previous_enrollment_id | ❌ Missing (for re-enrollment chain) |
| — | learning_plan_id | ❌ Missing |
| — | diagnostic_completed_at | ❌ Missing |
| — | parent_oath_signed_at | ❌ Missing |

#### `children` table — Missing V2 columns
| Current Column | V2 Needed | Status |
|---------------|-----------|--------|
| age | age → age_band derivation | ✅ Can derive |
| — | age_band | ❌ Missing (computed from age) |
| — | current_season | ❌ Missing |
| — | learning_plan_id | ❌ Missing |
| — | diagnostic_data (JSONB) | ❌ Missing |

#### `scheduled_sessions` table — Missing V2 columns
| Current Column | V2 Needed | Status |
|---------------|-----------|--------|
| session_type (coaching/parent_checkin/remedial) | + 'diagnostic' type | ❌ Missing type |
| — | session_template_id | ❌ Missing |
| — | age_band_duration_minutes | ❌ Missing (30/45/60) |
| duration_minutes | ✅ Exists | ✅ Can be used |

#### `session_templates` table — Exists with 3 rows
Live data shows 3 rows in `session_templates`. This is a start but V2 needs **dozens of templates** curated by Rucha, tagged by age band and skill focus.

#### Missing Tables for V2
| Table | Purpose |
|-------|---------|
| `learning_plans` | Multi-season roadmap per child |
| `learning_plan_milestones` | Individual milestones within a plan |
| `daily_parent_tasks` | Daily contextual tasks for WhatsApp delivery |
| `parent_oaths` | Oath records |
| `diagnostic_results` | Session 1 diagnostic data |
| `season_transitions` | Re-enrollment/season change records |

---

## Area 7: rAI (AI Assistant)

### Files Found
11 files in `lib/rai/`

### Findings

#### ⚠️ rAI has RAG infrastructure but no roadmap generation
- `rai/embeddings.ts` — generates embeddings for learning events
- `rai/hybrid-search.ts` — searches learning history
- `rai/intent-classifier.ts` — classifies user intents
- `rai/proactive-notifications.ts` — generates proactive notifications
- `rai/admin-insights.ts` — admin analytics

**V2 needs rAI to**:
1. ❌ Generate multi-season roadmaps from diagnostic data
2. ❌ Route session templates based on child's current position
3. ❌ Generate daily contextual parent tasks
4. ❌ Update roadmap after each session's PostSessionForm data

**Current rAI capabilities (reusable)**:
- ✅ Embedding generation — reuse for roadmap context
- ✅ Hybrid search — reuse for template matching
- ✅ Proactive notifications — extend for daily tasks

**Action**: ⚠️ Extend rAI with roadmap generation and template routing modules.

---

## Area 8: E-Learning & Gamification

### Findings

#### ✅ E-learning is mostly independent of V2 changes
The e-learning system (el_* tables, 63 units, gamification engine) operates independently of coaching sessions. It can continue as-is and be progressively aligned to age bands.

#### ⚠️ E-learning age ranges don't match V2 bands
`el_stages` has 3 stages but with undefined age ranges. `el_learning_units` have no age_band tagging.
**Action**: ⚠️ Add age_band tags to e-learning content.

---

## Summary: Change Impact Matrix

### ❌ Needs New Build (15 items)

| # | Item | Effort |
|---|------|--------|
| 1 | `learning_plans` table + API + roadmap generation | Large |
| 2 | Diagnostic Session 1 flow (form + API + template) | Large |
| 3 | rAI roadmap generator (from diagnostic data) | Large |
| 4 | rAI session template router | Medium |
| 5 | Daily parent task engine + WhatsApp cron | Large |
| 6 | Parent oath component + storage | Small |
| 7 | Re-enrollment flow (season end → new season) | Medium |
| 8 | Season transition management | Medium |
| 9 | Age band derivation service | Small |
| 10 | Parent dashboard roadmap view | Medium |
| 11 | Coach diagnostic session form | Medium |
| 12 | Session template management (admin) | Medium |
| 13 | `daily_parent_tasks` table + API | Medium |
| 14 | `diagnostic_results` table + API | Medium |
| 15 | Season-aware completion flow | Medium |

### ⚠️ Needs Modification (25 files)

| # | File | Change |
|---|------|--------|
| 1 | `lib/scheduling/config.ts` | Add age_band support to plan schedules + durations |
| 2 | `lib/config/loader.ts` | Add age_band-aware duration/session loading |
| 3 | `lib/config/types.ts` | Add AgeBand type, update PricingPlanConfig |
| 4 | `app/api/payment/verify/route.ts` | Derive sessions/duration from age_band, add oath check |
| 5 | `app/api/payment/create/route.ts` | Accept age_band, calculate correct pricing |
| 6 | `app/api/jobs/enrollment-complete/route.ts` | Dynamic duration from age_band |
| 7 | `app/api/cron/enrollment-lifecycle/route.ts` | Dynamic session count from enrollment |
| 8 | `app/api/cron/payment-reconciliation/route.ts` | Remove hardcoded `total_sessions: 9` |
| 9 | `app/api/coach/session-prep/route.ts` | Include session template + roadmap position |
| 10 | `components/coach/PreSessionBrief.tsx` | Show assigned template + roadmap position |
| 11 | `components/coach/PostSessionForm.tsx` | Feed data back to learning_plan |
| 12 | `components/coach/StudentCard.tsx` | Show age_band, season, roadmap progress |
| 13 | `components/coach/SessionCard.tsx` | Show template name, age-appropriate duration |
| 14 | `app/parent/dashboard/page.tsx` | Add roadmap view, daily tasks, oath status |
| 15 | `app/parent/sessions/page.tsx` | Remove hardcoded 45 min default |
| 16 | `app/api/parent/dashboard/route.ts` | Return roadmap, daily tasks, season info |
| 17 | `app/enroll/page.tsx` | Add parent oath step |
| 18 | `app/checkout/page.tsx` | Show age-band-specific pricing/sessions |
| 19 | `lib/razorpay.ts` | Delete deprecated PACKAGES |
| 20 | `components/assessment/ResultsDisplay.tsx` | Show age-band-specific program details |
| 21 | `scripts/update-assessment-passages.ts` | Realign age groups to V2 bands |
| 22 | `app/api/assessment/analyze/route.ts` | Tag assessment with age_band |
| 23 | `lib/scheduling/enrollment-scheduler.ts` | Age-band-aware session frequency |
| 24 | `lib/scheduling/smart-slot-finder.ts` | Respect frequency per age band |
| 25 | `app/api/completion/trigger/[enrollmentId]/route.ts` | Season-end flow vs program-end flow |

### ✅ Aligns (no changes needed)

| Item | Why |
|------|-----|
| Enterprise config loader pattern | DB-driven config, 5-min cache — reuse for age_band configs |
| QStash job queuing | Background processing pattern is solid |
| Communication infrastructure | AiSensy, SendGrid, WhatsApp Cloud — extend with daily tasks |
| Webhook patterns | Signature verification, idempotency — no changes |
| rAI embedding + search | Foundation for template matching + roadmap context |
| E-learning gamification engine | Independent, can be progressively tagged by age band |
| Coach portal layout + auth | Portal structure stays the same |
| Payment verification security | Razorpay signature, amount verification — no changes |

---

## Database Migration Required

```sql
-- New columns on existing tables
ALTER TABLE enrollments ADD COLUMN age_band TEXT CHECK (age_band IN ('foundation', 'building', 'mastery'));
ALTER TABLE enrollments ADD COLUMN season_number INTEGER DEFAULT 1;
ALTER TABLE enrollments ADD COLUMN previous_enrollment_id UUID REFERENCES enrollments(id);
ALTER TABLE enrollments ADD COLUMN learning_plan_id UUID;
ALTER TABLE enrollments ADD COLUMN diagnostic_completed_at TIMESTAMPTZ;
ALTER TABLE enrollments ADD COLUMN parent_oath_signed_at TIMESTAMPTZ;

ALTER TABLE children ADD COLUMN age_band TEXT CHECK (age_band IN ('foundation', 'building', 'mastery'));
ALTER TABLE children ADD COLUMN current_season INTEGER DEFAULT 1;

ALTER TABLE scheduled_sessions ADD COLUMN session_template_id UUID;
-- session_type already allows custom values, add 'diagnostic'

-- New tables
CREATE TABLE learning_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) NOT NULL,
  enrollment_id UUID REFERENCES enrollments(id),
  age_band TEXT NOT NULL,
  season_number INTEGER NOT NULL DEFAULT 1,
  diagnostic_data JSONB,
  roadmap JSONB NOT NULL,        -- rAI-generated multi-season plan
  current_milestone INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE daily_parent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) NOT NULL,
  enrollment_id UUID REFERENCES enrollments(id),
  task_date DATE NOT NULL,
  task_content TEXT NOT NULL,
  task_context JSONB,            -- derived from recent session + roadmap
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  parent_response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE parent_oaths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parents(id) NOT NULL,
  enrollment_id UUID REFERENCES enrollments(id) NOT NULL,
  oath_text TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT
);
```

---

## Recommended Build Order

### Phase 1: Data Foundation (Week 1)
1. Add `age_band` column to enrollments + children
2. Create age band derivation function: `age → band`
3. Add `season_number` and `previous_enrollment_id` to enrollments
4. Create `learning_plans` table
5. Update scheduling config to accept age_band parameter

### Phase 2: Core Engine (Week 2-3)
6. Build diagnostic Session 1 form and API
7. Build rAI roadmap generator
8. Build rAI session template router
9. Modify enrollment flow to set age_band and create learning_plan
10. Modify scheduling to use age-band-specific frequency and duration

### Phase 3: Daily Experience (Week 3-4)
11. Build daily parent task engine
12. Build WhatsApp daily task delivery cron
13. Add parent oath to enrollment flow
14. Rebuild parent dashboard with roadmap view

### Phase 4: Coach Experience (Week 4-5)
15. Add template display to PreSessionBrief
16. Modify PostSessionForm to update learning_plan
17. Add diagnostic form to coach portal
18. Add age band + season to StudentCard

### Phase 5: Lifecycle (Week 5-6)
19. Build season-end completion flow
20. Build re-enrollment flow
21. Remove all hardcoded session counts (9) and durations (45)
22. Update all frontend displays for dynamic session/duration counts
