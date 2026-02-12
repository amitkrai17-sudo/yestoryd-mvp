# Yestoryd MVP — Complete Codebase Inventory

**Generated**: 8 February 2026
**Source**: Live Supabase database + full codebase scan
**Project**: agnfzrkrpuwmtjulbbpd (Tokyo region)

---

## Table of Contents

1. [Summary Dashboard](#1-summary-dashboard)
2. [Database Tables](#2-database-tables)
3. [API Routes](#3-api-routes)
4. [Frontend Pages](#4-frontend-pages)
5. [React Components](#5-react-components)
6. [Library Modules](#6-library-modules)
7. [External Integrations](#7-external-integrations)
8. [Configuration & Infrastructure](#8-configuration--infrastructure)

---

## 1. Summary Dashboard

| Category | Count |
|----------|-------|
| Database tables (live) | ~130 |
| Database table definitions (TypeScript) | 196 |
| API route files | 155+ |
| Frontend pages | 76 |
| React components | 130+ |
| Library modules | 95+ |
| Supabase migrations | 18 |
| External integrations | 10 |

---

## 2. Database Tables

### 2.1 Live Table Stats (sorted by total size)

> From `supabase inspect db table-stats --linked` — 8 Feb 2026

| Table | Rows | Total Size | Seq Scans |
|-------|------|------------|-----------|
| child_rag_profiles | 0 | 1,248 kB | 73 |
| learning_events | 39 | 1,000 kB | 626 |
| activity_log | 1,098 | 528 kB | 83 |
| ab_test_events | 873 | 456 kB | 55 |
| scheduled_sessions | 31 | 456 kB | 4,815 |
| children | 38 | 440 kB | 13,460 |
| coaches | 1 | 328 kB | 12,696 |
| enrollments | 7 | 248 kB | 4,140 |
| discovery_calls | 10 | 240 kB | 1,151 |
| site_settings | 207 | 224 kB | 5,037 |
| coach_applications | 18 | 216 kB | 256 |
| books | 5 | 208 kB | 107 |
| bookings | 25 | 200 kB | 145 |
| communication_templates | 35 | 184 kB | 129 |
| recall_bot_sessions | 14 | 144 kB | 389 |
| parents | 7 | 144 kB | 1,981 |
| elearning_units | 9 | 136 kB | 74 |
| wa_lead_messages | 38 | 128 kB | 6 |
| coupons | 4 | 128 kB | 73 |
| payments | 7 | 128 kB | 946 |
| wa_leads | 2 | 128 kB | 8 |
| group_sessions | 4 | 120 kB | 141 |
| agreement_signing_log | 0 | 120 kB | 81 |
| group_session_participants | 0 | 120 kB | 114 |
| el_learning_units | 63 | 120 kB | 67 |
| child_gamification | 1 | 120 kB | 271 |
| el_skills | 63 | 112 kB | 54 |
| communication_log | 2 | 112 kB | 83 |
| wa_lead_conversations | 2 | 112 kB | 7 |
| enrollment_revenue | 0 | 112 kB | 155 |
| coach_schedule_rules | 12 | 104 kB | 42 |
| coach_availability_slots | 2 | 96 kB | 36 |
| coach_availability | 1 | 96 kB | 74 |
| child_video_progress | 0 | 96 kB | 805 |
| interactions | 0 | 96 kB | 93 |
| learning_videos | 20 | 96 kB | 201 |
| pricing_plans | 4 | 96 kB | 4,861 |
| child_unit_progress | 0 | 96 kB | 49 |
| el_videos | 63 | 96 kB | 52 |
| el_child_unit_progress | 1 | 80 kB | 52 |
| video_quizzes | 30 | 80 kB | 78 |
| enrollment_events | 1 | 80 kB | 68 |
| elearning_content_pools | 1 | 80 kB | 50 |
| reading_skills | 17 | 80 kB | 85 |
| communication_logs | 15 | 80 kB | 56 |
| push_subscriptions | 1 | 80 kB | 4 |
| admin_insights | 8 | 80 kB | 80 |
| group_class_types | 4 | 80 kB | 258 |
| child_skill_progress | 0 | 80 kB | 84 |
| group_class_coupons | 5 | 80 kB | 70 |
| elearning_skills | 4 | 80 kB | 48 |
| agreement_versions | 1 | 72 kB | 201 |
| coach_tier_changes | 0 | 64 kB | 71 |
| coach_payouts | 0 | 64 kB | 270 |
| book_collections | 5 | 64 kB | 69 |
| in_app_notifications | 7 | 64 kB | 3 |
| revenue_split_config | 2 | 64 kB | 149 |
| child_badges | 0 | 64 kB | 237 |
| skill_tags_master | 27 | 64 kB | 88 |
| feature_flags | 11 | 64 kB | 4,427 |
| tds_ledger | 0 | 64 kB | 97 |
| homework_assignments | 0 | 64 kB | 643 |
| reading_passages | 8 | 64 kB | 86 |
| communication_queue | 0 | 64 kB | 86 |
| learning_modules | 12 | 64 kB | 79 |
| el_game_content | 13 | 64 kB | 52 |
| elearning_sub_skills | 4 | 64 kB | 47 |
| book_reads | 0 | 64 kB | 72 |
| el_modules | 15 | 64 kB | 53 |
| coaching_tips | 18 | 64 kB | 84 |
| launch_waitlist | 0 | 56 kB | 6 |
| book_requests | 0 | 56 kB | 360 |
| child_daily_goals | 0 | 56 kB | 45 |
| completion_certificates | 0 | 56 kB | 60 |
| verification_tokens | 0 | 56 kB | 27 |
| coupon_uses | 0 | 56 kB | 44 |
| messages | 0 | 56 kB | 37 |
| admin_audit_log | 0 | 56 kB | 36 |
| communication_analytics | 1 | 56 kB | 3 |
| reading_ranks | 5 | 48 kB | 52 |
| el_stages | 3 | 48 kB | 52 |
| nps_responses | 0 | 48 kB | 123 |
| quiz_bank | 2 | 48 kB | 99 |
| el_game_engines | 5 | 48 kB | 50 |
| learning_levels | 5 | 48 kB | 109 |
| referral_credit_transactions | 0 | 48 kB | 143 |
| testimonials | 5 | 48 kB | 4,597 |
| whatsapp_templates | 8 | 48 kB | 118 |
| el_badges | 12 | 48 kB | 50 |
| support_tickets | 0 | 48 kB | 85 |
| lead_status_history | 0 | 48 kB | 92 |
| elearning_game_engines | 5 | 48 kB | 46 |
| achievement_badges | 20 | 48 kB | 86 |
| elearning_quizzes | 1 | 48 kB | 46 |
| group_class_certificates | 0 | 48 kB | 71 |
| coach_scores | 0 | 48 kB | 89 |
| agreement_config | 27 | 48 kB | 308 |
| time_buckets | 5 | 48 kB | 31 |
| coach_groups | 5 | 48 kB | 384 |
| el_child_avatars | 1 | 48 kB | 50 |
| el_game_sessions | 0 | 40 kB | 52 |
| processed_webhooks | 0 | 40 kB | 42 |
| proactive_notifications | 0 | 40 kB | 108 |
| session_holds | 0 | 40 kB | 59 |
| coach_assignment_status | 0 | 40 kB | 62 |
| el_child_gamification | 1 | 40 kB | 50 |
| session_notes | 0 | 40 kB | 96 |
| recall_reconciliation_logs | 0 | 40 kB | 4 |
| learning_games | 0 | 40 kB | 64 |
| group_class_waitlist | 0 | 40 kB | 91 |
| session_incidents | 0 | 40 kB | 248 |
| coupon_usages | 0 | 40 kB | 155 |
| session_duration_rules | 6 | 32 kB | 33 |
| curriculum_template | 25 | 32 kB | 101 |
| enrollment_terminations | 0 | 32 kB | 3 |
| termination_logs | 0 | 32 kB | 295 |
| communication_preferences | 0 | 32 kB | 3 |
| wcpm_benchmarks | 15 | 32 kB | 80 |
| referral_visits | 0 | 32 kB | 243 |
| session_templates | 3 | 32 kB | 80 |
| el_child_badges | 0 | 32 kB | 51 |
| xp_levels | 10 | 32 kB | 59 |
| parent_communications | 0 | 32 kB | 799 |
| reading_goals | 0 | 32 kB | 280 |
| quiz_attempts | 0 | 32 kB | 96 |
| system_schedule_defaults | 7 | 32 kB | 32 |
| child_game_progress | 0 | 32 kB | 47 |
| payment_retry_tokens | 0 | 32 kB | 3 |
| book_collection_items | 0 | 32 kB | 70 |
| failed_payments | 0 | 24 kB | 16 |
| video_watch_sessions | 0 | 24 kB | 67 |
| coach_triggered_assessments | 0 | 24 kB | 60 |
| el_child_video_progress | 0 | 24 kB | 52 |
| cron_logs | 0 | 24 kB | 52 |
| pending_assessments | 0 | 24 kB | 2 |
| el_child_identity | 0 | 24 kB | 50 |
| coach_reassignment_log | 0 | 24 kB | 2 |
| scheduling_queue | 0 | 24 kB | 2 |
| coach_specializations | 0 | 24 kB | 2 |
| phone_backup_20260117 | 17 | 16 kB | 22 |
| coach_earnings | 0 | 16 kB | 265 |
| session_change_requests | 0 | 16 kB | 1 |

### 2.2 Core Entity Tables (Key Columns)

#### children (38 rows, 88 columns)
Core child profile — the central entity of the system.
- **Identity**: id, parent_id, name, age, date_of_birth, gender, grade, school_name, profile_image_url
- **Assessment**: reading_level, wcpm_score, accuracy_percentage, comprehension_score, fluency_score, expression_score, cambridge_level, current_level, assessment_audio_url, assessment_status, assessment_passage_title
- **Program**: enrollment_status, program_type, sessions_completed, total_sessions, coach_id, assigned_coach_id
- **E-Learning**: avatar_name, avatar_type, avatar_color, xp_total, xp_level, streak_days, coins
- **Timestamps**: created_at, updated_at, enrolled_at, assessment_completed_at

#### parents (7 rows)
- id, user_id, name, email, phone, whatsapp_number, referral_code, referral_source, created_at

#### coaches (1 row)
- id, user_id, name, email, phone, status, tier, specializations, bio, profile_image_url, calendar_id, subdomain, referral_code, commission_rate, created_at

#### enrollments (7 rows)
- id, child_id, parent_id, coach_id, status, program_type, total_sessions, sessions_completed, start_date, end_date, pause_start, pause_end, pricing_plan_id, amount_paid, coupon_id, created_at

#### scheduled_sessions (31 rows)
- id, enrollment_id, child_id, coach_id, session_number, session_type, status, scheduled_date, scheduled_time, duration_minutes, google_calendar_event_id, recall_bot_id, meeting_link, notes, created_at

#### learning_events (39 rows)
- id, child_id, coach_id, session_id, event_type, event_data, skills_observed, areas_of_improvement, embedding, created_at

#### payments (7 rows)
- id, enrollment_id, parent_id, amount, currency, status, razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_method, created_at

#### pricing_plans (4 rows)
- id, name, display_name, description, price, original_price, currency, duration_months, total_sessions, session_duration_minutes, features, is_active, sort_order, created_at

#### discovery_calls (10 rows)
- id, parent_id, coach_id, child_name, child_age, phone, email, status, cal_booking_uid, scheduled_at, questionnaire_data, post_call_notes, lead_score, source, created_at

#### site_settings (207 rows)
- id, key, value, section, label, type, options, sort_order, is_public, created_at, updated_at

### 2.3 E-Learning Tables (Dual Schema)

**el_* schema** (newer, more populated):
| Table | Rows | Purpose |
|-------|------|---------|
| el_learning_units | 63 | Learning unit definitions |
| el_skills | 63 | Skill definitions |
| el_videos | 63 | Video content |
| el_modules | 15 | Module groupings |
| el_game_content | 13 | Game content items |
| el_badges | 12 | Badge definitions |
| el_game_engines | 5 | Game engine types |
| el_stages | 3 | Learning stages |
| el_child_unit_progress | 1 | Child's unit progress |
| el_child_gamification | 1 | Child gamification state |
| el_child_avatars | 1 | Child avatar selections |
| el_game_sessions | 0 | Game play sessions |
| el_child_video_progress | 0 | Video watch progress |
| el_child_badges | 0 | Earned badges |
| el_child_identity | 0 | Child identity/persona |

**elearning_* schema** (older, less populated):
| Table | Rows | Purpose |
|-------|------|---------|
| elearning_units | 9 | Learning units |
| elearning_game_engines | 5 | Game engines |
| elearning_skills | 4 | Skills |
| elearning_sub_skills | 4 | Sub-skills |
| elearning_quizzes | 1 | Quizzes |
| elearning_content_pools | 1 | Content pools |

### 2.4 Gamification Tables

| Table | Rows | Purpose |
|-------|------|---------|
| child_gamification | 1 | XP, level, streak, coins per child |
| achievement_badges | 20 | Badge definitions |
| child_badges | 0 | Earned badges per child |
| xp_levels | 10 | XP level thresholds |
| child_daily_goals | 0 | Daily goal tracking |
| child_game_progress | 0 | Game progress |
| child_skill_progress | 0 | Skill mastery progress |

### 2.5 Communication & CRM Tables

| Table | Rows | Purpose |
|-------|------|---------|
| communication_templates | 35 | Message templates |
| communication_logs | 15 | Sent message logs |
| communication_log | 2 | Alternate log table |
| communication_queue | 0 | Queued messages |
| communication_analytics | 1 | Message analytics |
| communication_preferences | 0 | User preferences |
| wa_lead_messages | 38 | WhatsApp lead messages |
| wa_leads | 2 | WhatsApp leads |
| wa_lead_conversations | 2 | Lead conversations |
| whatsapp_templates | 8 | WhatsApp templates |
| in_app_notifications | 7 | In-app notifications |

### 2.6 Coach & Scheduling Tables

| Table | Rows | Purpose |
|-------|------|---------|
| coach_applications | 18 | Coach applications |
| coach_schedule_rules | 12 | Recurring schedule rules |
| coach_groups | 5 | Coach groupings |
| coach_availability_slots | 2 | Specific available slots |
| coach_availability | 1 | General availability |
| coach_tier_changes | 0 | Tier change history |
| coach_payouts | 0 | Payout records |
| coach_scores | 0 | Performance scores |
| coach_assignment_status | 0 | Assignment tracking |
| coach_earnings | 0 | Earnings records |
| coach_specializations | 0 | Specialization tags |
| coach_reassignment_log | 0 | Reassignment history |
| session_duration_rules | 6 | Duration configurations |
| session_templates | 3 | Session templates |
| session_holds | 0 | Temporary holds |
| session_notes | 0 | Session notes |
| session_incidents | 0 | Incident reports |
| session_change_requests | 0 | Reschedule/cancel requests |

### 2.7 Reference Data & Config Tables

| Table | Rows | Purpose |
|-------|------|---------|
| agreement_config | 27 | Agreement/contract config |
| skill_tags_master | 27 | Skill tag definitions |
| curriculum_template | 25 | Curriculum templates |
| learning_videos | 20 | Video content library |
| coaching_tips | 18 | Coach guidance tips |
| reading_skills | 17 | Reading skill definitions |
| wcpm_benchmarks | 15 | Words-per-minute benchmarks |
| learning_modules | 12 | Learning module definitions |
| feature_flags | 11 | Feature toggle flags |
| xp_levels | 10 | XP level thresholds |
| reading_passages | 8 | Assessment passages |
| system_schedule_defaults | 7 | Default schedule settings |
| learning_levels | 5 | Level definitions |
| time_buckets | 5 | Scheduling time buckets |
| reading_ranks | 5 | Reading rank tiers |
| video_quizzes | 30 | Quiz questions for videos |
| quiz_bank | 2 | Quiz question bank |
| revenue_split_config | 2 | Revenue share config |

> **Full schema with all 196 table definitions and every column**: see `docs/database-schema-inventory.md`

---

## 3. API Routes

### 3.1 Admin (44 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/admin/dashboard` | GET | Admin dashboard stats |
| `/api/admin/settings` | GET, PATCH | Site settings management |
| `/api/admin/feature-flags` | GET, PUT | Feature flag toggles |
| `/api/admin/features` | GET, POST, PUT | Feature management |
| `/api/admin/pricing` | GET, POST, PUT | Pricing plan management |
| `/api/admin/revenue-config` | GET, POST | Revenue split configuration |
| `/api/admin/config/invalidate` | POST | Invalidate config cache |
| `/api/admin/coaches/[id]/specializations` | GET, PUT | Coach specialization management |
| `/api/admin/coaches/generate-referral` | POST, GET | Generate coach referral codes |
| `/api/admin/coach-applications` | GET | List coach applications |
| `/api/admin/coach-applications/[id]` | GET, PATCH, DELETE | Manage single application |
| `/api/admin/coach-applications/send-confirmation` | POST | Send confirmation to applicant |
| `/api/admin/coupons` | GET, POST, PATCH, DELETE | Coupon CRUD |
| `/api/admin/coupons/[id]` | GET, PATCH, DELETE | Single coupon management |
| `/api/admin/crm/leads` | GET, PATCH | CRM lead management |
| `/api/admin/crm/interactions` | GET, POST | CRM interaction tracking |
| `/api/admin/crm/coaches` | GET | CRM coach list |
| `/api/admin/crm/daily-stats` | GET | Daily CRM statistics |
| `/api/admin/crm/export` | GET | Export CRM data |
| `/api/admin/crm/funnel` | GET | Sales funnel stats |
| `/api/admin/crm/pipeline-stats` | GET | Pipeline statistics |
| `/api/admin/enrollments` → via pages | — | Enrollment management |
| `/api/admin/completion/list` | GET | Completed enrollments |
| `/api/admin/completion/extend` | POST | Extend enrollment |
| `/api/admin/completion/send-final-assessment` | POST | Trigger final assessment |
| `/api/admin/payments` | GET | Payment list |
| `/api/admin/payments/stats` | GET | Payment statistics |
| `/api/admin/payments/export` | GET | Export payment data |
| `/api/admin/payouts` | GET, POST | Coach payout management |
| `/api/admin/payouts/reconcile` | POST | Reconcile payouts |
| `/api/admin/tds` | GET, POST | TDS ledger management |
| `/api/admin/session-stats` | GET | Session statistics |
| `/api/admin/scheduling/queue` | GET, POST | Scheduling queue management |
| `/api/admin/group-classes` | GET, POST | Group class management |
| `/api/admin/group-classes/[sessionID]` | GET, PATCH, DELETE | Single group class |
| `/api/admin/group-classes/options` | GET, POST | Group class options |
| `/api/admin/agreements` | GET | List agreements |
| `/api/admin/agreements/[id]` | PATCH, DELETE | Manage single agreement |
| `/api/admin/agreements/upload` | POST | Upload agreement document |
| `/api/admin/testimonials` | GET, POST, PUT, DELETE | Testimonial management |
| `/api/admin/shadow` | GET, POST | Shadow session management |
| `/api/admin/generate-embeddings` | GET | Generate AI embeddings |
| `/api/admin/setup-qstash-schedules` | POST, GET | Setup cron schedules |
| `/api/admin/communication` → via pages | — | Communication management |

### 3.2 Assessment (7 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/assessment/analyze` | POST, GET | AI reading assessment analysis |
| `/api/assessment/enrolled` | POST | Submit enrolled child assessment |
| `/api/assessment/final/data` | GET | Get final assessment data |
| `/api/assessment/final/submit` | POST | Submit final assessment |
| `/api/assessment/results/[childId]` | GET | Get assessment results |
| `/api/assessment/retry` | POST | Retry failed assessment |
| `/api/coach-assessment/calculate-score` | POST | Calculate coach assessment score |

### 3.3 Authentication (4 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/[...nextauth]` | ALL | NextAuth handler (Google OAuth) |
| `/api/auth/send-otp` | POST | Send OTP for phone auth |
| `/api/auth/verify-otp` | POST | Verify OTP code |
| `/api/auth/session` | GET | Get current session |

### 3.4 Coach Portal (17 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/coach/profile` | GET, PATCH | Coach profile management |
| `/api/coach/onboarding` | POST | Coach onboarding submission |
| `/api/coach/sessions` | GET | List coach sessions |
| `/api/coach/sessions/[id]/complete` | POST, GET | Mark session complete |
| `/api/coach/sessions/[id]/parent-update` | POST, GET | Send parent update |
| `/api/coach/session-prep` | GET | Get session preparation brief |
| `/api/coach/availability` | GET, POST, PUT, DELETE, PATCH | Manage availability |
| `/api/coach/schedule-rules` | GET, POST, PUT, DELETE | Schedule rule management |
| `/api/coach/earnings` | GET | View earnings |
| `/api/coach/earnings-calculator` | GET | Estimate earnings |
| `/api/coach/earnings-summary` | GET | Earnings summary |
| `/api/coach/tier-change` | POST | Request tier change |
| `/api/coach/exit` | GET, POST, DELETE | Coach exit process |
| `/api/coach/my-referrals` | GET | View referral stats |
| `/api/coach/ai-suggestion` | POST | Get AI coaching suggestion |
| `/api/coach/notify-assignment` | POST | Notify of new assignment |
| `/api/coach/send-status-notification` | POST | Send status notification |

### 3.5 Coach Application & Assessment (5 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/coach-application/[id]` | GET, PATCH | Application management |
| `/api/coach-application/send-confirmation` | POST | Send confirmation |
| `/api/coach-assessment/chat` | POST | AI assessment chat |
| `/api/coach-assessment/interview-feedback` | POST, GET | Interview feedback |
| `/api/coach-assessment/schedule-interview` | POST | Schedule interview |

### 3.6 Sessions (10 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/sessions` | GET, PATCH, DELETE | Session CRUD |
| `/api/sessions/complete` | POST, GET | Complete a session |
| `/api/sessions/confirm` | POST | Confirm a session |
| `/api/sessions/missed` | POST | Mark session missed |
| `/api/sessions/[id]/feedback` | GET, POST, PATCH | Session feedback |
| `/api/sessions/[id]/cancel-request` | POST | Request cancellation |
| `/api/sessions/[id]/reschedule-request` | POST | Request reschedule |
| `/api/sessions/change-request/[id]/approve` | POST | Approve change request |
| `/api/sessions/parent-checkin` | POST, GET | Parent check-in data |
| `/api/session/[id]/audio` | GET, POST | Session audio recording |

### 3.7 Scheduling (3 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/scheduling/dispatch` | POST | Dispatch scheduling job |
| `/api/scheduling/hold` | POST, DELETE, GET | Session hold management |
| `/api/scheduling/slots` | GET | Get available slots |

### 3.8 E-Learning (14 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/elearning/dashboard` | GET | E-learning dashboard data |
| `/api/elearning/unit/[unitId]` | GET | Get learning unit details |
| `/api/elearning/video/[videoId]` | GET | Get video details |
| `/api/elearning/videos/[videoId]/progress` | POST | Track video progress |
| `/api/elearning/quiz/[quizId]` | GET | Get quiz questions |
| `/api/elearning/quiz-questions` | GET | Get quiz question bank |
| `/api/elearning/submit-quiz` | POST | Submit quiz answers |
| `/api/elearning/games/[gameId]` | GET, POST | Game data and results |
| `/api/elearning/complete` | POST | Mark unit complete |
| `/api/elearning/progress` | POST | Update progress |
| `/api/elearning/gamification` | GET | Get gamification state |
| `/api/elearning/avatar` | GET, POST | Avatar management |
| `/api/elearning/recommendations` | GET, POST | Content recommendations |
| `/api/elearning/session` | GET, POST | E-learning session tracking |

### 3.9 Parent Portal (8 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/parent/dashboard` | GET | Parent dashboard data |
| `/api/parent/enrolled-child` | GET | Get enrolled child info |
| `/api/parent/progress` | GET | Child progress data |
| `/api/parent/notification-preferences` | GET, PUT | Notification settings |
| `/api/parent/referral` | GET | Get referral info |
| `/api/parent/referral/generate` | POST | Generate referral code |
| `/api/parent/session/available-slots` | GET | Available reschedule slots |
| `/api/parent/session/reschedule` | POST | Reschedule session |

### 3.10 Payment (5 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/payment/create` | POST, GET | Create Razorpay order |
| `/api/payment/verify` | POST | Verify payment |
| `/api/payment/webhook` | POST | Razorpay webhook |
| `/api/payment/validate-retry` | GET | Validate retry token |
| `/api/refund/initiate` | POST | Initiate refund |

### 3.11 Discovery & Enrollment (12 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/discovery/book` | POST | Book discovery call |
| `/api/discovery-call/create` | POST | Create discovery call |
| `/api/discovery-call/pending` | GET | List pending calls |
| `/api/discovery-call/assign` | POST, GET | Assign coach |
| `/api/discovery-call/[id]` | GET | Get call details |
| `/api/discovery-call/[id]/questionnaire` | POST | Submit questionnaire |
| `/api/discovery-call/[id]/post-call` | POST, GET | Post-call notes |
| `/api/discovery-call/[id]/send-followup` | POST | Send follow-up |
| `/api/discovery-call/[id]/send-payment-link` | POST, GET | Send payment link |
| `/api/discovery-call/cal-webhook` | POST | Cal.com webhook |
| `/api/enrollment/[id]` | GET | Get enrollment details |
| `/api/enrollment/pause` | GET, POST | Pause enrollment |

### 3.12 Group Classes (8 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/group-classes` | GET | List group classes |
| `/api/group-classes/sessions` | GET | List sessions |
| `/api/group-classes/sessions/[sessionID]` | GET | Session details |
| `/api/group-classes/register` | POST | Register for class |
| `/api/group-classes/verify-payment` | POST | Verify payment |
| `/api/group-classes/validate-coupon` | POST | Validate coupon |
| `/api/group-classes/resend-confirmation` | GET, POST | Resend confirmation |
| `/api/group-classes/page-settings` | GET | Page display settings |

### 3.13 Cron Jobs (10 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/cron/coach-engagement` | GET | Coach engagement nudges |
| `/api/cron/coach-reminders-1h` | GET, POST | 1-hour session reminders |
| `/api/cron/compute-insights` | POST, GET | Compute admin insights |
| `/api/cron/daily-lead-digest` | GET, POST | Daily lead digest email |
| `/api/cron/discovery-followup` | GET, POST | Discovery call follow-ups |
| `/api/cron/enrollment-lifecycle` | GET, POST | Enrollment lifecycle checks |
| `/api/cron/lead-scoring` | POST | Recalculate lead scores |
| `/api/cron/monthly-payouts` | GET, POST | Process monthly payouts |
| `/api/cron/payment-reconciliation` | GET, POST | Payment reconciliation |
| `/api/cron/process-coach-unavailability` | GET, POST | Handle coach unavailability |

### 3.14 Background Jobs (6 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/jobs/enrollment-complete` | POST, GET | Process enrollment completion |
| `/api/jobs/goals-capture` | POST, GET | Capture learning goals |
| `/api/jobs/process-session` | POST, GET | Process completed session |
| `/api/jobs/recall-reconciliation` | GET | Reconcile Recall.ai data |
| `/api/jobs/retry-scheduling` | POST, GET | Retry failed scheduling |
| `/api/jobs/update-calendar-attendee` | POST, GET | Update calendar attendees |

### 3.15 Webhooks (5 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/webhooks/whatsapp-cloud` | GET, POST | WhatsApp Cloud webhook (existing bot) |
| `/api/webhooks/cal` | GET, POST | Cal.com booking webhook |
| `/api/webhooks/recall` | POST, GET | Recall.ai session webhook |
| `/api/webhooks/aisensy/goals` | POST, GET | AiSensy goals webhook |
| `/api/whatsapp/webhook` | GET, POST | WhatsApp Lead Bot webhook |

### 3.16 Other Routes (20+ routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/ab-track` | POST, GET | A/B test event tracking |
| `/api/activity/track` | POST, GET | Activity/event tracking |
| `/api/agreement/active` | GET | Get active agreement |
| `/api/agreement/config` | GET | Agreement configuration |
| `/api/agreement/sign` | POST | Sign agreement |
| `/api/availability` | GET | Coach availability |
| `/api/certificate/generate` | GET | Generate certificate |
| `/api/certificate/pdf` | GET | Certificate PDF |
| `/api/certificate/send` | POST, GET | Send certificate |
| `/api/chat` | POST, GET | AI chat (rAI) |
| `/api/children/[id]` | GET | Get child details |
| `/api/children/goals` | POST, GET | Child goals management |
| `/api/communication/send` | POST, GET | Send communication |
| `/api/communication/test` | POST, GET | Test communication |
| `/api/completion/check/[enrollmentId]` | GET | Check completion status |
| `/api/completion/data/[enrollmentId]` | GET | Completion report data |
| `/api/completion/report/[enrollmentId]` | POST | Generate completion report |
| `/api/completion/trigger/[enrollmentId]` | POST | Trigger completion flow |
| `/api/coupons/calculate` | POST | Calculate coupon discount |
| `/api/coupons/validate` | POST | Validate coupon code |
| `/api/email/enrollment-confirmation` | POST | Send enrollment email |
| `/api/enrollment/calculate-revenue` | POST | Calculate enrollment revenue |
| `/api/features` | GET | Get feature flags |
| `/api/leads/hot-alert` | GET, POST, PUT | Hot lead alerts |
| `/api/learning-events` | POST, GET | Learning event tracking |
| `/api/matching` | POST, GET | Coach-child matching |
| `/api/messages` | GET, POST, PATCH | Messages management |
| `/api/mini-challenge/complete` | POST, GET | Complete mini-challenge |
| `/api/mini-challenge/generate` | POST, GET | Generate mini-challenge |
| `/api/nps` | GET, POST | NPS survey management |
| `/api/nps/[enrollmentId]` | GET, POST | Enrollment NPS |
| `/api/payouts/process` | POST, GET | Process payouts |
| `/api/pricing` | GET | Get pricing plans |
| `/api/products` | GET | Get products |
| `/api/quiz/bank` | GET, POST, DELETE | Quiz bank management |
| `/api/quiz/generate` | POST | Generate quiz |
| `/api/quiz/submit` | POST | Submit quiz |
| `/api/recall/bot` | GET, POST, DELETE | Recall.ai bot management |
| `/api/referral/track` | GET, POST | Track referral visits |
| `/api/settings` | GET | Public settings |
| `/api/settings/coach` | GET | Coach-specific settings |
| `/api/settings/durations` | GET | Session durations |
| `/api/skill-booster/[sessionId]/booking-options` | GET | Skill booster options |
| `/api/skill-booster/book` | POST | Book skill booster |
| `/api/skill-booster/recommend` | POST | Recommend skill booster |
| `/api/skill-tags` | GET, POST | Skill tags management |
| `/api/support/tickets` | POST, GET | Support ticket management |
| `/api/support/tickets/[id]` | PATCH, GET | Single ticket management |
| `/api/test/scheduling` | GET, POST | Test scheduling endpoint |
| `/api/testimonials` | GET | Public testimonials |
| `/api/tts` | POST, GET | Text-to-speech |
| `/api/waitlist` | POST, GET | Waitlist signup |
| `/api/whatsapp/process` | POST | Process WhatsApp message |
| `/api/whatsapp/send` | POST | Send WhatsApp message |

---

## 4. Frontend Pages (76 pages)

### 4.1 Public Pages (13)

| Path | Purpose |
|------|---------|
| `/` | Homepage / landing page |
| `/yestoryd-academy` | Academy landing page |
| `/yestoryd-academy/assessment` | Start reading assessment |
| `/yestoryd-academy/qualify` | Qualification flow |
| `/yestoryd-academy/confirmation` | Booking confirmation |
| `/yestoryd-academy/apply` | Application form |
| `/assessment` | Reading assessment form |
| `/assessment/final` | Final assessment |
| `/assessment/results/[id]` | Assessment results display |
| `/lets-talk` | Contact / discovery call booking |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/book` | Book a session |

### 4.2 Enrollment & Checkout (5)

| Path | Purpose |
|------|---------|
| `/enroll` | Enrollment flow |
| `/checkout` | Payment checkout |
| `/enrollment/success` | Enrollment success page |
| `/booking-confirmed` | Booking confirmation |
| `/payment/retry` | Payment retry flow |

### 4.3 Parent Portal (8)

| Path | Purpose |
|------|---------|
| `/parent/login` | Parent login (OTP) |
| `/parent/dashboard` | Parent dashboard |
| `/parent/progress` | Child progress view |
| `/parent/sessions` | Session schedule |
| `/parent/elearning` | E-learning overview |
| `/parent/support` | Support & help |
| `/parent/book-skill-booster/[sessionId]` | Book skill booster |
| `/(parent)/progress/[childId]` | Per-child progress |

### 4.4 Coach Portal (14)

| Path | Purpose |
|------|---------|
| `/coach/login` | Coach login |
| `/coach/onboarding` | Coach onboarding flow |
| `/coach/dashboard` | Coach dashboard |
| `/coach/sessions` | Session list |
| `/coach/sessions/[sessionId]/prep` | Session prep view |
| `/coach/students` | Student roster |
| `/coach/students/[id]` | Student detail |
| `/coach/earnings` | Earnings dashboard |
| `/coach/templates` | Session templates |
| `/coach/discovery-calls` | Discovery call list |
| `/coach/discovery-calls/[id]` | Discovery call detail |
| `/coach/ai-assistant` | rAI assistant |
| `/coach/profile` | Profile settings |
| `/coach/confirm` | Confirmation page |
| `/coach/test-session-form` | Test session form |
| `/coach/[subdomain]` | Public coach profile |

### 4.5 Admin Portal (20)

| Path | Purpose |
|------|---------|
| `/admin/login` | Admin login |
| `/admin` | Admin dashboard |
| `/admin/enrollments` | Enrollment management |
| `/admin/coaches` | Coach management |
| `/admin/coach-applications` | Application review |
| `/admin/coach-groups` | Coach group management |
| `/admin/analytics` | Analytics dashboard |
| `/admin/payments` | Payment management |
| `/admin/payouts` | Payout processing |
| `/admin/tds` | TDS management |
| `/admin/coupons` | Coupon management |
| `/admin/crm` | CRM dashboard |
| `/admin/elearning` | E-learning management |
| `/admin/communication` | Communication center |
| `/admin/completion` | Completion management |
| `/admin/site-settings` | Site settings editor |
| `/admin/waitlist` | Waitlist management |
| `/admin/scheduling/queue` | Scheduling queue |
| `/admin/settings` | General settings |
| `/admin/settings/pricing` | Pricing configuration |
| `/admin/settings/revenue` | Revenue configuration |
| `/admin/agreements` | Agreement management |
| `/admin/group-classes` | Group class management |

### 4.6 Child Portal (3)

| Path | Purpose |
|------|---------|
| `/child/[childId]/unit/[unitId]` | Learning unit view |
| `/child/[childId]/quest/[unitId]` | Quest/game view |
| `/child/[childId]/play` | Game playground |

### 4.7 Other (6)

| Path | Purpose |
|------|---------|
| `/classes` | Group classes listing |
| `/classes/register/[sessionID]` | Class registration |
| `/classes/register/success` | Registration success |
| `/quiz/[sessionId]` | Quiz page |
| `/nps/[enrollmentId]` | NPS survey |
| `/completion/[enrollmentId]` | Completion certificate |
| `/mini-challenge/[childId]` | Mini-challenge flow |
| `/offline` | PWA offline page |

---

## 5. React Components (130+)

### 5.1 Admin (2)
| Component | Description |
|-----------|-------------|
| SessionIntelligenceCard | Dashboard showing session stats, completion rates, issues |
| SupportTicketsTab | Support ticket management with filtering and status updates |

### 5.2 Assessment (5)
| Component | Description |
|-----------|-------------|
| AssessmentForm | Multi-step reading assessment with audio recording |
| AudioRecorder | Audio recording with play/pause/delete controls |
| AudioRecorderCheck | Device audio compatibility checker |
| GoalsCapture | Learning goals selection grid |
| ResultsDisplay | Assessment results with score and pricing |

### 5.3 Booking (2)
| Component | Description |
|-----------|-------------|
| FlightStyleSlotPicker | Two-step slot picker (bucket → specific slot) |
| SlotPicker | Alternative time slot picker |

### 5.4 Chat (2)
| Component | Description |
|-----------|-------------|
| ChatWidget | AI chat assistant with role-based themes |
| RAIHeroCard | rAI hero card with quick prompts |

### 5.5 Child Portal (14)
| Component | Description |
|-----------|-------------|
| AvatarSelector | 3-step avatar creation (type, color, name) |
| BadgeUnlock / BadgeDisplay | Badge unlock celebration modal |
| BottomNav | Child app bottom navigation |
| ChildHeader | Profile header with avatar, level, coins |
| LearningPathCarousel | Learning path carousel |
| LoadingSpinner | Animated loading spinner |
| MascotGuide | Animated mascot helper |
| MoreQuests | Load more quests button |
| ParentGate | Parent verification gate |
| QuestCard | Quest/challenge card |
| StatsBar | Progress, level, XP stats |
| StreakFlame | Streak flame animation |
| TodaysFocus | Today's focus display |
| XPProgressBar | Animated XP progress bar |

### 5.6 Coach Portal (24)
| Component | Description |
|-----------|-------------|
| ActionDropdown | Session action dropdown menu |
| CoachAvailabilityCard | Availability display card |
| CoachEarnings | Earnings display |
| CoachLayout | Portal layout wrapper |
| CoachTierCard | Tier/level card |
| EarningsOverview | Earnings overview dashboard |
| ParentUpdateButton | One-click parent update |
| PostSessionForm | Post-session notes form |
| PreSessionBrief | Pre-session student brief |
| SessionCard | Session card with actions |
| SessionCompleteForm | Session completion form |
| SkillBoosterSection | Skill booster section |
| StatusBadge | Session status badge |
| StudentCard | Student display card |
| **Session Form (multi-step):** | |
| SessionForm (index) | Main form wrapper |
| Step1QuickPulse | Quick pulse/mood |
| Step2DeepDive | Detailed assessment |
| Step3Planning | Action planning |
| Step4Review | Review and submit |
| FocusAreaGrid | Focus area selection grid |
| ProgressSelector | Progress level selector |
| QuickPickInput | Quick input for common values |
| RatingScale | 1-5 rating scale |
| SkillTagSelector | Skill tag selector |

### 5.7 E-Learning (14)
| Component | Description |
|-----------|-------------|
| AskRAIModal | rAI question dialog |
| BadgesModal | Earned badges modal |
| CelebrationOverlay | Full-screen celebration |
| DailyGoalCard | Daily learning goal |
| GamificationDisplay | XP, badges, streaks display |
| GamificationHeader | Header with gamification stats |
| JourneyMap | Visual learning journey map |
| Leaderboard | Student leaderboard |
| MissionCard | Mission/quest card |
| QuizPlayer | Gamified MCQ quiz player |
| RAICarousel | rAI tips carousel |
| VideoPlayer | YouTube + native video player |
| VideoQuizModal | Video-attached quiz modal |
| XPAwardPopup | XP reward notification |

### 5.8 Games (2)
| Component | Description |
|-----------|-------------|
| PhonicsPopGame | Phonics/sound pop game |
| WordMatchGame | Word matching game |

### 5.9 Mini-Challenge (6)
| Component | Description |
|-----------|-------------|
| AnswerFeedback | Answer explanation display |
| ChallengeInvite | Challenge invitation card |
| ChallengeResults | Results/score display |
| MiniChallengeFlow | Main challenge flow wrapper |
| QuestionCard | Individual question card |
| VideoLesson | Video lesson within challenge |

### 5.10 Parent Portal (5)
| Component | Description |
|-----------|-------------|
| ParentLayout | Parent portal layout wrapper |
| PauseEnrollmentCard | Pause enrollment card |
| PendingSkillBoosterCard | Pending skill booster display |
| ReferralsTab | Referral rewards tab |
| SessionActionsCard | Session actions (reschedule, feedback) |

### 5.11 Shared (16)
| Component | Description |
|-----------|-------------|
| AvailabilityCalendar | Calendar slot selection |
| ChatWidget | Shared chat widget |
| CoachCard | Coach profile card |
| Footer | Site footer |
| GoalIcon | Learning goal icon |
| Header | Site header/navigation |
| ProgressChart | Progress visualization |
| RescheduleModal | Reschedule modal |
| SessionFeedbackForm | Feedback submission form |
| SkillTagSelector | Reusable skill tag selector |
| PortalLayout | Portal main layout |
| BottomNav | Shared bottom navigation |
| MobileHeader | Mobile header |
| Sidebar | Desktop sidebar |
| InstallPrompt | PWA install prompt |
| PWAProvider | PWA provider wrapper |

### 5.12 Support (2)
| Component | Description |
|-----------|-------------|
| SupportForm | Support/contact form |
| SupportWidget | Support button widget |

### 5.13 UI Primitives (16 — Shadcn-based)
| Component | Description |
|-----------|-------------|
| Badge | Status/label badge |
| BottomNav | Bottom navigation primitive |
| Button | Primary button with variants |
| Card / CardHeader / CardContent | Card primitives |
| DateTimePicker | Date and time picker |
| Input | Text input field |
| Label | Form label |
| LottieAnimation | Lottie animation player |
| Modal | Modal dialog primitives |
| NotificationBell | Notification bell icon |
| PhoneInput | Phone input with country code |
| ReadingSurface | Reading-focused text display |
| Skeleton | Loading placeholder |
| Spinner | Loading spinner |
| BookingPreferences | Scheduling preferences |

### 5.14 Root-Level Components (9)
| Component | Description |
|-----------|-------------|
| AgeCelebration | Age-based celebration overlay |
| AuthProvider | NextAuth session provider |
| Confetti | Confetti animation |
| GoogleAnalytics | GA tracking wrapper |
| MoneyBackGuarantee | Money-back guarantee display |
| NinetyDayPromise | 90-day promise display |
| NotifyMeModal | Notify-me signup modal |
| PaymentGuard | Payment verification wrapper |
| TrackingPixels | Analytics tracking pixels |

---

## 6. Library Modules (95+ files)

### 6.1 Core / Root (12 files)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `api-auth.ts` | requireAdmin, requireCoach, requireAuth, getServiceSupabase | Universal API authentication |
| `api-error.ts` | APIError, ErrorCodes, withErrorHandler | Standardized error handling |
| `auth-options.ts` | authOptions, getUserRole, syncUserOnSignIn | NextAuth config (Google OAuth) |
| `auth.ts` | getAuthUser, requireAdmin, withAuth | Auth helpers for API routes |
| `admin-fetch.ts` | adminFetch, adminGet, adminPost | Authenticated admin fetch wrapper |
| `db-utils.ts` | conditionalUpdate, timedQuery, batchUpsert | Database optimization utilities |
| `gamification.ts` | awardXP, updateStreak, checkAndAwardBadges | E-learning gamification engine |
| `learningEvents.ts` | saveAssessmentToLearningEvents, saveSessionToLearningEvents | Learning events with embeddings |
| `qstash.ts` | queueEnrollmentComplete, queueSessionProcessing, 10+ queue functions | QStash async job queuing hub |
| `design-tokens.ts` | tokens (colors, radius, shadows, typography) | Design system constants |
| `notify-coach-assignment.ts` | notifyCoachAssignment | Coach assignment notification |
| `audio-storage.ts` | downloadAndStoreAudio, getAudioSignedUrl | Recall.ai audio storage |

### 6.2 AI (3 files)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `ai/provider.ts` | analyzeReading, generateEmbedding, generateSessionSummary | AI provider fallback (Gemini → OpenAI) |
| `ai/errors.ts` | handleApiError, ApiError, ErrorCodes | AI-specific error handling |
| `ai/env-check.ts` | validateEnvVars, getEnv, isProduction | Environment variable validation |

### 6.3 Business Logic (2 files)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `business/revenue-split.ts` | calculateRevenueSplit, SPLIT_CONFIG | Revenue split with TDS |
| `business/session-scheduler.ts` | generateSessionSchedule, isValidRescheduleTime | Session scheduling logic |

### 6.4 Calendar (1 file)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `calendar/operations.ts` | createEnrollmentSessions, rescheduleSession, cancelSession | Google Calendar with rollback |

### 6.5 Communication (4 files)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `communication/index.ts` | sendCommunication, scheduleCommunication, sendAdminAlert | Central communication engine |
| `communication/aisensy.ts` | sendWhatsAppMessage, sendWhatsAppOTP | AiSensy WhatsApp integration |
| `communication/sendgrid.ts` | sendEmail | SendGrid email integration |
| `communication/whatsapp-cloud.ts` | sendWhatsAppCloudMessage, markMessageAsRead | Meta WhatsApp Cloud API |

### 6.6 Config (3 files)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `config/loader.ts` | loadAuthConfig, loadPaymentConfig, loadSchedulingConfig, etc. | Enterprise config loader (5-min TTL cache) |
| `config/types.ts` | AuthConfig, CoachConfig, PaymentConfig, etc. | Configuration type definitions |
| `config/navigation.ts` | parentNavItems, coachNavItems | Portal navigation config |

### 6.7 Constants (2 files)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `constants/goals.ts` | LEARNING_GOALS, getGoalsForAge | Learning goal definitions |
| `constants/structural.ts` | STATUS, SESSION_TYPE_KEYS, VALIDATION | Structural constants |

### 6.8 Scheduling (14 files)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `scheduling/orchestrator.ts` | — | Main scheduling orchestrator |
| `scheduling/enrollment-scheduler.ts` | — | Enrollment scheduling |
| `scheduling/smart-slot-finder.ts` | — | Intelligent slot finding |
| `scheduling/session-manager.ts` | — | Session management |
| `scheduling/config.ts` | — | Scheduling defaults (45 min hardcoded) |
| `scheduling/config-provider.ts` | — | Config provider pattern |
| `scheduling/circuit-breaker.ts` | — | Circuit breaker for failures |
| `scheduling/coach-availability-handler.ts` | — | Coach availability logic |
| `scheduling/notification-manager.ts` | — | Notification orchestration |
| `scheduling/manual-queue.ts` | — | Manual session queue |
| `scheduling/retry-queue.ts` | — | Retry logic |
| `scheduling/redis-store.ts` | — | Redis persistence |
| `scheduling/transaction-manager.ts` | — | Transaction support |
| `scheduling/logger.ts` | — | Structured logging |

### 6.9 rAI — AI Assistant (11 files)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `rai/embeddings.ts` | generateEmbedding, searchSimilarEvents | Embedding generation for RAG |
| `rai/hybrid-search.ts` | — | Hybrid search (vector + keyword) |
| `rai/intent-classifier.ts` | — | Intent classification |
| `rai/prompts.ts` | — | LLM prompt templates |
| `rai/proactive-notifications.ts` | — | Proactive notification logic |
| `rai/query-filters.ts` | — | Query filtering utilities |
| `rai/admin-insights.ts` | — | Admin insights generation |
| `rai/types.ts` | — | RAI type definitions |
| `rai/prompts/whatsapp-prospect.ts` | — | WhatsApp prospect prompts |
| `rai/queries/prospect-queries.ts` | — | Prospect query patterns |

### 6.10 WhatsApp Lead Bot (14 files)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `whatsapp/signature.ts` | verifySignature | Webhook HMAC-SHA256 verification |
| `whatsapp/extract.ts` | — | Message extraction |
| `whatsapp/cloud-api.ts` | — | Cloud API utilities |
| `whatsapp/types.ts` | — | Message type definitions |
| `whatsapp/intent/tier0-regex.ts` | — | Regex-based intent matching |
| `whatsapp/intent/tier1-gemini.ts` | — | AI intent classification |
| `whatsapp/handlers/greeting.ts` | — | Greeting handler |
| `whatsapp/handlers/faq.ts` | — | FAQ handler |
| `whatsapp/handlers/qualification.ts` | — | Prospect qualification |
| `whatsapp/handlers/assessment-cta.ts` | — | Assessment call-to-action |
| `whatsapp/handlers/booking.ts` | — | Discovery call booking |
| `whatsapp/handlers/escalate.ts` | — | Human escalation |

### 6.11 Other Modules

| File | Key Exports | Purpose |
|------|-------------|---------|
| `supabase/client.ts` | supabase | Client-side Supabase instance |
| `supabase/server.ts` | supabaseAdmin | Server-side admin client |
| `supabase/database.types.ts` | Database types | Auto-generated TypeScript types (423 KB) |
| `googleCalendar.ts` | scheduleCalendarEvent, getAvailableSlots, 10+ functions | Google Calendar integration |
| `razorpay.ts` | — | Razorpay payment integration |
| `recall-auto-bot.ts` | — | Recall.ai bot utilities |
| `referral.ts` | — | Referral code generation |
| `rate-limit.ts` | — | API rate limiting |
| `sounds.ts` | — | Audio asset management |
| `tts/google-tts.ts` | — | Google Text-to-Speech |
| `gemini/client.ts` | analyzeReading, generateSessionNotes | Gemini AI client |
| `logic/lead-scoring.ts` | calculateLeadScore, isHotLead | Lead scoring engine |
| `notifications/admin-alerts.ts` | sendNewLeadAlert, sendDailyDigest | Admin WhatsApp alerts |
| `mini-challenge/content.ts` | getMiniChallengeVideo, markMiniChallengeCompleted | Mini-challenge content |
| `mini-challenge/settings.ts` | getMiniChallengeSettings | Mini-challenge config |
| `coach-engagement/schedule.ts` | COACH_ENGAGEMENT_SCHEDULE | Coach touchpoint schedule |
| `triggers/goals-capture.ts` | — | Goals capture trigger |
| `validations/coach-journey.ts` | — | Coach journey validation |
| `hooks/useSiteSettings.ts` | useSiteSettings, 20+ setting hooks | Client-side settings hooks |
| `settings/getSettings.ts` | getSettings | Server-side settings fetch |
| `utils/phone.ts` | normalizePhone, formatForWhatsApp | Phone number utilities |
| `utils/rate-limiter.ts` | createRateLimiter | Token bucket rate limiting |
| `utils/source-detection.ts` | detectSource | Lead source detection |
| `utils/helpers.ts` | — | General utilities |

---

## 7. External Integrations

| Integration | Purpose | Config Location |
|-------------|---------|-----------------|
| **Supabase** | Database, auth, storage | `lib/supabase/` |
| **Google Calendar** | Session scheduling, discovery calls | `lib/googleCalendar.ts` |
| **Razorpay** | Payment processing | `lib/razorpay.ts` |
| **Google Gemini** | Reading analysis, AI coaching | `lib/gemini/`, `lib/ai/` |
| **OpenAI** | Fallback AI, embeddings | `lib/ai/provider.ts` |
| **AiSensy** | WhatsApp messaging (existing bot) | `lib/communication/aisensy.ts` |
| **Meta WhatsApp Cloud** | WhatsApp Lead Bot | `lib/whatsapp/`, `lib/communication/whatsapp-cloud.ts` |
| **SendGrid** | Email notifications | `lib/communication/sendgrid.ts` |
| **QStash (Upstash)** | Async job queuing | `lib/qstash.ts` |
| **Recall.ai** | Session recording & transcription | `lib/recall-auto-bot.ts` |
| **Cal.com** | Discovery call scheduling | `api/discovery-call/cal-webhook` |
| **Google Analytics** | Web analytics | `components/GoogleAnalytics.tsx` |
| **Sentry** | Error monitoring | `sentry.*.config.ts` |
| **Google TTS** | Text-to-speech | `lib/tts/google-tts.ts` |
| **NextAuth (Google)** | OAuth authentication | `lib/auth-options.ts` |

---

## 8. Configuration & Infrastructure

### 8.1 Supabase Migrations (18)

```
supabase/migrations/
├── 20241218000000_initial_schema.sql
├── 20241219000001_add_coach_applications.sql
├── 20241220000001_add_books.sql
├── 20241220000002_add_quiz_bank.sql
├── 20241221000001_add_learning_videos.sql
├── 20241223000001_add_scheduled_sessions.sql
├── 20241229000001_add_parents_table.sql
├── 20250104000001_add_enrollment_revenue.sql
├── 20250105000001_add_session_changes.sql
├── 20250106000001_add_coach_scheduling_v2.sql
├── 20250107000001_add_scheduling_infra.sql
├── 20250111000001_add_reading_passages.sql
├── 20250118000001_add_communication_tables.sql
├── 20250125000001_add_elearning_schema.sql
├── 20250126000001_add_group_sessions.sql
├── 20250201000001_add_wa_leads.sql
├── 20250202000001_add_lead_scoring.sql
├── 20250205000001_add_agreement_tables.sql
```

### 8.2 Key Config Files

| File | Purpose |
|------|---------|
| `next.config.js` | Next.js configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `tsconfig.json` | TypeScript configuration |
| `package.json` | Dependencies and scripts |
| `middleware.ts` | Auth middleware |
| `sentry.client.config.ts` | Sentry client config |
| `sentry.server.config.ts` | Sentry server config |
| `sentry.edge.config.ts` | Sentry edge config |
| `vercel.json` | Vercel deployment config |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker |

### 8.3 Environment Variables Required

Based on code analysis, the following env vars are used:

**Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
**Auth**: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`
**AI**: `GOOGLE_GEMINI_API_KEY`, `OPENAI_API_KEY`
**Payment**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
**Calendar**: `GOOGLE_CALENDAR_*` (multiple)
**Communication**: `AISENSY_API_KEY`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
**WhatsApp (Existing)**: `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_CLOUD_PHONE_ID`, `WHATSAPP_CLOUD_VERIFY_TOKEN`
**WhatsApp (Lead Bot)**: `META_WA_TOKEN`, `META_WA_PHONE_ID`, `META_WA_VERIFY_TOKEN`, `META_WA_APP_SECRET`
**QStash**: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
**Recall.ai**: `RECALL_API_KEY`
**Analytics**: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
**Sentry**: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
**App**: `NEXT_PUBLIC_APP_URL`, `INTERNAL_API_KEY`

### 8.4 Top Tables by Seq Scans (Performance Hotspots)

| Table | Seq Scans | Rows | Notes |
|-------|-----------|------|-------|
| children | 13,460 | 38 | Most queried table — needs indexing review |
| coaches | 12,696 | 1 | Extremely high for 1 row |
| site_settings | 5,037 | 207 | Frequently accessed settings |
| pricing_plans | 4,861 | 4 | High reads for pricing |
| scheduled_sessions | 4,815 | 31 | Session lookups |
| testimonials | 4,597 | 5 | Public page loads |
| feature_flags | 4,427 | 11 | Feature flag checks |
| enrollments | 4,140 | 7 | Enrollment lookups |
| parents | 1,981 | 7 | Parent lookups |
| discovery_calls | 1,151 | 10 | Discovery call lookups |

---

## Summary

This inventory documents the **complete Yestoryd MVP codebase** as of 8 February 2026:

- **~130 live database tables** with 196 TypeScript type definitions
- **155+ API routes** handling assessment, coaching, scheduling, payments, e-learning, CRM, communication, and admin
- **76 frontend pages** across public, parent, coach, admin, and child portals
- **130+ React components** with a child-facing gamification UI and coach multi-step session forms
- **95+ library modules** covering scheduling orchestration, AI-powered rAI assistant, WhatsApp lead bot, and communication engine
- **10 external integrations** (Supabase, Razorpay, Gemini, WhatsApp, Google Calendar, QStash, Recall.ai, SendGrid, Cal.com, Sentry)

Full column-level schema details are in `docs/database-schema-inventory.md`.
