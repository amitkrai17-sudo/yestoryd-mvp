# Yestoryd API Route Audit

**Generated:** 2026-04-11
**Total route.ts files:** 269 (excluding .deprecated)
**Total lines of code:** ~89,161

---

## Summary Stats

| Category | Count |
|----------|-------|
| INTERNAL (frontend/lib callers) | 199 |
| CRON (dispatcher-managed) | 33 |
| WEBHOOK (external callers) | 7 |
| JOB (QStash-triggered async) | 9 |
| ORPHANED (no references found) | 17 |
| SUSPECT (self-ref or comments only) | 4 |
| MISSING (referenced but no route file) | 3 |

---

## 1. CRON Routes (33 total)

### Dispatcher-managed (30 jobs in dispatcher JOBS array)

| Route Path | Methods | Lines | Schedule |
|------------|---------|-------|----------|
| `/api/cron/dispatcher` | GET, POST | 550 | QStash every 15min |
| `/api/cron/backops-signal-detector` | GET | ~100 | Every 15min |
| `/api/cron/session-completion-nudge` | GET, POST | ~144 | Every 15min |
| `/api/cron/session-start-notify` | GET | ~109 | Every 15min |
| `/api/cron/capture-reminders` | GET | 179 | Every 15min |
| `/api/cron/group-class-reminders` | GET, POST | 509 | Every 15min |
| `/api/cron/group-class-completion-nudge` | GET, POST | 298 | Every 15min |
| `/api/cron/backops-outcome-tracker` | GET | 199 | Every 30min |
| `/api/cron/payment-reconciliation-alert` | GET, POST | 400 | Every 30min |
| `/api/jobs/recall-reconciliation` | GET | 763 | Every 30min (via dispatcher) |
| `/api/cron/coach-reminders-1h` | GET, POST | 419 | Every 60min |
| `/api/cron/agent-nurture` | GET, POST | 554 | Every 120min |
| `/api/cron/lead-scoring` | POST | 336 | Daily 2:00 IST |
| `/api/cron/intelligence-profile-synthesis` | GET, POST | 301 | Daily 2:30 IST |
| `/api/cron/coach-intelligence-scores` | GET, POST | 209 | Daily 3:00 IST |
| `/api/cron/compute-insights` | GET, POST | 477 | Daily 3:30 IST |
| `/api/cron/intelligence-freshness` | GET | ~100 | Daily 6:00 IST |
| `/api/cron/micro-assessment-trigger` | GET | 228 | Daily 4:00 IST |
| `/api/cron/process-coach-unavailability` | GET, POST | ~174 | Daily 5:00 IST |
| `/api/cron/enrollment-lifecycle` | GET, POST | 597 | Daily 5:30 IST |
| `/api/cron/coach-engagement` | GET | 241 | Daily 6:00 IST |
| `/api/cron/discovery-followup` | GET, POST | 308 | Daily 6:30 IST |
| `/api/cron/smoke-test` | GET | 643 | Daily 6:45 IST |
| `/api/cron/daily-health-check` | GET | 442 | Daily 7:00 IST |
| `/api/cron/intelligence-practice-recommendations` | GET, POST | 407 | Daily 8:00 IST |
| `/api/cron/re-enrollment-nudge` | GET | 213 | Daily 9:00 IST |
| `/api/cron/daily-lead-digest` | GET, POST | 487 | Daily 9:15 IST |
| `/api/cron/practice-nudge` | GET | 255 | Daily 10:00 IST |
| `/api/cron/tuition-onboarding-nudge` | GET | 216 | Daily 11:00 IST |
| `/api/cron/payment-reconciliation` | GET, POST | 306 | Daily 22:30 IST |
| `/api/cron/compute-coach-quality` | GET, POST | 380 | Monthly 1st 6:00 IST |
| `/api/cron/monthly-payouts` | GET, POST | 242 | Monthly 7th 9:30 IST |

### Event-triggered crons (via QStash publish, NOT dispatcher)

| Route Path | Methods | Lines | Trigger |
|------------|---------|-------|---------|
| `/api/cron/group-class-insights` | POST | 269 | QStash after group class complete |
| `/api/cron/group-class-notifications` | POST | 240 | QStash after group class scheduled |
| `/api/cron/group-class-feedback-request` | POST | ~131 | QStash after group class ends |

### Separate QStash schedule

| Route Path | Methods | Lines | Schedule |
|------------|---------|-------|---------|
| `/api/jobs/goals-capture` | GET, POST | 334 | QStash every 5min |

---

## 2. WEBHOOK Routes (7 total)

| Route Path | Methods | Lines | External Caller |
|------------|---------|-------|-----------------|
| `/api/webhooks/recall` | POST, GET | 884 | Recall.ai bot status/recording |
| `/api/webhooks/cal` | POST, GET | 313 | Cal.com calendar events |
| `/api/webhooks/whatsapp-cloud` | GET, POST | 393 | Meta WhatsApp Cloud API |
| `/api/webhooks/aisensy/goals` | POST, GET | ~126 | AiSensy delivery receipts |
| `/api/webhooks/aisensy/feedback` | POST | 287 | AiSensy feedback delivery |
| `/api/payment/webhook` | POST | 1208 | Razorpay payment events |
| `/api/discovery-call/cal-webhook` | POST | ~100 | Cal.com discovery call events |

---

## 3. JOB Routes (9 total -- QStash async via lib/qstash.ts)

| Route Path | Methods | Lines | Triggered By |
|------------|---------|-------|-------------|
| `/api/jobs/enrollment-complete` | POST, GET | 1120 | Payment verify, webhook |
| `/api/jobs/process-session` | POST, GET | 827 | Session complete, recall webhook |
| `/api/jobs/post-capture-orchestrator` | POST | 289 | Coach capture submit |
| `/api/jobs/artifact-analysis` | POST | 591 | Artifact upload |
| `/api/jobs/progress-pulse` | POST | 270 | Various session events |
| `/api/jobs/update-calendar-attendee` | POST, GET | 193 | Calendar updates |
| `/api/jobs/retry-scheduling` | POST, GET | ~104 | Scheduling retry queue |
| `/api/jobs/recall-reconciliation` | GET | 763 | Dispatcher (every 30min) |
| `/api/jobs/goals-capture` | GET, POST | 334 | QStash every 5min |

---

## 4. INTERNAL Routes (199 total)

### Auth (4)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/auth/[...nextauth]` | GET, POST | ~50 |
| `/api/auth/send-otp` | POST | 355 |
| `/api/auth/verify-otp` | POST | 410 |
| `/api/auth/session` | GET | ~50 |

### Assessment (5)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/assessment/analyze` | POST, GET | 840 |
| `/api/assessment/enrolled` | POST | 189 |
| `/api/assessment/final/data` | GET | ~100 |
| `/api/assessment/final/submit` | POST | 247 |
| `/api/assessment/results/[childId]` | GET | ~100 |
| `/api/assessment/retry` | POST | 359 |

### Coach Portal (35)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/coach/ai-suggestion` | POST | 431 |
| `/api/coach/availability` | GET, POST, PUT, DELETE, PATCH | 423 |
| `/api/coach/children/[id]/homework` | GET, POST, PATCH, DELETE | 411 |
| `/api/coach/children/[id]/plan` | GET, PATCH | 283 |
| `/api/coach/children/[id]/plan/approve` | POST | ~100 |
| `/api/coach/diagnostic/[id]` | GET, POST | 307 |
| `/api/coach/earnings` | GET | ~100 |
| `/api/coach/earnings-calculator` | GET | 386 |
| `/api/coach/earnings-summary` | GET | 249 |
| `/api/coach/exit` | GET, POST, DELETE | 255 |
| `/api/coach/leaderboard` | GET | 223 |
| `/api/coach/leaderboard/opt-out` | POST | ~50 |
| `/api/coach/my-referrals` | GET | ~100 |
| `/api/coach/notify-assignment` | POST | 267 |
| `/api/coach/onboarding` | POST | 204 |
| `/api/coach/profile` | GET, POST | 211 |
| `/api/coach/reschedule-requests` | GET | ~100 |
| `/api/coach/schedule-rules` | GET, POST, PUT, DELETE | 559 |
| `/api/coach/send-status-notification` | POST | 509 |
| `/api/coach/session-prep` | GET | ~100 |
| `/api/coach/sessions` | GET | 375 |
| `/api/coach/sessions/[id]/activity-log` | POST | 473 |
| `/api/coach/sessions/[id]/brief` | GET | 463 |
| `/api/coach/sessions/[id]/complete` | POST, GET | 457 |
| `/api/coach/sessions/[id]/exit-assessment` | GET, POST | 300 |
| `/api/coach/sessions/[id]/live` | GET, POST | 451 |
| `/api/coach/sessions/[id]/offline-report` | POST | 595 |
| `/api/coach/sessions/[id]/parent-summary` | POST | 625 |
| `/api/coach/sessions/[id]/parent-update` | POST, GET | ~100 |
| `/api/coach/sessions/[id]/report-data` | GET | ~100 |
| `/api/coach/sessions/[id]/request-offline` | POST | 308 |
| `/api/coach/sessions/[id]/switch-to-online` | POST | 266 |
| `/api/coach/sessions/[id]/upload-audio` | POST | ~100 |
| `/api/coach/students` | GET | 254 |
| `/api/coach/tier-change` | POST | 336 |

### Coach Assessment / Application (6)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/coach-application/[id]` | GET, PATCH | ~100 |
| `/api/coach-application/send-confirmation` | POST | 226 |
| `/api/coach-assessment/calculate-score` | POST | 446 |
| `/api/coach-assessment/chat` | POST | 301 |
| `/api/coach-assessment/interview-feedback` | POST, GET | 262 |
| `/api/coach-assessment/schedule-interview` | POST | 273 |

### Intelligence (12)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/intelligence/activity-log` | GET | ~100 |
| `/api/intelligence/capture` | POST | 574 |
| `/api/intelligence/capture-chat` | POST | ~100 |
| `/api/intelligence/extract-voice` | POST | ~100 |
| `/api/intelligence/generate-summary` | POST | ~100 |
| `/api/intelligence/interpret-segment` | POST | ~100 |
| `/api/intelligence/micro-assessment` | POST | 457 |
| `/api/intelligence/micro-observation` | POST, GET | ~100 |
| `/api/intelligence/observations` | GET | ~100 |
| `/api/intelligence/session-observations` | GET | ~100 |
| `/api/intelligence/skills` | GET | ~50 |
| `/api/intelligence/suggest-text` | POST | ~100 |

### Parent Portal (22)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/parent/child/[childId]/timeline` | GET | 225 |
| `/api/parent/content-viewed` | POST | ~100 |
| `/api/parent/cro-settings` | GET | ~100 |
| `/api/parent/dashboard` | GET | ~100 |
| `/api/parent/enrolled-child` | GET | ~100 |
| `/api/parent/features` | GET | ~100 |
| `/api/parent/group-classes` | GET | 271 |
| `/api/parent/intelligence/[childId]` | GET | 180 |
| `/api/parent/intelligence/[childId]/progress-over-time` | GET | ~100 |
| `/api/parent/notification-preferences` | GET, POST | ~100 |
| `/api/parent/practice/[taskId]` | GET | ~100 |
| `/api/parent/progress` | GET | 365 |
| `/api/parent/re-enroll/[childId]` | GET, POST | 349 |
| `/api/parent/reading` | GET | ~100 |
| `/api/parent/reading-test` | GET | ~100 |
| `/api/parent/reading-test/analyze` | POST | 237 |
| `/api/parent/reading/log` | POST | ~100 |
| `/api/parent/referral` | GET | ~100 |
| `/api/parent/referral/generate` | POST | ~100 |
| `/api/parent/report/[enrollmentId]` | GET | 191 |
| `/api/parent/roadmap/[childId]` | GET | 264 |
| `/api/parent/session/available-slots` | GET | ~100 |
| `/api/parent/session/reschedule` | POST | 191 |
| `/api/parent/sessions/[childId]` | GET | ~100 |
| `/api/parent/tasks/[childId]` | GET | 225 |
| `/api/parent/tasks/[childId]/complete` | POST | 208 |
| `/api/parent/tasks/[childId]/upload-photo` | POST | ~100 |

### Sessions (10)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/sessions` | GET, PATCH, DELETE | 571 |
| `/api/sessions/[id]/cancel` | POST | ~100 |
| `/api/sessions/[id]/cancel-request` | POST | ~50 |
| `/api/sessions/[id]/feedback` | GET, POST, PATCH | 454 |
| `/api/sessions/[id]/missed` | POST | ~100 |
| `/api/sessions/[id]/reschedule-request` | POST | ~50 |
| `/api/sessions/change-request/[id]/approve` | POST | 306 |
| `/api/sessions/complete` | POST, GET | 417 |
| `/api/sessions/confirm` | POST | 411 |
| `/api/sessions/parent-checkin` | POST, GET | 537 |

### Payment (5)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/payment/create` | POST, GET | 368 |
| `/api/payment/record-offline` | POST | 311 |
| `/api/payment/validate-retry` | GET | ~100 |
| `/api/payment/verify` | POST | 888 |
| `/api/payouts/process` | POST, GET | 660 |

### Enrollment (4)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/enrollment/[id]` | GET | ~100 |
| `/api/enrollment/calculate-revenue` | POST | 466 |
| `/api/enrollment/pause` | GET, POST | 424 |
| `/api/completion/*` (4 routes) | Various | ~500 |

### Admin (82)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/admin/agreements` | GET | ~100 |
| `/api/admin/agreements/[id]` | PATCH, DELETE | ~100 |
| `/api/admin/agreements/upload` | POST | 179 |
| `/api/admin/backfill-embeddings` | POST | ~100 |
| `/api/admin/backfill-parent-auth` | POST | ~100 |
| `/api/admin/backops-summary` | GET | ~100 |
| `/api/admin/books` | GET, POST, DELETE | ~100 |
| `/api/admin/books/[id]` | GET, PUT, DELETE | ~100 |
| `/api/admin/books/bulk-upload` | POST | ~100 |
| `/api/admin/books/collections` | GET, POST | ~100 |
| `/api/admin/books/collections/[id]/items` | GET, POST | ~100 |
| `/api/admin/books/generate-embeddings` | POST | ~100 |
| `/api/admin/children/[id]/features` | GET, PATCH | ~100 |
| `/api/admin/coach-applications` | GET | ~100 |
| `/api/admin/coach-applications/[id]` | GET, PATCH, DELETE | 203 |
| `/api/admin/coach-applications/send-confirmation` | POST | 200 |
| `/api/admin/coaches/[id]/offline-stats` | GET | ~100 |
| `/api/admin/coaches/[id]/specializations` | GET, PUT | ~100 |
| `/api/admin/coaches/generate-referral` | POST, GET | 286 |
| `/api/admin/completion/extend` | POST | ~100 |
| `/api/admin/completion/list` | GET | 245 |
| `/api/admin/completion/send-final-assessment` | POST | ~100 |
| `/api/admin/config/invalidate` | POST | ~50 |
| `/api/admin/content-library` | GET | 179 |
| `/api/admin/content-library/[id]` | GET, PUT, DELETE | ~100 |
| `/api/admin/content-library/[id]/tags` | GET, POST | ~100 |
| `/api/admin/content-search` | GET | 229 |
| `/api/admin/content-upload` | POST | 281 |
| `/api/admin/content-upload/template` | GET | ~100 |
| `/api/admin/coupons` | GET, POST | 375 |
| `/api/admin/coupons/[id]` | GET, PATCH, DELETE | ~100 |
| `/api/admin/crm/coaches` | GET | ~100 |
| `/api/admin/crm/leads` | GET | 205 |
| `/api/admin/dashboard` | GET | ~100 |
| `/api/admin/enrollment/resume` | POST | 184 |
| `/api/admin/enrollment/switch` | POST | 515 |
| `/api/admin/feature-flags` | GET, PUT | ~100 |
| `/api/admin/features` | GET, POST, PUT | 222 |
| `/api/admin/generate-content-embeddings` | POST, PUT | 247 |
| `/api/admin/generate-embeddings` | GET | ~100 |
| `/api/admin/group-classes` | GET | 315 |
| `/api/admin/group-classes/[sessionID]` | GET, PATCH, DELETE | 402 |
| `/api/admin/group-classes/blueprints` | GET, POST | 264 |
| `/api/admin/group-classes/blueprints/[id]` | GET, PUT, DELETE | 314 |
| `/api/admin/group-classes/options` | GET, POST | 201 |
| `/api/admin/offline-overview` | GET | ~100 |
| `/api/admin/orphaned-payments` | GET | ~100 |
| `/api/admin/payments` | GET | ~100 |
| `/api/admin/payments/export` | GET | ~100 |
| `/api/admin/payments/stats` | GET | ~100 |
| `/api/admin/payouts` | GET, POST | 619 |
| `/api/admin/payouts/reconcile` | POST | ~100 |
| `/api/admin/pending-assessments` | GET, POST | ~100 |
| `/api/admin/pricing` | GET, POST, PUT | 265 |
| `/api/admin/revenue-config` | GET, POST | 218 |
| `/api/admin/scheduling/queue` | GET, POST | 249 |
| `/api/admin/session-stats` | GET | 197 |
| `/api/admin/sessions/[id]/offline-decision` | POST | 201 |
| `/api/admin/sessions/offline-requests` | GET | ~100 |
| `/api/admin/settings` | GET, PATCH | 231 |
| `/api/admin/setup-qstash-schedules` | POST, GET | 192 |
| `/api/admin/shadow` | GET, POST | 491 |
| `/api/admin/skill-categories` | GET, PATCH | ~100 |
| `/api/admin/tds` | GET, POST | 302 |
| `/api/admin/templates` | GET, POST | ~100 |
| `/api/admin/templates/[id]` | GET, PATCH | ~100 |
| `/api/admin/testimonials` | GET, POST, PUT, DELETE | 303 |
| `/api/admin/tuition` | GET | ~100 |
| `/api/admin/tuition/[id]/adjust` | POST | ~100 |
| `/api/admin/tuition/[id]/ledger` | GET | ~100 |
| `/api/admin/tuition/[id]/resend` | POST | ~100 |
| `/api/admin/tuition/batches` | GET | ~100 |
| `/api/admin/tuition/create` | POST | 184 |
| `/api/admin/tuition/reassign-batch` | POST | 266 |
| `/api/admin/tuition/stats` | GET | ~100 |

### E-Learning (15)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/elearning/avatar` | GET, POST | 182 |
| `/api/elearning/complete` | POST | 244 |
| `/api/elearning/dashboard` | GET | 313 |
| `/api/elearning/gamification` | GET | ~100 |
| `/api/elearning/games/[gameId]` | GET, POST | 372 |
| `/api/elearning/progress` | POST | ~100 |
| `/api/elearning/quiz-questions` | GET | ~100 |
| `/api/elearning/quiz/[quizId]` | GET | ~100 |
| `/api/elearning/recommendations` | GET, POST | 325 |
| `/api/elearning/session` | GET, POST | 275 |
| `/api/elearning/session/[sessionId]/interact` | POST | 450 |
| `/api/elearning/session/generate` | POST | ~100 |
| `/api/elearning/submit-quiz` | POST | 279 |
| `/api/elearning/unit/[unitId]` | GET | ~100 |
| `/api/elearning/video/[videoId]` | GET | ~100 |
| `/api/elearning/videos/[videoId]/progress` | POST | ~50 |

### Group Classes (12)
| Route Path | Methods | Lines |
|------------|---------|-------|
| `/api/group-classes` | GET | ~100 |
| `/api/group-classes/activity/responses/[sessionId]` | GET | ~100 |
| `/api/group-classes/activity/status/[sessionId]` | GET | ~100 |
| `/api/group-classes/activity/submit` | POST | ~100 |
| `/api/group-classes/page-settings` | GET | ~100 |
| `/api/group-classes/register` | POST | 323 |
| `/api/group-classes/session/[id]/capture` | POST | 370 |
| `/api/group-classes/session/[id]/complete` | POST | 505 |
| `/api/group-classes/sessions` | GET | ~100 |
| `/api/group-classes/sessions/[sessionID]` | GET | ~100 |
| `/api/group-classes/validate-coupon` | POST | ~100 |
| `/api/group-classes/verify-payment` | POST | 326 |

### Other Internal (misc)
| Route Path | Methods | Lines | Notes |
|------------|---------|-------|-------|
| `/api/ab-track` | POST, GET | ~100 | A/B test tracking |
| `/api/activity/track` | POST, GET | ~100 | Activity tracking |
| `/api/age-band-config` | GET | ~100 | Config endpoint |
| `/api/agreement/active` | GET | 258 | Active agreement check |
| `/api/agreement/config` | GET | ~100 | Agreement config |
| `/api/agreement/sign` | POST | 299 | Agreement signing |
| `/api/artifacts/[childId]` | GET | ~100 | Child artifacts |
| `/api/artifacts/[childId]/[artifactId]` | GET | ~100 | Single artifact |
| `/api/artifacts/upload` | POST | 281 | Artifact upload |
| `/api/availability` | GET | ~100 | Coach availability |
| `/api/backops/command` | POST | 463 | BackOps command |
| `/api/backops/health` | GET | ~100 | BackOps health |
| `/api/backops/query` | POST | 277 | BackOps query |
| `/api/books` | GET | ~100 | Library books |
| `/api/books/[slug]` | GET | ~100 | Single book |
| `/api/books/[slug]/vote` | POST | ~100 | Book voting |
| `/api/books/collections` | GET | ~100 | Book collections |
| `/api/books/kahani-picks` | GET | ~100 | Kahani picks |
| `/api/books/recommendations` | GET | ~100 | Book recommendations |
| `/api/books/trending` | GET | ~100 | Trending books |
| `/api/certificate/generate` | GET | 351 | Certificate generation |
| `/api/certificate/send` | POST, GET | 647 | Certificate sending |
| `/api/chat` | POST, GET | 969 | AI chat |
| `/api/chat/feedback` | POST | ~50 | Chat feedback |
| `/api/children/[id]` | GET | ~100 | Child profile |
| `/api/children/goals` | POST, GET | ~100 | Child goals |
| `/api/communication/send` | POST, GET | 394 | Communication dispatch |
| `/api/communication/templates-for-context` | GET | ~100 | Template lookup |
| `/api/communication/trigger` | POST | 309 | Manual comms trigger |
| `/api/completion/check/[enrollmentId]` | GET | ~100 | Completion check |
| `/api/completion/data/[enrollmentId]` | GET | ~100 | Completion data |
| `/api/completion/report/[enrollmentId]` | POST | 357 | Completion report |
| `/api/completion/trigger/[enrollmentId]` | POST | ~100 | Trigger completion |
| `/api/coupons/calculate` | POST | 353 | Coupon calculation |
| `/api/coupons/validate` | POST | 341 | Coupon validation |
| `/api/discovery-call/[id]` | GET | 307 | Discovery call detail |
| `/api/discovery-call/[id]/post-call` | POST, GET | 351 | Post-call actions |
| `/api/discovery-call/[id]/questionnaire` | POST | 286 | Questionnaire submit |
| `/api/discovery-call/[id]/send-followup` | POST | 296 | Send followup |
| `/api/discovery-call/[id]/send-payment-link` | POST, GET | 494 | Payment link |
| `/api/discovery-call/assign` | POST, GET | 442 | Assign discovery call |
| `/api/discovery-call/create` | POST | ~100 | Create discovery call |
| `/api/discovery-call/pending` | GET | 296 | Pending calls |
| `/api/discovery/book` | POST | 714 | Book discovery call |
| `/api/email/enrollment-confirmation` | POST | 245 | Enrollment email |
| `/api/features` | GET | ~100 | Feature flags |
| `/api/instructor/session/[sessionId]` | GET | ~100 | Instructor session |
| `/api/instructor/session/[sessionId]/voice-note` | POST | ~100 | Voice note upload |
| `/api/leads/hot-alert` | GET, POST, PUT | 699 | Hot lead alerts |
| `/api/learning-events` | POST, GET | 205 | Learning events |
| `/api/matching` | POST, GET | 347 | Coach matching |
| `/api/messages` | GET, POST, PATCH | 410 | In-app messaging |
| `/api/mini-challenge/complete` | POST | 362 | Mini-challenge complete |
| `/api/mini-challenge/generate` | POST | 379 | Generate challenge |
| `/api/my-child/[childId]` | GET | 249 | My child portal |
| `/api/my-child/verify-phone` | POST | ~100 | Phone verification |
| `/api/nps` | GET, POST | 238 | NPS survey |
| `/api/nps/[enrollmentId]` | GET | 207 | NPS for enrollment |
| `/api/parent-call/[enrollmentId]` | GET | ~100 | Parent call details |
| `/api/parent-call/complete` | POST | ~100 | Complete parent call |
| `/api/parent-call/request` | POST | ~100 | Request parent call |
| `/api/parent-call/schedule` | POST | ~100 | Schedule parent call |
| `/api/pricing` | GET | ~100 | Pricing data |
| `/api/pricing-display` | GET | ~100 | Public pricing |
| `/api/products` | GET | 319 | Products catalog |
| `/api/public/stats` | GET | ~50 | Public platform stats |
| `/api/quiz/bank` | GET, POST, DELETE | ~100 | Quiz bank |
| `/api/quiz/generate` | POST | ~100 | Generate quiz |
| `/api/quiz/submit` | POST | 194 | Submit quiz |
| `/api/recall/bot` | GET, POST, DELETE | 203 | Recall bot management |
| `/api/referral/register` | POST, GET | 276 | Register referral |
| `/api/referral/track` | GET, POST | ~100 | Track referral |
| `/api/refund/initiate` | POST | 219 | Initiate refund |
| `/api/scheduling/dispatch` | POST | ~100 | Scheduling dispatch |
| `/api/scheduling/hold` | POST, DELETE, GET | 316 | Hold slot |
| `/api/scheduling/slots` | GET | 627 | Available slots |
| `/api/session/[id]/audio` | GET, POST | 190 | Session audio |
| `/api/settings` | GET | ~100 | Site settings |
| `/api/settings/coach` | GET | ~50 | Coach settings |
| `/api/settings/durations` | GET | ~50 | Duration settings |
| `/api/skill-booster/[sessionId]/booking-options` | GET | 211 | Skill booster options |
| `/api/skill-booster/book` | POST | 210 | Book skill booster |
| `/api/skill-booster/recommend` | POST | ~100 | Skill recommendations |
| `/api/skill-tags` | GET, POST | ~100 | Skill tags |
| `/api/support/tickets` | POST, GET | 358 | Support tickets |
| `/api/support/tickets/[id]` | PATCH, GET | 183 | Single ticket |
| `/api/testimonials` | GET | ~100 | Public testimonials |
| `/api/tts` | POST, GET | ~100 | Text-to-speech |
| `/api/tuition/onboard/[token]` | GET, POST | 368 | Tuition onboarding |
| `/api/tuition/pay/[enrollmentId]` | GET | ~100 | Tuition payment |
| `/api/tuition/schedule` | POST | ~100 | Tuition scheduling |
| `/api/waitlist` | POST, GET | 201 | Waitlist signup |
| `/api/whatsapp/process` | POST | 782 | WhatsApp message processing |
| `/api/whatsapp/send` | POST | 192 | Send WhatsApp |
| `/api/whatsapp/webhook` | GET, POST | 323 | WhatsApp webhook (Lead Bot) |

---

## 5. ORPHANED Routes (no external references found -- deletion candidates)

These routes have NO fetch() calls from frontend/lib code, are NOT in the dispatcher, and are NOT webhook targets. They only reference themselves in comments/file headers.

| # | Route Path | Methods | Lines | Notes |
|---|------------|---------|-------|-------|
| 1 | `/api/admin/crm/daily-stats` | GET | ~100 | No callers found -- was likely used by a removed CRM dashboard widget |
| 2 | `/api/admin/crm/export` | GET | ~100 | No callers found -- CRM export feature unused |
| 3 | `/api/admin/crm/funnel` | GET | ~100 | No callers found -- funnel visualization not wired |
| 4 | `/api/admin/crm/interactions` | GET | 183 | No callers found -- CRM interactions panel unused |
| 5 | `/api/admin/crm/pipeline-stats` | GET | ~100 | No callers found -- pipeline stats not wired |
| 6 | `/api/admin/payout-preview` | GET | ~165 | No callers found -- payout preview not wired to UI |
| 7 | `/api/admin/group-classes/refund` | POST | 183 | No callers found -- refund flow not wired |
| 8 | `/api/group-classes/participants/[participantId]/cancel` | POST | ~100 | No callers found -- cancel participant not wired |
| 9 | `/api/group-classes/resend-confirmation` | GET, POST | 285 | No callers found -- resend flow not wired |
| 10 | `/api/group-classes/waitlist/join` | POST | ~100 | Only referenced by lib/group-classes/waitlist-promotion.ts (internal lib), not frontend |
| 11 | `/api/sentry-example-api` | GET | ~50 | Sentry test route -- safe to delete |
| 12 | `/api/test/scheduling` | GET, POST | 246 | Test route -- should not be in prod |
| 13 | `/api/communication/test` | POST, GET | ~100 | Test route -- should not be in prod |
| 14 | `/api/assessment/enrolled` | POST | 189 | No callers found anywhere |
| 15 | `/api/enrollment/calculate-revenue` | POST | 466 | No callers found (self-references only) |
| 16 | `/api/discovery-call/create` | POST | ~100 | No callers found (self-references only) |
| 17 | `/api/admin/content-library/[id]/tags` | GET, POST | ~100 | No callers found |

---

## 6. SUSPECT Routes (need review)

| # | Route Path | Issue |
|---|------------|-------|
| 1 | `/api/coach-assessment/schedule-interview` | Only self-referenced -- may be called manually via admin action not captured |
| 2 | `/api/coach-assessment/interview-feedback` | Only self-referenced -- may be called via admin flow |
| 3 | `/api/admin/backfill-embeddings` | Marked DEPRECATED in file -- prefer `/api/admin/generate-embeddings` |
| 4 | `/api/email/enrollment-confirmation` | Called internally by other routes but may be dead (needs check if still triggered) |

---

## 7. MISSING Routes (referenced in code but NO route.ts file exists)

These paths are referenced via QStash `publishJSON()` in `lib/qstash.ts` but have no corresponding `route.ts` file:

| # | Referenced Path | Referenced In | Impact |
|---|----------------|---------------|--------|
| 1 | `/api/jobs/send-notification` | `lib/qstash.ts:256` | QStash will get 404 -- BROKEN |
| 2 | `/api/jobs/send-communication` | `lib/qstash.ts:286` | QStash will get 404 -- BROKEN |
| 3 | `/api/jobs/send-discovery-notification` | `lib/qstash.ts:331` | QStash will get 404 -- BROKEN |

Additionally referenced in component code but missing:

| # | Referenced Path | Referenced In | Impact |
|---|----------------|---------------|--------|
| 4 | `/api/upload/audio` | `components/instructor/MicroAssessmentCapture.tsx:201` | Upload will fail |
| 5 | `/api/intelligence/reading-passages` | `components/instructor/MicroAssessmentCapture.tsx:116` | Fetch will fail |

---

## 8. Large Routes (> 500 lines -- refactoring candidates)

| Route Path | Lines |
|------------|-------|
| `/api/payment/webhook` | 1,208 |
| `/api/jobs/enrollment-complete` | 1,120 |
| `/api/chat` | 969 |
| `/api/payment/verify` | 888 |
| `/api/webhooks/recall` | 884 |
| `/api/assessment/analyze` | 840 |
| `/api/jobs/process-session` | 827 |
| `/api/whatsapp/process` | 782 |
| `/api/jobs/recall-reconciliation` | 763 |
| `/api/discovery/book` | 714 |
| `/api/leads/hot-alert` | 699 |
| `/api/payouts/process` | 660 |
| `/api/certificate/send` | 647 |
| `/api/cron/smoke-test` | 643 |
| `/api/scheduling/slots` | 627 |
| `/api/coach/sessions/[id]/parent-summary` | 625 |
| `/api/admin/payouts` | 619 |
| `/api/cron/enrollment-lifecycle` | 597 |
| `/api/coach/sessions/[id]/offline-report` | 595 |
| `/api/jobs/artifact-analysis` | 591 |
| `/api/intelligence/capture` | 574 |
| `/api/sessions` | 571 |
| `/api/coach/schedule-rules` | 559 |
| `/api/cron/agent-nurture` | 554 |
| `/api/cron/dispatcher` | 550 |
| `/api/sessions/parent-checkin` | 537 |
| `/api/admin/enrollment/switch` | 515 |
| `/api/group-classes/session/[id]/complete` | 505 |
| `/api/coach/send-status-notification` | 509 |
| `/api/cron/group-class-reminders` | 509 |

---

## 9. Observations and Recommendations

### Critical Issues
1. **3 missing QStash job routes** (`send-notification`, `send-communication`, `send-discovery-notification`) -- these will produce 404 errors when triggered. Either the routes were deleted without removing the QStash publish calls, or they were never created. The `publishJSON` functions in `lib/qstash.ts` that reference them need to be either removed or the routes created.

2. **2 missing routes referenced in components** (`/api/upload/audio`, `/api/intelligence/reading-passages`) in `MicroAssessmentCapture.tsx` -- these will fail at runtime for instructors using micro-assessment capture.

### Cleanup Opportunities
3. **17 orphaned routes** can likely be deleted, saving ~2,500 lines of dead code. Prioritize removing test routes (`sentry-example-api`, `test/scheduling`, `communication/test`) from production.

4. **5 CRM sub-routes** (`daily-stats`, `export`, `funnel`, `interactions`, `pipeline-stats`) appear to be from a CRM dashboard that was either never completed or removed. Consider deleting.

5. **`admin/backfill-embeddings`** is explicitly marked deprecated in favor of `admin/generate-embeddings` -- delete it.

### Architecture Notes
6. The dispatcher correctly manages 30 cron jobs through a single QStash schedule, with 3 event-triggered crons and 1 separate QStash schedule (goals-capture).

7. 30 routes exceed 500 lines -- `payment/webhook` (1,208 lines) and `jobs/enrollment-complete` (1,120 lines) are the largest and strongest refactoring candidates.
