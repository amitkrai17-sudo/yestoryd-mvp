# Yestoryd Alignment Audit Report

**Audit Date:** February 8, 2026
**North Star Document:** Purpose & Method V2 (February 2026)
**Audited Against:** Codebase (main branch @ a18f8ab4), Live Website, 7 User Journeys

---

## Part 1: Codebase Audit

---

### Section 1: Assessment System

**V2 Requirement:** Two-stage model — Stage 1: Free AI Assessment (5-min audio, Gemini analysis, instant certificate, lead capture, >80% completion rate). Stage 2: Post-Enrollment Diagnostic (Session 1, human coach-led, age-specific protocols for Foundation/Building/Mastery, diagnostic form richer than post-session form).

#### ✅ Aligned

- **Free AI Assessment (Stage 1) fully implemented.** 3-step flow (Details → Record → Results) in `app/assessment/AssessmentPageClient.tsx` (1,416 lines). Gemini analyzes audio for clarity, fluency, speed. Instant certificate generated. Lead captured into `children` table.
- **Age-appropriate passage selection** exists: 4-5, 6-7, 8-9, 10-12 mapped to Cambridge levels (Pre-A1 Starters through B1 Preliminary).
- **Assessment data stored permanently** across three tables: `children` (summary fields), `learning_events` (with embeddings), `assessments` (detailed records).

#### ⚠️ Conflicts

- **Session types do not include "diagnostic."** `scheduled_sessions.session_type` supports `coaching | checkin | skillBooster | discovery` — no `diagnostic` type. Session 1 is indistinguishable from Session 2 in the data model.
- **Same post-session form for ALL sessions.** `app/api/coach/sessions/[id]/complete/route.ts` uses one form regardless of `session_number`. V2 requires a richer diagnostic form for Session 1 that captures age-specific observations (pencil grip, language dominance, parent dynamic, etc.).

#### ❌ Missing

- **Post-Enrollment Diagnostic (Stage 2)** — No concept of a diagnostic session. No age-specific Session 1 protocols (Foundation 30-min play-based, Building 45-min structured, Mastery 60-min conversational).
- **Diagnostic Session Form** — No separate, richer form for Session 1 data capture. The post-session form captures ~20 data points, but V2 requires age-band-specific observation fields (e.g., letter recognition, rhyme detection, fine motor for Foundation; graded word reading, sight word speed for Building; spoken English fluency for Mastery).
- **Diagnostic → Plan pipeline** — No system to take Session 1 data and generate a personalized learning plan or multi-season roadmap. `session_templates` table exists in DB schema but no code reads from it.
- **`child_learning_plans` table** — Does not exist.
- **`child_journey_roadmap` table** — Does not exist.

#### 📋 Recommended Changes

1. Add `diagnostic` to `session_type` enum and auto-assign it to Session 1 of every enrollment.
2. Build age-specific diagnostic forms (3 variants: Foundation, Building, Mastery) with the observation fields specified in V2.
3. Create `child_learning_plans` and `child_journey_roadmap` tables.
4. Build the diagnostic → plan generation pipeline: Session 1 data → rAI processes overnight → generates roadmap + Season 1 plan → sends to parent via WhatsApp within 24 hours.
5. Populate `session_templates` table with Rucha's curated library (40+ templates across 3 bands).

---

### Section 2: Scheduling & Sessions

**V2 Requirement:** Age-differentiated scheduling — Foundation: 24 sessions, 2x/week, 30 min. Building: 18 sessions, 1.5x/week, 45 min. Mastery: 12 sessions, 1x/week, 60 min. All within a 12-week season.

#### ✅ Aligned

- **Plan-driven scheduling implemented.** `lib/scheduling/enrollment-scheduler.ts` creates sessions based on pricing plans with starter (3 sessions/4 weeks), continuation (6/8 weeks), and full (9/12 weeks) schedules.
- **Smart slot finder** with 6-tier priority system for finding available calendar slots.
- **Google Calendar + Recall.ai integration** with circuit breaker patterns for resilience.
- **Session metadata** includes `session_number`, `session_type`, `duration_minutes`, `week_number`.

#### ⚠️ Conflicts

- **All sessions default to 45 minutes.** `lib/scheduling/config.ts` hardcodes: coaching=45, checkin=45, skillBooster=45, discovery=30. V2 requires 30/45/60 minutes based on age band.
- **Full plan = 9 sessions** (6 coaching + 3 check-in over 12 weeks). V2 requires 24 sessions for Foundation, 18 for Building, 12 for Mastery.
- **Session frequency is uniform.** Coaching weeks are [1,2,5,6,9,10] and check-in weeks are [4,8,12] for all children. V2 requires 2x/week (Foundation), ~1.5x/week (Building), 1x/week (Mastery).

#### ❌ Missing

- **Age band concept** — No `age_band` field on `enrollments` or `children` tables. No Foundation/Building/Mastery differentiation anywhere in scheduling logic.
- **Variable session counts** — Cannot schedule 24 sessions for a Foundation child. The plan system maxes at 9.
- **Variable session durations** — No mechanism to set duration based on child's age.
- **Variable frequency** — No mechanism for 2x/week vs 1x/week scheduling.
- **Season concept** — No `season_number` field on enrollments. `renewed_from_enrollment_id` provides implicit chaining but no explicit season tracking.

#### 📋 Recommended Changes

1. Add `age_band` field (enum: `foundation | building | mastery`) to `children` and `enrollments` tables, auto-derived from child's age at enrollment.
2. Create age-band-specific plan configurations: Foundation (24 sessions, 2x/week, 30 min), Building (18, ~1.5x/week, 45 min), Mastery (12, 1x/week, 60 min).
3. Update `lib/scheduling/config.ts` and `enrollment-scheduler.ts` to branch on age band.
4. Add `season_number` to `enrollments` table (auto-incremented from `renewed_from_enrollment_id` chain).

---

### Section 3: Personalized Learning Plans

**V2 Requirement:** Session Template Library curated by Rucha (40+ templates, tagged by skill/difficulty/age/prerequisites/duration). rAI selects and sequences templates into per-child plans. Coach-in-the-loop plan adaptation.

#### ✅ Aligned

- **`session_templates` table exists** in database schema with fields: `template_name`, `session_type`, `target_age_group`, `structure` (JSON), `duration_minutes`, `tips`, `is_active`.
- **`curriculum_template` table exists** as a static blueprint for curriculum structure.

#### ⚠️ Conflicts

- **Session templates table is unused.** No application code reads from `session_templates`. The table exists in the schema but is functionally dead.

#### ❌ Missing

- **Template content** — `session_templates` table appears to be empty or sparsely populated. V2 requires 40+ templates across 3 age bands.
- **Template tagging** — Current schema has `target_age_group` and `session_type` but lacks: `skill_dimension`, `difficulty_level`, `prerequisites`, `required_materials` tags that V2 specifies.
- **Per-child learning plans** — No `child_learning_plans` table. No mechanism to assign specific templates to specific sessions for a specific child.
- **Plan generation logic** — No rAI pipeline that takes diagnostic data → identifies skill gaps → selects/sequences templates → generates a season plan.
- **Coach plan review** — No UI for coach to review/approve an AI-generated plan before Session 2.
- **Plan adaptation** — No mechanism for coach to request a plan revision mid-season. No "coach-in-the-loop" override flow.

#### 📋 Recommended Changes

1. Extend `session_templates` schema with: `skill_dimension`, `difficulty_level` (1-10), `prerequisites` (array of template IDs), `required_materials`, `phonicseeds_content_link`.
2. Create `child_learning_plans` table (child_id, enrollment_id, season_number, plan JSON with week-by-week template assignments, status, generated_at, reviewed_by_coach_at).
3. Build plan generation endpoint: POST `/api/rAI/generate-plan` — takes diagnostic data + age band → outputs template sequence.
4. Build coach plan review UI in coach portal.
5. Build plan revision flow: coach requests update → rAI regenerates remaining sessions → coach approves.

---

### Section 4: Multi-Season Journey Roadmap

**V2 Requirement:** After Session 1 diagnostic, rAI generates a full multi-season roadmap (3-6 seasons) showing season names, goals, milestones. Shared with parent via WhatsApp within 24 hours. Displayed on parent dashboard. Updated at end of each season via exit assessment.

#### ✅ Aligned

- **Enrollment chaining exists.** `renewed_from_enrollment_id` on `enrollments` table allows linking seasons.
- **Exit assessment infrastructure exists.** Completion flow includes assessment that reuses the free assessment infrastructure, with before/after comparison.

#### ⚠️ Conflicts

- None — this feature is almost entirely missing rather than conflicting.

#### ❌ Missing

- **`child_journey_roadmap` table** — Does not exist.
- **Roadmap generation** — No rAI logic to generate a multi-season roadmap from diagnostic data.
- **Roadmap display** — No roadmap visualization on parent dashboard.
- **Roadmap WhatsApp delivery** — No automated 24-hour post-Session-1 roadmap message.
- **Season naming** — No concept of season names or season-specific goals/milestones.
- **Roadmap updating** — No mechanism to update the roadmap based on exit assessment at season end.
- **"The 24-hour magic moment"** — The specific workflow of Session 1 → diagnostic → overnight rAI processing → roadmap delivery within 24 hours is completely absent.

#### 📋 Recommended Changes

1. Create `child_journey_roadmap` table (child_id, total_seasons, current_season, roadmap JSON with per-season goals/milestones, generated_at, last_updated_at).
2. Build roadmap generation endpoint triggered after Session 1 diagnostic form submission.
3. Add roadmap visualization component to parent dashboard.
4. Create WhatsApp template for roadmap delivery and automate 24-hour post-Session-1 send via QStash.
5. Build roadmap update logic triggered by exit assessment at season end.

---

### Section 5: Parent Engagement

**V2 Requirement:** Parent Oath at enrollment (age-specific weekly commitment). Weekly checklist via WhatsApp (5-7 tasks mixing reading, group class, platform, coaching). Daily WhatsApp nudges linked to learning plan. Anonymous leaderboard showing consistency percentile. Parent activity logging with single-tap completion.

#### ✅ Aligned

- **Parent dashboard exists** (`app/parent/dashboard/page.tsx`) showing: stats grid, upcoming sessions, coach card, skill booster access, referral system.
- **WhatsApp communication infrastructure** exists (AiSensy integration, `communication_templates`, `communication_logs`).
- **82+ communication touchpoints** already configured for various lifecycle events.

#### ⚠️ Conflicts

- **Parent is positioned as viewer, not partner.** The current dashboard shows progress and sessions but requires no active participation from the parent. V2 positions the parent as an active co-learner (Foundation) or practice supervisor (Building).

#### ❌ Missing

- **Parent Oath** — No oath/commitment mechanism at enrollment. No age-specific pledge. No UI to present and capture the oath.
- **Weekly Checklist** — No `parent_tasks` or `parent_checklist` table. No weekly task delivery via WhatsApp. No checklist UI on parent dashboard.
- **Daily WhatsApp Nudges** — No daily automated messages linked to the child's learning plan. The 82 touchpoints are lifecycle-triggered (enrollment, session reminders, etc.), not daily pedagogical nudges.
- **Parent Activity Logging** — No mechanism for parents to log daily activities (story time, reading practice). No single-tap completion tracking.
- **Anonymous Leaderboard** — No parent consistency tracking. No percentile calculation. No "You're in the top 20%" notifications.
- **Parent Streak System** — No streak tracking for parent engagement.

#### 📋 Recommended Changes

1. Create `parent_tasks` table (parent_id, child_id, week_number, tasks JSON, completed_tasks, delivered_at, completion_rate).
2. Build Parent Oath UI in enrollment flow with age-specific commitments.
3. Build weekly checklist delivery system: every Monday via WhatsApp with clickable tasks.
4. Build daily nudge pipeline: rAI generates contextual task → QStash schedules morning delivery → parent taps "done" → logged to `learning_events`.
5. Build anonymous leaderboard: weekly percentile calculation across all active parents, delivered via WhatsApp.
6. Add parent activity section to dashboard showing streaks, completion rates, and tasks.

---

### Section 6: Coach Intelligence & Pre-Session Briefs

**V2 Requirement:** Coach walks into every session with zero cognitive overhead. rAI provides: diagnostic data, last session summary, parent activity completion, session template for today, AI-generated recommendations. Diagnostic form (Session 1) is richer than regular post-session form. Coach can request plan revision.

#### ✅ Aligned

- **PreSessionBrief component exists** (`components/coach/PreSessionBrief.tsx`) with 3 tabs: Overview (assessment score, progress metrics, key topics), History (last session summary), Tips (AI-generated via Gemini).
- **Session Prep Hub full page** exists for comprehensive session preparation.
- **Post-session form captures ~20 data points** written to `learning_events` with `content_for_embedding` for rAI vectorization.
- **Coach post-session data IS vectorized** — written to `learning_events` table with embeddings generated asynchronously.

#### ⚠️ Conflicts

- **Same form for all sessions.** V2 requires a richer diagnostic form for Session 1 with age-specific observation fields. Currently Session 1 uses the identical post-session form as all other sessions.
- **Pre-session brief lacks parent activity data.** V2 specifies "parent activity completion this week" as a key brief element. This data doesn't exist (parent activity logging is missing).

#### ❌ Missing

- **Diagnostic Session Form** — No separate, richer Session 1 form capturing: skill-level observations across all dimensions, behavioral notes (attention, confidence, parent dynamic), language dominance assessment, coach's initial recommendation for learning focus areas.
- **Session template in brief** — Pre-session brief does not show "the specific session template for today" because per-child learning plans with template assignments don't exist.
- **Parent activity in brief** — Cannot show parent weekly activity because parent task tracking doesn't exist.
- **Plan revision request** — No mechanism for coach to flag "this child needs a plan adjustment" and trigger rAI to regenerate remaining sessions.
- **Coach cannot see parent engagement data** — Dashboard shows child learning data but not parent participation metrics.

#### 📋 Recommended Changes

1. Build age-specific diagnostic forms (3 variants) for Session 1 completion.
2. Add session template display to PreSessionBrief when per-child plans exist.
3. Add parent activity widget to PreSessionBrief (blocked by parent task system).
4. Add "Request Plan Revision" button to coach portal that triggers rAI plan regeneration with coach notes.

---

### Section 7: Re-Enrollment & Graduation

**V2 Requirement:** Exit assessment (same dimensions as diagnostic). rAI generates "Next Season Learning Plan." Shareable milestone (video + before/after + certificate). Re-enrollment offer with continuity discount. FOMO nudges if parent doesn't re-enroll ("Riya's friends are in Kahani Time today!"). True graduation ceremony when child completes all seasons.

#### ✅ Aligned

- **Completion flow exists** with PDF certificate, NPS survey, and referral prompt.
- **Exit assessment exists** — reuses the assessment infrastructure with before/after comparison.
- **AI-generated progress report** with before/after visualization.
- **Loyalty discount** — 10% within 7 days of completion, configurable via `site_settings`.
- **Enrollment chaining** — `renewed_from_enrollment_id` supports multi-season linking.

#### ⚠️ Conflicts

- **Exit assessment reuses free assessment format.** V2 says exit assessment should use "same dimensions as the diagnostic" (Session 1 format), which is human-led and richer. Current exit assessment is the same AI-only audio analysis.

#### ❌ Missing

- **rAI "Next Season Learning Plan"** — No generation of a next-season plan at completion. The re-enrollment flow doesn't show what Season 2 would look like.
- **FOMO nudges** — No automated "Riya's friends are in Kahani Time today!" messages to lapsed parents. No re-engagement drip campaign.
- **Shareable video milestone** — No mechanism to record a child reading in the final session and package it as a shareable video.
- **Season tracking** — No `season_number` field, so the system cannot display "Season 1 of 3 complete" or track graduation eligibility.
- **True graduation** — No graduation ceremony concept, no "Reading Buddy" invitation for graduated children, no distinction between season completion and program graduation.

#### 📋 Recommended Changes

1. Build rAI next-season plan generation triggered at exit assessment.
2. Build FOMO nudge system: QStash-scheduled WhatsApp messages referencing group class activity to lapsed families.
3. Add `season_number` to enrollments and build graduation eligibility logic.
4. Create graduation flow distinct from season completion (graduation = all seasons done + exit assessment shows independence).

---

### Section 8: rAI Data Completeness

**V2 Requirement:** "All data sources must be vectorized into the learning_events pipeline. Currently only 30% of available data is vectorized." Required sources: coach post-session (36 data points), Session 1 diagnostic, parent daily activity logs, e-learning engagement, group class attendance, full assessment history.

#### ✅ Aligned

- **Coach post-session data → vectorized.** Post-session form writes to `learning_events` with `content_for_embedding`. Embeddings generated asynchronously. ✅
- **Assessment data → vectorized.** Free assessment results stored with embeddings. ✅
- **Parent check-in data → written.** Check-in session observations go to `learning_events`. ✅
- **E-learning completion events → tracked.** Game completion events written to `learning_events`. ✅
- **Hybrid search (SQL + pgvector HNSW)** implemented for rAI retrieval. ✅

#### ⚠️ Conflicts

- None — the existing vectorization works correctly, it's just incomplete.

#### ❌ Missing

- **Session 1 diagnostic data** — Not separately captured (no diagnostic form exists), so it's treated as a regular session. The richer diagnostic observations V2 requires are not being captured or vectorized.
- **Parent daily activity logs** — Don't exist. No parent task system means no completion data to vectorize. This is flagged in V2 as critical: "Parent daily activity logs (checklist completion, reading time)."
- **Group class attendance** — Group class system exists but attendance is not written to `learning_events` for vectorization.
- **Coach observation depth** — V2 says "36 data points per session." Current form captures ~20. Gap of ~16 data points not being captured.

#### 📋 Recommended Changes

1. Build diagnostic form → ensures richer Session 1 data enters the vectorization pipeline.
2. Build parent activity logging → ensures daily engagement data is vectorized.
3. Add group class attendance events to `learning_events` pipeline.
4. Expand post-session form to capture all 36 observation data points V2 specifies (gap analysis needed with Rucha to identify missing 16 fields).

---

### Section 9: Group Classes

**V2 Requirement:** 4 sessions per week targeting different age bands (Kahani Time, Reading Yoga for younger; Creative Writing, Grammar Challenge for older). Enrolled families attend free. Non-enrolled pay ₹199-400 (acquisition funnel). Coaches can run their own group classes as additional revenue stream.

#### ✅ Aligned

- **Full group class CRUD system built** — create, edit, schedule, manage group classes.
- **ENROLLED100 coupon** — virtual coupon system making group classes free for enrolled families.
- **Google Calendar + Recall.ai integration** for group classes.
- **Age filtering exists** — classes can target age groups.
- **Revenue stream for coaches** — coaches can organize and run their own group classes.

#### ⚠️ Conflicts

- **Age bands don't match V2.** Current system uses 4-6, 6-8, 8-10, 10-12. V2 specifies Foundation (4-6), Building (7-9), Mastery (10-12). The 6-8 and 8-10 bands overlap differently than V2's clean three-band model.
- **Isolated from enrollment journey.** Group classes live at `/classes` route, largely disconnected from the main enrollment flow and parent dashboard.

#### ❌ Missing

- **4 per week structure** — No enforcement or template for the V2's specific 4-classes-per-week cadence (Kahani Time, Reading Yoga, Creative Writing, Grammar Challenge).
- **Non-enrolled pricing tiers** — ₹199-400 pricing for non-enrolled families as acquisition funnel is not clearly implemented as a structured pricing strategy.
- **Group class attendance in learning_events** — Attendance data is not vectorized for rAI.
- **Integration with parent dashboard** — Group class schedule and attendance not shown on parent dashboard.
- **Instructor marketplace** — No platform for external reference experts to list and manage group classes (V2 post-launch item).

#### 📋 Recommended Changes

1. Align age bands to Foundation/Building/Mastery (4-6, 7-9, 10-12).
2. Create group class templates for the 4 recurring weekly sessions.
3. Add group class attendance to `learning_events` vectorization pipeline.
4. Surface group class schedule on parent dashboard with easy join links.
5. Build acquisition funnel pricing for non-enrolled families.

---

### Section 10: E-Learning Platform

**V2 Requirement:** 5 game engines (Word Match, Phonics Pop, Sentence Builder, Story Sequence, Rhyme Time) with SM-2 spaced repetition. Focus Mode with Mission Cards. Gamification: XP, badges, streaks, celebration ladder. Content personalized by rAI. Content currently in development.

#### ✅ Aligned

- **2 of 5 game engines implemented** — Word Match and Phonics Pop are functional.
- **Focus Mode / Mission Card UI built** — single-task presentation mode exists.
- **Gamification system built** — XP, levels, badges, streaks, celebration animations all implemented.
- **rAI content recommendations** connected to coaching session data.
- **E-learning completion events** tracked in `learning_events`.

#### ⚠️ Conflicts

- **Two parallel table schemas.** Both `el_*` tables and `learning_*` tables exist for e-learning data. This creates confusion about which is the source of truth. Needs consolidation.

#### ❌ Missing

- **3 game engines** — Sentence Builder, Story Sequence, and Rhyme Time are not implemented.
- **Content is 0%** — No actual learning content (word lists, phonics rules, stories, sequences) has been loaded. V2 acknowledges this: "E-learning content is currently in active development."
- **SM-2 spaced repetition** — Algorithm not confirmed as implemented. Difficulty progression exists but full SM-2 may not be wired up.
- **Age-band content differentiation** — No mechanism to restrict/recommend content by Foundation/Building/Mastery band.

#### 📋 Recommended Changes

1. Build remaining 3 game engines (Sentence Builder, Story Sequence, Rhyme Time).
2. Consolidate e-learning tables (choose `el_*` or `learning_*` as canonical).
3. Implement or verify SM-2 spaced repetition algorithm.
4. Tag all content by age band once content is loaded.
5. Content creation is Rucha's workstream — Foundation band first per V2 execution plan.

---

## Part 2: Website Audit

---

### Homepage

#### ✅ Aligned
- ARC Method (Assess → Remediate → Celebrate) is presented.
- Core value proposition about AI + human coaching communicates the V2 vision.
- Mobile-first design (80%+ users on mobile).

#### ⚠️ Conflicts
- No mention of age bands (Foundation/Building/Mastery). The homepage treats all children 4-12 as a homogeneous group.
- No mention of the multi-season journey or "long journey, clear milestones" framing.

#### ❌ Missing
- No Parent Oath concept on the homepage. V2 positions parents as active partners — the homepage positions them as buyers.
- No mention of diagnostic session (Stage 2 assessment).
- No group class promotion or schedule.
- No daily engagement messaging ("84 consecutive days of reading engagement").

---

### Assessment Page

#### ✅ Aligned
- Functions correctly as Stage 1 lead generation tool.
- Fast, impressive, frictionless — matches V2's requirement for >80% completion rate.
- Age-appropriate passages.

#### ⚠️ Conflicts
- Not explicitly labeled as "Stage 1" or "Free Assessment." V2 draws a clear distinction between Stage 1 (lead gen) and Stage 2 (diagnostic). The current page doesn't set up the expectation that a deeper diagnostic follows after enrollment.

#### ❌ Missing
- No messaging about what comes after: "After enrollment, your child gets a comprehensive 1:1 diagnostic with a certified coach."

---

### Enrollment Page

#### ✅ Aligned
- Dynamic pricing from `site_settings` (config loader pattern).
- Razorpay payment integration working.
- Phase infrastructure exists for enrollment flow.

#### ⚠️ Conflicts
- No mention of diagnostic session as Session 1.
- Pricing currently at ₹5,999 for uniform 6-session package. V2 says pricing is "under revision" to reflect age-differentiated session counts (24/18/12).

#### ❌ Missing
- No age-band selection or display during enrollment.
- No Parent Oath step in the enrollment flow.
- No preview of the multi-season journey ("Here's what your child's road looks like").

---

### Academy Page (`/yestoryd-academy`)

#### ✅ Aligned
- Presents the coaching program.
- Curriculum information available.

#### ⚠️ Conflicts
- **Hardcoded "Rs. 5,999"** in FAQ section (`app/yestoryd-academy/page.tsx:67,155`). Violates CLAUDE.md "NO HARDCODING" rule and will be wrong when V2 pricing is implemented.
- **Stale "January 2026" badge** — needs updating.

#### ❌ Missing
- No age-band differentiation in the academy presentation.
- No Three Pillars framing (Interest Generation → Science of English → Independent Reading).

---

### Classes Page (`/classes`)

#### ✅ Aligned
- Group class listing and browsing works.
- Age filtering available.

#### ⚠️ Conflicts
- Route is `/classes` not `/group-classes` — minor but inconsistent with V2 terminology.
- Isolated from the rest of the site — no cross-links from parent dashboard or enrollment flow.

#### ❌ Missing
- Not positioned as an acquisition funnel for non-enrolled families.
- No "Enrolled families attend free" messaging.

---

### Missing Pages

#### ❌ Missing
- **`/about`** — No about page. V2's narrative about why Yestoryd exists, the blue ocean positioning, and the team's credentials has no home on the website.
- **`/book-call`** — No standalone discovery call booking page (currently embedded in enrollment flow).

---

## Part 3: User Journey Audit

---

### Journey 1: New Parent → Free Assessment → Lead Capture

**V2 Flow:** Parent discovers Yestoryd → Takes free 5-min AI assessment → Receives instant certificate + report → Lead captured → Follow-up via WhatsApp/email → Discovery call booked.

#### ✅ Aligned
- Assessment flow works end-to-end (Details → Record → Results).
- Lead captured in `children` table with parent info.
- Instant certificate generated.
- Communication automation triggers follow-up (part of 82+ touchpoints).

#### ⚠️ Conflicts
- Assessment doesn't preview the post-enrollment diagnostic. V2 says Stage 1 should create appetite for Stage 2's deeper analysis.

#### ❌ Missing
- No explicit framing of "This is just the beginning — enroll for a full diagnostic with a certified coach."

---

### Journey 2: Enrolled Parent → Session 1 Diagnostic → Roadmap Delivered

**V2 Flow:** Parent enrolls → Session 1 is a diagnostic (age-specific protocol) → Coach submits diagnostic form → rAI processes overnight → Multi-season roadmap generated → Parent receives roadmap via WhatsApp within 24 hours → Roadmap displayed on dashboard.

#### ✅ Aligned
- Enrollment and first session scheduling works.

#### ❌ Missing (Entire Journey)
- No diagnostic session type.
- No age-specific Session 1 protocol.
- No diagnostic form.
- No rAI overnight processing.
- No roadmap generation.
- No 24-hour WhatsApp delivery.
- No roadmap on parent dashboard.

**This is the single most impactful missing journey.** V2 calls the 24-hour roadmap delivery "the moment Yestoryd becomes irreplaceable in the parent's mind."

---

### Journey 3: Coach → Pre-Session Prep → Session Delivery → Post-Session

**V2 Flow:** Coach opens session → Sees full brief (diagnostic data, last session, parent activity, today's template, AI tips) → Delivers session using template → Submits post-session form → If needed, requests plan revision → rAI updates remaining sessions.

#### ✅ Aligned
- PreSessionBrief exists with 3 tabs (Overview, History, Tips).
- Session Prep Hub provides comprehensive preparation.
- Post-session form captures data and writes to `learning_events` with embeddings.
- AI-generated tips via Gemini in pre-session brief.

#### ⚠️ Conflicts
- Same form for all sessions (no Session 1 distinction).
- Brief missing parent activity data and session template.

#### ❌ Missing
- No session template assignment per session.
- No parent activity completion display.
- No "Request Plan Revision" flow.
- Diagnostic data not separately surfaced (because it doesn't exist).

---

### Journey 4: Parent → Daily Engagement → Weekly Checklist → Leaderboard

**V2 Flow:** Every morning parent receives WhatsApp nudge linked to learning plan → Completes task in <10 min → Taps "done" → Weekly checklist delivered Monday → Maintains streak → Receives anonymous percentile ("Top 20%!").

#### ❌ Missing (Entire Journey)
- No daily WhatsApp nudges.
- No parent task system.
- No weekly checklist delivery.
- No activity logging.
- No streak tracking.
- No anonymous leaderboard.

**This journey is 100% absent.** V2 positions this as the backbone of the "84 consecutive days of reading engagement" model. Without it, the program is 9-24 coaching sessions with nothing in between.

---

### Journey 5: Child → E-Learning → Gamification → Progress

**V2 Flow:** Child opens platform → Focus Mode presents Mission Card → Plays age-appropriate game (5 engines) → Earns XP, badges → Maintains streak → Content personalized by rAI based on coaching sessions.

#### ✅ Aligned
- Focus Mode / Mission Card UI built.
- 2 game engines working (Word Match, Phonics Pop).
- Gamification system functional (XP, levels, badges, streaks).
- rAI recommendations connected to coaching data.

#### ❌ Missing
- 3 game engines not built.
- 0% content loaded.
- SM-2 spaced repetition unconfirmed.
- Age-band content differentiation not implemented.

---

### Journey 6: Season End → Exit Assessment → Re-Enrollment or Graduation

**V2 Flow:** Season ends → Exit assessment (same as diagnostic format) → Before/after comparison → Certificate + shareable video → rAI generates next-season plan → Re-enrollment offer with discount → If lapsed, FOMO nudges → If all seasons done, graduation ceremony.

#### ✅ Aligned
- Completion flow with certificate, NPS, referral.
- Exit assessment with before/after comparison.
- Loyalty discount (10% within 7 days).
- AI progress report generated.

#### ❌ Missing
- Next-season plan generation.
- Shareable video milestone.
- FOMO nudges for lapsed families.
- Season tracking (season_number).
- Graduation vs. season-completion distinction.

---

### Journey 7: Non-Enrolled Family → Group Class → Conversion

**V2 Flow:** Non-enrolled family discovers group class → Pays ₹199-400 → Attends class → Experiences Yestoryd methodology → Receives follow-up → Takes free assessment → Enrolls.

#### ✅ Aligned
- Group class system exists with scheduling and management.
- Free assessment exists as conversion endpoint.

#### ❌ Missing
- No structured pricing tiers for non-enrolled (₹199-400).
- No explicit acquisition funnel flow (class → assessment → enrollment).
- No post-class follow-up automation targeting conversion.
- Group classes isolated from main site — no cross-promotion.

---

## Final Gap Summary Table

Sorted by: Blocks Other Work (yes first) → Strategic Importance (highest first) → Effort (lowest first)

| # | Gap | Strategic Importance | Effort | Blocks Other Work | Recommended Priority |
|---|-----|---------------------|--------|-------------------|---------------------|
| 1 | **Age band system** (Foundation/Building/Mastery fields on children + enrollments) | 🔴 Critical | Small | **YES** — blocks scheduling, plans, content, diagnostic forms, pricing | **P0 — Do First** |
| 2 | **Session 1 diagnostic form** (3 age-specific variants) | 🔴 Critical | Medium | **YES** — blocks plan generation, roadmap, coach brief enrichment | **P0 — Do First** |
| 3 | **Session template library** (40+ templates, tagged, populated) | 🔴 Critical | Large (Rucha) | **YES** — blocks plan generation, per-session assignment | **P0 — Do First (Content)** |
| 4 | **Per-child learning plan system** (child_learning_plans table + generation logic) | 🔴 Critical | Large | **YES** — blocks coach template display, daily nudges, plan revision | **P1 — Core Engine** |
| 5 | **Variable session scheduling** (24/18/12 sessions, 30/45/60 min, 2x/1.5x/1x per week) | 🔴 Critical | Medium | **YES** — blocks correct enrollment for all age bands | **P1 — Core Engine** |
| 6 | **Multi-season roadmap** (table, generation, display, WhatsApp delivery) | 🟠 High | Medium | No | **P1 — Core Engine** |
| 7 | **Full data vectorization** (diagnostic form, parent activity, group attendance) | 🟠 High | Medium | **YES** — blocks rAI intelligence improvement | **P1 — Tech Debt** |
| 8 | **Parent task system** (parent_tasks table, weekly checklist, daily nudges) | 🟠 High | Large | **YES** — blocks parent activity logging, leaderboard, coach brief | **P2 — Engagement** |
| 9 | **Parent Oath** (enrollment step, age-specific commitment) | 🟠 High | Small | No | **P2 — Engagement** |
| 10 | **FOMO nudges** (lapsed parent re-engagement via WhatsApp) | 🟡 Medium | Small | No | **P2 — Engagement** |
| 11 | **Anonymous parent leaderboard** (streak percentile, WhatsApp delivery) | 🟡 Medium | Medium | No | **P2 — Engagement** |
| 12 | **Coach plan revision flow** (request → rAI regenerate → approve) | 🟡 Medium | Medium | No | **P2 — Coach Tools** |
| 13 | **rAI next-season plan** (generated at exit assessment) | 🟡 Medium | Medium | No | **P2 — Re-Enrollment** |
| 14 | **3 remaining game engines** (Sentence Builder, Story Sequence, Rhyme Time) | 🟡 Medium | Large | No | **P3 — E-Learning** |
| 15 | **E-learning content** (0% loaded, Foundation band first) | 🟡 Medium | Very Large (Rucha) | No | **P3 — E-Learning** |
| 16 | **Group class age band alignment** (match Foundation/Building/Mastery) | 🟢 Low | Small | No | **P3 — Cleanup** |
| 17 | **Group class acquisition funnel** (₹199-400 pricing, post-class follow-up) | 🟢 Low | Medium | No | **P3 — Growth** |
| 18 | **Hardcoded ₹5,999 references** (~20 files) | 🟢 Low | Small | No | **P3 — Cleanup** |
| 19 | **Shareable video milestone** (final session recording packaged for parents) | 🟢 Low | Medium | No | **P3 — Delight** |
| 20 | **E-learning table consolidation** (el_* vs learning_* schema) | 🟢 Low | Small | No | **P3 — Tech Debt** |
| 21 | **Season number tracking** (field on enrollments, graduation logic) | 🟡 Medium | Small | No | **P2 — Data Model** |
| 22 | **SM-2 spaced repetition verification** | 🟢 Low | Small | No | **P3 — E-Learning** |
| 23 | **About page** | 🟢 Low | Small | No | **P3 — Website** |
| 24 | **Stale content** (January 2026 badge on academy page) | 🟢 Low | Trivial | No | **P3 — Cleanup** |
| 25 | **Pricing restructure** (age-band pricing replacing flat ₹5,999) | 🟠 High | Medium | Blocked by age band system | **P1 — After Age Bands** |

---

## Executive Summary

### What's Working Well
The platform has strong foundations: a functional assessment system (Stage 1), plan-driven scheduling with Google Calendar integration, Razorpay payments, coach session infrastructure with data vectorization, a completion flow with certificates, and communication automation (82+ touchpoints). The e-learning gamification framework is architecturally sound.

### The Core Gap
**The entire "personalization engine" described in V2 is missing.** The system currently treats every child the same regardless of age: same session count (9), same duration (45 min), same frequency, same post-session form, no learning plan, no roadmap. V2's core competitive advantage — "no competitor in India combines AI-powered diagnostic assessment, 1:1 human coaching, structured daily practice, and parent partnership" — requires the personalization engine to function.

### The Critical Path
The recommended implementation order follows V2's execution phases:

1. **Age Band System (P0)** — Add Foundation/Building/Mastery to data model. Small effort, unblocks everything.
2. **Session Template Library (P0, Rucha)** — Content creation, runs in parallel with tech work.
3. **Diagnostic Form + Variable Scheduling (P1)** — The Session 1 experience and age-appropriate session structure.
4. **Plan Generation + Roadmap (P1)** — The rAI engine that makes personalization real.
5. **Parent Engagement System (P2)** — Oath, tasks, nudges, leaderboard — the "84 days" model.
6. **Data Vectorization Completion (P1)** — Feed rAI the remaining 70% of data.
7. **E-Learning Content + Engines (P3)** — Platform engagement layer, content-dependent.

### Bottom Line
The codebase is approximately **40% aligned** with V2. The aligned portions (assessment, scheduling infrastructure, coach session flow, payments, communications) are solid and production-tested. The missing 60% centers on three themes: **age differentiation** (the entire Foundation/Building/Mastery system), **personalization** (diagnostic → plans → templates → roadmap), and **daily engagement** (parent tasks, nudges, leaderboard). These are the features that V2 identifies as Yestoryd's competitive moat.

---

*Report generated by Claude Code on February 8, 2026*
*Source: Codebase audit of main branch (commit a18f8ab4), live website analysis, Purpose & Method V2 document review*
