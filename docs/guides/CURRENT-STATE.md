# Yestoryd MVP — Current State

**Generated:** 2026-02-12 (after Session 5: Final Wiring)
**Build status:** PASS (0 type errors, 0 lint-blocking errors)

---

## Database Schema (135 public tables, 24 views, 39 functions)

### Core Tables

| Table | Cols | Purpose |
|-------|------|---------|
| `children` | 95 | Child profiles, assessment data, leads, learning_profile (JSONB) |
| `parents` | 15 | Parent accounts |
| `coaches` | 83 | Coach profiles, calendar, earnings, schedule rules |
| `enrollments` | 89 | Paid program enrollments (3-month seasons) |
| `scheduled_sessions` | 110 | Coaching sessions (Google Calendar linked), adherence_score |
| `discovery_calls` | 50 | Cal.com + native discovery call bookings |
| `learning_events` | 19 | Unified event tracking with embeddings (RAG), all event types |
| `session_templates` | 20 | Activity flow templates with content_refs |
| `session_activity_log` | 12 | Per-activity logs from Companion Panel |
| `season_learning_plans` | 12 | Per-child weekly plan with template assignments |
| `season_roadmaps` | 13 | Season structure (focus areas, milestones) |

### E-Learning Tables (el_*)

| Table | Cols | Purpose |
|-------|------|---------|
| `el_skills` | 10 | Skill taxonomy (phonics, fluency, etc.) |
| `el_stages` | 11 | Learning stages/levels |
| `el_modules` | 10 | Content modules |
| `el_learning_units` | 42 | Units with coach_guidance, parent_instruction |
| `el_videos` | 27 | Video content assets |
| `el_worksheets` | 12 | Worksheet/PDF assets |
| `el_game_content` | 10 | Game content definitions |
| `el_game_engines` | 15 | Game engine types |
| `el_game_sessions` | 21 | Game play sessions |
| `el_badges` | 15 | Badge definitions |
| `el_child_gamification` | 23 | Child XP, streaks, levels |
| `el_child_badges` | 5 | Awarded badges |
| `el_child_avatars` | 8 | Child avatar selections |
| `el_child_identity` | 15 | Child identity/persona |
| `el_child_unit_progress` | 28 | Unit completion progress |
| `el_child_video_progress` | 19 | Video watch progress |

### Communication Tables

| Table | Cols | Purpose |
|-------|------|---------|
| `communication_templates` | 35 | WhatsApp/email templates by category |
| `communication_logs` | 13 | Sent message history |
| `communication_log` | 21 | Legacy message log |
| `communication_queue` | 19 | Queued messages |
| `communication_analytics` | 18 | Message engagement tracking |
| `communication_preferences` | 12 | Parent notification preferences |
| `parent_communications` | 13 | Parent-specific messages |

### Payment & Revenue Tables

| Table | Cols | Purpose |
|-------|------|---------|
| `bookings` | 19 | Payment records |
| `payments` | 17 | Payment transactions |
| `failed_payments` | 12 | Failed payment tracking |
| `coupons` | 27 | Coupon definitions |
| `coupon_usages` | 18 | Coupon usage tracking |
| `enrollment_revenue` | 22 | Revenue per enrollment |
| `revenue_split_config` | 14 | Coach/platform split rules |
| `coach_earnings` | 10 | Coach earnings records |
| `coach_payouts` | 29 | Payout processing |
| `tds_ledger` | 16 | TDS tax ledger |
| `pricing_plans` | 35 | Pricing plan definitions |

### Coach Tables

| Table | Cols | Purpose |
|-------|------|---------|
| `coach_applications` | 47 | Coach recruitment applications |
| `coach_availability` | 13 | Coach availability windows |
| `coach_availability_slots` | 12 | Individual time slots |
| `coach_schedule_rules` | 16 | Scheduling rule configuration |
| `coach_scores` | 17 | Performance scores |
| `coach_specializations` | 6 | Skill specializations |
| `coach_tier_changes` | 10 | Tier progression history |
| `coach_groups` | 13 | Coach grouping |
| `coach_assignment_status` | 9 | Assignment tracking |
| `coach_reassignment_log` | 10 | Reassignment history |
| `coach_triggered_assessments` | 13 | Coach-initiated assessments |

### Session Management Tables

| Table | Cols | Purpose |
|-------|------|---------|
| `session_change_requests` | 17 | Reschedule/cancel requests |
| `session_holds` | 13 | Session slot holds |
| `session_incidents` | 16 | Session issues/incidents |
| `session_notes` | 11 | Coach session notes |
| `session_duration_rules` | 7 | Duration configuration |
| `scheduling_queue` | 10 | Async scheduling queue |
| `recall_bot_sessions` | 21 | Recall.ai recording sessions |
| `recall_reconciliation_logs` | 6 | Recording reconciliation |

### Other Tables

| Table | Cols | Purpose |
|-------|------|---------|
| `site_settings` | 10 | Dynamic config (NO HARDCODING) |
| `books` | 40 | Reading library |
| `book_collections` | 14 | Book collections |
| `book_reads` | 15 | Reading tracking |
| `reading_goals` | 15 | Reading goals |
| `reading_passages` | 13 | Assessment passages |
| `quiz_bank` | 14 | Quiz question bank |
| `quiz_attempts` | 12 | Quiz attempt records |
| `video_quizzes` | 11 | Video-linked quizzes |
| `nps_responses` | 24 | NPS survey responses |
| `support_tickets` | 17 | Support ticket tracking |
| `testimonials` | 13 | User testimonials |
| `feature_flags` | 6 | Feature flag toggles |
| `parent_daily_tasks` | 12 | Parent practice tasks + streaks |
| `re_enrollment_nudges` | 9 | Re-enrollment nudge tracking |
| `completion_certificates` | 23 | PDF certificate records |
| `referral_credit_transactions` | 12 | Referral program credits |
| `referral_visits` | 9 | Referral link tracking |
| `wa_leads` | 19 | WhatsApp lead bot leads |
| `wa_lead_conversations` | 14 | Lead bot conversations |
| `wa_lead_messages` | 9 | Lead bot messages |
| `whatsapp_templates` | 9 | WhatsApp template registry |
| `group_sessions` | 30 | Group class sessions |
| `group_class_types` | 25 | Group class types |
| `group_session_participants` | 27 | Group class participants |
| `pending_assessments` | 19 | Queued assessments |
| `skill_tags_master` | 8 | Skill taxonomy tags |
| `age_band_config` | 16 | Age band configuration |
| `agreement_versions` | 15 | Legal agreement versions |
| `agreement_signing_log` | 10 | Agreement signatures |
| `cron_logs` | 7 | Cron execution logs |
| `processed_webhooks` | 6 | Webhook idempotency |

---

## API Routes (230 total)

### Assessment & Enrollment
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/assessment/analyze` | POST | AI reading assessment analysis via Gemini |
| `/api/assessment/enrolled` | GET | Get enrolled child assessment data |
| `/api/assessment/final/data` | GET | Final assessment data |
| `/api/assessment/final/submit` | POST | Submit final assessment |
| `/api/assessment/results/[childId]` | GET | Assessment results for child |
| `/api/assessment/retry` | POST | Retry failed assessment |
| `/api/discovery/book` | POST | Book native discovery call |
| `/api/discovery-call/[id]` | GET/PATCH | Discovery call details |
| `/api/discovery-call/[id]/post-call` | POST | Post-call processing |
| `/api/discovery-call/[id]/questionnaire` | GET/POST | Pre-call questionnaire |
| `/api/discovery-call/[id]/send-followup` | POST | Send followup message |
| `/api/discovery-call/[id]/send-payment-link` | POST | Send payment link |
| `/api/discovery-call/assign` | POST | Assign coach to discovery call |
| `/api/discovery-call/create` | POST | Create discovery call record |
| `/api/discovery-call/pending` | GET | Get pending discovery calls |
| `/api/enrollment/[id]` | GET/PATCH | Enrollment details |
| `/api/enrollment/calculate-revenue` | POST | Calculate revenue split |
| `/api/enrollment/pause` | POST | Pause enrollment |
| `/api/payment/create` | POST | Create Razorpay order |
| `/api/payment/verify` | POST | Verify Razorpay payment |
| `/api/payment/webhook` | POST | Razorpay webhook handler |

### Coach Portal
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/coach/sessions` | GET | List coach's sessions |
| `/api/coach/sessions/[id]/brief` | GET | Pre-session brief + learning_profile + parent engagement |
| `/api/coach/sessions/[id]/live` | GET/PATCH | Live session data + content resolution + parent engagement |
| `/api/coach/sessions/[id]/activity-log` | POST | Save activity logs, adherence score, queue parent summary |
| `/api/coach/sessions/[id]/complete` | POST | Mark session complete |
| `/api/coach/sessions/[id]/parent-summary` | POST | Generate AI summary, assign practice materials, WhatsApp send |
| `/api/coach/sessions/[id]/parent-update` | POST | Ad-hoc parent update |
| `/api/coach/sessions/[id]/exit-assessment` | POST | Exit assessment for child |
| `/api/coach/ai-suggestion` | POST | AI session suggestion using learning_profile |
| `/api/coach/children/[id]/plan` | GET/POST | Child learning plan |
| `/api/coach/children/[id]/plan/approve` | POST | Approve learning plan |
| `/api/coach/diagnostic/[id]` | GET/POST | Diagnostic session data |
| `/api/coach/availability` | GET/POST | Coach availability management |
| `/api/coach/schedule-rules` | GET/POST | Scheduling rules |
| `/api/coach/earnings` | GET | Coach earnings |
| `/api/coach/profile` | GET/PATCH | Coach profile |

### Parent Portal
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/parent/dashboard` | GET | Parent dashboard summary |
| `/api/parent/enrolled-child` | GET | Get enrolled child details |
| `/api/parent/progress` | GET | Learning progress |
| `/api/parent/roadmap/[childId]` | GET | Season roadmap + timeline |
| `/api/parent/tasks/[childId]` | GET | Daily practice tasks |
| `/api/parent/tasks/[childId]/complete` | POST | Mark task complete |
| `/api/parent/content-viewed` | POST | Track practice content viewing |
| `/api/parent/report/[enrollmentId]` | GET | Progress report |
| `/api/parent/re-enroll/[childId]` | POST | Re-enrollment |
| `/api/parent/referral` | GET/POST | Referral program |
| `/api/parent/session/reschedule` | POST | Reschedule session |

### Admin
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/crm/leads` | GET | CRM leads list |
| `/api/admin/crm/coaches` | GET | CRM coaches list |
| `/api/admin/crm/funnel` | GET | Funnel analytics |
| `/api/admin/crm/pipeline-stats` | GET | Pipeline stats |
| `/api/admin/crm/daily-stats` | GET | Daily stats |
| `/api/admin/crm/export` | GET | Data export |
| `/api/admin/crm/interactions` | GET/POST | Lead interactions |
| `/api/admin/templates` | GET/POST | Session template management |
| `/api/admin/templates/[id]` | GET/PATCH | Template details + content picker |
| `/api/admin/content-search` | GET | Content search for admin picker |
| `/api/admin/completion/list` | GET | Completion candidates |
| `/api/admin/settings` | GET/PATCH | Site settings |
| `/api/admin/dashboard` | GET | Admin dashboard stats |
| `/api/admin/payments` | GET | Payment management |
| `/api/admin/payouts` | GET/POST | Payout management |
| `/api/admin/coaches/[id]/specializations` | GET/POST | Coach specializations |
| `/api/admin/coach-applications` | GET/POST | Coach applications |
| `/api/admin/pricing` | GET/POST | Pricing plans |
| `/api/admin/feature-flags` | GET/POST | Feature flags |

### E-Learning
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/elearning/session` | GET/POST | E-learning session management |
| `/api/elearning/unit/[unitId]` | GET | Unit details + content |
| `/api/elearning/video/[videoId]` | GET | Video details |
| `/api/elearning/progress` | GET | Child progress |
| `/api/elearning/complete` | POST | Mark unit complete |
| `/api/elearning/gamification` | GET | Gamification stats |
| `/api/elearning/recommendations` | GET | AI recommendations |
| `/api/elearning/quiz/[quizId]` | GET | Quiz questions |
| `/api/elearning/submit-quiz` | POST | Submit quiz attempt |
| `/api/elearning/dashboard` | GET | E-learning dashboard |

### Webhooks
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/webhooks/cal` | POST | Cal.com discovery call events |
| `/api/webhooks/recall` | POST | Recall.ai transcripts + analysis |
| `/api/payment/webhook` | POST | Razorpay payment events |
| `/api/webhooks/whatsapp-cloud` | GET/POST | AiSensy WhatsApp bot |
| `/api/webhooks/aisensy/goals` | POST | AiSensy goal capture |
| `/api/whatsapp/webhook` | GET/POST | Meta WhatsApp Lead Bot |

### Background Jobs (QStash consumers)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/jobs/enrollment-complete` | POST | Post-enrollment setup |
| `/api/jobs/process-session` | POST | Session post-processing |
| `/api/jobs/goals-capture` | POST | Goal capture processing |
| `/api/jobs/recall-reconciliation` | POST | Recall recording reconciliation |
| `/api/jobs/retry-scheduling` | POST | Retry failed scheduling |
| `/api/jobs/update-calendar-attendee` | POST | Update Google Calendar |

### Cron Jobs (12)
| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/coach-engagement` | Daily | Coach engagement metrics |
| `/api/cron/coach-reminders-1h` | Hourly | 1-hour session reminders |
| `/api/cron/compute-insights` | Daily | Compute admin insights |
| `/api/cron/daily-lead-digest` | Daily | Lead digest to admin |
| `/api/cron/discovery-followup` | Daily | Discovery call followups |
| `/api/cron/enrollment-lifecycle` | Daily | Enrollment status transitions |
| `/api/cron/lead-scoring` | Daily | AI lead scoring |
| `/api/cron/monthly-payouts` | Monthly | Coach payout processing |
| `/api/cron/payment-reconciliation` | Daily | Payment reconciliation |
| `/api/cron/process-coach-unavailability` | Daily | Handle coach unavailability |
| `/api/cron/re-enrollment-nudge` | Daily | Re-enrollment nudge messages |
| `/api/cron/session-completion-nudge` | Daily | Nudge coaches to complete sessions |

---

## Component Directories

| Directory | Files | Purpose |
|-----------|-------|---------|
| `components/coach/` | 41 | Coach portal UI (SessionCard, live-session panel, diagnostic forms) |
| `components/shared/` | 20 | Shared UI components |
| `components/ui/` | 17 | Base UI components (shadcn) |
| `components/child/` | 14 | Child-facing components |
| `components/elearning/` | 14 | E-learning module UI |
| `components/mini-challenge/` | 7 | Mini-challenge game components |
| `components/assessment/` | 5 | Assessment flow UI |
| `components/parent/` | 5 | Parent portal components |
| `components/chat/` | 3 | rAI chat interface |
| `components/config/` | 3 | Config management UI |
| `components/support/` | 3 | Support ticket UI |
| `components/admin/` | 2 | Admin panel components |
| `components/booking/` | 2 | Booking flow UI |
| `components/games/` | 2 | Game UI components |
| `components/checkout/` | 1 | Checkout flow |
| `components/icons/` | 1 | Custom icons |
| `components/layouts/` | 1 | Layout components |
| `components/navigation/` | 1 | Navigation components |

### Lib Directories

| Directory | Files | Purpose |
|-----------|-------|---------|
| `lib/scheduling/` | 15 | Smart slot finder, enrollment scheduler, config |
| `lib/whatsapp/` | 14 | WhatsApp Lead Bot (intent, handlers, templates) |
| `lib/rai/` | 11 | rAI chatbot (context, prompts, RAG, hybrid search) |
| `lib/communication/` | 4 | AiSensy + SendGrid senders |
| `lib/supabase/` | 4 | Supabase client, types, server utils |
| `lib/utils/` | 4 | Phone normalization, formatters |
| `lib/config/` | 3 | Typed config loaders (NO HARDCODING) |
| `lib/mini-challenge/` | 3 | Mini-challenge content + logic |
| `lib/ai/` | 3 | Gemini AI utilities |
| `lib/business/` | 3 | Business logic (revenue, matching) |
| `lib/hooks/` | 2 | React hooks |
| `lib/google/` | 2 | Google Calendar + OAuth |
| `lib/constants/` | 2 | Structural constants |
| `lib/settings/` | 2 | Settings utilities |

---

## Session Manifests Summary (Last 5)

### Session 1: E-Learning Consolidation (2026-02-11)
- **Purpose:** Migrate 3 parallel e-learning schemas onto canonical `el_*` tables
- **Files modified:** 13 (all e-learning routes + gamification + admin)
- **Migration:** `20260211_elearning_consolidation.sql` — created `el_worksheets`, `el_game_engines`, consolidated views
- **Impact:** Zero legacy table references remaining

### Session 2: Content Bridge (2026-02-11)
- **Purpose:** Link session templates to el_* content assets via `content_refs`
- **Files created:** 2 (content-search API, seed migration)
- **Files modified:** 3 (types, admin template editor, enrollment scheduler)
- **Impact:** Templates can now reference videos/worksheets/games per activity step

### Session 3: Panel Merge (2026-02-11)
- **Purpose:** Display resolved content in Companion Panel + merge Recall.ai and companion data streams
- **Files modified:** 7 (live route, activity-log, process-session, InfoTab, ActivityTab, LiveSessionPanel, types)
- **Impact:** Coaches see content cards with guidance during live sessions; learning events are unified

### Session 4: Profile + Adherence (2026-02-11)
- **Purpose:** Gemini-synthesized child learning_profile + adherence score calculation
- **Files modified:** 4 (parent-summary, brief, ai-suggestion, activity-log)
- **Migration:** `20260211_child_learning_profile.sql` — added learning_profile, adherence_score, adherence_details
- **Impact:** AI builds persistent child profile; adherence tracked per session

### Session 5: Final Wiring (2026-02-12)
- **Purpose:** Parent practice loop + coach engagement visibility
- **Files modified:** 6 (parent-summary, brief, live, journey page, InfoTab, types)
- **Files created:** 1 (content-viewed API)
- **New event type:** `parent_practice_assigned`
- **Impact:** Full cycle: session → practice materials → parent viewing → coach visibility

---

## Learning Event Types (Registry)

| Event Type | Created By | Purpose |
|------------|-----------|---------|
| `session` | Recall.ai webhook | AI transcript + analysis |
| `session_companion_log` | Activity-log POST | Coach-logged activity data |
| `diagnostic_assessment` | Assessment flow | Initial diagnostic results |
| `parent_session_summary` | Parent-summary POST | AI-generated parent WhatsApp summary |
| `activity_struggle_flag` | Activity-log POST | Per-activity struggle markers |
| `parent_practice_assigned` | Parent-summary POST | Practice materials auto-assigned to parent |

---

## Known Tech Debt

| # | Item | Severity | Location |
|---|------|----------|----------|
| 1 | **Untyped Supabase client in enrollment-scheduler** | Low | `lib/scheduling/enrollment-scheduler.ts` uses `createClient()` without `<Database>` generic; queries cast with `as any` |
| 2 | **13 deprecated tables still in schema** | Low | `_deprecated_*` tables exist but have zero code references |
| 3 | **Duplicate communication tables** | Low | Both `communication_log` (21 cols) and `communication_logs` (13 cols) exist |
| 4 | **`children` table has 95 columns** | Medium | Candidate for vertical partitioning (assessment data, profile, contact info) |
| 5 | **`scheduled_sessions` table has 110 columns** | Medium | Candidate for partitioning (scheduling, completion, recording, billing) |
| 6 | **No practice reminder cron** | Low | Parents get materials in WhatsApp summary but no follow-up nudge if not opened |
| 7 | **AiSensy template character limits** | Low | Practice materials appended to summary text; may truncate if many items |
| 8 | **`el_learning_units.parent_instruction` unused** | Low | Column exists but not resolved in live route or parent-summary |
| 9 | **E-learning content gap** | High | Video player UI exists but needs 477-1,178 videos for full curriculum |
| 10 | **No automated test suite** | High | Only one test file (`__tests__/coach-journey.test.ts`) with broken imports |
| 11 | **`elearning_game_engines` duplicate** | Low | Both `el_game_engines` and `elearning_game_engines` exist with similar schemas |
| 12 | **Missing index on learning_events** | Medium | `event_type + child_id + created_at` composite index would speed up profile synthesis and engagement queries |
