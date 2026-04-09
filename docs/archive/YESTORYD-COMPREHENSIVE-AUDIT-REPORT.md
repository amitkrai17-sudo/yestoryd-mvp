# YESTORYD - COMPREHENSIVE LOGIC AUDIT REPORT
## Post-Config Migration Verification & Gap Analysis

**Date:** February 1, 2026  
**Auditor:** Claude Code  
**Duration:** 13m 41s comprehensive code review

---

## EXECUTIVE SUMMARY

The payment flow and related systems are **INTACT** after the config migration. The codebase contains sophisticated, enterprise-grade implementations that should NOT be modified without careful consideration.

### Audit Scope
- Payment Create, Verify, Webhook routes
- Coach assignment and matching logic
- Scheduling orchestrator
- Revenue split and TDS calculation
- E-learning infrastructure
- Communication system
- CRM data flow

---

## SECTION 1: ALREADY SOPHISTICATED (DO NOT CHANGE)

### 1.1 Payment Flow - Triple Safety Net

**Implementation Quality:** ⭐⭐⭐⭐⭐ Enterprise-grade

| Layer | Purpose | Location |
|-------|---------|----------|
| **Verify Route** | Primary payment processing | `app/api/payment/verify/route.ts` |
| **Webhook Handler** | Fallback if verify times out | `app/api/payment/webhook/route.ts` |
| **Daily Reconciliation** | Catch orphaned payments | Cron job |

**Features:**
- HMAC-SHA256 signature verification (timing-safe)
- Razorpay API amount verification (prevents tampering)
- Idempotency via `processed_webhooks` table
- Race condition handling with unique constraints
- Request ID tracing throughout
- Structured JSON logging

**DO NOT:** Add duplicate reconciliation, modify signature verification, or change idempotency logic.

---

### 1.2 Coach Assignment - Load-Balanced + Quality-Weighted

**Implementation Quality:** ⭐⭐⭐⭐⭐ Enterprise-grade

**Smart Matching Algorithm:**
```
Priority Order:
1. Discovery call coach (if assigned) ← ALREADY PREFERRED
2. Explicit coach from request
3. Smart match based on:
   - Current load (active enrollments)
   - Quality metrics (completion rate, ratings)
   - Availability
4. Default coach (last resort)
```

**Features:**
- Load balancing across coaches
- Quality weighting (not just availability)
- Discovery coach preference ALREADY EXISTS
- Capacity awareness ALREADY EXISTS

**DO NOT:** Add duplicate capacity checking or discovery coach preference - it's already there.

---

### 1.3 Scheduling - 6-Tier Slot Priority Finder

**Implementation Quality:** ⭐⭐⭐⭐⭐ Enterprise-grade

**Location:** `lib/scheduling/`

**Slot Finding Algorithm:**
```
Tier 1: Exact preferred time
Tier 2: Same day, different time
Tier 3: Adjacent days, preferred time
Tier 4: Same week, any time
Tier 5: Next week, preferred time
Tier 6: Any available slot within lookahead
```

**Features:**
- Google Calendar integration with circuit breaker
- Recall.ai bot auto-scheduling
- Constraint enforcement (gap days, time slots, coach limits)
- Rescheduling support
- Conflict detection

**DO NOT:** Modify slot-finding algorithm without understanding all 6 tiers.

---

### 1.4 Revenue Split - Full TDS Compliance

**Implementation Quality:** ⭐⭐⭐⭐⭐ Enterprise-grade

**Tables:**
- `revenue_split_config` - Split percentages, TDS config
- `enrollment_revenue` - Per-enrollment breakdown
- `coach_payouts` - Scheduled payouts

**TDS Compliance:**
- Section 194J professional services
- ₹30,000 annual threshold tracking
- `tds_cumulative_fy` per coach
- Form 26Q quarterly preparation
- Staggered monthly payouts (Months 1, 2, 3)

**3-Component Model:**
| Component | Default % | Purpose |
|-----------|-----------|---------|
| Lead Cost | 20% | To lead source (if coach-sourced) |
| Coach Cost | 50% | To delivering coach |
| Platform Fee | 30% | Yestoryd retention |

**DO NOT:** Change TDS calculation without CA review.

---

### 1.5 E-Learning Infrastructure - AI-Powered

**Implementation Quality:** ⭐⭐⭐⭐⭐ Enterprise-grade (infra only, content pending)

**Components:**
- Gemini-powered rAI recommendations
- SM-2 spaced repetition algorithm
- 5 game engines for engagement
- Gamification system (badges, streaks, rewards)
- Progress tracking per child

**Tables:**
- `elearning_modules`
- `elearning_progress`
- `child_game_progress`
- Learning events with embeddings for RAG

**Gap:** Infrastructure exists but needs 477-1,178 videos to populate.

---

### 1.6 Communication System - 82+ Touchpoints

**Implementation Quality:** ⭐⭐⭐⭐⭐ Enterprise-grade

**Channels:**
- WhatsApp (AiSensy)
- Email (SendGrid)
- SMS (fallback)

**Features:**
- Template-driven messaging
- Condition-based triggers
- Engagement cron for re-activation
- Queue system for async delivery

**Touchpoint Categories:**
| Category | Count | Examples |
|----------|-------|----------|
| Parent | 37 | Reminders, updates, certificates |
| Coach | 17 | Assignments, session prep |
| Admin | 10 | Alerts, reports |
| Lead Gen | 8 | Follow-ups, offers |
| Reschedule | 10 | Notifications, confirmations |

---

### 1.7 CRM - Full Funnel Tracking

**Implementation Quality:** ⭐⭐⭐⭐ Good

**Flow:**
```
Assessment → children table (Leads tab)
     ↓
Discovery Call → discovery_calls table (Discovery tab)
     ↓
Post-Call Notes → Questionnaire, likelihood, objections
     ↓
Payment → enrollments table
     ↓
Coaching → scheduled_sessions table
```

**Gap:** `discovery_calls.child_id` uses soft join (email match) not FK.

---

## SECTION 2: VERIFIED GAPS (10 Items)

### Gap #1: Refund Processing [CRITICAL]

**Status:** Completely missing

**What's Needed:**
- Prorated refund calculation: `(Sessions Remaining / Total) × Amount Paid`
- Razorpay refund API integration
- Coach settlement on partial completion
- `termination_logs` table population
- Parent notification of refund

**Business Rules:**
- Full refund if <24 hours from purchase (no sessions completed)
- Prorated refund based on sessions remaining
- Coach gets paid for completed sessions
- 7-day processing time for bank credit

---

### Gap #2: Failed Payment Notification/Retry [HIGH]

**Status:** No user notification on failure

**What's Needed:**
- Detect payment failure (Razorpay webhook `payment.failed`)
- Send user-friendly notification (WhatsApp/Email)
- Provide retry link with same order
- Expire retry link after 24 hours
- Admin alert for repeated failures

---

### Gap #3: Admin Payments Dashboard [MEDIUM]

**Status:** Stub page exists

**What's Needed:**
- Payment list with filters (date, status, amount)
- Revenue summary (daily, weekly, monthly)
- Refund tracking
- Failed payment tracking
- Export to CSV

---

### Gap #4: E-Learning Content [HIGH]

**Status:** Infrastructure complete, content missing

**What's Needed:**
- 477-1,178 videos across 3 stages:
  - Foundation (4-6 years)
  - Building (7-9 years)
  - Mastery (10-12 years)
- Video hosting setup (YouTube unlisted → Bunny.net)
- Content creation workflow
- Quiz/assessment for each module

**This is CONTENT work, not CODE work.**

---

### Gap #5: discovery_calls.child_id FK [MEDIUM]

**Status:** Soft join by email, no foreign key

**What's Needed:**
```sql
ALTER TABLE discovery_calls 
ADD COLUMN child_id UUID REFERENCES children(id);

-- Backfill existing
UPDATE discovery_calls dc 
SET child_id = (
  SELECT c.id FROM children c 
  WHERE LOWER(c.parent_email) = LOWER(dc.parent_email)
  ORDER BY c.created_at DESC LIMIT 1
)
WHERE dc.child_id IS NULL;
```

**Benefit:** Proper relational integrity, faster JOINs, cleaner CRM queries.

---

### Gap #6: Parent Self-Service Rescheduling [MEDIUM]

**Status:** No UI for parents

**What's Needed:**
- Parent dashboard "Reschedule" button
- Available slot picker (respects constraints)
- Coach notification of change
- Calendar event update
- Reschedule limit (max 2 per enrollment?)

---

### Gap #7: Notification Preferences [LOW]

**Status:** No opt-out mechanism

**What's Needed:**
- Parent preference settings (WhatsApp, Email, SMS)
- Unsubscribe link in emails
- DPDP Act compliance for marketing
- Preference storage in `parents` table

---

### Gap #8: Coach Skill Matching [LOW]

**Status:** No specialization-based assignment

**What's Needed:**
- `coach_specializations` table (phonics levels, age groups)
- Match child's `phonics_focus` to coach skills
- Weighted scoring in smart match algorithm

**Note:** Current load-balancing is working. This is an optimization, not a fix.

---

### Gap #9: Automated Lead Scoring [LOW]

**Status:** Manual scoring only

**What's Needed:**
- Score based on: assessment completion, engagement, response time
- Auto-update `lead_status` based on score
- Hot lead alerts to admin

**Note:** Manual process is working. This is an automation enhancement.

---

### Gap #10: Payout-to-Bank Reconciliation [MEDIUM]

**Status:** No verification that bank transfer succeeded

**What's Needed:**
- Track payout status (pending, processed, failed)
- Bank transfer confirmation upload
- UTR number tracking
- Coach receipt generation

---

## SECTION 3: IMPLEMENTATION PRIORITY

| Priority | Gap | Effort | Impact |
|----------|-----|--------|--------|
| **P0** | #1 Refund Processing | 4-6 hours | Critical for customer trust |
| **P0** | #2 Failed Payment Notification | 2-3 hours | Reduces support burden |
| **P1** | #5 discovery_calls FK | 1 hour | Data integrity |
| **P1** | #3 Admin Payments Dashboard | 4-6 hours | Operations visibility |
| **P1** | #10 Payout Reconciliation | 3-4 hours | Financial accuracy |
| **P2** | #6 Parent Self-Reschedule | 4-6 hours | User experience |
| **P2** | #7 Notification Preferences | 2-3 hours | DPDP compliance |
| **P3** | #8 Coach Skill Matching | 3-4 hours | Optimization |
| **P3** | #9 Automated Lead Scoring | 2-3 hours | Automation |
| **Content** | #4 E-Learning Videos | Weeks | Not code work |

---

## SECTION 4: DO NOT TOUCH

These systems are working correctly. Do not modify without full understanding:

1. **Payment signature verification** - Timing-safe, correct implementation
2. **Idempotency mechanism** - `processed_webhooks` table working
3. **Coach smart matching** - Load-balanced, quality-weighted, already has discovery preference
4. **Scheduling 6-tier algorithm** - Sophisticated slot finding
5. **TDS calculation** - Section 194J compliant, ₹30K threshold
6. **Revenue split 3-component model** - Lead/Coach/Platform correctly separated
7. **Communication template system** - 82+ touchpoints mapped
8. **rAI infrastructure** - Gemini + HNSW + hybrid search working

---

## SECTION 5: QUICK REFERENCE

### Database Tables (Key)
| Table | Purpose |
|-------|---------|
| `payments` | Payment records |
| `enrollments` | Active enrollments |
| `scheduled_sessions` | Coaching sessions |
| `discovery_calls` | Pre-payment calls |
| `children` | Child profiles (leads) |
| `coaches` | Coach profiles |
| `revenue_split_config` | Split percentages |
| `enrollment_revenue` | Per-enrollment breakdown |
| `coach_payouts` | Scheduled payouts |
| `processed_webhooks` | Idempotency tracking |
| `communication_templates` | Message templates |
| `communication_logs` | Sent messages |

### API Routes (Payment)
| Route | Purpose |
|-------|---------|
| `/api/payment/create` | Create Razorpay order |
| `/api/payment/verify` | Process successful payment |
| `/api/payment/webhook` | Razorpay webhook handler |

### Config Loaders
| Function | Returns |
|----------|---------|
| `loadAuthConfig()` | Admin emails |
| `loadCoachConfig()` | Default coach |
| `loadPaymentConfig()` | Payment settings |
| `loadSchedulingConfig()` | Scheduling rules |
| `loadRevenueSplitConfig()` | Split percentages, TDS |
| `loadPricingPlan(id)` | Product details |

---

*This audit confirms the codebase is enterprise-grade. Focus on filling gaps, not changing working systems.*
