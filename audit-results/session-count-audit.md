# AUDIT: Session Count References in Yestoryd Codebase
**Date:** 2026-02-16
**Auditor:** Claude Code

---

## EXECUTIVE SUMMARY

**Finding:** Session counts are **partially configurable** via `pricing_plans` table, but have **extensive hardcoded fallbacks to "9"** throughout the codebase. The system uses a multi-tier architecture but relies heavily on legacy defaults.

**Risk Level:** 🟡 MEDIUM - System works but lacks full flexibility

**Recommendation:** Implement centralized session configuration service to eliminate hardcoded fallbacks.

---

## 1. HARDCODED SESSION NUMBERS

### 1.1 Primary Default: `|| 9` Pattern
**Count:** 20+ occurrences across critical paths

**Critical Files:**
```typescript
// app/api/coach/sessions/route.ts:16
const DEFAULT_TOTAL_SESSIONS = 9;

// Fallback pattern repeated everywhere:
enrollment.total_sessions || 9
child.total_sessions || 9
plan.sessions_included || 9
```

**Files with "|| 9" fallbacks:**
- `app/api/parent/dashboard/route.ts:80`
- `app/api/coach/sessions/[id]/parent-summary/route.ts:344`
- `app/api/chat/route.ts:684`
- `app/api/certificate/pdf/route.tsx:642,654`
- `app/api/admin/completion/list/route.ts:165`
- `app/api/cron/enrollment-lifecycle/route.ts:450`
- `app/api/products/route.ts:155`
- `app/api/sessions/parent-checkin/route.ts:134`
- `app/coach/students/page.tsx:105`
- `app/completion/[enrollmentId]/page.tsx:64,83`
- `app/admin/completion/page.tsx:174,201,561,583,586,590`
- `app/api/certificate/pdf/route.tsx:642,654`
- `app/api/parent/report/[enrollmentId]/route.ts:147`
- `app/api/parent/roadmap/[childId]/route.ts:240`

### 1.2 Marketing Copy: Session Breakdown
**Pattern:** "6 coaching sessions + 3 check-ins"

**Found in:**
```typescript
// app/HomePageClient.tsx:397
features: ['6 coaching sessions (1:1)', 'Practice activities at home', 'Weekly WhatsApp updates']

// app/terms/page.tsx:111
"3-month program with 6 coaching sessions + 3 parent check-ins"

// app/api/payment/verify/route.ts:1138-1139
// sessions_purchased = total paid for (12: 6 coaching + 3 skill booster + 3 checkin)
// sessions_scheduled will be set to 9 (6 coaching + 3 checkin)

// app/assessment/AssessmentPageClient.tsx:241
"With 6 coaching sessions, most improve by 3-4 points."
```

### 1.3 Arc Section (90-Day Program)
**Weeks hardcoded in ArcSection component:**
```typescript
// app/HomePageClient.tsx:397
arc_remediate_weeks: 'Week 5-8'

// Phases defined as:
- Assess: Weeks 1-4
- Remediate: Weeks 5-8
- Celebrate: Weeks 9-12
```

---

## 2. SESSION COUNT SOURCES (Priority Order)

### ✅ Tier 1: `pricing_plans` Table (Single Source of Truth)
**Table:** `pricing_plans`
**Columns:**
- `sessions_included` (total)
- `sessions_coaching` (1:1 sessions)
- `sessions_skill_building` (on-demand)
- `sessions_checkin` (parent updates)

**Usage:** 30+ files reference `pricing_plans`

**Key Routes:**
- `app/api/products/route.ts` - Product fetching (line 98)
- `app/api/payment/create/route.ts` - Order creation (line 113)
- `app/api/payment/verify/route.ts` - Payment verification (line 276)
- `app/api/admin/pricing/route.ts` - Admin management (line 69)

**Example:**
```typescript
// app/api/products/route.ts:98-101
const { data: plans } = await supabase
  .from('pricing_plans')
  .select('*')
  .eq('is_active', true);

// app/api/products/route.ts:155-159
sessions_included: plan.sessions_included || 9,
sessions_coaching: plan.sessions_coaching || 6,
sessions_skill_building: plan.sessions_skill_building || 0,
sessions_checkin: plan.sessions_checkin || 3,
```

### ✅ Tier 2: `age_band_config` Table (Age-Differentiated)
**Purpose:** Age-specific session recommendations

**Files using age_band_config:**
- `app/api/age-band-config/route.ts:25,44`
- `app/api/payment/verify/route.ts:119-172` (fetches config for child age)
- `lib/supabase/database.types.ts` (type definitions)

**Example:**
```typescript
// app/api/payment/verify/route.ts:128
const { data: config } = await supabase
  .from('age_band_config')
  .select('*')
  .eq('age_band', ageBand)
  .single();
```

### ⚠️ Tier 3: Enrollment Record (`total_sessions`)
**Column:** `enrollments.total_sessions`

**Usage:** 40+ references in:
- Progress tracking
- Completion checks
- Dashboard displays
- API responses

**Files:**
- `app/(parent)/progress/[childId]/page.tsx:36,272`
- `app/api/coach/sessions/[id]/brief/route.ts:65-73`
- `app/api/coach/sessions/[id]/live/route.ts:57-60`
- `app/api/parent/progress/route.ts:52,180`
- `app/api/coach/sessions/route.ts:83,266`

---

## 3. CONFIGURABLE vs HARDCODED

### ✅ CONFIGURABLE (Database-Driven)

| Aspect | Source | Status |
|--------|--------|--------|
| Product pricing | `pricing_plans` | ✅ Fully dynamic |
| Session breakdown | `pricing_plans` (coaching/skill/checkin) | ✅ Per-product |
| Age-based sessions | `age_band_config` | ✅ Per age band |
| Session durations | `site_settings` | ✅ Global config |
| Product features | `pricing_plans.features` (JSON) | ✅ Dynamic |

### ❌ HARDCODED (Code-Level)

| Aspect | Location | Value | Risk |
|--------|----------|-------|------|
| Default sessions | `app/api/coach/sessions/route.ts:16` | 9 | 🟡 Medium |
| Fallback pattern | 20+ files | `\|\| 9` | 🔴 High |
| Marketing copy | `app/HomePageClient.tsx:397` | "6 coaching sessions" | 🟡 Medium |
| Arc weeks | `ArcSection.tsx` | "Week 5-8" | 🟢 Low |
| Terms page | `app/terms/page.tsx:111` | "6 coaching + 3 checkin" | 🟡 Medium |
| Assessment tips | `app/assessment/AssessmentPageClient.tsx:241` | "6 coaching sessions" | 🟢 Low |
| Completion msg | `app/api/sessions/parent-checkin/route.ts:227` | "all 9 sessions" | 🟡 Medium |

---

## 4. CRITICAL FINDINGS

### 🔴 Critical: Fallback Chain Fragility
**Issue:** If `pricing_plans` is missing data, system falls back to hardcoded 9.

**Example:**
```typescript
// app/api/parent/dashboard/route.ts:80
const totalSessions = child.total_sessions || 9;
```

**Impact:**
- New products default to 9 sessions regardless of actual plan
- Age differentiation bypassed
- Incorrect progress calculations

### 🟡 Medium: Marketing Copy Drift
**Issue:** Marketing copy hardcodes "6 coaching + 3 checkin" but products can have different breakdowns.

**Files requiring manual updates if session counts change:**
1. `app/HomePageClient.tsx:397` (Arc features)
2. `app/terms/page.tsx:111` (legal terms)
3. `app/assessment/AssessmentPageClient.tsx:241` (tips)
4. `app/api/sessions/parent-checkin/route.ts:227` (completion message)
5. `app/page.tsx:250` (default arc features)

### 🟢 Low: Completion Message Hardcode
**Issue:** Celebration message says "9 sessions" regardless of actual program.

```typescript
// app/api/sessions/parent-checkin/route.ts:227
"successfully completed all 9 sessions of the reading program!"
```

---

## 5. SESSION DURATION CONFIGURATION

### ✅ Centralized in `site_settings`
**Keys:**
- `coaching_session_minutes` (default: 45)
- `skill_building_session_minutes` (default: 45)
- `parent_checkin_minutes` (default: 45)
- `discovery_call_minutes` (default: 45)

**Files:**
- `lib/settings/getSettings.ts:363` (fetcher)
- `app/api/settings/durations/route.ts:3` (API)
- `lib/scheduling/config.ts:186` (scheduler)
- `contexts/SiteSettingsContext.tsx` (React context)

**Status:** ✅ Properly centralized and working well

---

## 6. API ENDPOINTS ANALYSIS

### Product APIs (Session Counts)
1. **GET `/api/products`** - Returns `sessions_included` from `pricing_plans`
2. **GET `/api/pricing`** - Returns full pricing data
3. **POST `/api/payment/create`** - Uses `pricing_plans.sessions_included`
4. **POST `/api/payment/verify`** - Writes to `enrollments.total_sessions`

### Dashboard APIs (Progress Display)
1. **GET `/api/parent/dashboard`** - Uses `total_sessions || 9`
2. **GET `/api/parent/progress`** - Uses `total_sessions || 0`
3. **GET `/api/coach/sessions`** - Uses `DEFAULT_TOTAL_SESSIONS`

---

## 7. PRICING_PLANS TABLE SCHEMA

```sql
CREATE TABLE pricing_plans (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT,
  description TEXT,
  original_price INTEGER,
  discounted_price INTEGER,
  sessions_included INTEGER,        -- Total sessions
  sessions_coaching INTEGER,        -- 1:1 coaching
  sessions_skill_building INTEGER,  -- On-demand boosters
  sessions_checkin INTEGER,         -- Parent check-ins
  duration_months INTEGER,
  duration_coaching_mins INTEGER,
  duration_skill_mins INTEGER,
  duration_checkin_mins INTEGER,
  features JSONB,
  is_active BOOLEAN,
  is_featured BOOLEAN,
  is_locked BOOLEAN,
  lock_message TEXT,
  week_range TEXT,
  phase_number INTEGER,
  display_order INTEGER
);
```

**Current Plans:**
- `starter`: 9 sessions (6 coaching + 3 checkin)
- `continuation`: 12 sessions (varies)
- `full`: 24 sessions (custom breakdown)

---

## 8. AGE_BAND_CONFIG TABLE

**Purpose:** Age-differentiated session recommendations

**Referenced in:**
- `app/api/age-band-config/route.ts`
- `app/api/payment/verify/route.ts:1109-1112`

**Logic:**
```typescript
// Prefer age_band_config, fallback to product, then legacy default
const sessionsTotal = ageBandConfig?.recommended_sessions
  || product.sessions_included
  || 9;
```

---

## 9. FAQ & MARKETING CONTENT

### Files to Update When Session Counts Change:
1. **Homepage:**
   - `app/HomePageClient.tsx:397` (Arc features, pricing)
   - `app/(home)/_components/ArcSection.tsx` (weeks display)
   - `app/(home)/_components/PricingSection.tsx` (session display)
   - `app/page.tsx:250` (default settings)

2. **Legal:**
   - `app/terms/page.tsx:111` ("6 coaching + 3 checkin")

3. **Assessment:**
   - `app/assessment/AssessmentPageClient.tsx:241` (improvement tips)

4. **Emails/Notifications:**
   - `app/api/sessions/parent-checkin/route.ts:227` (completion message)

5. **Comments/Documentation:**
   - `app/api/payment/verify/route.ts:1138-1139` (session breakdown explanation)
   - `app/api/completion/check/[enrollmentId]/route.ts:74` (session math comment)

---

## 10. SITE_SETTINGS KEYS RELATED TO SESSIONS

**Found:** Limited direct session count configuration in `site_settings`

**Session Duration Keys (Present):**
- `coaching_session_minutes`
- `skill_building_session_minutes`
- `parent_checkin_minutes`
- `discovery_call_minutes`

**Session Count Keys (MISSING):**
- No `default_total_sessions` key
- No `default_coaching_sessions` key
- Session counts only in `pricing_plans` table

**Arc-Related Keys (Present):**
- `arc_remediate_weeks`
- `arc_remediate_features` (array)
- `arc_remediate_title`
- `arc_remediate_description`

---

## 11. TOTAL SESSION_COUNT REFERENCES

**Summary Statistics:**
- `total_sessions` property: 40+ references
- `sessions_included` property: 30+ references
- `sessions_purchased` property: 15+ references
- `|| 9` fallback pattern: 20+ occurrences
- `pricing_plans` table queries: 30+ files
- `age_band_config` references: 8 files

---

## RECOMMENDATIONS

### 🎯 Priority 1: Eliminate "|| 9" Fallbacks
**Action:** Create centralized session config service
**Benefit:** Single source of truth, no hardcoded defaults

```typescript
// lib/sessions/config.ts (NEW)
export async function getSessionConfig(
  childId: string,
  productSlug: string
) {
  // 1. Check age_band_config
  const ageBand = await getAgeBandForChild(childId);
  const ageConfig = await getAgeBandConfig(ageBand);

  if (ageConfig?.recommended_sessions) {
    return parseSessionBreakdown(ageConfig);
  }

  // 2. Fallback to pricing_plans
  const product = await getPricingPlan(productSlug);
  if (product?.sessions_included) {
    return parseSessionBreakdown(product);
  }

  // 3. Throw error if missing (no silent defaults)
  throw new Error('Session configuration not found');
}
```

### 🎯 Priority 2: Dynamic Marketing Content
**Action:** Move marketing copy to `site_settings` or `pricing_plans`
**Benefit:** No code changes when session counts change

**New columns for `site_settings`:**
- `completion_message_template` (e.g., "all {total} sessions")
- `assessment_improvement_tip` (e.g., "With {coaching} sessions...")

**New columns for `pricing_plans`:**
- `session_breakdown_display` (e.g., "6 coaching + 3 check-in")
- `marketing_description` (rich text for Arc section)

### 🎯 Priority 3: Validation Layer
**Action:** Add DB constraints and API validation
**Benefit:** Prevent missing/invalid session data

```sql
-- Ensure session breakdown adds up
ALTER TABLE pricing_plans
  ADD CONSTRAINT sessions_sum_check
  CHECK (
    sessions_included =
    sessions_coaching + sessions_skill_building + sessions_checkin
  );

-- Prevent null values in active plans
ALTER TABLE pricing_plans
  ADD CONSTRAINT active_plans_complete
  CHECK (
    NOT is_active OR (
      sessions_included IS NOT NULL AND
      sessions_coaching IS NOT NULL AND
      discounted_price IS NOT NULL
    )
  );
```

### 🎯 Priority 4: Audit Enrollments Table
**Action:** Find and fix enrollments with NULL total_sessions
**Benefit:** Eliminate reliance on "|| 9" fallback

```sql
-- Find problematic enrollments
SELECT
  id,
  child_id,
  status,
  total_sessions,
  sessions_purchased,
  product_id
FROM enrollments
WHERE total_sessions IS NULL
  AND status IN ('active', 'scheduled');

-- Backfill from product data
UPDATE enrollments e
SET total_sessions = pp.sessions_included
FROM pricing_plans pp
WHERE e.product_id = pp.id
  AND e.total_sessions IS NULL;
```

---

## IMPACT ASSESSMENT

**If session counts change from 9 to different numbers:**

| Component | Impact | Files to Update | Automation Possible? |
|-----------|--------|-----------------|---------------------|
| Database | 🟢 Low | Update `pricing_plans` rows | ✅ Yes (SQL) |
| Product API | 🟢 Low | Auto-fetches from DB | ✅ Yes (dynamic) |
| Payment Flow | 🟢 Low | Uses `pricing_plans` | ✅ Yes (dynamic) |
| Progress Display | 🟡 Medium | 20+ files with "|| 9" | ⚠️ Partial (needs refactor) |
| Marketing Copy | 🔴 High | 5+ manual updates | ❌ No (hardcoded) |
| Completion Logic | 🟡 Medium | Hardcoded message | ⚠️ Partial (template system) |
| Legal Terms | 🔴 High | Manual update | ❌ No (compliance risk) |

---

## MIGRATION PLAN

### Phase 1: Audit & Cleanup (1 week)
1. Run SQL query to find enrollments with NULL `total_sessions`
2. Backfill missing data from `pricing_plans`
3. Add NOT NULL constraint after backfill
4. Document all "|| 9" occurrences

### Phase 2: Centralized Config (2 weeks)
1. Create `lib/sessions/config.ts` service
2. Add validation functions
3. Update 5 high-traffic routes to use service
4. Test payment flow end-to-end

### Phase 3: Replace Fallbacks (2 weeks)
1. Replace "|| 9" with service calls in batches:
   - Batch 1: Dashboard/Progress (5 files)
   - Batch 2: Coach views (8 files)
   - Batch 3: Admin tools (7 files)
2. Add monitoring/logging for config misses
3. Run regression tests

### Phase 4: Dynamic Content (1 week)
1. Add `completion_message_template` to `site_settings`
2. Add `marketing_description` to `pricing_plans`
3. Update templates to use database values
4. Create admin UI for content management

### Phase 5: Validation & Constraints (1 week)
1. Add DB constraints
2. Add API validation middleware
3. Create admin alerts for invalid data
4. Update documentation

**Total Timeline:** 7 weeks for complete decoupling

---

## CONCLUSION

**Current State:**
- ✅ Product configuration is database-driven via `pricing_plans`
- ✅ Age differentiation exists via `age_band_config`
- ✅ Session durations properly centralized in `site_settings`
- ⚠️ Extensive hardcoded fallbacks to 9 sessions create fragility
- ❌ Marketing copy requires manual updates when counts change
- ❌ No validation to prevent misconfiguration

**Risk Assessment:**
- **Functional Risk:** 🟡 MEDIUM - System works but has hidden dependencies
- **Maintenance Risk:** 🔴 HIGH - Changes require touching 20+ files
- **Scaling Risk:** 🟡 MEDIUM - Adding new products is error-prone
- **Data Integrity Risk:** 🟢 LOW - Most data flows from DB correctly

**Recommended Action:**
Proceed with migration plan in phases. Priority 1 (centralized service) will eliminate most risk. Priorities 2-4 are quality-of-life improvements but not critical.

**Estimated Effort:** 7 weeks full-time or 3-4 sprints with normal velocity

---

**Report Generated:** 2026-02-16 by Claude Code
**Files Analyzed:** 150+ TypeScript/TSX files
**Lines of Code Searched:** ~50,000
