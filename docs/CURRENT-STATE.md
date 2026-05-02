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
| `parent_daily_tasks` | 19 | Parent practice tasks + streaks + photo + intelligence (difficulty_rating, practice_duration, content_item_id, photo_analysis — Mar 2026) |
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

## Architecture Decisions

Reverse-chronological log of significant architecture commitments. One entry per decision. Add new entries at the top.

### 2026-04-29 — Spine principle audit findings (read-only)

**Context:** After committing the BSP migration decision (62f8bb2c), ran a two-pass audit to validate the strategy session's claims about codebase state before locking the 5-block spine consolidation roadmap. First pass: 25 claims across comms, codebase architecture, and BSP migration readiness. Second pass: three targeted follow-up checks on the gaps from pass one.

**Audit outcome — pass 1 (25 claims):**
- ✅ 7 verified
- ⚠ 9 partial
- ❌ 7 incorrect
- ❓ 2 undetermined (require Meta Business Manager UI access)

**Material findings that change the plan:**

1. **Lead Bot already has full Meta Cloud send capability.** `lib/whatsapp/cloud-api.ts` exports `sendTemplate`, `sendButtons`, `sendList`, `sendText`, `sendTextWithPreview`, `markAsRead` (6 functions). BSP migration outbound is not net-new code — only an adapter translating positional `wa_variables[]` to Meta `components[{type:'body', parameters[]}]`. Block 2 timeline reduced from ~4 weeks to ~2 weeks.

2. **Pillar 2B Rule 7 (`assertAiSensyResponseOk`) is exported but never invoked.** notify.ts:475 checks `result.success` directly instead of calling the validator. Silent-fail detection promised but not implemented. Block 1 priority.

3. **`direct:*` template-code bypass is historical, not ongoing.** 2 caller sites in `app/api/backops/command/route.ts:101, 306` produce the bypass when called without `meta.templateCode`. Last fired Apr 18-19, before unification migration 20260421130000 landed. Fix is a 2-line replace per site. Schedule in Block 1 cleanup; not a Block 2 prerequisite.

4. **`coach_session_reminder` (no v3) is not a duplicate.** All 26 "sends" in 30-day window were AiSensy 406 errors ("Campaign is Not Live") from a stale caller, already resolved by the same Apr 21 unification migration. Forensic residue, not a parallel reminder path.

5. **Pre-existing audit docs in repo:** `docs/wa-audit-2026-04-16.md` and `docs/wa-validation-audit-2026-04-19.md` cover the same template-alignment incident class that motivated the spine principle. Their action items have largely been completed via the Apr 21 migration. Read before locking Block 1 scope to avoid redundant work.

**Audit outcome — pass 2 (template inventory):**
- communication_templates total rows: 76
- Active (is_active=true): 55
- Active + Meta-approved (is_active=true AND wa_approved=true): 54 — this is the BSP migration scope
- Active templates that fired in last 30 days: 13
- Active templates with zero 30-day sends: 41 (mostly low-frequency triggers; parent_session_reminder_1h_v3 / _24h_v3 are notable — coach equivalents fire reliably, parent equivalents don't)
- Version-drift duplicates: 2 base names (parent_tuition_low_balance, parent_tuition_onboarding); both clean (one active, one retired per base)

**Validator state (lib/communication/validate-notification.ts):**
- 8 rules documented; 6 wired into checks array; Rule 2 is a stub (returns ok:true unconditionally); Rule 7 exported but unwired
- Mode hardcoded `'warn'` at notify.ts:393; Rules 3 and 7 always enforce regardless (Rule 7 enforcement is theoretical until invoked)

**Adapter shape captured for BSP migration:**
- `lib/communication/aisensy.ts:33-42` input: `{to, templateName, variables[], buttons?, source?, meta?}`
- AiSensy outbound payload: `{apiKey, campaignName: templateName, destination, userName: 'Yestoryd', templateParams: variables}`
- Meta Cloud equivalent in `lib/whatsapp/cloud-api.ts:185` already exists: `sendTemplate(to, templateName, languageCode, components)`
- Translation needed: `variables[]` → `components[{type:'body', parameters[]}]`

**Schema additions for BSP migration:**
- `language_code` (varchar) — Meta API requires per-send (NOT FOUND in current schema)
- `meta_template_id` (varchar, nullable) — useful for reconciliation, optional
- `components_template` (jsonb, nullable) — derivable from wa_variables, optional

**Open questions deferred to investigation:**
- `parent_session_reminder_1h_v3` / `parent_session_reminder_24h_v3` — zero 30-day sends despite coach equivalents firing reliably. Either intentional (parents get reminders via different path) or missing caller. 5-minute spot check before BSP migration.
- AiSensy webhook handlers count: 3 (catch-all, feedback, goals), not 6 as previously claimed. Confirmed via direct ls of app/api/webhooks/aisensy/.
- Twilio code path is reachable at `app/api/coach/send-status-notification/route.ts:443-485`. Env vars unset in production assumed but not verified. Block 3 cleanup target.

**Roadmap confidence after audit:**
- Block 1 (May, stabilization): NEEDS REVISION — scope smaller than originally framed (deprecated tables done, tests exist, hardcoded pricing 1 file not 20). Real work: wire Rule 7, fix 2 backops bypasses, retire `lib/razorpay.ts:calculateRevenueSplit` competitor to Calculator B.
- Block 2 (June, comms spine consolidation): SOLID, FASTER — sendTemplate already exists; 1-2 weeks not 4. Add language_code column; add 'leadbot' channel branch in notify.ts; build adapter translation.
- Block 3 (July, comms spine cleanup): SOLID — 25 sendCommunication callers across 17 files; Resend port + notification_preferences gating; Twilio code deletion.
- Block 4 (August+, cross-domain spine): SOLID — auth resolver, admin_emails parsers consolidate to lib/config/loader.ts:requireJsonArray, retire lib/razorpay.ts competitor, 359→target as any sweep.
- Block 5 (September+, borrowed UI): SOLID — no audit findings against it.

**Kill-switch (Phase B, implemented Task 4):** `site_settings.leadbot_live_sends` (default false). Has 5-min flip latency due to in-process cache TTL — for immediate stop, flip `channel='aisensy'` on affected templates (DB-row rollback is the belt-and-suspenders fallback).

**Status:** Audit complete. Findings folded into roadmap. Implementation deferred to dedicated sessions per block.

**Reference:** Two-pass audit conducted 2026-04-29. Full audit reports retained in chat session context.

### 2026-04-28 — WhatsApp BSP migration: AiSensy → Meta Cloud direct

**Context:** AiSensy free tier (Basic ₹999/mo) blocks inbound webhooks. Webhook unlock requires Pro Plan upgrade (~₹3,200/mo) PLUS Webhook Add-on (₹24,000 + 18% GST = ₹28,320/yr). Combined ~₹66,720/yr just to enable parent quick-reply button replies and other inbound traffic.

**Decision:** Migrate outbound from AiSensy → Meta Cloud direct on Lead Bot WABA (8591). Keep AiSensy Basic running for 6 months as fallback hedge.

**Rationale:**
- AiSensy upgrade economics don't make sense at our stage. ₹66K/yr = 11x one Continuation enrollment.
- Lead Bot WABA (8591) is already on Meta Cloud direct with full inbound webhook plumbing wired and tested at `app/api/whatsapp/webhook/route.ts` and `app/api/whatsapp/process/route.ts`.
- Lead Bot WABA is a separate WABA from AiSensy WABA — clean quality rating, no inheritance from April 24 mass-pause event.
- Eliminates AiSensy Campaign drift class (Pillar 2B Rule 2 stub becomes irrelevant). Consistency triangle becomes a line: DB row ↔ Meta-approved template ↔ Code caller.
- One number for parents (8591) for both inbound and outbound — cleaner UX than current dual-number setup (8976 outbound, 8591 wa.me).

**Trade-offs accepted:**
- ~25-30 hours engineering investment over 4 weeks vs. paying ~₹66K/yr indefinitely.
- ~50 templates need re-approval on Lead Bot WABA (Meta Business Suite UI, 1-24h per template).
- Lose AiSensy dashboard/agent UI — not used today by Rucha, acceptable.
- Lose BSP support layer — already debugging Meta-side issues directly anyway.

**Migration shape (4 weeks):**
- Week 1: Verify Lead Bot WABA tier/verification/access tokens. Build `lib/communication/leadbot.ts` adapter mirroring `aisensy.ts` shape. Add `channel='leadbot'` routing in `notify.ts`. Pilot with `parent_otp_v3`.
- Week 2: Migrate 6 hot-path templates currently firing in production (`parent_practice_tasks_v3`, `coach_session_reminder_1h_v3`, `admin_daily_health_v3`, `parent_practice_nudge_v3`, `parent_tuition_onboarding_v4`, `parent_otp_v3`).
- Week 3: Submit `parent_tuition_low_balance_v5` with native quick-reply buttons on Lead Bot WABA. Wire 4 ack templates. **This is when two-way renewal flow goes live without paying for AiSensy webhook.**
- Week 4: Long-tail migration + decommission planning. Wired-but-dormant templates can stay on AiSensy until needed.

**Reverted alternatives (do not revisit without new information):**
- AiSensy PRO + Webhook upgrade — economics killed it (~₹66K/yr).
- URL-redirect renewal flow (Path D) — superseded by native buttons on Lead Bot once outbound migration ships.
- Big-bang migration in one sprint — phased is lower risk given solo engineering bandwidth.

**Pre-flight verification needed before Week 1 implementation:**
1. Lead Bot WABA verification status (Business Suite → Settings → Business Info)
2. Lead Bot WABA quality rating + messaging tier (WhatsApp Manager → Phone Numbers → 8591 → Quality)
3. Existing template approvals on Lead Bot WABA (WhatsApp Manager → Message Templates)
4. Lead Bot phone number display name as it appears to parents in WhatsApp
5. System user with `whatsapp_business_messaging` permission + non-expiring access token

**Status:** Decision committed. Pre-flight checks pending. Implementation deferred to dedicated session.

**Reference:** Discussed in chat session on 2026-04-28 covering the full path comparison (AiSensy PRO vs Lead Bot migration vs hybrid vs web-form) and Yash @ AiSensy's quote breakdown.

---

## Known Tech Debt

| # | Item | Severity | Location |
|---|------|----------|----------|
| 1 | **Untyped Supabase client in enrollment-scheduler** | Low | `lib/scheduling/enrollment-scheduler.ts` uses `createClient()` without `<Database>` generic; queries cast with `as any` |
| 2 | **`children` table has 95 columns** | Medium | Candidate for vertical partitioning (assessment data, profile, contact info) |
| 3 | **`scheduled_sessions` table has 110 columns** | Medium | Candidate for partitioning (scheduling, completion, recording, billing) |
| 4 | **No practice reminder cron** | Low | Parents get materials in WhatsApp summary but no follow-up nudge if not opened |
| 5 | **AiSensy template character limits** | Low | Practice materials appended to summary text; may truncate if many items |
| 6 | **`el_learning_units.parent_instruction` unused** | Low | Column exists but not resolved in live route or parent-summary |
| 7 | **E-learning content gap** | High | Video player UI exists but needs 477-1,178 videos for full curriculum |
| 8 | **Partial test coverage — 12 test files** | Medium | `tests/` has communication, enrollment, payout, referral suites; `__tests__/` has coach-journey, scheduling (6 files), utils/date-format. Heavy coverage on payouts and scheduling. Thin coverage on payments end-to-end, comms end-to-end, cron orchestration. |
| 9 | **`elearning_game_engines` duplicate** | Low | Both `el_game_engines` and `elearning_game_engines` exist with similar schemas |
| 10 | **Missing index on learning_events** | Medium | `event_type + child_id + created_at` composite index would speed up profile synthesis and engagement queries |
| 11 | **359 `as any` type assertions across 152 files** | Medium | platform-wide; top hotspots: `app/api/admin/completion/list` (12), `lib/gamification.ts` (10), `app/api/intelligence/capture` (8), `app/api/coach/sessions/[id]/parent-summary` (8) |
| 12 | **1 production file with hardcoded pricing** | Low | `lib/whatsapp/handlers/faq.ts` — matches 1499/5999/6999 pattern; needs review whether it's editorial copy or dynamic program-label rendering |
