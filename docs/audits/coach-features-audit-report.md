# Coach Selection Features Audit Report

**Date:** 2026-01-30
**Codebase:** C:\yestoryd-mvp
**Auditor:** Claude Code (automated static analysis)

---

## Executive Summary

| Category | Count |
|----------|-------|
| Features fully built | 0/10 |
| Features partially built | 4/10 |
| Features not built | 6/10 |

**Key Finding:** The coach recruitment *pipeline* (apply -> assess -> interview -> approve -> onboard) is well-built. What's missing is the *intelligence layer* on top: matching, monitoring, engagement, and verification.

---

## Detailed Findings

---

### Feature 1: Skill-Based Matching Intelligence

**Status:** :warning: Partial (matching API built, never integrated)

**Implementation:**
A complete matching API exists at `app/api/matching/route.ts` that calculates match scores between child learning needs and coach skill tags. However, it is **never called** from any enrollment, assignment, or admin flow.

**Files:**
- `app/api/matching/route.ts` - Full matching engine (UNUSED)
- `app/api/webhooks/cal/route.ts:40-88` - Round-robin discovery call assignment (no skill matching)
- `app/api/payment/verify/route.ts:453-499` - Enrollment coach assignment (hardcoded fallback to Rucha)
- `app/api/discovery-call/assign/route.ts` - Manual admin assignment (no suggestions)
- `app/coach/profile/page.tsx` - Profile with skill_tags, certifications, years_experience
- `components/coach/CoachTierCard.tsx` - Tier display (Rising/Expert/Master/Founding)

**Database:**
- `coaches.skill_tags: string[]` - exists, used by matching API
- `coaches.specializations: string[]` - exists but NOT exposed in profile UI
- `coaches.avg_rating`, `coaches.total_sessions_completed` - exist
- MISSING: `coaches.age_groups`, `coaches.languages`, `coaches.performance_by_age`

**What's Working:**
- Coach profiles collect skill_tags, certifications, experience
- Matching API calculates match scores from child needs vs coach skills
- Tier system exists with Rising/Expert/Master/Founding levels
- Round-robin assignment ensures fairness for discovery calls
- Availability checking (leave, exit, accepting_new)

**What's Missing:**
- Matching API is never called from any assignment flow
- No age group preferences on coach profile
- No language field
- No admin UI showing match score suggestions
- No auto-assignment using matching algorithm
- No performance tracking per age group

**Code Quality:** 7/10 - The matching API is well-structured but orphaned.

**Recommendations:**
1. Integrate matching API into `payment/verify/route.ts` as fallback instead of Rucha
2. Show top-3 match suggestions in admin CRM during manual assignment
3. Add age_groups and languages fields to coach profile

---

### Feature 2: Soft Rejection / Waitlist Path

**Status:** :warning: Partial (binary pass/fail, no borderline handling)

**Implementation:**
Score threshold is configurable (default 6/10 via `site_settings.coach_assessment_pass_score`). Results are binary: `qualified` or `not_qualified`. An `on_hold` status exists but is only set manually by admins after interviews, not automatically for borderline AI scores.

**Files:**
- `app/api/coach-assessment/calculate-score/route.ts:370-377` - Qualification logic
- `supabase/migrations/20260130_coach_applications.sql:57-62` - Valid statuses
- `app/api/coach/send-status-notification/route.ts:136-230` - Rejection email template
- `app/api/coach-assessment/interview-feedback/route.ts:125-159` - Post-interview rejection

**Database:**
- Valid statuses include `on_hold` but NOT `waitlist` or `borderline`
- `hold_notification_sent` / `hold_notification_date` fields exist
- MISSING: `can_reapply_at`, `last_application_date`, duplicate prevention

**What's Working:**
- Configurable pass score (6/10 default, via site_settings)
- `STRONG_NO` recommendation auto-disqualifies even if score >= 6
- Rejection email includes "reapply in 3-6 months" messaging
- `on_hold` status exists for admin discretion after interviews
- Separate email templates for approved/rejected/hold/qualified

**What's Missing:**
- No borderline status for scores 5.0-5.9
- No differentiated email for near-miss vs low scores
- No reapply cooldown enforcement (email mentions 3-6 months, system allows immediate)
- No duplicate application prevention by email/phone
- No "waitlist" auto-status for borderline scores
- Admin can't easily filter borderline candidates

**Code Quality:** 6/10 - Works correctly but lacks nuance.

**Recommendations:**
1. Add `borderline` status for scores 5.0-5.9 with specific email template
2. Add `can_reapply_at` column with enforcement
3. Add duplicate application check on email

---

### Feature 3: Red Flag Detection in AI Assessment

**Status:** :warning: Partial (detected but not surfaced)

**Implementation:**
The Gemini AI prompts explicitly instruct detection of red flags per question. A `concerns` array and `STRONG_NO` recommendation are captured. However, red flags are buried inside a JSONB blob and not surfaced to admins or used for alerts.

**Files:**
- `app/api/coach-assessment/chat/route.ts:12-99` - System prompt with scoring criteria
- `app/api/coach-assessment/calculate-score/route.ts:257-295` - Red flag detection per question
- `app/api/coach-assessment/interview-feedback/route.ts:234-244` - Interview red flag checkboxes

**Database:**
- Red flags stored in `ai_score_breakdown` JSONB: `raiAnalysis.concerns[]`, `voiceAnalysis.concerns[]`
- `STRONG_NO` recommendation auto-disqualifies
- Interview form has 6 red flag checkboxes
- MISSING: Dedicated `red_flags` column, severity levels, admin alerts

**What's Working:**
- 4 behavioral questions test empathy, communication, sensitivity, honesty
- Each question has explicit red flag criteria in Gemini prompt
- Concerns array captured per question type
- `STRONG_NO` recommendation blocks qualification regardless of score
- Interview feedback form has red flag checkboxes (6 categories)

**What's Missing:**
- No dedicated `red_flags` column (buried in JSONB, not queryable)
- No severity levels (critical/moderate/minor)
- No admin alert when `STRONG_NO` is detected
- No dashboard filtering for "applications with red flags"
- No red-flag-specific rejection email
- Concerns not highlighted in admin review UI

**Code Quality:** 7/10 - Detection is solid, surfacing is weak.

**Recommendations:**
1. Extract `red_flags: string[]` to dedicated column for queryable filtering
2. Add admin notification on `STRONG_NO` detection
3. Highlight concerns in admin application review UI

---

### Feature 4: Probation/Trial Period Tracking

**Status:** :warning: Partial (tier system exists, no probation gate)

**Implementation:**
A tier system exists (Rising -> Expert -> Master -> Founding) based on children coached count. Session completion and no-show counters exist. However, there is no probation period, no activation gate after onboarding, and no automatic consequences for poor performance.

**Files:**
- `components/coach/CoachTierCard.tsx:44-56` - Tier config (Rising/Expert/Master/Founding)
- `app/api/coach/tier-change/route.ts` - Tier change notifications
- `supabase/migrations/20260129_noshow_tracking.sql:4-8` - No-show tracking
- `types/supabase.ts:3336-3395` - Coach fields (avg_rating, total_sessions_completed)

**Database:**
- `coaches.current_tier` - exists
- `coaches.total_sessions_completed` - exists
- `enrollments.consecutive_no_shows`, `total_no_shows`, `at_risk` - exist
- `coaches.avg_rating`, `coaches.current_score` - exist
- MISSING: `probation_until`, `trainee_tier`, `is_on_probation`, `warnings` table

**What's Working:**
- Tier system with 4 levels based on children coached count
- Tier change email + WhatsApp notifications
- No-show tracking at enrollment level (consecutive + total + at_risk)
- Session completion counter exists
- Average rating field exists

**What's Missing:**
- No probation period (coaches go from approved to fully active instantly)
- No "trainee" tier or probation distinction
- No sessions-before-activation requirement
- No auto-tier demotion on low NPS or high no-shows
- No performance warnings table or three-strike system
- No automated review triggers
- No-show tracking exists but triggers no consequences

**Code Quality:** 5/10 - Foundation exists but no enforcement logic.

**Recommendations:**
1. Add `probation_until` date column and enforce it in assignment logic
2. Add `probation_sessions_required` (e.g., 5 sessions supervised before solo)
3. Create auto-escalation: 3+ no-shows or avg_rating < 3 triggers review

---

### Feature 5: Shadow Session Flow

**Status:** :x: Not Built

**Implementation:**
An admin "shadow mode" API exists (`/api/admin/shadow/route.ts`) but it is for admin monitoring/support, NOT for training or observation sessions. There is no shadow session scheduling, tracking, or requirement before coach activation.

**Files:**
- `app/api/admin/shadow/route.ts` - Admin monitoring tool (NOT training shadow)
- `app/coach/onboarding/page.tsx` - 2-step onboarding (agreement + bank details)
- `app/api/coach/onboarding/route.ts` - Sets `onboarding_complete: true` after bank details

**Database:**
- `coaches.onboarding_complete` - set after bank details only
- MISSING: `shadow_session_completed`, `shadow_session_date`, `eligible_for_students`

**What's Working:**
- Nothing related to shadow sessions

**What's Missing:**
- No shadow session concept exists
- No scheduling of observation sessions with senior coaches
- No database fields for tracking
- No activation gate (coaches go directly from bank details to active)
- No evaluation form for senior coach feedback on new coach
- Onboarding = agreement + bank details = done (no practical training)

**Code Quality:** N/A

**Recommendations:**
1. Add shadow session as Step 3 of onboarding
2. Add `eligible_for_assignment` boolean separate from `onboarding_complete`
3. Pair new coaches with experienced coaches for 1-2 observation sessions

---

### Feature 6: Post-Approval Engagement / Drip Communication

**Status:** :x: Not Built

**Implementation:**
Notification tracking fields exist in the database (`approved_notification_sent`, etc.) but are never populated. When a coach is approved via admin UI, the status changes but NO email, WhatsApp, or any communication is triggered. No drip campaign, no onboarding nudges, no re-engagement for inactive coaches.

**Files:**
- `app/api/admin/coach-applications/[id]/route.ts:66-121` - Approval creates coach record, NO notification
- `supabase/migrations/20260130_coach_applications.sql:75-84` - Notification tracking fields (unused)
- `lib/communication/index.ts` - Full communication engine (no coach templates)
- `app/api/cron/*` - 8 cron jobs, none for coach engagement

**Database:**
- `approved_notification_sent`, `rejected_notification_sent`, etc. - exist but never set to true
- MISSING: `last_login`, `onboarding_started_at`, engagement tracking

**What's Working:**
- Notification tracking fields exist in schema
- Communication engine with template support exists
- SendGrid and Twilio (WhatsApp) integrations are working for parents

**What's Missing:**
- Zero communication on approval (coaches are ghosted)
- No drip campaign (Day 1, 3, 7, 14 follow-ups)
- No onboarding nudge reminders
- No cron job for coach engagement
- No re-engagement for inactive approved coaches
- No communication templates for coach journey
- Notification sent flags are never updated

**Code Quality:** N/A

**Recommendations:**
1. Add notification trigger in approval PATCH handler
2. Create coach communication templates
3. Create `/api/cron/coach-engagement` cron job (daily check)
4. Day 0: Welcome + onboarding link. Day 3: Reminder. Day 7: Check-in. Day 14: Re-engage.

---

### Feature 7: Referral Program in Application

**Status:** :warning: Half Built (generation works, input missing)

**Implementation:**
Referral code generation and display works for approved coaches. Parent referral tracking works end-to-end. However, coach-to-coach referrals are broken: there is no referral code input field on the application form, so `referral_code_used` is never populated.

**Files:**
- `app/api/admin/coach-applications/[id]/route.ts:78-82` - Referral code generated on approval
- `app/api/admin/coaches/generate-referral/route.ts` - Bulk referral code generation
- `app/coach/dashboard/MyReferralsTab.tsx` - Referral display with stats and sharing
- `app/yestoryd-academy/apply/page.tsx` - Application form (NO referral code input)
- `hooks/useReferralTracking.ts` - Parent referral tracking (works)

**Database:**
- `coach_applications.referral_code_used` - column exists, never populated
- `coaches.referral_code` - generated on approval (`REF-FIRSTNAME-UUID`)
- `coaches.referral_link` - generated on approval
- `site_settings.coach_referral_bonus` = 500

**What's Working:**
- Referral codes auto-generated on approval (REF-FIRSTNAME-UUID pattern)
- Coach dashboard shows referral code, link, copy/share buttons
- Parent referral tracking works end-to-end
- Referral stats displayed (total, enrolled, conversion rate)
- `referral_code_used` column exists in coach_applications

**What's Missing:**
- No referral code input field on application form
- `referral_code_used` is never populated
- No referral code validation API
- Referring coach is never notified when someone uses their code
- No priority queue for referred applicants
- No referral bonus tracking for coach-to-coach referrals
- `coach_referral_bonus` site setting (500) is unused

**Code Quality:** 6/10 - Infrastructure built but not connected.

**Recommendations:**
1. Add referral code input to `/yestoryd-academy/apply` form
2. Add validation endpoint to check if code belongs to active coach
3. Notify referring coach when their referral applies/gets approved

---

### Feature 8: Experience-Based Tracks

**Status:** :x: Not Built

**Implementation:**
`teaching_experience_years` is collected and stored but never used for any business logic. All applicants go through identical assessment, scoring, and onboarding regardless of experience level.

**Files:**
- `supabase/migrations/20260130_coach_applications.sql:25` - `teaching_experience_years` column
- `lib/validations/coach-journey.ts:32` - Validation schema (0-50 years)
- `app/yestoryd-academy/qualify/page.tsx:56-58` - "Bonus quality" mention
- `components/coach/CoachTierCard.tsx:92-96` - Tier based on children count only

**Database:**
- `coach_applications.teaching_experience_years` - stored, unused
- Tier progression based solely on `children_coached` count

**What's Working:**
- Experience field is collected and stored

**What's Missing:**
- No experience-based branching in assessment or onboarding
- No fast-track for experienced teachers (5+ years)
- No different tier assignment based on experience
- No different AI assessment criteria based on experience
- Experience is purely decorative

**Code Quality:** N/A

**Recommendations:**
1. Consider fast-track for 5+ years experience (skip or lighter AI assessment)
2. Set initial tier based on experience (e.g., 10+ years = Expert from day 1)
3. Use experience in matching algorithm weighting

---

### Feature 9: Analytics / Funnel Tracking

**Status:** :warning: Partial (parent funnel tracked, coach funnel absent)

**Implementation:**
GA4 is fully integrated with 12+ custom events for the parent/child assessment journey. Meta Pixel and Google Ads tracking also exist. An admin funnel API exists for parent journey. However, the coach application journey has zero analytics events.

**Files:**
- `components/GoogleAnalytics.tsx:1-172` - GA4 with custom events (parent journey only)
- `components/TrackingPixels.tsx` - Meta Pixel + Google Ads
- `app/layout.tsx:85-86` - Analytics loaded globally
- `app/api/admin/crm/funnel/route.ts` - Parent funnel stats API
- `app/admin/analytics/page.tsx` - Placeholder ("Coming Soon")

**Database:**
- Parent funnel stats via Supabase RPC function

**What's Working:**
- GA4 with 12+ custom events for parent journey
- Meta Pixel + Google Ads conversion tracking
- Admin funnel API for parent pipeline (discovery -> enrolled)
- Page view tracking on all route changes
- Revenue tracking on enrollment completion

**What's Missing:**
- Zero GA4 events for coach application journey
- No tracking: page views on /yestoryd-academy, form starts, completions
- No AI assessment score tracking events
- No interview scheduled/completed tracking
- No admin dashboard for coach pipeline funnel
- No drop-off analysis for coach journey
- Admin analytics page is a "Coming Soon" stub

**Code Quality:** 8/10 for parent journey, 0/10 for coach journey.

**Recommendations:**
1. Add GA4 events to all coach application pages (apply, qualify, assess, results)
2. Build coach pipeline funnel API similar to parent funnel
3. Add admin dashboard tab showing: Started -> Qualified -> Interviewed -> Approved

---

### Feature 10: Background/Reference Verification

**Status:** :x: Not Built

**Implementation:**
PAN number is collected and format-validated (regex) but not verified against government databases. No ID proof upload, no reference checks, no LinkedIn verification, no background checks of any kind. Coaches are working with children based solely on self-declaration.

**Files:**
- `app/api/coach/onboarding/route.ts:45-50` - PAN regex validation only
- `app/coach/onboarding/page.tsx:46` - PAN input field
- `supabase/migrations/20260130_coach_applications.sql:28` - Certifications JSONB (unverified)

**Database:**
- `coaches.pan_number` - stored, format-checked only
- `coach_applications.certifications` - JSONB array, self-declared
- MISSING: `verification_status`, `reference_1_*`, `reference_2_*`, `aadhaar_verified`, `linkedin_url`

**What's Working:**
- PAN format validation (regex)
- PAN sent to Razorpay for contact creation

**What's Missing:**
- No PAN verification against government database
- No Aadhaar/ID proof collection or verification
- No reference checks (no fields, no workflow)
- No LinkedIn profile collection
- No education certificate verification
- No background check integration
- No document upload for ID proof
- No `verification_status` field
- Admin can approve without any verification

**Code Quality:** N/A

**Recommendations:**
1. Add Aadhaar verification via DigiLocker API
2. Require 2 references with contact info
3. Add document upload for ID proof + education certificates
4. Add `verification_status` field with pending/verified/failed states
5. Block student assignment until verification_status = verified

---

## Priority Fixes

| Priority | Feature | Impact | Effort |
|----------|---------|--------|--------|
| 1 | **Background Verification** (Audit 10) | Child safety risk | High |
| 2 | **Post-Approval Engagement** (Audit 6) | Coach retention/activation | Medium |
| 3 | **Shadow Session Flow** (Audit 5) | Quality control gap | Medium |
| 4 | **Matching Integration** (Audit 1) | Better student-coach fit | Low (API exists) |
| 5 | **Coach Analytics** (Audit 9) | Funnel optimization | Low |
| 6 | **Probation Enforcement** (Audit 4) | Performance accountability | Medium |
| 7 | **Referral Input** (Audit 7) | Growth opportunity | Low |
| 8 | **Red Flag Surfacing** (Audit 3) | Admin visibility | Low |
| 9 | **Borderline Handling** (Audit 2) | Candidate experience | Low |
| 10 | **Experience Tracks** (Audit 8) | Nice-to-have | Low |

---

## Code Examples

### Matching API (exists but unused)
```
File: app/api/matching/route.ts
- Calculates match_score = (matched_skills / total_needs) * 100
- Filters by availability, accepting_new, capacity
- Sorts by match_score DESC, avg_rating DESC
- NEVER called from enrollment or assignment flows
```

### Red Flag Detection (exists but buried)
```
File: app/api/coach-assessment/calculate-score/route.ts:370-377
const isQualified = combinedScore >= settings.assessmentPassScore &&
  raiAnalysis.recommendation !== 'STRONG_NO' &&  // Auto-disqualify
  voiceScore >= 2 &&
  raiScore >= 2;

// Concerns stored in ai_score_breakdown JSONB - not queryable
```

### Coach Assignment (hardcoded fallback)
```
File: app/api/payment/verify/route.ts:453-499
async function getCoach(coachId, requestId) {
  if (coachId) return coach;       // Use provided coach
  return getRucha();                // Fallback to Rucha - no matching!
}
```

### Post-Approval (no notification)
```
File: app/api/admin/coach-applications/[id]/route.ts:66-121
if (status === 'approved') {
  // Creates coach record ✅
  // Generates referral code ✅
  // Sends notification ❌ ← MISSING
}
```
