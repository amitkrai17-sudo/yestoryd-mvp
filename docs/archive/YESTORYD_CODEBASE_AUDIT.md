# YESTORYD CODEBASE TECHNICAL AUDIT REPORT

**Date:** January 31, 2026
**Codebase Location:** C:\yestoryd-mvp
**Branch:** main
**Auditor:** Claude Opus 4.5

---

## TABLE OF CONTENTS

1. [Project Structure](#1-project-structure)
2. [Tech Stack](#2-tech-stack)
3. [Database](#3-database)
4. [API Routes](#4-api-routes)
5. [Authentication](#5-authentication)
6. [Third-Party Integrations](#6-third-party-integrations)
7. [Frontend](#7-frontend)
8. [Environment Variables](#8-environment-variables)
9. [Deployment](#9-deployment)
10. [Data Flow](#10-data-flow)

---

## 1. PROJECT STRUCTURE

### Architecture Pattern

Next.js 14 App Router with a monolithic fullstack architecture. The codebase follows a role-based portal pattern: public-facing marketing/assessment pages, plus three authenticated portals (parent, coach, admin). Background job processing is offloaded via QStash to avoid Vercel serverless timeouts.

### Directory Tree (Key Directories)

```
C:\yestoryd-mvp\
|
|-- app/                          # Next.js App Router pages & API
|   |-- (home)/                   # Home page route group
|   |   |-- _components/          # Hero, CTA, Pricing, Testimonials sections
|   |-- (parent)/                 # Parent route group (progress/[childId])
|   |-- admin/                    # Admin portal (15+ pages)
|   |   |-- analytics/
|   |   |-- coach-applications/
|   |   |-- coaches/
|   |   |-- completion/
|   |   |-- coupons/
|   |   |-- crm/
|   |   |-- elearning/
|   |   |-- enrollments/
|   |   |-- group-classes/
|   |   |-- login/
|   |   |-- payments/
|   |   |-- payouts/
|   |   |-- scheduling/queue/
|   |   |-- settings/ (pricing, revenue)
|   |   |-- site-settings/
|   |   |-- tds/
|   |   |-- waitlist/
|   |-- assessment/               # Free reading assessment flow
|   |   |-- results/[id]/
|   |   |-- final/
|   |-- book/                     # Discovery call booking
|   |-- booking-confirmed/
|   |-- checkout/                 # Payment checkout
|   |-- child/[childId]/          # Child e-learning portal (play, quest, unit)
|   |-- classes/                  # Group classes listing & registration
|   |-- coach/                    # Coach portal (13+ pages)
|   |   |-- ai-assistant/
|   |   |-- dashboard/
|   |   |-- discovery-calls/
|   |   |-- earnings/
|   |   |-- login/
|   |   |-- onboarding/
|   |   |-- profile/
|   |   |-- sessions/[sessionId]/prep/
|   |   |-- students/[id]/
|   |   |-- templates/
|   |   |-- [subdomain]/          # Coach subdomain landing pages
|   |-- completion/[enrollmentId]/ # Program completion + certificate
|   |-- enroll/                   # Enrollment & payment page
|   |-- lets-talk/                # Contact / discovery call
|   |-- nps/[enrollmentId]/       # NPS survey
|   |-- parent/                   # Parent portal (7+ pages)
|   |   |-- book-skill-booster/
|   |   |-- dashboard/
|   |   |-- elearning/
|   |   |-- login/
|   |   |-- progress/
|   |   |-- sessions/
|   |   |-- support/
|   |-- quiz/[sessionId]/         # Post-session quiz
|   |-- terms/
|   |-- privacy/
|   |-- yestoryd-academy/         # Coach recruitment academy
|   |
|   |-- api/                      # API routes (~130+ endpoints)
|       |-- ab-track/
|       |-- activity/track/
|       |-- admin/                # 30+ admin API routes
|       |-- agreement/            # Coach agreement management
|       |-- assessment/           # Assessment data endpoints
|       |-- auth/                 # NextAuth + session
|       |-- availability/
|       |-- certificate/generate/
|       |-- coach/                # Coach-specific endpoints
|       |-- coach-application/
|       |-- coach-assessment/     # Coach hiring assessment
|       |-- communication/test/
|       |-- completion/           # Enrollment completion
|       |-- coupons/              # Coupon validation
|       |-- cron/                 # 9 cron job endpoints
|       |-- discovery-call/       # Discovery call booking
|       |-- elearning/            # 12+ e-learning endpoints
|       |-- email/
|       |-- enrollment/
|       |-- features/
|       |-- group-classes/        # 8 group class endpoints
|       |-- jobs/                 # 5 background job processors
|       |-- matching/
|       |-- messages/
|       |-- nps/
|       |-- parent/               # Parent data endpoints
|       |-- payment/              # create, verify, webhook
|       |-- pricing/
|       |-- products/
|       |-- quiz/
|       |-- recall/bot/
|       |-- referral/track/
|       |-- scheduling/           # Session scheduling
|       |-- sessions/             # Session management
|       |-- settings/             # Site settings & coach settings
|       |-- skill-booster/
|       |-- skill-tags/
|       |-- support/tickets/
|       |-- testimonials/
|       |-- waitlist/
|       |-- webhooks/             # cal, recall
|
|-- components/                   # Reusable React components (~100+)
|   |-- admin/
|   |-- assessment/
|   |-- booking/
|   |-- chat/
|   |-- checkout/
|   |-- child/                    # Child-facing UI components
|   |-- coach/                    # Coach portal components
|   |-- elearning/
|   |-- games/                    # PhonicsPopGame, WordMatchGame
|   |-- icons/
|   |-- layouts/
|   |-- navigation/
|   |-- parent/
|   |-- shared/                   # Cross-portal shared components
|   |   |-- layout/
|   |   |-- navigation/
|   |   |-- pwa/
|   |-- support/
|   |-- ui/                       # Primitives (button, card, modal, etc.)
|   |   |-- scheduling/
|
|-- lib/                          # Server-side utilities & business logic
|   |-- ai/                       # Gemini provider, error handling
|   |-- business/                 # Revenue split, session scheduler
|   |-- calendar/                 # Calendar operations
|   |-- coach-engagement/
|   |-- communication/            # AiSensy (WhatsApp), SendGrid (email), central engine
|   |-- config/
|   |-- constants/
|   |-- gemini/                   # Gemini AI client
|   |-- google/                   # Google Auth, Sheets
|   |-- hooks/
|   |-- logic/                    # Lead scoring
|   |-- notifications/            # Admin alerts
|   |-- rai/                      # rAI chatbot (embeddings, hybrid search, intent, prompts)
|   |-- scheduling/               # Full scheduling orchestrator system (12 files)
|   |-- settings/                 # Site settings, coach settings
|   |-- supabase/                 # Client, server, database types
|   |-- triggers/
|   |-- utils/
|   |-- validations/
|
|-- contexts/                     # React context providers (SiteSettings)
|-- public/                       # Static assets, icons, manifest
|-- supabase/migrations/          # 8 SQL migration files
|-- __tests__/                    # Jest test files (scheduling)
|-- docs/                         # Audit/enhancement documentation
```

### Key Configuration Files

| File | Purpose |
|------|---------|
| `C:\yestoryd-mvp\package.json` | Dependencies & scripts |
| `C:\yestoryd-mvp\middleware.ts` | Route protection, subdomain routing, auth checks |
| `C:\yestoryd-mvp\app\layout.tsx` | Root layout with GA, PWA, SiteSettings provider |
| `C:\yestoryd-mvp\CLAUDE.md` | AI assistant context and project rules |
| `C:\yestoryd-mvp\.env.example` | Environment variable template |
| `C:\yestoryd-mvp\tsconfig.tsbuildinfo` | TypeScript build info |
| `C:\yestoryd-mvp\jest.config.ts` | Jest test configuration |

---

## 2. TECH STACK

### Core Framework

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 14.2.0 | Fullstack React framework (App Router) |
| React | ^18.2.0 | UI library |
| TypeScript | ^5.4.0 | Type safety |
| Tailwind CSS | ^3.4.1 | Utility-first CSS |

### Backend / Data

| Technology | Version | Purpose |
|-----------|---------|---------|
| @supabase/supabase-js | ^2.87.1 | Database client (PostgreSQL) |
| @supabase/ssr | ^0.8.0 | Supabase SSR middleware integration |
| next-auth | ^4.24.13 | Authentication (Google OAuth) |
| razorpay | ^2.9.6 | Payment processing |
| googleapis | ^140.0.1 | Google Calendar API |
| google-auth-library | ^9.6.0 | Google service account auth |
| @sendgrid/mail | ^8.1.6 | Email sending |
| @upstash/qstash | ^2.8.4 | Background job queue |
| @upstash/redis | ^1.36.1 | Redis for idempotency/circuit breaker |
| @upstash/ratelimit | ^2.0.7 | Rate limiting |
| @sentry/nextjs | ^10.32.1 | Error monitoring |
| zod | ^3.22.4 | Runtime validation |

### AI / ML

| Technology | Version | Purpose |
|-----------|---------|---------|
| @google/generative-ai | ^0.21.0 | Gemini AI SDK |
| @ai-sdk/google | ^2.0.45 | Vercel AI SDK Google provider |
| ai | ^5.0.108 | Vercel AI SDK (streaming) |

### Frontend UI

| Technology | Version | Purpose |
|-----------|---------|---------|
| framer-motion | ^12.24.10 | Animations |
| @radix-ui/* | various | Accessible UI primitives (dialog, select, tabs, dropdown) |
| @headlessui/react | ^2.2.9 | Headless UI components |
| lucide-react | ^0.363.0 | Icons |
| recharts | ^2.15.4 | Charts/graphs |
| canvas-confetti | ^1.9.4 | Celebration animations |
| @react-pdf/renderer | ^4.3.2 | PDF certificate generation |
| class-variance-authority | ^0.7.0 | Component variants |
| tailwind-merge | ^2.2.1 | Tailwind class merging |
| react-hook-form | ^7.51.0 | Form management |
| @hookform/resolvers | ^3.3.4 | Zod form validation |
| date-fns | ^3.6.0 | Date utilities |
| mammoth | ^1.11.0 | DOCX parsing (coach agreements) |

### Dev Dependencies

| Technology | Version | Purpose |
|-----------|---------|---------|
| jest | ^30.2.0 | Testing framework |
| ts-jest | ^29.4.6 | TypeScript Jest support |
| sharp | ^0.34.5 | Image optimization |
| eslint-config-next | 14.2.0 | Linting |

### NPM Scripts

```
dev         - next dev
build       - next build
start       - next start
lint        - next lint
typecheck   - tsc --noEmit
quality     - npm run typecheck && npm run lint
test        - jest
test:scheduling - jest __tests__/scheduling
```

---

## 3. DATABASE

### Provider

**Supabase** (managed PostgreSQL with pgvector extension for embeddings). The database is accessed via two client patterns:

1. **Server-side (API routes):** `supabaseAdmin` using `SUPABASE_SERVICE_ROLE_KEY` -- bypasses Row Level Security (RLS)
   - File: `C:\yestoryd-mvp\lib\supabase\server.ts`

2. **Client-side (browser):** `supabase` using `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- respects RLS
   - File: `C:\yestoryd-mvp\lib\supabase\client.ts`

**Note:** The database types file (`C:\yestoryd-mvp\lib\supabase\database.types.ts`) uses a permissive `Record<string, any>` pattern rather than generated types. This means there is no compile-time table/column safety.

### Tables (Identified from Code)

#### Core Business Tables

| Table | Purpose | Key Columns (from code usage) |
|-------|---------|-------------------------------|
| `parents` | Parent accounts | id, email, name, phone, avatar_url, last_login_at, referral_credit_balance, referral_credit_expires_at |
| `children` | Child profiles (also serves as Leads table) | id, child_name, age, parent_id, parent_email, parent_name, parent_phone, lead_status, enrollment_status, coach_id, latest_assessment_score, phonics_focus, struggling_phonemes, enrolled_at, created_at |
| `coaches` | Coach profiles | id, name, email, user_id, is_active, is_available, status, calendar_id, avatar_url, last_login_at, last_assigned_at, exit_status |
| `enrollments` | Paid program enrollments | id, child_id, parent_id, coach_id, payment_id, amount, status, program_start, program_end, schedule_confirmed, sessions_scheduled, lead_source, lead_source_coach_id, referral_code_used, enrollment_type, starter_completed_at, source |
| `scheduled_sessions` | Coaching sessions (linked to Google Calendar) | id, enrollment_id, child_id, coach_id, session_type, scheduled_date, scheduled_time, google_meet_link, status, recall_bot_id, recall_status, started_at, completed_at, duration_minutes, attendance_count, no_show_reason, scheduling_attempts, last_attempt_at, next_retry_at, failure_reason |
| `bookings` | Payment/order records (bridge between Razorpay order and enrollment) | id, razorpay_order_id, child_id, parent_id, amount, coach_id, status, payment_id, paid_at, metadata, child_name, parent_email, parent_name, parent_phone, lead_source, lead_source_coach_id, coupon_code, failure_reason |
| `payments` | Captured payment records | id, parent_id, child_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, captured_at, source, coupon_code |
| `pricing_plans` | Product catalog (server-controlled pricing) | id, slug, name, discounted_price, sessions_included, sessions_coaching, sessions_skill_building, sessions_checkin, duration_months, is_active, is_locked, lock_message |

#### Discovery & Booking

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `discovery_calls` | Cal.com + native discovery call bookings | id, child_id, parent_name, parent_email, parent_phone, child_name, child_age, status, scheduled_at, meeting_url, cal_booking_id, cal_booking_uid, source, coach_id, assignment_type, assigned_at, assigned_by |

#### Communication

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `communication_templates` | WhatsApp/email templates by category | id, template_code, is_active, use_whatsapp, use_email, use_sms, wa_template_name, wa_variables, email_subject, email_body_html, email_sendgrid_template_id |
| `communication_logs` | Sent message history | id, template_id, template_code, channel, recipient_type, recipient_id, recipient_name, recipient_contact, variables_used, status, provider_message_id, error_message, sent_at, failed_at, related_entity_type, related_entity_id |
| `communication_queue` | Scheduled/pending messages | id, template_code, recipient_type, recipient_id, variables, scheduled_for, status, related_entity_type, related_entity_id, request_id |

#### AI / rAI

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `learning_events` | Unified event tracking with vector embeddings (RAG) | id, child_id, event_type, event_data, ai_summary, created_at, embedding (pgvector) |

#### Session Recording

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `recall_bot_sessions` | Recall.ai bot tracking | bot_id, session_id, child_id, coach_id, meeting_url, status, scheduled_join_time, recording_url, duration_seconds, last_status_change, status_history, metadata |

#### Coach Management

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `coach_availability` | Coach leave/unavailability periods | coach_id, status, start_date, end_date |
| `coach_reassignment_log` | Tracks all coach changes | enrollment_id, child_id, original_coach_id, new_coach_id, reason, reassignment_type, is_temporary |

#### Coupons & Referrals

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `coupons` | Discount coupons | id, code, coupon_type, discount_type, discount_value, min_order_amount, max_discount_amount, max_uses, current_uses, valid_from, valid_until, is_active, one_time_per_user, applicable_to |
| `coupon_uses` | Usage tracking | coupon_id, user_email, order_id, discount_amount |

#### Infrastructure

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `site_settings` | Dynamic site content (critical: NO hardcoding pattern) | key, value |
| `processed_webhooks` | Idempotency for webhook processing | webhook_id, event_type, processed_at, request_id |
| `enrollment_events` | Enrollment lifecycle event log | enrollment_id, event_type, event_data, triggered_by |
| `activity_log` | Auth and user activity logging | user_email, action, details, created_at |
| `scheduling_queue` | Manual queue for scheduling failures | id, session_id, enrollment_id, child_id, coach_id, reason, attempts_made, status |

#### Other Tables (Referenced in Code)

| Table | Purpose |
|-------|---------|
| `launch_waitlist` | Pre-launch product waitlist |
| `support_tickets` | Parent support tickets |
| `nps_responses` | NPS survey responses |
| `agreements` | Coach agreements/contracts |

---

## 4. API ROUTES

### Assessment & Results

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/assessment/results/[childId]` | GET | Fetch complete assessment results for a child |
| `/api/assessment/enrolled` | GET | Check if child is already enrolled |
| `/api/assessment/final/data` | GET | Final assessment data for completion |

### Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth.js handler (Google OAuth) |
| `/api/auth/session` | GET | Get current session info |

### Payment Flow

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/payment/create` | POST | Create Razorpay order with server-controlled pricing from `pricing_plans` table. Validates coupons, referral credits, product eligibility. Creates parent/child records. Rate limited (5/min/email). |
| `/api/payment/verify` | POST | Verify Razorpay payment signature, create enrollment, trigger scheduling via QStash |
| `/api/payment/webhook` | POST | Razorpay webhook handler. Verifies HMAC signature, creates enrollment (with race condition handling against /verify), queues background job via QStash |

### Discovery Calls

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/discovery-call/create` | POST | Create native discovery call booking (Google Calendar) |
| `/api/discovery-call/assign` | POST | Assign/reassign coach to discovery call |
| `/api/discovery-call/cal-webhook` | POST | Legacy Cal.com webhook handler |

### Webhooks

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/webhooks/cal` | POST | Cal.com booking webhook. Auto-assigns coach (round-robin), links to child record, creates `discovery_calls` entry |
| `/api/webhooks/recall` | POST | Recall.ai webhook. Handles bot status changes, transcriptions, recording ready, and bot done events. Offloads heavy processing to QStash |

### Background Jobs (QStash Targets)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/jobs/enrollment-complete` | POST | Process enrollment after payment: schedule sessions, send notifications |
| `/api/jobs/process-session` | POST | AI transcript analysis, audio storage, embedding generation, notification sending |
| `/api/jobs/goals-capture` | POST | Send P7 WhatsApp message if goals not captured 30min post-assessment |
| `/api/jobs/update-calendar-attendee` | POST | Update Google Calendar attendees on coach reassignment |
| `/api/jobs/retry-scheduling` | POST | Retry failed scheduling attempts |

### Cron Jobs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cron/enrollment-lifecycle` | POST | Process enrollment state transitions |
| `/api/cron/daily-lead-digest` | POST | Morning admin summary of leads/discovery calls |
| `/api/cron/discovery-followup` | POST | Follow up on unbooked discovery calls |
| `/api/cron/coach-reminders-1h` | POST | 1-hour session reminders for coaches |
| `/api/cron/compute-insights` | POST | Compute rAI analytics insights |
| `/api/cron/monthly-payouts` | POST | Monthly coach payout calculations |
| `/api/cron/payment-reconciliation` | POST | Reconcile payments between Razorpay and Supabase |
| `/api/cron/process-coach-unavailability` | POST | Handle coach availability changes |
| `/api/cron/coach-engagement` | POST | Coach engagement metrics tracking |

### Sessions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sessions/route` | GET | List sessions |
| `/api/sessions/complete` | POST | Mark session as complete |
| `/api/sessions/parent-checkin` | POST | Parent check-in session handling |
| `/api/sessions/missed` | POST | Handle missed sessions |
| `/api/sessions/[id]/feedback` | POST | Submit session feedback |
| `/api/sessions/[id]/cancel-request` | POST | Request session cancellation |
| `/api/sessions/[id]/reschedule-request` | POST | Request session reschedule |
| `/api/sessions/change-request` | POST | General session change request |
| `/api/session/[id]/audio` | GET | Get session audio recording |

### Coach Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/coach/sessions` | GET | Coach's session list |
| `/api/coach/sessions/[id]/complete` | POST | Coach completes a session (post-session form) |
| `/api/coach/sessions/[id]/parent-update` | POST | Send parent update after session |
| `/api/coach/availability` | GET/POST | Manage coach availability |
| `/api/coach/earnings` | GET | Coach earnings data |
| `/api/coach/earnings-summary` | GET | Earnings summary |
| `/api/coach/my-referrals` | GET | Coach's referral tracking |
| `/api/coach/notify-assignment` | POST | Notify coach of new assignment |
| `/api/coach/onboarding` | POST | Coach onboarding flow |
| `/api/coach/schedule-rules` | GET/POST | Coach scheduling rules |
| `/api/coach/send-status-notification` | POST | Send coach status notification |
| `/api/coach/tier-change` | POST | Coach tier level change |
| `/api/coach/exit` | POST | Coach exit process |

### Coach Assessment (Hiring)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/coach-assessment/chat` | POST | AI-powered coach assessment chat |
| `/api/coach-assessment/calculate-score` | POST | Calculate coach assessment score |
| `/api/coach-assessment/interview-feedback` | POST | Interview feedback submission |
| `/api/coach-assessment/schedule-interview` | POST | Schedule coach interview |
| `/api/coach-application/[id]` | GET/PATCH | Get/update coach application |

### Admin Endpoints (~35 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/dashboard` | GET | Admin dashboard stats |
| `/api/admin/crm/leads` | GET | CRM leads view |
| `/api/admin/crm/coaches` | GET | CRM coaches view |
| `/api/admin/crm/funnel` | GET | Sales funnel data |
| `/api/admin/crm/pipeline-stats` | GET | Pipeline statistics |
| `/api/admin/crm/daily-stats` | GET | Daily CRM stats |
| `/api/admin/crm/interactions` | GET/POST | Lead interactions |
| `/api/admin/crm/export` | GET | Export CRM data |
| `/api/admin/coach-applications` | GET | List coach applications |
| `/api/admin/coach-applications/[id]` | GET/PATCH | Manage coach application |
| `/api/admin/coach-applications/send-confirmation` | POST | Send application confirmation |
| `/api/admin/coaches/generate-referral` | POST | Generate referral code for coach |
| `/api/admin/enrollments` | GET | List enrollments |
| `/api/admin/completion/list` | GET | List completion-eligible enrollments |
| `/api/admin/completion/extend` | POST | Extend enrollment |
| `/api/admin/completion/send-final-assessment` | POST | Send final assessment |
| `/api/admin/coupons` | GET/POST | Coupon management |
| `/api/admin/coupons/[id]` | PATCH/DELETE | Update/delete coupon |
| `/api/admin/agreements` | GET/POST | Coach agreements |
| `/api/admin/agreements/upload` | POST | Upload agreement document |
| `/api/admin/agreements/[id]` | PATCH | Update agreement |
| `/api/admin/group-classes` | GET/POST | Group class management |
| `/api/admin/group-classes/options` | GET | Group class options |
| `/api/admin/group-classes/[sessionID]` | PATCH | Update group class |
| `/api/admin/payouts` | GET/POST | Coach payout management |
| `/api/admin/tds` | GET | TDS (tax) tracking |
| `/api/admin/pricing` | GET/POST | Pricing management |
| `/api/admin/revenue-config` | GET/POST | Revenue split configuration |
| `/api/admin/session-stats` | GET | Session statistics |
| `/api/admin/settings` | GET/POST | Admin settings |
| `/api/admin/feature-flags` | GET/POST | Feature flags |
| `/api/admin/features` | GET | Feature configuration |
| `/api/admin/testimonials` | GET/POST | Testimonial management |
| `/api/admin/generate-embeddings` | POST | Generate RAI embeddings |
| `/api/admin/setup-qstash-schedules` | POST | Initialize QStash cron schedules |
| `/api/admin/shadow` | POST | Shadow login |
| `/api/admin/scheduling/queue` | GET | View scheduling queue |

### E-Learning (~12 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/elearning/dashboard` | GET | E-learning dashboard data |
| `/api/elearning/progress` | GET | Child progress data |
| `/api/elearning/session` | GET/POST | E-learning session management |
| `/api/elearning/unit/[unitId]` | GET | Unit content |
| `/api/elearning/video/[videoId]` | GET | Video content |
| `/api/elearning/videos/[videoId]/progress` | POST | Track video progress |
| `/api/elearning/quiz/[quizId]` | GET | Quiz content |
| `/api/elearning/quiz-questions` | GET | Quiz questions |
| `/api/elearning/submit-quiz` | POST | Submit quiz answers |
| `/api/elearning/complete` | POST | Mark e-learning module complete |
| `/api/elearning/games/[gameId]` | GET | Game content |
| `/api/elearning/gamification` | GET | XP, badges, streaks |
| `/api/elearning/avatar` | GET/POST | Child avatar management |

### Group Classes (~8 routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/group-classes` | GET | List available group classes |
| `/api/group-classes/sessions` | GET | Available sessions |
| `/api/group-classes/sessions/[sessionID]` | GET | Session details |
| `/api/group-classes/page-settings` | GET | Group classes page settings |
| `/api/group-classes/register` | POST | Register for group class |
| `/api/group-classes/verify-payment` | POST | Verify group class payment |
| `/api/group-classes/validate-coupon` | POST | Validate coupon for group class |
| `/api/group-classes/resend-confirmation` | POST | Resend registration confirmation |

### Other Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/settings` | GET | Public site settings |
| `/api/settings/durations` | GET | Session duration settings |
| `/api/settings/coach` | GET/POST | Coach-specific settings |
| `/api/pricing` | GET | Public pricing data |
| `/api/products` | GET | Product catalog |
| `/api/features` | GET | Feature flags (public) |
| `/api/testimonials` | GET | Public testimonials |
| `/api/availability` | GET | Coach availability |
| `/api/matching` | POST | Coach-student matching |
| `/api/messages` | GET/POST | Messaging |
| `/api/referral/track` | POST | Track referral click |
| `/api/parent/dashboard` | GET | Parent dashboard data |
| `/api/parent/progress` | GET | Child progress for parent |
| `/api/parent/enrolled-child` | GET | Get enrolled child info |
| `/api/parent/referral` | GET | Parent referral info |
| `/api/parent/referral/generate` | POST | Generate referral link |
| `/api/support/tickets` | GET/POST | Support ticket management |
| `/api/support/tickets/[id]` | GET/PATCH | Individual ticket |
| `/api/nps` | POST | Submit NPS score |
| `/api/nps/[enrollmentId]` | GET | Get NPS data |
| `/api/completion/trigger/[enrollmentId]` | POST | Trigger completion flow |
| `/api/completion/data/[enrollmentId]` | GET | Get completion data |
| `/api/completion/report/[enrollmentId]` | GET | Completion report |
| `/api/certificate/generate` | POST | Generate PDF certificate |
| `/api/enrollment/[id]` | GET/PATCH | Enrollment details |
| `/api/enrollment/pause` | POST | Pause enrollment |
| `/api/email/enrollment-confirmation` | POST | Send enrollment confirmation email |
| `/api/agreement/config` | GET | Agreement configuration |
| `/api/agreement/active` | GET | Active agreement check |
| `/api/agreement/sign` | POST | Sign coach agreement |
| `/api/recall/bot` | POST | Create Recall.ai bot |
| `/api/quiz/generate` | POST | Generate quiz questions |
| `/api/quiz/submit` | POST | Submit quiz answers |
| `/api/quiz/bank` | GET | Quiz question bank |
| `/api/skill-tags` | GET | Skill tag list |
| `/api/scheduling/hold` | POST | Hold scheduling slot |
| `/api/scheduling/dispatch` | POST | Dispatch scheduling event |
| `/api/ab-track` | POST | A/B test tracking |
| `/api/activity/track` | POST | User activity tracking |
| `/api/coupons/validate` | POST | Validate coupon code |
| `/api/coupons/calculate` | POST | Calculate coupon discount |
| `/api/waitlist` | POST | Join product waitlist |
| `/api/sentry-example-api` | GET | Sentry test endpoint |
| `/api/test/*` | Various | Test endpoints |

---

## 5. AUTHENTICATION

### Dual Auth System

The codebase uses **two authentication systems** in parallel:

#### 1. NextAuth.js (Primary for Coach & Admin Portals)

- **File:** `C:\yestoryd-mvp\lib\auth-options.ts`
- **Provider:** Google OAuth only (GoogleProvider)
- **Session Strategy:** JWT (30-day expiry)
- **Role Determination:** On sign-in, the system queries Supabase to determine role:
  1. Check admin email whitelist (hardcoded in `auth-options.ts` and `middleware.ts`)
  2. Query `coaches` table (email match + is_active)
  3. Query `parents` table (email match)
  4. Default: "unknown" role
- **JWT contains:** user ID, email, role, coachId, parentId
- **Sign-in side effects:** Creates/updates parent record, logs auth event to `activity_log`
- **Route handler:** `C:\yestoryd-mvp\app\api\auth\[...nextauth]\route.ts`

#### 2. Supabase Auth (Used in Middleware for Session Validation)

- **File:** `C:\yestoryd-mvp\middleware.ts`
- Uses `@supabase/ssr` `createServerClient` to validate sessions via `getUser()`
- Used for parent portal authentication (checks `user_metadata.role === 'parent'`)

### Admin Email Whitelist

Hardcoded in two places:

1. `C:\yestoryd-mvp\middleware.ts` lines 42-48:
   - rucha.rai@yestoryd.com
   - rucha@yestoryd.com
   - amitkrai17@gmail.com
   - amitkrai17@yestoryd.com
   - engage@yestoryd.com

2. `C:\yestoryd-mvp\lib\auth-options.ts` lines 27-32:
   - amitkrai17@yestoryd.com
   - engage@yestoryd.com
   - rucha.rai@yestoryd.com

### Route Protection (Middleware)

File: `C:\yestoryd-mvp\middleware.ts`

**Protected Routes:**
- `/admin` -- requires admin email whitelist
- `/coach/dashboard`, `/coach/sessions`, `/coach/students`, `/coach/payouts` -- requires active coach in DB
- `/parent/dashboard`, `/parent/progress`, `/parent/sessions` -- requires `user_metadata.role === 'parent'`

**Public Routes (bypass auth):**
- `/admin/login`, `/admin`, `/coach/login`, `/coach`, `/parent/login`, `/parent`, `/login`, `/register`, `/assessment`, `/discovery`, `/api`, `/images`

**Note:** There is a logical conflict: `/admin` is listed in both PROTECTED_ROUTES and PUBLIC_ROUTES. The `isPublicRoute` check runs first, so the admin landing page is effectively public.

### Subdomain Routing

The middleware handles coach subdomains:
- Production: `{coach}.yestoryd.com` rewrites to `/coach/{subdomain}`
- Development: `?coach=name` query param rewrites to `/coach/name`
- Reserved subdomains: www, admin, api, app, dashboard, mail, email

### API Route Protection Patterns

1. **NextAuth session check:** `C:\yestoryd-mvp\lib\auth.ts` provides `getAuthUser()`, `requireAdmin()`, `requireAuth()`, `withAuth()` wrappers
2. **Direct Supabase admin client:** Many API routes simply use `supabaseAdmin` with service role key and do not check authentication at all (e.g., assessment results, payment endpoints, public settings)
3. **API routes are exempted from middleware auth** (line 85: `pathname.startsWith('/api')` returns NextResponse.next())

---

## 6. THIRD-PARTY INTEGRATIONS

### 6.1 Razorpay (Payments)

- **Library:** `razorpay` ^2.9.6
- **Files:** `C:\yestoryd-mvp\lib\razorpay.ts`, `C:\yestoryd-mvp\app\api\payment\create\route.ts`, `C:\yestoryd-mvp\app\api\payment\verify\route.ts`, `C:\yestoryd-mvp\app\api\payment\webhook\route.ts`
- **Flow:**
  1. `/api/payment/create` creates Razorpay order with server-controlled pricing from `pricing_plans` table
  2. Frontend opens Razorpay checkout modal
  3. `/api/payment/verify` validates signature using HMAC-SHA256, creates enrollment
  4. `/api/payment/webhook` receives async Razorpay webhooks as backup (handles race conditions via unique constraints)
- **Webhook signature:** HMAC-SHA256 with timing-safe comparison
- **Idempotency:** Uses `processed_webhooks` table to prevent duplicate processing
- **Status:** LIVE (production keys)

### 6.2 AiSensy (WhatsApp)

- **File:** `C:\yestoryd-mvp\lib\communication\aisensy.ts`
- **API:** `https://backend.aisensy.com/campaign/t1/api/v2`
- **Pattern:** Template-based messaging. Templates are stored in `communication_templates` table with `wa_template_name` and `wa_variables` columns.
- **Phone formatting:** Uses `C:\yestoryd-mvp\lib\utils\phone.ts` for international format
- **Usage:** Session reminders, assessment follow-ups, enrollment confirmations, admin alerts, discovery call notifications, no-show alerts
- **Orchestrated by:** Central communication engine at `C:\yestoryd-mvp\lib\communication\index.ts`

### 6.3 SendGrid (Email)

- **File:** `C:\yestoryd-mvp\lib\communication\sendgrid.ts`
- **API:** `https://api.sendgrid.com/v3/mail/send`
- **Supports:** Both inline HTML emails and SendGrid dynamic templates (template_id)
- **Default sender:** engage@yestoryd.com / "Yestoryd"
- **Orchestrated by:** Central communication engine

### 6.4 Google Calendar API

- **File:** `C:\yestoryd-mvp\lib\googleCalendar.ts`
- **Auth:** Service account with domain-wide delegation (impersonates engage@yestoryd.com)
- **Features:**
  - Create coaching sessions (45 min) and parent check-ins (30 min) with Google Meet links
  - Create discovery call events (30 min) with Meet links
  - Get available slots (freebusy query)
  - Reschedule, cancel, delete events
  - Update event attendees (add/remove coaches)
- **Session schedule:** 9 sessions over 12 weeks (6 coaching + 3 parent check-ins)
- **Discovery slot windows:** Mon-Sat, 10AM-1PM and 5PM-7PM IST

### 6.5 Cal.com (Discovery Calls - Legacy)

- **Webhook:** `C:\yestoryd-mvp\app\api\webhooks\cal\route.ts`
- **Event:** Processes `BOOKING_CREATED` events for discovery calls
- **Features:**
  - Extracts parent/child info from Cal.com response objects
  - Auto-assigns coach using round-robin (least recently assigned, excluding unavailable/exiting coaches)
  - Auto-links to existing child records by email+name match
  - Creates `discovery_calls` record in Supabase
- **Note:** The platform also has a native discovery booking system (`/api/discovery-call/create`) that directly uses Google Calendar

### 6.6 Recall.ai (Session Recording)

- **Files:** `C:\yestoryd-mvp\lib\recall-auto-bot.ts`, `C:\yestoryd-mvp\app\api\webhooks\recall\route.ts`, `C:\yestoryd-mvp\app\api\jobs\process-session\route.ts`
- **API:** `https://us-west-2.recall.ai/api/v1`
- **Flow:**
  1. After enrollment, bots are scheduled for each session via `createRecallBot()` (joins 1 min early)
  2. Recall.ai sends webhooks: `bot.status_change`, `bot.transcription`, `bot.recording_ready`, `bot.done`
  3. On `bot.done`: Quick attendance analysis, outcome determination, then heavy processing queued to QStash
  4. Background job: AI transcript analysis (Gemini), audio storage, embedding generation, notification sending
- **Attendance detection:** Analyzes participants to determine coach/child presence, session validity (min 10 min, min 2 participants)
- **Smart chunking:** Keeps beginning (40%) + end (40%) of transcript, summarizes middle for payload size limits
- **Bot settings:** 10min waiting room timeout, 5min no-one-joined timeout, 1min everyone-left timeout

### 6.7 Gemini AI (Google)

- **Files:** `C:\yestoryd-mvp\lib\gemini\client.ts`, `C:\yestoryd-mvp\lib\ai\provider.ts`
- **Libraries:** `@google/generative-ai` (direct), `@ai-sdk/google` + `ai` (Vercel AI SDK)
- **Model:** Gemini 2.5 Flash Lite
- **Usage:**
  - Reading assessment analysis (score generation, phonics analysis, error classification)
  - Session transcript analysis (post-session AI summary)
  - rAI chatbot (conversational reading intelligence assistant)
  - Coach assessment (hiring evaluation)
  - Embedding generation for hybrid search (pgvector)

### 6.8 QStash / Upstash (Background Jobs)

- **File:** `C:\yestoryd-mvp\lib\qstash.ts`
- **Library:** `@upstash/qstash` ^2.8.4
- **Jobs queued:**
  - `enrollment-complete`: Calendar scheduling, notifications, recording bot setup
  - `process-session`: AI analysis, audio download, embeddings
  - `goals-capture`: Periodic check (every 5 min)
  - `send-notification`: Delayed notifications
  - `send-communication`: Template-based messaging
  - `send-discovery-notification`: Discovery call confirmations
  - `update-calendar-attendee`: Calendar attendee changes
  - `daily-lead-digest`: Morning admin summary (9:15 AM IST)
  - `hot-lead-alert`: Urgent admin notification for low-scoring assessments
- **Redis:** `@upstash/redis` for idempotency keys and circuit breaker state

### 6.9 Google Analytics (GA4)

- **File:** `C:\yestoryd-mvp\components\GoogleAnalytics.tsx`
- **Measurement ID:** G-1KJ6P709KZ (hardcoded fallback, overridable via env)
- **Tracked Events:**
  - Assessment: started, completed, passage_played, recording_started/completed
  - Conversion: cta_clicked, coach_call_booked, enrollment_started, purchase
  - User: sign_up, login
  - Engagement: whatsapp_clicked, results_shared
  - Coach: application_started/submitted, assessment_started/completed, onboarding

### 6.10 Tracking Pixels

- **File:** `C:\yestoryd-mvp\components\TrackingPixels.tsx`
- Loaded in root layout alongside Google Analytics

### 6.11 Sentry (Error Monitoring)

- **Library:** `@sentry/nextjs` ^10.32.1
- **DSN:** Configured via SENTRY_DSN env var
- **Test endpoint:** `/api/sentry-example-api`

### 6.12 Google Sheets (Legacy)

- **File:** `C:\yestoryd-mvp\lib\google\sheets.ts`
- Uses same service account as Calendar
- Referenced in `.env.example` (GOOGLE_SHEET_ID) -- likely legacy before Supabase migration

---

## 7. FRONTEND

### Page Inventory

#### Public Pages

| Page | File | Purpose |
|------|------|---------|
| Home | `app/page.tsx` + `app/(home)/_components/` | Marketing landing page with Hero, Problem, Story, ARC, Journey, rAI, Pricing, Testimonials, Transformation, CTA sections |
| Assessment | `app/assessment/page.tsx` | Free 5-min AI reading assessment |
| Assessment Results | `app/assessment/results/[id]/page.tsx` | Score display with detailed breakdown |
| Final Assessment | `app/assessment/final/page.tsx` | Post-program final assessment |
| Let's Talk | `app/lets-talk/page.tsx` | Discovery call booking |
| Booking Confirmed | `app/booking-confirmed/page.tsx` | Post-booking confirmation |
| Enroll | `app/enroll/page.tsx` | Enrollment & payment page |
| Checkout | `app/checkout/page.tsx` | Payment checkout |
| Enrollment Success | `app/enrollment/success/page.tsx` | Post-payment success |
| Completion | `app/completion/[enrollmentId]/page.tsx` | Program completion + certificate |
| NPS Survey | `app/nps/[enrollmentId]/page.tsx` | Net Promoter Score survey |
| Group Classes | `app/classes/page.tsx` | Group class listings |
| Class Registration | `app/classes/register/[sessionID]/page.tsx` | Register for group class |
| Privacy Policy | `app/privacy/page.tsx` | Privacy policy |
| Terms of Service | `app/terms/page.tsx` | Terms of service |
| Yestoryd Academy | `app/yestoryd-academy/page.tsx` | Coach recruitment landing |
| Academy Apply | `app/yestoryd-academy/apply/page.tsx` | Coach application form |
| Academy Assessment | `app/yestoryd-academy/assessment/page.tsx` | Coach assessment |
| Academy Qualify | `app/yestoryd-academy/qualify/page.tsx` | Coach qualification check |
| Offline | `app/offline/page.tsx` | PWA offline fallback |

#### Parent Portal

| Page | File | Purpose |
|------|------|---------|
| Login | `app/parent/login/page.tsx` | Parent login (Google OAuth) |
| Dashboard | `app/parent/dashboard/page.tsx` | Overview: enrollment, sessions, progress |
| Progress | `app/parent/progress/page.tsx` | Child progress tracking |
| Sessions | `app/parent/sessions/page.tsx` | Session schedule & history |
| E-Learning | `app/parent/elearning/page.tsx` | E-learning module access |
| Support | `app/parent/support/page.tsx` | Support ticket system |
| Book Skill Booster | `app/parent/book-skill-booster/[sessionId]/page.tsx` | Book additional sessions |

#### Coach Portal

| Page | File | Purpose |
|------|------|---------|
| Login | `app/coach/login/page.tsx` | Coach login |
| Dashboard | `app/coach/dashboard/page.tsx` | Overview: today's sessions, students |
| Sessions | `app/coach/sessions/page.tsx` | Session list & management |
| Session Prep | `app/coach/sessions/[sessionId]/prep/page.tsx` | Pre-session brief with child history |
| Students | `app/coach/students/page.tsx` | Student roster |
| Student Detail | `app/coach/students/[id]/page.tsx` | Individual student profile |
| Discovery Calls | `app/coach/discovery-calls/page.tsx` | Assigned discovery calls |
| Discovery Call Detail | `app/coach/discovery-calls/[id]/page.tsx` | Individual call details |
| Earnings | `app/coach/earnings/page.tsx` | Earnings & payouts |
| AI Assistant | `app/coach/ai-assistant/page.tsx` | rAI coaching assistant |
| Templates | `app/coach/templates/page.tsx` | Communication templates |
| Profile | `app/coach/profile/page.tsx` | Coach profile management |
| Onboarding | `app/coach/onboarding/page.tsx` | New coach onboarding flow |
| Confirm | `app/coach/confirm/page.tsx` | Session confirmation |
| Subdomain | `app/coach/[subdomain]/page.tsx` | Coach's branded landing page |

#### Admin Portal

| Page | File | Purpose |
|------|------|---------|
| Login | `app/admin/login/page.tsx` | Admin login |
| Dashboard | `app/admin/page.tsx` | Admin home/dashboard |
| CRM | `app/admin/crm/page.tsx` | Leads, pipeline, funnel |
| Coaches | `app/admin/coaches/page.tsx` | Coach management |
| Coach Applications | `app/admin/coach-applications/page.tsx` | Review applications |
| Coach Groups | `app/admin/coach-groups/page.tsx` | Coach group management |
| Enrollments | `app/admin/enrollments/page.tsx` | Enrollment management |
| Completion | `app/admin/completion/page.tsx` | Program completion management |
| Payments | `app/admin/payments/page.tsx` | Payment records |
| Payouts | `app/admin/payouts/page.tsx` | Coach payout management |
| TDS | `app/admin/tds/page.tsx` | Tax deduction tracking |
| Coupons | `app/admin/coupons/page.tsx` | Coupon management |
| Group Classes | `app/admin/group-classes/page.tsx` | Group class admin |
| Agreements | `app/admin/agreements/page.tsx` | Coach agreement management |
| Site Settings | `app/admin/site-settings/page.tsx` | Dynamic site content management |
| Settings | `app/admin/settings/page.tsx` | General admin settings |
| Pricing Settings | `app/admin/settings/pricing/page.tsx` | Product pricing management |
| Revenue Settings | `app/admin/settings/revenue/page.tsx` | Revenue split configuration |
| Analytics | `app/admin/analytics/page.tsx` | Platform analytics |
| E-Learning | `app/admin/elearning/page.tsx` | E-learning content management |
| Communication | `app/admin/communication/page.tsx` | Communication template management |
| Waitlist | `app/admin/waitlist/page.tsx` | Pre-launch waitlist management |
| Scheduling Queue | `app/admin/scheduling/queue/page.tsx` | Failed scheduling queue |

#### Child E-Learning Portal

| Page | File | Purpose |
|------|------|---------|
| Play | `app/child/[childId]/play/page.tsx` | Child's game portal |
| Unit | `app/child/[childId]/unit/[unitId]/page.tsx` | Learning unit |
| Quest | `app/child/[childId]/quest/[unitId]/page.tsx` | Quest/mission page |

### Key Component Groups

**Home Page Sections** (`app/(home)/_components/`):
- HeroSection, ProblemSection, StorySection, ArcSection, JourneySection, RaiSection, PricingSection, TestimonialsSection, TransformationSection, CtaSection, FloatingElements, HeaderNav

**Assessment:** AudioRecorderCheck, GoalsCapture

**Booking:** SlotPicker, FlightStyleSlotPicker, AvailabilityCalendar

**Coach Portal:** SessionCard, PostSessionForm (multi-step: QuickPulse, DeepDive, Planning, Review), PreSessionBrief, EarningsOverview, CoachTierCard, CoachAvailabilityCard, StudentCard, ActionDropdown, SkillBoosterSection

**Parent Portal:** ParentLayout, PauseEnrollmentCard, PendingSkillBoosterCard, ReferralsTab, SessionActionsCard

**Child Portal:** AvatarSelector, MascotGuide, ChildHeader, BottomNav, StatsBar, LearningPathCarousel, QuestCard, XPProgressBar, StreakFlame, TodaysFocus, BadgeUnlock, ParentGate

**E-Learning:** VideoPlayer, QuizPlayer, GamificationHeader, GamificationDisplay, JourneyMap, CelebrationOverlay, XPAwardPopup, BadgesModal, Leaderboard, MissionCard, DailyGoalCard, AskRAIModal

**Games:** PhonicsPopGame, WordMatchGame

**Chat:** ChatWidget (two versions -- shared and rAI-specific), RAIHeroCard

**Shared:** Header, Footer, PortalLayout (with Sidebar, BottomNav, MobileHeader), CoachCard, RescheduleModal, ProgressChart, SkillTagSelector, SessionFeedbackForm, GoalIcon

**UI Primitives:** button, card, modal, badge, skeleton, spinner, label, PhoneInput, DateTimePicker

**PWA:** PWAProvider, InstallPrompt

### Design System

- **Fonts:** Plus Jakarta Sans (headings), Inter (body), Lexend (reading content)
- **Theme:** Dark background (`bg-surface-0`, `text-white`)
- **Brand color:** #FF0099 (theme-color)
- **Mobile-first:** Viewport locked (max-scale=1, user-scalable=false)
- **Design tokens:** `C:\yestoryd-mvp\lib\design-tokens.ts`

---

## 8. ENVIRONMENT VARIABLES

From `C:\yestoryd-mvp\.env.example`:

### Google Workspace
| Key | Purpose |
|-----|---------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account for Calendar/Sheets |
| `GOOGLE_PRIVATE_KEY` | Service account private key |
| `GOOGLE_SHEET_ID` | Legacy Google Sheets database |

### Google OAuth (NextAuth)
| Key | Purpose |
|-----|---------|
| `GOOGLE_CLIENT_ID` | OAuth client ID (referenced in auth-options.ts) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |

### Gemini AI
| Key | Purpose |
|-----|---------|
| `GEMINI_API_KEY` | Google Gemini API key |

### Razorpay
| Key | Purpose |
|-----|---------|
| `RAZORPAY_KEY_ID` | Razorpay API key (exposed to frontend) |
| `RAZORPAY_KEY_SECRET` | Razorpay secret (server-only) |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC verification secret |

### Application URLs
| Key | Purpose |
|-----|---------|
| `NEXT_PUBLIC_BASE_URL` | Base URL (localhost:3000 or yestoryd.com) |
| `NEXT_PUBLIC_API_URL` | API base URL |
| `NEXT_PUBLIC_APP_URL` | App URL (used by QStash for job targets) |

### Default Coach
| Key | Purpose |
|-----|---------|
| `DEFAULT_COACH_ID` | Default coach (Rucha) |
| `DEFAULT_COACH_NAME` | Default coach name |
| `DEFAULT_COACH_EMAIL` | Default coach email |

### Revenue
| Key | Purpose |
|-----|---------|
| `COACH_REVENUE_PERCENTAGE` | Coach share (70%) |
| `PLATFORM_REVENUE_PERCENTAGE` | Platform share (30%) |
| `RUCHA_COACH_ID` | Rucha's coach ID (for 100% platform split) |

### Supabase
| Key | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (server-only, bypasses RLS) |

### Upstash Redis
| Key | Purpose |
|-----|---------|
| `UPSTASH_REDIS_REST_URL` | Redis endpoint for idempotency/circuit breaker |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |

### Upstash QStash
| Key | Purpose |
|-----|---------|
| `QSTASH_URL` | QStash endpoint |
| `QSTASH_TOKEN` | QStash auth token |
| `QSTASH_CURRENT_SIGNING_KEY` | Webhook verification |
| `QSTASH_NEXT_SIGNING_KEY` | Key rotation |

### SendGrid
| Key | Purpose |
|-----|---------|
| `SENDGRID_API_KEY` | SendGrid email API key |
| `SENDGRID_FROM_EMAIL` | Sender email (default: engage@yestoryd.com) |
| `SENDGRID_FROM_NAME` | Sender name (default: Yestoryd) |

### AiSensy
| Key | Purpose |
|-----|---------|
| `AISENSY_API_KEY` | AiSensy WhatsApp API key |
| `AISENSY_BASE_URL` | AiSensy API base URL (optional) |

### Recall.ai
| Key | Purpose |
|-----|---------|
| `RECALL_API_KEY` | Recall.ai API key for bot creation |
| `RECALL_WEBHOOK_SECRET` | Webhook signature verification |

### Sentry
| Key | Purpose |
|-----|---------|
| `SENTRY_DSN` | Sentry error reporting DSN |

### Analytics
| Key | Purpose |
|-----|---------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 measurement ID (fallback: G-1KJ6P709KZ) |

### NextAuth
| Key | Purpose |
|-----|---------|
| `NEXTAUTH_SECRET` | JWT signing secret |

### Google Calendar
| Key | Purpose |
|-----|---------|
| `GOOGLE_CALENDAR_DELEGATED_USER` | User to impersonate (default: engage@yestoryd.com) |
| `GOOGLE_CALENDAR_EMAIL` | Calendar email for events |

---

## 9. DEPLOYMENT

### Hosting

**Vercel** -- Auto-deploy on push to `main` branch.

### Build

```bash
npm run build  # next build
```

### Runtime

- **Framework:** Next.js 14 on Vercel Serverless Functions
- **Region:** Not specified in config (likely auto/US)
- **Edge:** Middleware runs on Vercel Edge Runtime

### Domain

- **Production:** `yestoryd.com` / `www.yestoryd.com`
- **Coach subdomains:** `{coach-name}.yestoryd.com`
- **Preview:** Vercel preview URLs (`*.vercel.app`)

### PWA Support

- Service worker registered via `PWAProvider` component
- Manifest at `/manifest.json`
- Offline page at `/offline`
- Apple Web App capable with black-translucent status bar

### CI/CD

No CI/CD pipeline files visible (no GitHub Actions, no Vercel config files). Deployment appears to be Vercel's automatic Git integration.

### Quality Checks

```bash
npm run quality    # typecheck + lint
npm run test       # jest
npm run test:scheduling  # scheduling-specific tests
```

### Infrastructure Dependencies

| Service | Purpose | Failure Impact |
|---------|---------|----------------|
| Vercel | Hosting, serverless functions | Complete outage |
| Supabase | Database, auth | Complete outage |
| Razorpay | Payments | Cannot process payments |
| Google Cloud | Calendar, Meet, AI | No scheduling, no AI assessment |
| Upstash | Background jobs, rate limiting | Jobs fail silently (graceful degradation) |
| AiSensy | WhatsApp messaging | No WhatsApp notifications |
| SendGrid | Email | No email notifications |
| Recall.ai | Session recording | No session transcripts |
| Sentry | Error monitoring | Silent failures |

---

## 10. DATA FLOW

### Complete Parent Journey: Assessment to Enrollment to Sessions

#### Phase 1: Free Assessment

```
1. Parent visits yestoryd.com
   -> Home page loads (SSR) with dynamic content from site_settings
   -> Google Analytics tracks page view

2. Parent clicks "Reading Test - Free" CTA
   -> analytics.ctaClicked() fires
   -> Navigates to /assessment

3. Parent enters child info (name, age, parent details)
   -> Data stored client-side initially

4. Child reads passage (age-appropriate), audio recorded in browser
   -> analytics.recordingStarted() / recordingCompleted()

5. Recording submitted to Gemini AI for analysis
   -> AI returns: score, clarity, fluency, speed, WPM, errors, strengths,
      areas_to_improve, phonics_analysis, error_classification, skill_breakdown

6. Results saved to Supabase:
   -> INSERT into `children` table (child_name, age, parent_email, etc.)
   -> INSERT into `learning_events` table (event_type='assessment', event_data=AI results)
   -> Child gets lead_status='assessed'
   -> analytics.assessmentCompleted() fires

7. Parent sees results at /assessment/results/[childId]
   -> GET /api/assessment/results/[childId] fetches combined child + learning_event data

8. If score is low -> QStash queues hot lead alert for admin
   -> POST /api/leads/hot-alert (admin WhatsApp/email notification)

9. Goals capture triggered 30 min after assessment (QStash cron)
   -> POST /api/jobs/goals-capture sends P7 WhatsApp via AiSensy
```

#### Phase 2: Discovery Call

```
10. Parent books discovery call (two paths):

    Path A - Native booking (/lets-talk):
    -> GET discovery slots from Google Calendar (freebusy API)
    -> Parent selects slot
    -> POST /api/discovery-call/create
       -> Google Calendar event created with Meet link
       -> INSERT into discovery_calls (status='scheduled')
       -> Coach auto-assigned (round-robin)
       -> QStash queues notifications (WhatsApp + email)

    Path B - Cal.com booking:
    -> Parent uses Cal.com widget
    -> Cal.com sends BOOKING_CREATED webhook to /api/webhooks/cal
       -> Coach auto-assigned (round-robin, excludes unavailable/exiting)
       -> Auto-links to children table by email+name match
       -> INSERT into discovery_calls
       -> Updates coach.last_assigned_at for round-robin fairness

11. Coach receives notification of assignment
    -> POST /api/coach/notify-assignment
    -> WhatsApp + email via communication engine

12. Discovery call happens on Google Meet
    -> Coach discusses child's assessment results
    -> If parent interested -> proceed to enrollment
```

#### Phase 3: Payment & Enrollment

```
13. Parent navigates to /enroll
    -> Selects product (starter, continuation, or full)
    -> Product pricing loaded from pricing_plans table (server-controlled)
    -> Optional coupon code applied and validated server-side

14. POST /api/payment/create
    -> Validates input with Zod schema
    -> Rate limit check (5/min/email)
    -> Fetches product from pricing_plans (checks is_locked, is_active)
    -> Validates coupon (expiry, usage limits, applicable products)
    -> Validates referral credits
    -> Calculates final amount (base - coupon - referral, min Rs.1)
    -> UPSERT parent record (race-safe)
    -> GET/CREATE child record
    -> Creates Razorpay order (server-controlled amount)
    -> INSERT into bookings (status='confirmed')
    -> Returns orderId, amount, key to frontend

15. Frontend opens Razorpay checkout modal
    -> Parent completes payment (card/UPI/netbanking)

16. Two parallel paths handle payment confirmation:

    Path A - Frontend verify (fast):
    -> POST /api/payment/verify
       -> HMAC-SHA256 signature verification
       -> Razorpay API: fetch order to verify amount matches
       -> INSERT into payments (status='captured')
       -> INSERT into enrollments (status='active', 3-month program)
       -> UPDATE children (enrollment_status='enrolled')
       -> QStash: queue enrollment-complete job
       -> Scheduling: create sessions via scheduling orchestrator
       -> Redirect to /enrollment/success

    Path B - Razorpay webhook (backup):
    -> POST /api/payment/webhook
       -> HMAC-SHA256 signature verification (timing-safe)
       -> Idempotency check (processed_webhooks table)
       -> If enrollment already created by /verify -> return already_processed
       -> Same enrollment creation logic as /verify
       -> Race condition: unique constraint on enrollments.payment_id
         -> If 23505 error, gracefully handles as "already processed"
       -> QStash: queue enrollment-complete job
```

#### Phase 4: Session Scheduling

```
17. QStash processes enrollment-complete job
    -> POST /api/jobs/enrollment-complete
    -> Scheduling orchestrator (lib/scheduling/orchestrator.ts):
       a. Smart slot finder finds available times respecting:
          - Coach schedule rules
          - Coach unavailability periods
          - Existing calendar events (freebusy)
          - Parent preferences
       b. Creates 9 Google Calendar events (6 coaching + 3 check-ins)
          - Each event gets Google Meet link
          - Attendees: parent, coach, platform email
       c. INSERT into scheduled_sessions (one per session)
       d. If slot finding fails -> INSERT into scheduling_queue for manual resolution
       e. Retry mechanism: scheduling_attempts, next_retry_at

18. Recall.ai bots scheduled for each session
    -> POST to Recall.ai API for each session
    -> INSERT into recall_bot_sessions
    -> UPDATE scheduled_sessions with recall_bot_id

19. Notifications sent:
    -> WhatsApp: Welcome message, schedule confirmation
    -> Email: Enrollment confirmation with schedule details
    -> Coach notified of new student assignment
```

#### Phase 5: Coaching Sessions

```
20. Before each session:
    -> Cron: coach-reminders-1h sends reminder to coach
    -> Coach views session prep at /coach/sessions/[id]/prep
       -> Pre-session brief with child history, previous session notes

21. Session happens:
    -> Recall.ai bot joins Google Meet 1 min early
    -> Bot status changes: joining -> in_waiting_room -> in_call_recording
    -> Webhooks track status in real-time
    -> If no-show detected (timeout) -> notification queued for admin

22. After session:
    -> Recall.ai bot.done webhook fires
    -> Quick attendance analysis (participants, duration)
    -> Outcome determined (completed/no_show/coach_no_show/partial)
    -> Heavy processing queued to QStash:
       a. Transcript built with speaker labels (COACH/CHILD)
       b. Smart truncation (40% beginning + 40% end)
       c. Gemini AI analyzes transcript
       d. Embedding generated (pgvector)
       e. INSERT into learning_events
       f. Session status updated to 'completed'

23. Coach completes post-session form:
    -> Multi-step form: Quick Pulse -> Deep Dive -> Planning -> Review
    -> POST /api/coach/sessions/[id]/complete
    -> Parent update sent via WhatsApp/email
```

#### Phase 6: Program Completion

```
24. After all sessions complete (or program end date reached):
    -> Cron: enrollment-lifecycle processes state transitions
    -> POST /api/completion/trigger/[enrollmentId]

25. Final assessment:
    -> Admin sends final assessment link
    -> Parent/child completes assessment at /assessment/final

26. Completion page at /completion/[enrollmentId]:
    -> GET /api/completion/data/[enrollmentId]
    -> PDF certificate generated via @react-pdf/renderer
    -> NPS survey at /nps/[enrollmentId]

27. Revenue split calculated:
    -> Coach-sourced: 70% coach / 30% platform
    -> Platform-sourced: 50% / 50%
    -> Rucha direct: 100% platform
    -> 10% TDS deducted from coach share
    -> Monthly payout via cron: monthly-payouts
```

### Data Storage Summary

| Data | Where Stored | Accessed By |
|------|-------------|-------------|
| Parent accounts | `parents` table | All portals |
| Child profiles & assessment data | `children` table | Assessment, parent, coach, admin |
| Assessment AI results | `learning_events` table | Results page, rAI, coach prep |
| Discovery call bookings | `discovery_calls` table | Admin CRM, coach portal |
| Payment orders | `bookings` table + Razorpay | Payment flow |
| Captured payments | `payments` table | Admin, payouts |
| Enrollments | `enrollments` table | All portals |
| Session schedule | `scheduled_sessions` table + Google Calendar | Coach, parent, admin |
| Session recordings | Recall.ai (URL in `recall_bot_sessions`) | Coach, admin |
| Session transcripts & AI analysis | `learning_events` table | rAI, coach prep, admin |
| Communication history | `communication_logs` table | Admin |
| Site content | `site_settings` table | All public pages |
| Product pricing | `pricing_plans` table | Payment, enrollment |
| Coupons | `coupons` + `coupon_uses` tables | Payment, admin |
| Coach agreements | `agreements` table | Coach, admin |

---

*End of Technical Audit Report*
