# YESTORYD - COMPREHENSIVE LOGIC AUDIT
## Understand Before Changing

**Purpose:** Document ALL existing logic in payment, scheduling, coach assignment, and e-learning BEFORE suggesting any modifications. We must not break or duplicate what's already built.

---

## PHASE 1: PAYMENT FLOW AUDIT

### 1.1 Payment Create Route

```
TASK: Audit app/api/payment/create/route.ts

Show me the COMPLETE file. I need to understand:

1. What validation is performed?
2. What data is fetched/created?
3. How is the Razorpay order created?
4. What metadata is stored in order notes?
5. What coach/child/parent data is handled?
6. What booking record is created?
7. Is there any scheduling logic here?
8. What integrations are triggered?

Do NOT summarize - show me the actual code so I can understand the exact logic.
```

### 1.2 Payment Verify Route

```
TASK: Audit app/api/payment/verify/route.ts

Show me the COMPLETE file. I need to understand:

1. How is signature verified?
2. How is amount verified with Razorpay API?
3. What's the EXACT coach resolution logic?
   - Is there already a priority system?
   - Is there capacity checking?
   - Is there smart matching?
   - How is discovery call coach handled?
4. How is enrollment created?
   - What fields are populated?
   - What's the end date calculation?
   - What status is set?
5. What happens AFTER enrollment creation?
   - Session scheduling?
   - Communication triggers?
   - Revenue split calculation?
6. What QStash jobs are queued?
7. What's the error handling flow?
8. Is there idempotency logic?

This is the most critical file - I need to see ALL of it.
```

### 1.3 Payment Webhook Route

```
TASK: Audit app/api/payment/webhook/route.ts

Show me the COMPLETE file. I need to understand:

1. How is webhook signature verified?
2. What's the idempotency mechanism (processed_webhooks)?
3. What processing happens here vs in verify route?
4. Is there fallback enrollment creation?
5. How does it handle race conditions with verify route?
```

### 1.4 Payment Reconciliation (If Exists)

```
TASK: Search for any existing reconciliation logic

Search for:
- reconcil
- orphan
- payment.*cron
- payment.*sync

Check if there's already a reconciliation mechanism I'm not aware of.
```

---

## PHASE 2: COACH ASSIGNMENT AUDIT

### 2.1 Coach Matching/Assignment Logic

```
TASK: Find and audit ALL coach assignment logic

Search the codebase for:
- smartMatch
- matchCoach
- assignCoach
- coach.*assignment
- getCoach
- resolveCoach
- coach.*capacity
- max_students

For each file found, show me the logic. I need to understand:
1. Is there already a smart matching algorithm?
2. Does it consider capacity?
3. Does it consider skills/specialization?
4. Does it consider availability?
5. What's the priority order?
6. How does discovery call coach factor in?
```

### 2.2 Coach Capacity Logic

```
TASK: Check if coach capacity is already implemented

Search for:
- max_students
- capacity
- coach.*limit
- coach.*load
- enrollments.*count

Check:
- coaches table schema (does max_students exist?)
- Any capacity checking in assignment logic
- Any dashboard showing coach load
```

### 2.3 Discovery Call to Enrollment Flow

```
TASK: Trace the complete discovery-to-enrollment flow

1. Show me app/api/webhooks/cal/route.ts - how discovery calls are created
2. Show me how assigned_coach_id is set on discovery_calls
3. Show me if/how this coach is used during enrollment
4. Is there already logic to prefer discovery coach?
```

---

## PHASE 3: SCHEDULING AUDIT

### 3.1 Scheduling Orchestrator

```
TASK: Audit the scheduling system

Find and show me ALL files in:
- lib/scheduling/
- app/api/scheduling/
- Any file with "schedule" in the name

I need to understand:
1. How are sessions scheduled after enrollment?
2. What's the session pattern (6 coaching + 3 check-in)?
3. How is coach availability checked?
4. How are Google Calendar events created?
5. How is Recall.ai bot scheduled?
6. What constraints are enforced (gap days, time slots)?
7. Is there rescheduling logic?
8. How are conflicts handled?
```

### 3.2 Session Types and Durations

```
TASK: Audit session type handling

Search for:
- session_type
- coaching
- parent_checkin
- remedial
- duration

Where do session types come from?
Where do durations come from?
Is it from pricing_plans? site_settings? hardcoded?
```

---

## PHASE 4: REVENUE SPLIT AUDIT

### 4.1 Revenue Calculation Logic

```
TASK: Audit revenue split implementation

Search for:
- revenue
- split
- payout
- coach.*earnings
- lead_source
- commission

Show me:
1. Is enrollment_revenue table populated?
2. Is coach_payouts table populated?
3. What calculation logic exists?
4. How is lead source determined?
5. How is TDS calculated?
```

---

## PHASE 5: E-LEARNING AUDIT

### 5.1 E-Learning Module System

```
TASK: Audit e-learning implementation

Search for:
- elearning
- e-learning
- module
- video
- lesson
- progress

Show me:
1. What tables exist for e-learning?
2. Is there progress tracking?
3. How are modules assigned to children?
4. Is there any AI-driven recommendation?
```

---

## PHASE 6: COMMUNICATION AUDIT

### 6.1 Communication Triggers

```
TASK: Audit communication/notification system

Show me:
- lib/communication/
- app/api/communication/
- Any WhatsApp integration
- Any SendGrid integration

I need to understand:
1. What triggers are already implemented?
2. What templates are used?
3. How is timing handled (reminders)?
4. Is there a queue system?
```

---

## PHASE 7: CRM & DATA FLOW AUDIT

### 7.1 Children-Discovery Link

```
TASK: Check if discovery_calls already links to children

Run SQL:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'discovery_calls';

Check:
- Does child_id column exist?
- Is it populated?
- How is it used in queries?
```

### 7.2 CRM Queries

```
TASK: Audit CRM data fetching

Show me:
- app/admin/crm/page.tsx or related files
- API routes that serve CRM data

How is data joined between children and discovery_calls?
```

---

## PHASE 8: CREATE AUDIT REPORT

After completing phases 1-7, create a comprehensive report:

```
### EXISTING LOGIC SUMMARY

#### Payment Flow
- [ ] What's already built
- [ ] What's working well
- [ ] What's actually missing

#### Coach Assignment
- [ ] Current priority logic
- [ ] Capacity handling (exists? how?)
- [ ] Discovery coach handling (exists? how?)
- [ ] Smart matching (exists? how?)

#### Scheduling
- [ ] Session creation logic
- [ ] Calendar integration
- [ ] Recall.ai integration
- [ ] Rescheduling

#### Revenue Split
- [ ] Current implementation status
- [ ] What's calculated
- [ ] What's missing

#### E-Learning
- [ ] Current implementation status
- [ ] What's built
- [ ] What's planned

#### Communication
- [ ] Implemented triggers
- [ ] Missing triggers

### ACTUAL GAPS (Not Assumed)
Based on code review, these are the REAL gaps:
1. ...
2. ...

### DO NOT CHANGE (Already Working)
These systems are already sophisticated:
1. ...
2. ...
```

---

## EXECUTION

```
Run this audit with Claude Code:

"Execute the comprehensive logic audit from YESTORYD-COMPREHENSIVE-LOGIC-AUDIT.md

Start with Phase 1 - show me the COMPLETE payment/verify route.
Do NOT summarize. I need to see the actual code to understand the logic.

After each phase, document what you found before moving to the next phase.

Only after ALL phases are complete, create the audit report identifying REAL gaps."
```

This ensures we understand what's built before suggesting any changes.
