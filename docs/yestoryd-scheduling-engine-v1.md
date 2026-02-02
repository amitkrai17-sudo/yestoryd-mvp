# YESTORYD SCHEDULING ENGINE v1.0

**Version:** 1.0  
**Date:** January 30, 2026  
**Status:** Production Ready  
**Score:** 9/10 Enterprise Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Entry Points](#entry-points)
4. [Orchestrator Core](#orchestrator-core)
5. [Event Handlers](#event-handlers)
6. [Retry & Manual Queue](#retry--manual-queue)
7. [External Integrations](#external-integrations)
8. [Database Schema](#database-schema)
9. [Configuration](#configuration)
10. [Complete Flow Example](#complete-flow-example)
11. [Files Reference](#files-reference)
12. [Testing](#testing)

---

## Overview

The Yestoryd Scheduling Engine is an enterprise-grade, event-driven system that handles all session lifecycle operations. It provides:

- **Centralized orchestration** for all scheduling events
- **Redis-backed idempotency** preventing duplicate processing
- **Circuit breakers** protecting external API calls
- **Compensating transactions** for atomic multi-step operations
- **Automatic retry** with exponential backoff
- **Manual escalation queue** for admin intervention
- **Structured JSON logging** for observability

### Key Metrics

| Metric | Value |
|--------|-------|
| Events Supported | 11 |
| API Routes Integrated | 9 |
| Test Suites | 3 (23 tests) |
| Code Quality Score | 9/10 |
| Enterprise Readiness | 9/10 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Idempotency │  │   Circuit   │  │ Transaction │                 │
│  │   (Redis)   │  │   Breaker   │  │   Manager   │                 │
│  │  + Memory   │  │   (Redis)   │  │ (Compensate)│                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
│         └────────────────┼────────────────┘                         │
│                          ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    EVENT DISPATCHER                           │  │
│  │  enrollment.*  │  coach.*  │  session.*                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          │                                          │
│         ┌────────────────┼────────────────┐                        │
│         ▼                ▼                ▼                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                   │
│  │  Session   │  │   Coach    │  │   Config   │                   │
│  │  Manager   │  │  Handler   │  │  Provider  │                   │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                   │
│        │               │               │                           │
│        ▼               ▼               ▼                           │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              EXTERNAL INTEGRATIONS (Circuit Protected)        │  │
│  │  Google Calendar  │  Recall.ai  │  Notifications              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                          │                                          │
│         ┌────────────────┴────────────────┐                        │
│         ▼                                 ▼                        │
│  ┌────────────┐                   ┌────────────┐                   │
│  │   Retry    │ ──(exhausted)──▶  │   Manual   │                   │
│  │   Queue    │                   │   Queue    │                   │
│  └────────────┘                   └────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Entry Points

### Parent Actions

| Action | Endpoint | Event Triggered |
|--------|----------|-----------------|
| Cancel Session | `POST /api/sessions/[id]/cancel-request` | `session.cancel` |
| Reschedule Session | `POST /api/sessions/[id]/reschedule-request` | `session.reschedule` |
| Pause Enrollment | `POST /api/enrollment/pause` | `enrollment.paused` |

### Coach Actions

| Action | Endpoint | Event Triggered |
|--------|----------|-----------------|
| Complete Session | `POST /api/coach/sessions/[id]/complete` | `session.completed` |
| Mark No-Show | `POST /api/sessions/missed` | `session.no_show` |
| Mark Unavailable | `POST /api/coach/availability` | `coach.unavailable` |

### System Triggers

| Trigger | Source | Event Triggered |
|---------|--------|-----------------|
| Payment Success | Razorpay webhook | `enrollment.created` |
| Cron: Coach Unavailability | Daily cron | `coach.unavailable` |
| QStash: Retry | Scheduled job | (re-dispatches failed event) |

### Admin Actions

| Action | Endpoint | Description |
|--------|----------|-------------|
| Manual Dispatch | `POST /api/scheduling/dispatch` | Direct event dispatch |
| Resolve Queue Item | `POST /api/admin/scheduling/queue` | Manual resolution |

---

## Orchestrator Core

### Dispatch Flow

```
dispatch(event, payload)
        │
        ▼
┌─────────────────────────────────────────┐
│ STEP 1: IDEMPOTENCY CHECK               │
│ Key = hash(event + payload)             │
│ Check Redis → Check Memory → Continue   │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ STEP 2: STRUCTURED LOGGING              │
│ JSON format with timestamp, level,      │
│ service, event, requestId, data         │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ STEP 3: EVENT ROUTING                   │
│ Route to appropriate handler            │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ STEP 4: CACHE RESULT                    │
│ Store in Redis + Memory (10s TTL)       │
└─────────────────────────────────────────┘
```

### Supported Events

| Category | Event | Description |
|----------|-------|-------------|
| Enrollment | `enrollment.created` | New payment → Schedule all sessions |
| Enrollment | `enrollment.resumed` | Pause ends → Reschedule remaining |
| Enrollment | `enrollment.paused` | Parent requests break → Cancel upcoming |
| Enrollment | `enrollment.delayed_start_activated` | Delayed start date reached |
| Coach | `coach.unavailable` | Coach takes leave → Handle sessions |
| Coach | `coach.available` | Coach returns → Transfer students back |
| Coach | `coach.exit` | Coach leaves platform permanently |
| Session | `session.cancel` | Cancel a scheduled session |
| Session | `session.reschedule` | Move session to new date/time |
| Session | `session.completed` | Mark session as done |
| Session | `session.no_show` | Student missed session |

---

## Event Handlers

### enrollment.created

Triggered when a new payment is successful. Schedules all sessions for the plan.

**Input:** `{ enrollmentId }`

**Flow:**
1. Load enrollment, plan, and parent preferences
2. Calculate session schedule based on plan (e.g., 36 sessions for 12-week starter)
3. For each session, use Smart Slot Finder with priority cascade:
   - P1: Exact match (preferred day + preferred time)
   - P2: Preferred day, any time
   - P3: Preferred time, any day
   - P4: Any available slot
   - P5: Manual queue (no slot found)
4. Schedule each session using Transaction Manager:
   - Insert to scheduled_sessions
   - Create Google Calendar event
   - Schedule Recall.ai bot
   - Compensate on failure (rollback)
5. Notify parent and coach

**Output:** `{ sessionsScheduled: 36, firstSession: "2026-02-03T17:00" }`

---

### enrollment.paused

Triggered when parent requests a break.

**Input:** `{ enrollmentId, pauseStartDate, pauseEndDate, reason }`

**Flow:**
1. Find sessions in pause window
2. For each session: cancel Calendar event, cancel Recall bot, update status
3. Update enrollment status → 'paused'
4. Notify parent

**Output:** `{ sessionsPaused: 6, resumeDate: "2026-03-01" }`

---

### session.cancel

Triggered when parent/coach/admin cancels a session.

**Input:** `{ sessionId, reason, cancelledBy }`

**Flow:**
1. Validate session exists and is scheduled
2. Cancel Google Calendar event (circuit breaker protected)
3. Cancel Recall.ai bot (circuit breaker protected)
4. Update scheduled_sessions status → 'cancelled'
5. Create audit log entry
6. Notify parent and coach

**Output:** `{ success: true, sessionId, status: 'cancelled' }`

---

### session.no_show

Triggered when student misses a session. Implements cascade logic.

**Input:** `{ sessionId }`

**Flow:**
1. Increment counters:
   - `consecutive_no_shows += 1`
   - `total_no_shows += 1`
2. Check thresholds:
   - 3 consecutive → Flag as at-risk, notify admin
   - 5 consecutive → Auto-pause enrollment, cancel remaining sessions

**Output:** `{ consecutiveNoShows: 3, totalNoShows: 5, atRisk: true, autoPaused: false }`

---

### coach.unavailable

Triggered when coach marks leave or cron detects upcoming unavailability.

**Input:** `{ coachId, startDate, endDate, reason }`

**Flow based on duration:**

| Duration | Action |
|----------|--------|
| ≤7 days (Short) | Reschedule sessions to after return date |
| 8-21 days (Medium) | Assign temporary backup coach |
| >21 days (Long) | Permanent reassignment |

For each action:
- Update sessions/enrollments
- Log to coach_reassignment_log
- Notify parents and coaches
- If no backup/replacement available → Manual queue

**Output:** `{ action: 'rescheduled|backup|reassigned', affected: 12 }`

---

### coach.exit

Triggered when coach leaves the platform permanently.

**Input:** `{ coachId, reason, effectiveDate }`

**Flow:**
1. Find all active enrollments for this coach
2. For each enrollment:
   - Find best available coach (workload balanced)
   - Update enrollment.coach_id
   - Update all future sessions
   - Log permanent reassignment
   - Notify parent + new coach
3. Mark coach status = 'inactive'

**Output:** `{ studentsReassigned: 15, newCoaches: ['coach-a', 'coach-b'] }`

---

## Retry & Manual Queue

### Retry Strategy

When session scheduling fails, the system implements exponential backoff:

| Attempt | Delay | Action |
|---------|-------|--------|
| 1 | 0 hours | Immediate retry |
| 2 | 1 hour | QStash scheduled job |
| 3 | 6 hours | QStash scheduled job |
| 4 | 24 hours | QStash scheduled job |
| 5 | - | Escalate to manual queue |

### Manual Queue

Sessions that exhaust retry attempts are escalated to the manual queue.

**Table:** `scheduling_queue`
- `session_id` - The affected session
- `enrollment_id` - Related enrollment
- `reason` - Why scheduling failed
- `attempts_made` - Number of retry attempts
- `status` - 'pending' or 'resolved'
- `assigned_to` - Admin handling the case
- `resolution_notes` - How it was resolved

**Admin UI:** `/admin/scheduling/queue`
- View pending items
- Filter by status, date, reason
- Resolve with notes

---

## External Integrations

All external API calls are wrapped in circuit breakers.

### Circuit Breaker State Machine

```
┌──────────┐    5 failures    ┌──────────┐    60s timeout    ┌──────────┐
│  CLOSED  │ ───────────────▶ │   OPEN   │ ────────────────▶ │HALF-OPEN │
│ (normal) │                  │(fail fast)│                   │(try once)│
└────┬─────┘                  └──────────┘                   └────┬─────┘
     │                              ▲                              │
     │ success                      │ failure                      │
     └──────────────────────────────┴──────────────────────────────┘
                                                   success
```

### Integrations

| Service | Operations | Circuit Protected |
|---------|------------|-------------------|
| Google Calendar | Create, Update, Delete events | Yes |
| Recall.ai | Schedule, Cancel bots | Yes |
| AiSensy (WhatsApp) | Send notifications | Via sendCommunication |
| SendGrid (Email) | Send notifications | Via sendCommunication |
| QStash | Schedule retry jobs | No (internal) |

### On Circuit Open

When a circuit opens:
1. Log: "Circuit OPEN for {service}"
2. Skip external call (fail fast)
3. Return graceful fallback
4. Session still created in DB (external sync later via retry)

---

## Database Schema

### Primary Tables

**scheduled_sessions**
```sql
- id (uuid, PK)
- enrollment_id (uuid, FK)
- child_id (uuid, FK)
- coach_id (uuid, FK)
- scheduled_time (timestamptz)
- status ('scheduled', 'completed', 'cancelled', 'missed', 'paused')
- session_type ('coaching', 'check_in', 'skill_booster')
- google_event_id (text)
- recall_bot_id (text)
- scheduling_attempts (int)
- last_attempt_at (timestamptz)
- next_retry_at (timestamptz)
- failure_reason (text)
```

**enrollments**
```sql
- id (uuid, PK)
- child_id (uuid, FK)
- coach_id (uuid, FK)
- plan_slug (text)
- status ('active', 'paused', 'completed', 'cancelled')
- consecutive_no_shows (int, default 0)
- total_no_shows (int, default 0)
- at_risk (boolean, default false)
- at_risk_reason (text)
- preferred_day (int, 0-6)
- preference_time_bucket ('morning', 'afternoon', 'evening')
```

### Support Tables

**scheduling_queue**
```sql
- id (uuid, PK)
- session_id (uuid, FK)
- enrollment_id (uuid, FK)
- reason (text)
- attempts_made (int)
- status ('pending', 'resolved')
- assigned_to (uuid)
- resolution_notes (text)
- resolved_at (timestamptz)
```

**coach_reassignment_log**
```sql
- id (uuid, PK)
- enrollment_id (uuid, FK)
- original_coach_id (uuid)
- new_coach_id (uuid)
- reason (text)
- is_temporary (boolean)
- start_date (date)
- expected_end_date (date)
- actual_end_date (date)
```

---

## Configuration

All configuration is stored in `site_settings` table. No hardcoded values.

### Scheduling Settings

| Key | Default | Description |
|-----|---------|-------------|
| `scheduling_session_duration` | 45 | Session duration in minutes |
| `scheduling_buffer_minutes` | 15 | Buffer between sessions |
| `scheduling_min_start_days` | 2 | Min days after payment for first session |
| `scheduling_max_start_days` | 14 | Max days to delay start |
| `scheduling_slot_interval_mins` | 30 | Interval between available slots |

### No-Show Thresholds

| Key | Default | Description |
|-----|---------|-------------|
| `no_show_at_risk_threshold` | 3 | Consecutive no-shows to flag at-risk |
| `no_show_auto_pause_threshold` | 5 | Consecutive no-shows to auto-pause |

### Coach Unavailability

| Key | Default | Description |
|-----|---------|-------------|
| `coach_unavail_short_days` | 7 | Max days for reschedule strategy |
| `coach_unavail_medium_days` | 21 | Max days for backup coach strategy |

### Time Buckets

| Key | Start | End |
|-----|-------|-----|
| `scheduling_morning_start/end` | 9:00 | 12:00 |
| `scheduling_afternoon_start/end` | 12:00 | 16:00 |
| `scheduling_evening_start/end` | 16:00 | 20:00 |

---

## Complete Flow Example

### Parent Cancels Session

```
1. PARENT ACTION
   └── Clicks "Cancel" in dashboard
       └── POST /api/sessions/abc-123/cancel-request
           { reason: "Family emergency" }

2. API VALIDATION
   ├── Authenticate parent
   ├── Verify session belongs to parent's child
   ├── Check 24-hour notice policy
   ├── Check max cancellations not exceeded
   └── Create change_request record

3. ORCHESTRATOR DISPATCH
   └── dispatch('session.cancel', {
         sessionId: 'abc-123',
         reason: 'Family emergency',
         cancelledBy: 'parent',
         requestId: 'req-456'
       })

4. IDEMPOTENCY CHECK
   ├── Check Redis: idemp:session.cancel:{hash}
   ├── Check Memory: Map.get(key)
   └── Not duplicate → Continue

5. EVENT HANDLER (session.cancel)
   ├── 5a. Cancel Google Calendar
   │   └── withCircuitBreaker('google-calendar', deleteEvent)
   │       └── Circuit CLOSED → Execute → Success
   │
   ├── 5b. Cancel Recall.ai Bot
   │   └── withCircuitBreaker('recall-ai', cancelBot)
   │       └── Circuit CLOSED → Execute → Success
   │
   ├── 5c. Update Database
   │   └── UPDATE scheduled_sessions SET status = 'cancelled'
   │
   ├── 5d. Audit Log
   │   └── INSERT enrollment_events
   │
   └── 5e. Notifications
       ├── P_session_cancelled → Parent (WhatsApp)
       └── C_session_cancelled → Coach (WhatsApp)

6. CACHE RESULT
   ├── Redis: SET idemp:key result EX 10
   └── Memory: Map.set(key, result)

7. STRUCTURED LOG
   {
     "timestamp": "2026-01-30T15:30:00Z",
     "level": "info",
     "service": "orchestrator",
     "event": "session.cancel",
     "requestId": "req-456",
     "data": { "success": true, "duration": 1234 }
   }

8. RESPONSE
   └── { success: true, sessionId: 'abc-123', status: 'cancelled' }

9. PARENT SEES
   └── "Session cancelled successfully"
   └── WhatsApp: "Your session on Feb 3 has been cancelled"
```

---

## Files Reference

### Core Library (`lib/scheduling/`)

| File | Purpose |
|------|---------|
| `orchestrator.ts` | Main dispatch function, event routing |
| `config-provider.ts` | Fetch config from site_settings |
| `session-manager.ts` | Session CRUD with transaction support |
| `coach-availability-handler.ts` | Handle coach unavailability/exit |
| `smart-slot-finder.ts` | Find best available slot |
| `enrollment-scheduler.ts` | Schedule all sessions for enrollment |
| `retry-queue.ts` | QStash retry scheduling |
| `manual-queue.ts` | Escalation to admin |
| `notification-manager.ts` | Send notifications |
| `circuit-breaker.ts` | Circuit breaker state machine |
| `redis-store.ts` | Redis operations for idempotency/circuit |
| `transaction-manager.ts` | Compensating actions pattern |
| `logger.ts` | Structured JSON logging |

### API Routes

| Route | Purpose |
|-------|---------|
| `/api/scheduling/dispatch` | Main orchestrator entry point |
| `/api/sessions/[id]/cancel-request` | Parent cancel session |
| `/api/sessions/[id]/reschedule-request` | Parent reschedule session |
| `/api/enrollment/pause` | Parent pause enrollment |
| `/api/coach/sessions/[id]/complete` | Coach complete session |
| `/api/sessions/missed` | Mark session as no-show |
| `/api/admin/scheduling/queue` | Admin queue management |
| `/api/jobs/retry-scheduling` | QStash retry handler |
| `/api/cron/process-coach-unavailability` | Daily cron |

### Admin UI

| Route | Purpose |
|-------|---------|
| `/admin/scheduling/queue` | Manual queue dashboard |

---

## Testing

### Test Suites

| Suite | Tests | Coverage |
|-------|-------|----------|
| `orchestrator.test.ts` | 8 | Cancel, reschedule, coach unavailability, no-show, idempotency |
| `circuit-breaker.test.ts` | 8 | State transitions, failure threshold, reset |
| `transaction-manager.test.ts` | 5 | Success, compensation, error handling |
| **Total** | **23** | All passing ✅ |

### Manual Testing

**Test session cancel:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/scheduling/dispatch" `
  -Method POST -ContentType "application/json" `
  -Headers @{"x-internal-api-key"="YOUR_KEY"} `
  -Body '{"event": "session.cancel", "payload": {"sessionId": "SESSION_ID", "reason": "Test", "cancelledBy": "admin"}}'
```

**Test coach unavailability:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/scheduling/dispatch" `
  -Method POST -ContentType "application/json" `
  -Headers @{"x-internal-api-key"="YOUR_KEY"} `
  -Body '{"event": "coach.unavailable", "payload": {"coachId": "COACH_ID", "startDate": "2026-02-01", "endDate": "2026-02-03", "reason": "sick"}}'
```

---

## Environment Variables

```env
# Redis (Upstash) - for idempotency and circuit breaker
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# QStash - for retry scheduling
QSTASH_URL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Google Calendar
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CALENDAR_ID=

# Recall.ai
RECALL_API_KEY=

# Internal API Key (for dispatch endpoint)
INTERNAL_API_KEY=
```

**Note:** Redis is optional. The system gracefully falls back to in-memory storage when Redis is unavailable.

---

## Changelog

### v1.0 (January 30, 2026)

- Initial release
- 11 event handlers
- Redis-backed idempotency and circuit breaker
- Compensating transactions
- Exponential backoff retry (0h → 1h → 6h → 24h → manual)
- Admin manual queue with UI
- Structured JSON logging
- 23 integration tests
- All APIs integrated with orchestrator

---

## Support

For issues or questions:
- Check logs at `/admin/logs` (structured JSON format)
- Review manual queue at `/admin/scheduling/queue`
- Contact: amit@yestoryd.com

---

*Document generated: January 30, 2026*
