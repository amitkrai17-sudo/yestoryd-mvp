# YESTORYD ALIGNMENT AUDIT REPORT

**Date:** February 8, 2026
**North Star:** Purpose & Method V2 (February 2026)
**Codebase:** main branch @ commit a18f8ab4
**Auditor:** Claude Code

---

## STEP 1: Codebase Structure Map

### 1.1 Database Schema

**Source:** `lib/supabase/database.types.ts` (auto-generated from Supabase)
**Migrations:** `supabase/migrations/` (18 SQL files, Jan-Feb 2026)

**Core Tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `children` | Child profiles + leads | `child_name, age, parent_email, parent_phone, latest_assessment_score, assessment_wpm, phonics_focus, struggling_phonemes, lead_score, lead_status, lead_source, is_enrolled` |
| `parents` | Parent accounts | `name, email, phone, user_id, notification_preferences (JSONB)` |
| `coaches` | Coach profiles | `name, email, phone, calendar_id, tier, specializations, is_active` |
| `enrollments` | Paid program enrollments | `child_id, coach_id, enrollment_type (starter/continuation/full), sessions_purchased, sessions_completed, sessions_remaining, program_start, program_end, status, renewed_from_enrollment_id, remedial_sessions_max` |
| `scheduled_sessions` | Coaching sessions | `enrollment_id, child_id, coach_id, session_number, session_type (coaching/checkin/skillBooster/discovery), duration_minutes, week_number, scheduled_date, scheduled_time, status, google_event_id, google_meet_link, recall_bot_id` |
| `learning_events` | Unified event tracking + RAG | `child_id, coach_id, session_id, event_type, event_date, event_data (JSONB), content_for_embedding, embedding (vector), ai_summary` |
| `assessments` | Detailed assessment records | `child_id, score, clarity_score, fluency_score, speed_score, wpm, feedback, errors, phonics_analysis` |
| `discovery_calls` | Pre-enrollment consultations | `child_id, coach_id, scheduled_date, status, notes` |
| `pricing_plans` | Product/plan definitions | `slug (starter/continuation/full), name, duration_weeks, sessions_coaching, sessions_checkin, sessions_skill_building, coaching_week_schedule (JSONB), duration_coaching_mins, phase_number, is_locked` |
| `bookings` | Payment records | `amount, currency, payment_id, order_id, status` |
| `session_templates` | Template library (unused) | `template_name, session_type, target_age_group, structure (JSONB), duration_minutes, tips, is_active` |
| `curriculum_template` | Static curriculum blueprint | `week_number, session_type, session_number, title, focus_areas, duration_minutes` |
| `communication_templates` | WhatsApp/email templates | `category, channel, template_name, content, variables` |
| `communication_logs` | Sent message history | `recipient, channel, template, status, sent_at` |
| `site_settings` | Dynamic configuration | `key, value, category (auth/coach/payment/scheduling/etc.)` |
| `group_class_types` | Class type definitions | `name, slug, icon_emoji, price_inr, age_min, age_max, duration_minutes, max_participants` |
| `group_sessions` | Scheduled group classes | `class_type_id, title, scheduled_date, scheduled_time, coach_id, status, google_meet_link, recall_bot_id, current_participants` |
| `coach_schedule_rules` | Coach availability | `coach_id, day_of_week, start_time, end_time, session_type` |
| `activity_log` | Usage audit trail | `user_id, action, metadata` |
| `support_tickets` | Parent support requests | `parent_id, category, status, resolution_notes` |

**E-Learning Tables (dual schema):**

| Table (el_* prefix) | Purpose |
|---------------------|---------|
| `el_child_gamification` | XP, level, streak, coins |
| `el_child_badges` | Earned badges |
| `el_child_unit_progress` | Per-unit completion tracking |
| `el_child_avatars` | Avatar customization |
| `el_stages` | Age-based learning stages |
| `el_learning_units` | Unit definitions |
| `el_videos` | Video content |
| `el_game_content` | Game instances |
| `el_game_engines` | 5 game engine definitions |
| `el_child_video_progress` | Video watch progress |

| Table (elearning_* prefix) | Purpose |
|---------------------------|---------|
| `elearning_skills` | Skill categories |
| `elearning_sub_skills` | Individual skills |
| `elearning_content_pools` | Word banks, sentence pools |
| `elearning_units` | Unit definitions (v2 schema) |
| `child_unit_progress` | Completion + spaced repetition |
| `child_game_progress` | Game play scores |
| `child_daily_goals` | Daily activity targets |
| `child_badges` | Badge definitions |

**Tables that DO NOT exist (required by V2):**

| Missing Table | V2 Purpose |
|---------------|------------|
| `child_learning_plans` | Per-child session template sequence |
| `child_journey_roadmap` | Multi-season arc (3-6 seasons) |
| `parent_tasks` | Weekly parent checklist items |
| `parent_oath` | Enrollment commitment tracking |
| `parent_activity_logs` | Daily activity completion tracking |

---

### 1.2 API Routes (100+ endpoints)

**Assessment (5 routes):**
- `/api/assessment/analyze` — Gemini AI analysis of reading audio
- `/api/assessment/results/[childId]` — Fetch assessment results
- `/api/assessment/final/data` — Final assessment data
- `/api/assessment/final/submit` — Submit final assessment
- `/api/assessment/retry` — Retry failed assessments

**Payment (5 routes):**
- `/api/payment/create` — Create Razorpay order
- `/api/payment/verify` — Verify payment + create enrollment + schedule sessions
- `/api/payment/webhook` — Razorpay webhook handler
- `/api/payment/validate-retry` — Retry failed payments
- `/api/pricing` — Fetch pricing plans

**Coach (17 routes):**
- `/api/coach/sessions` — List coach sessions
- `/api/coach/sessions/[id]/complete` — Post-session form submission
- `/api/coach/sessions/[id]/parent-update` — Send parent update
- `/api/coach/session-prep` — Pre-session brief data
- `/api/coach/ai-suggestion` — AI coaching tips
- `/api/coach/schedule-rules` — Availability management
- `/api/coach/availability` — One-off unavailability
- `/api/coach/earnings` / `earnings-summary` / `earnings-calculator` — Earnings
- `/api/coach/profile` / `onboarding` / `exit` — Lifecycle
- `/api/coach/my-referrals` / `tier-change` / `notify-assignment` / `send-status-notification`

**Admin (41 routes):**
- `/api/admin/crm/*` — Leads, pipeline, funnel, interactions, coaches, export, daily-stats
- `/api/admin/payments/*` — Payments, stats, export
- `/api/admin/payouts/*` — Payout processing, reconciliation
- `/api/admin/coaches/*` — Coach management, specializations, referral generation
- `/api/admin/coach-applications/*` — Application review, confirmation
- `/api/admin/group-classes/*` — CRUD + options
- `/api/admin/completion/*` — List, extend, send final assessment
- `/api/admin/coupons/*` — Coupon CRUD
- `/api/admin/agreements/*` — Upload, manage
- `/api/admin/config/invalidate` — Cache invalidation
- `/api/admin/settings` / `pricing` / `revenue-config` / `features` / `feature-flags` / `tds` / `testimonials`
- `/api/admin/generate-embeddings` — Manual embedding generation
- `/api/admin/session-stats` / `dashboard` / `scheduling/queue` / `shadow` / `setup-qstash-schedules`

**Sessions (10 routes):**
- `/api/sessions` — List sessions
- `/api/sessions/[id]/reschedule-request` / `cancel-request` / `feedback`
- `/api/sessions/confirm` / `missed` / `complete`
- `/api/sessions/parent-checkin` — Parent check-in form
- `/api/sessions/change-request/[id]/approve`

**Scheduling (4 routes):**
- `/api/scheduling/dispatch` — Schedule session dispatch
- `/api/scheduling/hold` — Hold a slot
- `/api/scheduling/slots` — Available slots

**E-Learning (14 routes):**
- `/api/elearning/dashboard` — Aggregated child data
- `/api/elearning/unit/[unitId]` — Unit details
- `/api/elearning/games/[gameId]` — Game content
- `/api/elearning/video/[videoId]` / `videos/[videoId]/progress` — Video access + tracking
- `/api/elearning/gamification` — XP, level, streak
- `/api/elearning/quiz-questions` / `quiz/[quizId]` / `submit-quiz`
- `/api/elearning/recommendations` — rAI content suggestions
- `/api/elearning/session` / `complete` / `progress` / `avatar`

**Parent (8 routes):**
- `/api/parent/dashboard` / `enrolled-child` / `progress`
- `/api/parent/session/available-slots` / `reschedule`
- `/api/parent/referral` / `referral/generate`
- `/api/parent/notification-preferences`

**WhatsApp & Webhooks (6 routes):**
- `/api/whatsapp/webhook` — Lead Bot webhook (META_WA_*)
- `/api/whatsapp/send` — Send WhatsApp message
- `/api/webhooks/whatsapp-cloud` — AI Bot webhook (WHATSAPP_CLOUD_*)
- `/api/webhooks/cal` — Cal.com booking webhook
- `/api/webhooks/recall` — Recall.ai transcript webhook
- `/api/webhooks/aisensy/goals` — AiSensy goal tracking

**Background Jobs & Cron (9 routes):**
- `/api/cron/compute-insights` / `enrollment-lifecycle` / `monthly-payouts` / `payment-reconciliation` / `process-coach-unavailability`
- `/api/jobs/retry-scheduling` / `recall-reconciliation` / `process-session` / `update-calendar-attendee` / `goals-capture`

**Other (15+ routes):**
- `/api/chat` — rAI chat (coach/parent/admin)
- `/api/matching` — Coach-child matching
- `/api/products` — Product listing
- `/api/certificate/generate` / `send` — Certificate generation
- `/api/completion/check` / `data` / `report` — Completion flow
- `/api/mini-challenge/*` — Post-assessment mini-challenge
- `/api/group-classes/*` — Registration, validation, confirmation
- `/api/skill-booster/*` — Skill booster booking + recommendations
- `/api/quiz/*` — Quiz generation + submission
- `/api/refund/initiate` — Refund processing
- `/api/nps/*` — Net Promoter Score
- `/api/support/tickets/*` — Support system
- `/api/tts` — Text-to-speech
- `/api/leads/hot-alert` — Hot lead admin notification

---

### 1.3 Frontend Pages (75+ pages)

**Public Pages (12):**
- `/` — Homepage (A/B tested hero, ARC section, pricing, FAQ)
- `/assessment` — Free AI reading assessment (3-step flow)
- `/assessment/results/[id]` — Assessment results + certificate
- `/assessment/final` — End-of-program re-assessment
- `/lets-talk` — Discovery call booking (3-step flow)
- `/enroll` — Enrollment + payment (Razorpay)
- `/book` — Redirects to `/enroll`
- `/classes` — Group class listing + registration
- `/classes/register/[sessionID]` — Group class registration
- `/yestoryd-academy` — Coach recruitment landing page
- `/yestoryd-academy/apply` / `qualify` / `assessment` / `confirmation` — Coach onboarding
- `/privacy` / `/terms` — Legal pages

**Parent Portal (8):**
- `/parent/login` — Parent authentication
- `/parent/dashboard` — Main dashboard (stats, sessions, coach, referrals)
- `/parent/sessions` — Session list + management
- `/parent/progress` — Progress report + timeline
- `/parent/elearning` — E-learning + video library
- `/parent/support` — Support tickets
- `/parent/book-skill-booster/[sessionId]` — Skill booster booking

**Coach Portal (15):**
- `/coach/login` — Coach authentication
- `/coach/dashboard` — Dashboard (students, sessions, earnings, referrals)
- `/coach/sessions` — Session list/calendar
- `/coach/sessions/[sessionId]/prep` — Pre-session brief + prep hub
- `/coach/students` — Student list
- `/coach/students/[id]` — Student profile (sessions, AI chat, history)
- `/coach/earnings` — Earnings tracking
- `/coach/templates` — WhatsApp templates
- `/coach/discovery-calls` / `[id]` — Discovery call management
- `/coach/ai-assistant` — Dedicated AI chat
- `/coach/profile` / `onboarding` / `confirm` — Lifecycle
- `/coach/[subdomain]` — Coach landing page

**Admin Portal (18):**
- `/admin` — Dashboard
- `/admin/crm` — CRM (Leads + Discovery tabs)
- `/admin/enrollments` — Enrollment management
- `/admin/coaches` — Coach management
- `/admin/group-classes` — Group class management
- `/admin/payments` — Payment records
- `/admin/payouts` — Payout processing
- `/admin/analytics` — Analytics
- `/admin/completion` — Completion management
- `/admin/tds` — TDS compliance
- `/admin/coupons` — Coupon management
- `/admin/elearning` — E-learning admin
- `/admin/site-settings` — Dynamic config
- `/admin/settings` / `settings/pricing` / `settings/revenue` — System settings
- `/admin/communication` — Communication management
- `/admin/coach-applications` — Application review
- `/admin/coach-groups` — Coach group management
- `/admin/agreements` / `waitlist` / `scheduling/queue` — Misc admin

**Child Portal (3):**
- `/child/[childId]/play` — E-learning main (Focus Mode)
- `/child/[childId]/unit/[unitId]` — Unit player (video → game → quiz)
- `/child/[childId]/quest/[unitId]` — Quest mode

**Other (5):**
- `/completion/[enrollmentId]` — Completion ceremony page
- `/enrollment/success` — Post-enrollment success
- `/booking-confirmed` — Booking confirmation
- `/nps/[enrollmentId]` — NPS survey
- `/mini-challenge/[childId]` — Post-assessment challenge

---

### 1.4 Key Lib Modules (90+ files)

| Module | Files | Purpose |
|--------|-------|---------|
| `lib/scheduling/` | 13 files | Enrollment scheduler, smart slot finder, session manager, config, orchestrator, circuit breaker, transaction manager, retry queue, manual queue, notification manager |
| `lib/rai/` | 8 files | Hybrid search, embeddings, intent classifier, prompts, admin insights, proactive notifications, query filters, types |
| `lib/communication/` | 4 files | AiSensy, SendGrid, WhatsApp Cloud API, central hub |
| `lib/whatsapp/` | 10 files | Lead Bot: signature verification, message extraction, intent classification (tier0-regex + tier1-gemini), handlers (greeting, FAQ, qualification, assessment-cta, booking, escalate) |
| `lib/config/` | 3 files | Enterprise config loader (types, loader with 5-min TTL, navigation) |
| `lib/business/` | 3 files | Revenue split, session scheduler (legacy), index |
| `lib/supabase/` | 4 files | Client, server (admin), database types, index |
| `lib/google/` | 2 files | Google auth, Google Sheets |
| `lib/calendar/` | 1 file | Calendar operations (Google Calendar) |
| `lib/ai/` | 3 files | AI provider (Gemini), errors, env check |
| `lib/gemini/` | 1 file | Gemini client |
| `lib/mini-challenge/` | 3 files | Settings, content, index |
| `lib/refund/` | 1 file | Refund calculator |
| Other | 15+ files | Razorpay, QStash, auth, rate limiting, lead scoring, gamification, referral, sounds, TTS, phone utils, etc. |

---

### 1.5 External Integrations

| Service | Integration File(s) | Purpose |
|---------|---------------------|---------|
| **Gemini 2.5 Flash Lite** | `lib/ai/provider.ts`, `lib/gemini/client.ts` | AI assessment analysis, coaching tips, rAI chat, intent classification |
| **Supabase** | `lib/supabase/client.ts`, `server.ts` | PostgreSQL + pgvector + Auth + Storage |
| **Razorpay** | `lib/razorpay.ts` | Payment processing (LIVE) |
| **Google Calendar** | `lib/googleCalendar.ts`, `lib/calendar/operations.ts` | Session scheduling + Google Meet |
| **Recall.ai** | `lib/recall-auto-bot.ts` | Session recording + transcription |
| **AiSensy** | `lib/communication/aisensy.ts` | WhatsApp template messages (enrolled families) |
| **Meta WhatsApp Cloud** | `lib/communication/whatsapp-cloud.ts`, `lib/whatsapp/` | WhatsApp Lead Bot (prospects) |
| **SendGrid** | `lib/communication/sendgrid.ts` | Email delivery |
| **QStash (Upstash)** | `lib/qstash.ts` | Background job queue |
| **Sentry** | `sentry.*.config.ts` | Error monitoring |
| **Google TTS** | `lib/tts/google-tts.ts` | Text-to-speech for children |

---

## STEP 2: Section-by-Section Audit

---

### SECTION 1: Two-Stage Assessment

**REQUIRED:** Stage 1 (Free AI, 5 min, lead gen) + Stage 2 (Post-enrollment diagnostic, Session 1, human-led, age-specific protocols, richer diagnostic form)

#### ✅ ALIGNED
- **Stage 1 fully implemented.** `app/assessment/AssessmentPageClient.tsx` (1,416 lines). 3-step flow: Details → Record → Results. Gemini analyzes audio for clarity, fluency, speed. Instant certificate generated. Lead captured into `children` table with scoring.
- **Age-appropriate passage selection:** 4-5, 6-7, 8-9, 10-12 mapped to Cambridge levels.
- **Assessment data stored permanently** in 3 tables: `children` (summary), `learning_events` (with embeddings), `assessments` (detailed records).
- **Final assessment (exit) exists** — reuses assessment infrastructure with before/after comparison.

#### ⚠️ CONFLICT
- **Session types lack "diagnostic."** `session_type` supports `coaching | checkin | skillBooster | discovery` only. Session 1 is data-identical to Session 2.
- **Same post-session form for ALL sessions.** `app/api/coach/sessions/[id]/complete/route.ts` captures ~20 data points regardless of `session_number`. V2 requires a richer diagnostic form for Session 1 with age-specific fields (pencil grip, language dominance, parent dynamic for Foundation; graded word reading, sight word speed for Building; spoken English fluency for Mastery).

#### ❌ MISSING
- **Post-Enrollment Diagnostic (Stage 2)** — No concept of a diagnostic session. No age-specific Session 1 protocols.
- **Diagnostic Session Form** — No separate, richer form for Session 1.
- **Diagnostic → Plan pipeline** — No system to take Session 1 data and generate a personalized learning plan. `session_templates` table exists but is unused.
- **`child_learning_plans` table** — Does not exist.
- **`child_journey_roadmap` table** — Does not exist.

#### 🔧 CHANGE NEEDED
1. Add `diagnostic` to `session_type` enum; auto-assign to Session 1 of every enrollment. **Effort: Low**
2. Build 3 age-specific diagnostic forms (Foundation, Building, Mastery) with the V2-specified observation fields. **Effort: Medium**
3. Create `child_learning_plans` and `child_journey_roadmap` tables. **Effort: Low**
4. Build diagnostic → plan generation pipeline (Session 1 data → rAI → roadmap + plan → WhatsApp within 24h). **Effort: High**

---

### SECTION 2: Age-Differentiated Session Structure

**REQUIRED:** Foundation 24 sessions/2x wk/30 min. Building 18/1.5x/45 min. Mastery 12/1x/60 min.

#### ✅ ALIGNED
- **Plan-driven scheduling engine** in `lib/scheduling/enrollment-scheduler.ts`. Creates sessions from `pricing_plans` table with configurable week schedules.
- **Smart slot finder** (`lib/scheduling/smart-slot-finder.ts`) with 6-tier priority matching.
- **Google Calendar + Recall.ai integration** with circuit breakers for resilience.
- **Session metadata** includes `session_number`, `session_type`, `duration_minutes`, `week_number`.
- **Durations configurable** via `site_settings` table (not only hardcoded).

#### ⚠️ CONFLICT
- **All sessions default 45 min.** `lib/scheduling/config.ts`: coaching=45, checkin=45, skillBooster=45, discovery=30.
- **Full plan = 9 sessions** (6 coaching + 3 check-in). V2 requires 24/18/12 by age.
- **Frequency is uniform.** Coaching weeks [1,2,5,6,9,10] and check-in weeks [4,8,12] for all children.

#### ❌ MISSING
- **Age band concept** — No `age_band` field on `children` or `enrollments`. No Foundation/Building/Mastery differentiation in scheduling.
- **Variable session counts** — Cannot schedule 24 sessions. Max is 9.
- **Variable durations and frequency** — No branching by age.
- **Season concept** — No `season_number` on enrollments. Only implicit chaining via `renewed_from_enrollment_id`.

#### 🔧 CHANGE NEEDED
1. Add `age_band` enum (`foundation | building | mastery`) to `children` + `enrollments`, auto-derived from child age. **Effort: Low**
2. Create 3 age-band plan configurations in `pricing_plans`. **Effort: Medium**
3. Update `lib/scheduling/config.ts` + `enrollment-scheduler.ts` to branch on age band. **Effort: Medium**
4. Add `season_number` to `enrollments` (auto-increment from renewal chain). **Effort: Low**

---

### SECTION 3: Session Template Library

**REQUIRED:** 40+ templates curated by Rucha, tagged by skill/difficulty/age/prerequisites/duration. rAI selects and sequences them into per-child plans.

#### ✅ ALIGNED
- **`session_templates` table exists** with fields: `template_name`, `session_type`, `target_age_group`, `structure` (JSON), `duration_minutes`, `tips`, `is_active`.
- **`curriculum_template` table exists** as a static blueprint.

#### ⚠️ CONFLICT
- **`session_templates` is functionally dead.** No application code reads from it. Table exists in schema only.

#### ❌ MISSING
- **Template content** — Table appears empty or sparsely populated. V2 requires 40+ templates.
- **Template tagging** — Schema lacks: `skill_dimension`, `difficulty_level`, `prerequisites`, `required_materials`.
- **Per-child learning plans** — No `child_learning_plans` table to link children to ordered template sequences.
- **Plan generation logic** — No rAI pipeline (diagnostic → skill gaps → select templates → sequence).
- **Coach plan review UI** — No interface for coach to review/approve AI-generated plans.
- **Plan adaptation** — No "Request Plan Update" mechanism.

#### 🔧 CHANGE NEEDED
1. Extend `session_templates` schema: add `skill_dimension`, `difficulty_level` (1-10), `prerequisites` (array), `required_materials`. **Effort: Low**
2. Create `child_learning_plans` table (child_id, enrollment_id, season_number, plan JSON, status, generated_at, reviewed_by_coach_at). **Effort: Low**
3. Build plan generation endpoint: `POST /api/rai/generate-plan`. **Effort: High**
4. Build coach plan review UI + "Request Plan Update" button. **Effort: Medium**
5. Populate 40+ templates (Rucha's workstream). **Effort: High (Content)**

---

### SECTION 4: Personalized Learning Plans

**REQUIRED:** After diagnostic, rAI generates per-child plan from template library. Plan respects prerequisites. Coach reviews before Session 2. Mid-journey adaptation via coach request.

#### ✅ ALIGNED
- Nothing directly aligned — this is entirely new functionality.
- The infrastructure exists to support it: `session_templates` schema, `learning_events` for data, Gemini for AI generation.

#### ⚠️ CONFLICT
- None — feature doesn't exist to conflict.

#### ❌ MISSING
- **Entire plan generation system** — No tables, no logic, no UI, no API.
- **Coach plan review flow** — No interface.
- **Plan adaptation / coach-in-the-loop** — No mechanism.

#### 🔧 CHANGE NEEDED
1. Create tables: `child_learning_plans`. **Effort: Low**
2. Build plan generation logic using Gemini + session_templates. **Effort: High**
3. Build coach plan review page showing upcoming sessions with assigned templates. **Effort: Medium**
4. Build plan revision endpoint: coach notes → rAI regenerates remaining sessions → coach approves. **Effort: Medium**

---

### SECTION 5: Multi-Season Journey Roadmap

**REQUIRED:** Full multi-season roadmap (3-6 seasons) generated after Session 1 diagnostic. Shows season names, goals, milestones. Shared via WhatsApp within 24 hours. Displayed on parent dashboard. Updated at season end.

#### ✅ ALIGNED
- **Enrollment chaining** via `renewed_from_enrollment_id`.
- **Exit assessment infrastructure** exists with before/after comparison.
- **WhatsApp infrastructure** ready (AiSensy templates, communication pipeline).

#### ⚠️ CONFLICT
- None — feature is almost entirely missing.

#### ❌ MISSING
- **`child_journey_roadmap` table.**
- **Roadmap generation logic.**
- **Roadmap display** on parent dashboard.
- **24-hour WhatsApp delivery** post-Session-1.
- **Season naming / milestone tracking.**
- **Roadmap update** at season end based on exit assessment.

#### 🔧 CHANGE NEEDED
1. Create `child_journey_roadmap` table. **Effort: Low**
2. Build roadmap generation endpoint (triggered after diagnostic form). **Effort: High**
3. Add roadmap visualization to parent dashboard. **Effort: Medium**
4. Create WhatsApp template + QStash automation for 24h delivery. **Effort: Medium**
5. Build roadmap update logic at exit assessment. **Effort: Medium**

---

### SECTION 6: Parent Engagement System

**REQUIRED:** Parent Oath at enrollment. Weekly checklist (5-7 tasks) via WhatsApp every Monday. Daily nudges linked to learning plan. Single-tap activity logging. Anonymous leaderboard (streak percentile).

#### ✅ ALIGNED
- **Parent dashboard** exists with stats, sessions, coach info, referrals, support.
- **WhatsApp infrastructure** ready (AiSensy + Meta Cloud API).
- **82+ communication touchpoints** configured for lifecycle events.
- **Parent check-in sessions** capture `home_practice_frequency` and `parent_sentiment`.
- **Notification preferences** system exists (WhatsApp, email, quiet hours).

#### ⚠️ CONFLICT
- **Parent positioned as viewer, not partner.** Dashboard shows progress passively. V2 requires active participation (co-learner for Foundation, practice supervisor for Building).

#### ❌ MISSING
- **Parent Oath** — No mechanism. No UI in enrollment flow. No age-specific commitments.
- **Weekly Checklist** — No `parent_tasks` table. No Monday WhatsApp delivery. No checklist UI.
- **Daily Nudges** — 82 touchpoints are lifecycle-triggered, not daily pedagogical nudges linked to learning plan.
- **Activity Logging** — No mechanism for parents to log daily activities (story time, reading practice).
- **Anonymous Leaderboard** — No streak tracking, no percentile calculation, no "Top 20%" messages.
- **Parent Streak System** — Does not exist.

#### 🔧 CHANGE NEEDED
1. Create `parent_tasks` table (parent_id, child_id, week_number, tasks JSON, completed_tasks, completion_rate). **Effort: Low**
2. Build Parent Oath UI in enrollment flow with age-specific commitments. **Effort: Low**
3. Build weekly checklist delivery: QStash cron → generate tasks → WhatsApp template → Monday morning. **Effort: Medium**
4. Build daily nudge pipeline: rAI generates task from learning plan → QStash schedules → parent taps "done" → logged to `learning_events`. **Effort: High**
5. Build anonymous leaderboard: weekly cron → calculate percentiles → WhatsApp delivery. **Effort: Medium**
6. Add parent activity section to dashboard with streaks and task history. **Effort: Medium**

---

### SECTION 7: Coach Intelligence

**REQUIRED:** Pre-session brief with diagnostic data, last session, parent activity, today's template, rAI tips. Post-session form captures 36 data points. Coach can request plan update. Coach assigned based on diagnostic profile match.

#### ✅ ALIGNED
- **PreSessionBrief component** (`components/coach/PreSessionBrief.tsx`) with 3 tabs: Overview, History, Tips.
- **Session Prep Hub** full page with child overview, AI patterns, recent sessions, prep notes.
- **Post-session form** captures ~20 data points written to `learning_events` with `content_for_embedding`.
- **Data IS vectorized** — embeddings generated async for rAI search.
- **AI-generated coaching tips** via Gemini.
- **Coach assignment** via `/api/matching` endpoint.

#### ⚠️ CONFLICT
- **Same form for all sessions** — No Session 1 diagnostic variant.
- **Pre-session brief lacks parent activity data** — Doesn't exist to show.
- **Post-session captures ~20 of 36 required data points** — 16 fields gap.

#### ❌ MISSING
- **Diagnostic Session Form** — 3 age-specific variants for Session 1.
- **Session template in brief** — Cannot show "today's template" without learning plans.
- **Parent activity in brief** — Cannot show without parent task system.
- **Plan revision request** — No "Request Plan Update" button or flow.
- **Diagnostic-based coach matching** — Current matching doesn't consider child's skill gap profile.

#### 🔧 CHANGE NEEDED
1. Build 3 age-specific diagnostic forms. **Effort: Medium**
2. Add template display to PreSessionBrief (blocked by learning plans). **Effort: Low**
3. Add parent activity widget to brief (blocked by parent task system). **Effort: Low**
4. Add "Request Plan Revision" button → rAI regeneration → coach approval. **Effort: Medium**
5. Expand post-session form from ~20 to 36 data points (gap analysis with Rucha needed). **Effort: Medium**

---

### SECTION 8: Group Classes

**REQUIRED:** 4/week across age bands (Kahani Time, Reading Yoga, Creative Writing, Grammar Challenge). Free for enrolled. ₹199-400 for non-enrolled (acquisition funnel). Attendance fed to learning_events. Coaches can run own classes.

#### ✅ ALIGNED
- **Full CRUD system** — create, edit, schedule, manage group classes.
- **ENROLLED100 virtual coupon** — free for enrolled families.
- **Google Calendar + Recall.ai integration.**
- **Age filtering** on class listing.
- **Coaches can run own classes** as revenue stream.
- **Registration flow** with payment for non-enrolled.

#### ⚠️ CONFLICT
- **Age bands don't match V2.** Current: 4-6, 6-8, 8-10, 10-12. V2: Foundation (4-6), Building (7-9), Mastery (10-12).
- **Isolated from enrollment journey.** Lives at `/classes`, disconnected from parent dashboard and main flow.

#### ❌ MISSING
- **4/week cadence enforcement** — No template for the specific Kahani Time + Reading Yoga + Creative Writing + Grammar Challenge structure.
- **Attendance in learning_events** — Not vectorized for rAI.
- **Integration with parent dashboard** — No group class schedule shown.
- **Structured acquisition funnel** — No post-class follow-up automation for non-enrolled.

#### 🔧 CHANGE NEEDED
1. Align age bands to Foundation/Building/Mastery. **Effort: Low**
2. Create recurring group class templates for 4 weekly sessions. **Effort: Low**
3. Write group class attendance to `learning_events`. **Effort: Low**
4. Surface group classes on parent dashboard. **Effort: Medium**
5. Build post-class follow-up automation for non-enrolled. **Effort: Medium**

---

### SECTION 9: Re-Enrollment & Graduation

**REQUIRED:** Exit assessment (same as diagnostic). rAI generates "Next Season Plan." Shareable milestone (video + before/after + certificate). Continuity discount. FOMO nudges for lapsed families. True graduation ceremony.

#### ✅ ALIGNED
- **Completion flow** with PDF certificate, NPS survey, referral prompt.
- **Exit assessment** (before/after comparison using assessment infrastructure).
- **AI progress report** with score visualization.
- **Loyalty discount** — 10% within 7 days (configurable via site_settings).
- **Enrollment chaining** via `renewed_from_enrollment_id`.

#### ⚠️ CONFLICT
- **Exit assessment reuses free assessment format** (AI-only audio). V2 says it should use diagnostic format (human-led, richer).

#### ❌ MISSING
- **rAI "Next Season Plan"** — No generation at completion.
- **FOMO nudges** — No "Riya's friends are in Kahani Time today!" automation.
- **Shareable video milestone** — No mechanism to record and package.
- **Season tracking** — No `season_number` field.
- **True graduation** — No distinction between season completion and program graduation. No "Reading Buddy" invitation.

#### 🔧 CHANGE NEEDED
1. Build next-season plan generation triggered at exit assessment. **Effort: Medium**
2. Build FOMO nudge system via QStash-scheduled WhatsApp. **Effort: Low**
3. Add `season_number` to enrollments + graduation eligibility logic. **Effort: Low**
4. Create graduation flow distinct from season completion. **Effort: Medium**

---

### SECTION 10: Data & Intelligence (rAI)

**REQUIRED:** ALL data vectorized into learning_events. Sources: coach post-session (36 points), diagnostic, parent activity logs, e-learning engagement, group class attendance, assessment history. Currently ~30% vectorized.

#### ✅ ALIGNED
- **Coach post-session data → vectorized.** Written to `learning_events` with `content_for_embedding`. Embeddings generated async.
- **Assessment data → vectorized.**
- **Parent check-in data → written** to `learning_events`.
- **E-learning completion events → tracked.**
- **Hybrid search (SQL + pgvector HNSW)** implemented in `lib/rai/hybrid-search.ts`.
- **Two-tier intent classification** (`lib/rai/intent-classifier.ts`) routes queries.
- **Admin insights cache** for fast common queries.
- **Rate limiting** per user role (admin 100/min, coach 50/min, parent 20/min).

#### ⚠️ CONFLICT
- None — existing vectorization works correctly, just incomplete.

#### ❌ MISSING
- **Session 1 diagnostic data** — Not separately captured, treated as regular session.
- **Parent daily activity logs** — Don't exist. No data to vectorize.
- **Group class attendance** — Not in `learning_events`.
- **Coach observation depth** — ~20 of 36 required data points captured.

#### 🔧 CHANGE NEEDED
1. Build diagnostic form → richer Session 1 data enters pipeline. **Effort: Medium** (blocked by diagnostic form)
2. Build parent activity logging → daily engagement data vectorized. **Effort: Medium** (blocked by parent task system)
3. Add group class attendance to `learning_events`. **Effort: Low**
4. Expand post-session form to 36 data points. **Effort: Medium**

---

### SECTION 11: Pricing & Payment

**REQUIRED:** Pricing under revision upward from ₹5,999. Must support: per-season enrollment, age-band-specific packaging, continuity discounts, group class purchases for non-enrolled. Variable pricing by age band.

#### ✅ ALIGNED
- **Razorpay integration fully working** (LIVE mode). Payment create → verify → webhook flow.
- **`pricing_plans` table** with configurable products: slug, name, sessions, duration, pricing, phase_number, is_locked.
- **Enterprise config loader** (`lib/config/loader.ts`) with `loadPaymentConfig()` — dynamic pricing from site_settings, 5-min TTL cache.
- **Coupon system** — percentage and fixed discounts, usage tracking, `group_class_coupons` table.
- **Referral discounts** — credit-based system with configurable percentages.
- **Loyalty/continuity discount** — 10% within 7 days, configurable.
- **Phase infrastructure** — `phase_number` and `is_locked` on pricing_plans supports sequential product unlocking.
- **Revenue split logic** — coach-sourced 70/30, Yestoryd-sourced 50/50, configurable via site_settings.
- **Refund system** — `lib/refund/calculator.ts` with configurable rules.

#### ⚠️ CONFLICT
- **12 files contain hardcoded "5999"** references:
  - `components/assessment/ResultsDisplay.tsx` — CTA text
  - `app/yestoryd-academy/page.tsx` — FAQ earnings examples
  - `app/coach/earnings/page.tsx` — Earnings explanation
  - `components/coach/CoachTierCard.tsx` — Tier card
  - `components/PaymentGuard.tsx` — Payment validation
  - `app/api/coach/earnings-summary/route.ts` — Earnings calculation
  - `app/api/coupons/validate/route.ts` / `calculate/route.ts` — Coupon validation
  - `app/admin/settings/pricing/page.tsx` / `revenue/page.tsx` — Admin panels
  - `app/admin/coach-groups/page.tsx` — Coach groups
  - `types/database.ts` — Type definitions
- **Pricing plans are plan-based, not age-band-based.** `pricing_plans` uses `starter/continuation/full` slugs, not `foundation/building/mastery`.
- **Session counts are plan-driven, not age-driven.** Starter=3, Continuation=6, Full=9 — regardless of child's age.

#### ❌ MISSING
- **Age-band-specific pricing tiers** — No Foundation/Building/Mastery pricing.
- **Season-based enrollment** — System says "3-month program" not "Season 1 of 3."
- **Variable coach costs by age band** — Shorter sessions (Foundation) vs longer sessions (Mastery) have different per-session economics.

#### 🔧 CHANGE NEEDED
1. Replace 12 hardcoded "5999" references with dynamic config loader calls. **Effort: Low**
2. Create age-band-specific `pricing_plans` entries (foundation_full, building_full, mastery_full, etc.). **Effort: Medium**
3. Update enrollment flow to select pricing based on child's age band. **Effort: Medium**
4. Revenue split adjustment for variable session lengths. **Effort: Low**

---

### SECTION 12: E-Learning Platform

**REQUIRED:** 5 game engines (Word Match, Phonics Pop, Sentence Builder, Story Sequence, Rhyme Time). SM-2 spaced repetition. Focus Mode / Mission Cards. Gamification (XP, badges, streaks, celebration ladder). Content personalized by rAI. Content: 0% loaded.

#### ✅ ALIGNED
- **2 of 5 game engines implemented** — Word Match + Phonics Pop are functional with components.
- **Focus Mode / Mission Card UI** — `components/elearning/MissionCard.tsx` with "rAI picked" badge, quest title, activity sequence icons, start button.
- **Gamification fully built:**
  - XP + levels: `GamificationHeader.tsx` with level titles, icons, progress bar
  - Badges: `CelebrationOverlay.tsx` with spinning badge animations
  - Streaks: Fire emoji, streak count, milestone celebrations
  - Celebration ladder: Full-screen overlays for level up, badge, streak, perfect score, daily goal — auto-closes after 3.5s
- **rAI content recommendations** via `/api/elearning/recommendations` connected to coaching session data.
- **E-learning completion events** tracked in `learning_events`.
- **Unit player flow** — Video → Game → Quiz with step-by-step progress.
- **Daily goals** — 3 activities or 15 minutes, 25 XP bonus.
- **SM-2 spaced repetition schema exists** — `child_unit_progress` has `ease_factor`, `interval_days`, `next_review_at`, `review_count`.
- **5 game engines seeded in DB** — All 5 defined in `el_game_engines` table.

#### ⚠️ CONFLICT
- **Two parallel table schemas** — `el_*` (MVP) and `elearning_*` (v2) tables coexist. Source of truth ambiguous.

#### ❌ MISSING
- **3 game engines** — Sentence Builder, Story Sequence, Rhyme Time need frontend components.
- **Content is 0%** — No word lists, phonics rules, stories, or game content loaded. Only seed data (TH Words - Common with 10 words).
- **SM-2 algorithm wiring** — Schema exists but `calculate_next_review()` function may not be fully integrated into the game completion flow.
- **Age-band content differentiation** — No mechanism to restrict/recommend content by Foundation/Building/Mastery.

#### 🔧 CHANGE NEEDED
1. Build 3 remaining game engine components (Sentence Builder, Story Sequence, Rhyme Time). **Effort: High**
2. Consolidate e-learning tables (pick `el_*` or `elearning_*` as canonical). **Effort: Low**
3. Verify SM-2 integration in game completion → unit progress flow. **Effort: Low**
4. Tag content by age band once loaded. **Effort: Low**
5. Content creation (Rucha's workstream, Foundation first). **Effort: Very High (Content)**

---

## STEP 3: Final Report

---

### Part A: Summary Dashboard

| # | Section | ✅ Aligned | ⚠️ Conflicts | ❌ Missing | Effort to Fix |
|---|---------|-----------|--------------|-----------|---------------|
| 1 | Two-Stage Assessment | Stage 1 complete, data persistence | No diagnostic session type, same form for all sessions | Stage 2 diagnostic, diagnostic form, plan pipeline | **High** |
| 2 | Age-Differentiated Sessions | Scheduling engine, smart slot finder, Calendar/Recall integration | All sessions 45 min, max 9 sessions, uniform frequency | Age band concept, variable counts/durations/frequency, season tracking | **Medium** |
| 3 | Session Template Library | `session_templates` table exists | Table unused (dead schema) | Template content, tagging, plan generation, coach review, adaptation | **High** |
| 4 | Personalized Learning Plans | Infrastructure exists (templates schema, events, Gemini) | — | Entire system (tables, generation, review, adaptation) | **High** |
| 5 | Multi-Season Roadmap | Enrollment chaining, exit assessment, WhatsApp infra | — | Roadmap table, generation, display, WhatsApp delivery, season naming | **High** |
| 6 | Parent Engagement | Dashboard, WhatsApp infra, 82 touchpoints, check-in tracking | Parent as viewer not partner | Oath, checklist, daily nudges, activity logging, leaderboard, streaks | **High** |
| 7 | Coach Intelligence | PreSessionBrief, Prep Hub, post-session form, vectorization | Same form all sessions, missing parent data, ~20/36 data points | Diagnostic form, template display, parent activity, plan revision | **Medium** |
| 8 | Group Classes | Full CRUD, ENROLLED100, Calendar/Recall, age filtering, coach revenue | Age bands mismatch, isolated from main flow | 4/week structure, attendance vectorization, dashboard integration | **Low** |
| 9 | Re-Enrollment & Graduation | Completion flow, exit assessment, certificate, loyalty discount | Exit uses AI format not diagnostic format | Next-season plan, FOMO nudges, video milestone, season tracking, graduation | **Medium** |
| 10 | Data & Intelligence (rAI) | Post-session vectorized, assessment vectorized, hybrid search, HNSW | — | Diagnostic data, parent activity, group attendance, 16 missing form fields | **Medium** |
| 11 | Pricing & Payment | Razorpay LIVE, pricing_plans table, config loader, coupons, revenue split | 12 files hardcode ₹5,999, plan-based not age-based pricing | Age-band pricing, season enrollment, variable coach costs | **Medium** |
| 12 | E-Learning Platform | 2/5 engines, Focus Mode, gamification, rAI recommendations, SM-2 schema | Dual table schemas | 3 game engines, content (0%), SM-2 wiring, age-band content | **High** |

---

### Part B: Critical Blockers (Top 5)

These MUST change before the new methodology can work:

**1. No Age Band System**
- Impact: Blocks EVERY age-differentiated feature (scheduling, pricing, diagnostic forms, templates, content, group classes)
- Current: Children have `age` (integer) but no `age_band` classification
- Fix: Add `age_band` enum (`foundation | building | mastery`) to `children` + `enrollments`, auto-derived from age at enrollment
- Effort: **Low** — schema change + one utility function
- Files: `lib/supabase/database.types.ts`, migration SQL, `app/api/payment/verify/route.ts`

**2. No Diagnostic Session (Session 1 = Regular Session)**
- Impact: Without diagnostic data, cannot generate learning plans or roadmaps. The "24-hour magic moment" cannot happen.
- Current: Session 1 uses same `PostSessionForm` as all sessions. No richer diagnostic capture.
- Fix: Add `diagnostic` session type, build 3 age-specific forms, trigger plan generation on submission
- Effort: **Medium** — new forms + API endpoint + QStash trigger
- Files: `components/coach/PostSessionForm.tsx`, `app/api/coach/sessions/[id]/complete/route.ts`

**3. Fixed Session Count (Max 9, All 45 min)**
- Impact: Cannot offer Foundation (24 sessions, 30 min) or Mastery (12 sessions, 60 min). The scheduling engine is built for exactly 9 sessions.
- Current: `lib/scheduling/config.ts` hardcodes coaching=45min, plan structures max 6 coaching + 3 check-in
- Fix: Create age-band plan configs in `pricing_plans`, update scheduler to read session count/duration from age band
- Effort: **Medium** — config changes + scheduler refactor
- Files: `lib/scheduling/config.ts`, `lib/scheduling/enrollment-scheduler.ts`

**4. No Learning Plan System**
- Impact: Without per-child plans, coaches improvise sessions. Cannot show "today's template" in briefs. Cannot adapt plans. No prerequisite chains.
- Current: `session_templates` table exists but is unused. No `child_learning_plans` table.
- Fix: Create tables, build plan generation (Gemini + templates), build coach review UI
- Effort: **High** — new tables + rAI pipeline + coach UI
- Files: New migration, new API routes, new coach portal components

**5. No Parent Engagement System**
- Impact: Without daily engagement, the program is 9-24 sessions over 12 weeks with nothing in between. V2 says "It is 84 consecutive days of reading engagement." The competitive moat requires parent partnership.
- Current: Parent is passive viewer. No tasks, checklists, nudges, streaks, or leaderboard.
- Fix: Create `parent_tasks` table, build WhatsApp checklist delivery, build daily nudge pipeline, build leaderboard
- Effort: **High** — full new feature area
- Files: New migration, new API routes, new components, QStash cron jobs

---

### Part C: Quick Wins (Partially Built, Minor Changes)

| # | Quick Win | Current State | Change Needed | Effort |
|---|-----------|--------------|---------------|--------|
| 1 | **Add `age_band` field** | `children.age` exists | Add derived enum field + auto-calculation | Low |
| 2 | **Add `season_number`** | `renewed_from_enrollment_id` exists | Add field + auto-increment on renewal | Low |
| 3 | **Fix hardcoded ₹5,999** | 12 files with literal "5999" | Replace with `loadPaymentConfig()` calls | Low |
| 4 | **Stale "January 2026" badge** | Academy page | Update to current month or make dynamic | Trivial |
| 5 | **Group class age bands** | Uses 4-6, 6-8, 8-10, 10-12 | Change to Foundation/Building/Mastery | Low |
| 6 | **Add `diagnostic` session type** | `session_type` supports 4 types | Add to enum, auto-assign on Session 1 | Low |
| 7 | **Group class attendance → learning_events** | Attendance tracked but not vectorized | Write attendance event on completion | Low |
| 8 | **FOMO nudges** | WhatsApp infra exists | Create template + QStash cron for lapsed families | Low |
| 9 | **E-learning table consolidation** | Dual `el_*` and `elearning_*` schemas | Pick canonical, deprecate other | Low |
| 10 | **Parent Oath UI** | Enrollment flow exists | Add oath step with age-specific text | Low |
| 11 | **Extend `session_templates` schema** | Table exists with basic fields | Add `skill_dimension`, `difficulty_level`, `prerequisites` | Low |
| 12 | **Group classes on parent dashboard** | Dashboard exists, classes exist separately | Add group class widget to dashboard | Low-Medium |

---

### Part D: New Builds Required (Don't Exist At All)

| # | New Build | Description | Effort | Dependencies |
|---|-----------|-------------|--------|--------------|
| 1 | **Diagnostic Session Forms** | 3 age-specific forms (Foundation, Building, Mastery) with enriched observation fields | Medium | Age band system |
| 2 | **Plan Generation Engine** | rAI pipeline: diagnostic data → skill gap analysis → template selection → prerequisite ordering → per-child plan | High | Diagnostic form, session template library (content) |
| 3 | **Multi-Season Roadmap** | Table + generation + parent dashboard visualization + WhatsApp delivery + season-end updates | High | Diagnostic form, plan generation |
| 4 | **Parent Task System** | `parent_tasks` table + weekly checklist generation + WhatsApp Monday delivery + single-tap completion + learning_events logging | High | Learning plans (for contextual tasks) |
| 5 | **Daily Nudge Pipeline** | rAI generates daily task from learning plan → QStash schedules morning delivery → WhatsApp template → parent taps "done" | High | Parent task system, learning plans |
| 6 | **Parent Leaderboard** | Weekly cron → calculate parent consistency percentiles → WhatsApp delivery ("Top 20%!") | Medium | Parent task system (needs completion data) |
| 7 | **Coach Plan Review UI** | Page showing upcoming sessions with assigned templates, prep materials, "Request Plan Update" button | Medium | Learning plans |
| 8 | **Plan Revision Flow** | Coach submits revision request with notes → rAI regenerates remaining sessions → coach approves | Medium | Learning plans, plan generation engine |
| 9 | **3 Game Engines** | Sentence Builder, Story Sequence, Rhyme Time frontend components | High | — |
| 10 | **E-Learning Content** | 477-1,178 videos, word banks, phonics rules, game content for all 5 engines | Very High | Game engines, content team (Rucha) |
| 11 | **Next-Season Plan Generation** | rAI generates next-season learning plan at exit assessment, shown in re-enrollment flow | Medium | Plan generation engine, exit assessment |
| 12 | **Graduation Flow** | Separate from season completion. Graduation = all seasons done + exit assessment shows independence. Ceremony page, Reading Buddy invitation | Medium | Season tracking |
| 13 | **Age-Band Pricing** | New `pricing_plans` entries for Foundation/Building/Mastery with variable session counts and durations | Medium | Age band system |

---

### Part E: Recommended Build Order

Based on dependencies (what blocks what):

#### Phase 1: Foundation (Weeks 1-2)
*Everything else depends on these. Smallest effort, highest impact.*

| Task | Effort | Blocks |
|------|--------|--------|
| Add `age_band` enum to `children` + `enrollments` tables | Low | ALL age-differentiated features |
| Add `season_number` to `enrollments` | Low | Roadmap, graduation, re-enrollment |
| Add `diagnostic` to `session_type` enum | Low | Diagnostic form, plan generation |
| Extend `session_templates` schema (add tagging fields) | Low | Template population, plan generation |
| Fix 12 hardcoded ₹5,999 references | Low | Pricing restructure |
| Fix stale "January 2026" badge | Trivial | — |
| Consolidate e-learning table schemas | Low | Clean e-learning development |

**Rucha parallel task:** Begin populating `session_templates` table (40+ templates across 3 bands). This is content work that runs alongside engineering.

---

#### Phase 2: Core Engine (Weeks 2-5)
*The personalization engine — diagnostic → plans → scheduling → roadmap.*

| Task | Effort | Blocks |
|------|--------|--------|
| Build 3 age-specific diagnostic forms (Foundation, Building, Mastery) | Medium | Plan generation, roadmap |
| Create age-band plan configs in `pricing_plans` | Medium | Correct enrollment |
| Update scheduling engine for variable sessions (24/18/12, 30/45/60 min, 2x/1.5x/1x per week) | Medium | Correct session scheduling |
| Create `child_learning_plans` table | Low | Plan generation |
| Build plan generation endpoint (diagnostic → Gemini + templates → ordered plan) | High | Coach brief, daily nudges |
| Create `child_journey_roadmap` table + generation logic | Medium | Parent dashboard, WhatsApp |
| Build roadmap display on parent dashboard | Medium | — |
| Build 24-hour roadmap WhatsApp delivery (QStash trigger after diagnostic) | Medium | — |
| Create age-band pricing in `pricing_plans` | Medium | — |

---

#### Phase 3: Daily Experience (Weeks 4-7)
*What happens between sessions. The "84 days" model.*

| Task | Effort | Blocks |
|------|--------|--------|
| Build Parent Oath UI in enrollment flow | Low | — |
| Create `parent_tasks` table | Low | Checklist, nudges |
| Build weekly checklist generation + Monday WhatsApp delivery | Medium | Parent activity data |
| Build daily nudge pipeline (rAI → QStash → WhatsApp → tap "done" → learning_events) | High | — |
| Add parent activity section to dashboard | Medium | — |
| Build coach plan review page | Medium | — |
| Add "Request Plan Revision" flow | Medium | — |
| Expand post-session form to 36 data points | Medium | — |
| Surface group classes on parent dashboard | Medium | — |
| Align group class age bands to Foundation/Building/Mastery | Low | — |
| Write group class attendance to learning_events | Low | — |

---

#### Phase 4: Intelligence (Weeks 5-8)
*Feed rAI the remaining 70% of data. Make it smarter.*

| Task | Effort | Blocks |
|------|--------|--------|
| Vectorize diagnostic form data into learning_events | Low | Better rAI plans |
| Vectorize parent daily activity logs | Low | Better rAI nudges |
| Vectorize group class attendance | Low | Better rAI recommendations |
| Add parent activity to coach pre-session brief | Low | — |
| Add session template to coach pre-session brief | Low | — |
| Verify SM-2 spaced repetition is wired into game completion flow | Low | — |
| Build 3 remaining game engines (Sentence Builder, Story Sequence, Rhyme Time) | High | Content loading |

---

#### Phase 5: Growth (Weeks 6-8+)
*Re-enrollment, graduation, leaderboard, acquisition funnel.*

| Task | Effort | Blocks |
|------|--------|--------|
| Build anonymous parent leaderboard (weekly percentile via WhatsApp) | Medium | — |
| Build FOMO nudge system for lapsed families | Low | — |
| Build next-season plan generation at exit assessment | Medium | — |
| Build graduation flow (distinct from season completion) | Medium | — |
| Build group class acquisition funnel (₹199-400 pricing, post-class follow-up) | Medium | — |
| Build shareable video milestone feature | Medium | — |
| E-learning content creation — Foundation band first (Rucha's workstream) | Very High | — |
| About page | Low | — |

---

## Appendix: Key File References

| Area | Primary File(s) |
|------|----------------|
| Assessment flow | `app/assessment/AssessmentPageClient.tsx`, `app/api/assessment/analyze/route.ts` |
| Scheduling engine | `lib/scheduling/enrollment-scheduler.ts`, `lib/scheduling/config.ts`, `lib/scheduling/smart-slot-finder.ts`, `lib/scheduling/session-manager.ts` |
| Post-session form | `components/coach/PostSessionForm.tsx`, `app/api/coach/sessions/[id]/complete/route.ts` |
| Pre-session brief | `components/coach/PreSessionBrief.tsx`, `app/coach/sessions/[sessionId]/prep/page.tsx` |
| rAI chat | `app/api/chat/route.ts`, `lib/rai/hybrid-search.ts`, `lib/rai/intent-classifier.ts` |
| Payment flow | `app/api/payment/verify/route.ts`, `app/api/payment/webhook/route.ts`, `lib/razorpay.ts` |
| Config loader | `lib/config/loader.ts`, `lib/config/types.ts` |
| Scheduling config | `lib/scheduling/config.ts`, `lib/scheduling/config-provider.ts` |
| Parent dashboard | `app/parent/dashboard/page.tsx` |
| Coach dashboard | `app/coach/dashboard/page.tsx`, `app/coach/dashboard/CoachDashboardClient.tsx` |
| Completion flow | `app/completion/[enrollmentId]/page.tsx`, `app/api/completion/report/[enrollmentId]/route.ts` |
| E-learning | `app/child/[childId]/play/page.tsx`, `components/elearning/MissionCard.tsx`, `components/elearning/GamificationHeader.tsx` |
| Group classes | `app/classes/ClassesPageClient.tsx`, `app/api/group-classes/sessions/route.ts` |
| WhatsApp Lead Bot | `app/api/whatsapp/webhook/route.ts`, `lib/whatsapp/` (10 files) |
| Communication | `lib/communication/index.ts`, `lib/communication/aisensy.ts`, `lib/communication/whatsapp-cloud.ts` |
| Database types | `lib/supabase/database.types.ts` |

---

**Overall Alignment: ~40%**

The aligned 40% (assessment, scheduling infrastructure, coach session flow, payments, communications, gamification framework) is solid and production-tested. The missing 60% centers on three themes that define V2's competitive moat:

1. **Age Differentiation** — Foundation/Building/Mastery system (data model, scheduling, pricing, content)
2. **Personalization Engine** — Diagnostic → Learning Plans → Session Templates → Roadmap
3. **Daily Engagement** — Parent Oath → Weekly Checklist → Daily Nudges → Leaderboard → "84 days"

The recommended build order starts with low-effort, high-leverage foundation work (Phase 1: ~1 week) and progressively builds the core engine (Phase 2: ~3 weeks), daily experience (Phase 3: ~3 weeks), intelligence layer (Phase 4: ~3 weeks), and growth features (Phase 5: ongoing).

---

*Generated by Claude Code on February 8, 2026*
*Codebase: main branch @ a18f8ab4 | North Star: Purpose & Method V2 (Feb 2026)*
