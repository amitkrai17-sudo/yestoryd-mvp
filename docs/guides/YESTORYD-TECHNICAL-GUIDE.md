# YESTORYD - Technical Implementation Guide
## For Claude's Reference (Updated: Dec 16, 2025)

---

## 1. CORE ARCHITECTURE

### Tech Stack
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS
- **Hosting:** Vercel
- **Database:** Supabase (PostgreSQL + pgvector for RAG)
- **AI:** Gemini 2.5 Flash Lite (reading assessment analysis)
- **Payments:** Razorpay (LIVE - working as of Dec 2025)
- **Email:** SendGrid (with domain authentication)
- **Calendars:** 
  - Cal.com → Pre-payment discovery calls
  - Google Calendar API → Post-payment coaching sessions

### Key Principle
**ALL pages must be dynamic** - fetch content from `site_settings` table, NOT hardcoded. Admin portal controls all variables.

---

## 2. DATABASE TABLES (Key Ones)

| Table | Purpose |
|-------|---------|
| `children` | All assessed children (Leads) |
| `parents` | Parent accounts |
| `coaches` | Coach profiles |
| `discovery_calls` | Cal.com discovery bookings |
| `enrollments` | Paid enrollments |
| `scheduled_sessions` | Post-payment coaching sessions |
| `bookings` | Payment records |
| `site_settings` | Dynamic site content |
| `learning_events` | Unified tracking (JSONB) |

---

## 3. DISCOVERY CALL FLOW (Critical!)

```
Parent completes assessment
        ↓
Results page (/assessment/results/[id])
        ↓
"Talk to Coach" button → /enroll?source=assessment&type=free&childName=X&childAge=Y&parentEmail=Z&parentPhone=W
        ↓
/enroll page (form PRE-FILLED with URL params)
        ↓
"Book Free Session" → Cal.com popup (discovery event - 30min)
        ↓
Parent selects time slot → Booking confirmed
        ↓
Cal.com sends webhook → POST /api/webhooks/cal
        ↓
Webhook creates record in `discovery_calls` table (status: scheduled)
        ↓
Shows in Admin CRM → Discovery Calls tab
        ↓
Admin assigns coach (searchable dropdown)
        ↓
Coach opens /coach/discovery-calls/[id]
        ↓
Coach sees AI questions tab + Questionnaire tab
        ↓
Coach conducts call → Fills questionnaire
        ↓
"Send Payment Link" → WhatsApp with Razorpay link
        ↓
Parent pays → Enrollment created → Google Calendar sessions scheduled
```

---

## 4. CRM STRUCTURE

**Location:** `/admin/crm`

**Two Tabs:**
1. **Leads Tab** - From `children` table (assessment completions)
2. **Discovery Tab** - From `discovery_calls` table (Cal.com bookings)

**Same person can appear in BOTH tabs** - that's correct behavior.

---

## 5. KEY API ROUTES

### Discovery Call APIs
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/webhooks/cal` | POST | Cal.com webhook → Creates discovery_calls |
| `/api/discovery-call/pending` | GET | List calls + ALL coaches |
| `/api/discovery-call/assign` | POST | Assign coach to call |
| `/api/discovery-call/[id]` | GET | Get call details + AI questions |
| `/api/discovery-call/[id]/questionnaire` | POST | Save coach questionnaire |
| `/api/discovery-call/[id]/send-payment-link` | POST | Generate WhatsApp payment link |
| `/api/discovery-call/[id]/send-followup` | POST | Send 24hr follow-up |

### Payment APIs
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/payment/create` | POST | Create Razorpay order |
| `/api/payment/verify` | POST | Verify payment (primary) |
| `/api/payment/webhook` | POST | Razorpay webhook (backup) |

### Assessment APIs
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/assessment/analyze` | POST | Gemini analyzes reading |
| `/api/certificate/send` | POST | Email certificate via SendGrid |

---

## 6. CAL.COM CONFIGURATION

**Account:** yestoryd (Cal.com username)

**Event Types:**
- `discovery` - 30 min (FREE discovery call)
- `coaching` - 60 min (post-payment)
- `parent-checkin` - 15 min (post-payment)

**Webhook:**
- URL: `https://yestoryd.com/api/webhooks/cal`
- Event: `BOOKING_CREATED`

**Custom Fields in Discovery Event:**
- Child's Name
- Child's Age
- Phone

---

## 7. GOOGLE CALENDAR CONFIGURATION

**Service Account:** yestoryd-calendar@yestoryd.iam.gserviceaccount.com
**Domain Delegation:** https://www.googleapis.com/auth/calendar

**Post-Payment Flow:**
- Razorpay webhook triggers enrollment
- Creates 9 sessions: 6 coaching + 3 parent check-ins
- Each event includes: Parent, Coach, engage@yestoryd.com (for tl;dv)
- Google Meet link auto-generated

---

## 8. COACH PORTAL

**Pages:**
- `/coach/discovery-calls` - List of assigned discovery calls
- `/coach/discovery-calls/[id]` - Questionnaire form with AI questions

**Questionnaire Fields:**
- Call status (completed/no_show/rescheduled)
- Reading frequency
- Child attitude
- Parent goal
- Likelihood to enroll (high/medium/low)
- Objections (checkboxes)
- Coach notes

---

## 9. STYLING RULES

**CRITICAL:** Always use explicit text colors!
- Inputs: `text-gray-900 bg-white`
- Labels: `text-gray-700`
- Never rely on inherited colors (causes white-on-white issues)

**Brand Colors:**
- Hot Pink: #FF0099 (primary CTAs)
- Electric Blue: #00ABFF (secondary)
- Yellow: #FFDE00 (highlights)
- Purple: #7B008B (gradients)
- WhatsApp Green: #25D366

---

## 10. REVENUE MODEL

| Lead Source | Coach Share | Yestoryd Share |
|-------------|-------------|----------------|
| Coach-sourced | 70% | 30% |
| Yestoryd-sourced | 50% | 50% |
| Rucha coaching | 0% | 100% |

**Pricing:** ₹5,999 for 3-month program (9 sessions)

---

## 11. PENDING ITEMS

1. ✅ Razorpay live payments - WORKING
2. ⏳ Cal.com webhook deployment - Ready to deploy
3. ⏳ Web analytics dashboard
4. ⏳ Coach onboarding page (Yestoryd Academy)
5. ⏳ E-learning modules

---

## 12. COMMON ISSUES & FIXES

| Issue | Cause | Fix |
|-------|-------|-----|
| White text on white | Missing explicit text color | Add `text-gray-900` to all inputs |
| Coach dropdown empty | API filtering `is_active` | Remove filter, fetch ALL coaches |
| Cal.com webhook not firing | Testing on localhost | Deploy to Vercel, Cal.com needs public URL |
| Discovery call in Leads tab | Confusion about tables | Assessment→children (Leads), Cal.com→discovery_calls (Discovery) |

---

## 13. FILE LOCATIONS

```
app/
├── admin/crm/page.tsx          # CRM with Leads + Discovery tabs
├── assessment/results/[id]/page.tsx  # Results with CTAs
├── coach/discovery-calls/
│   ├── page.tsx                # Coach list view
│   └── [id]/page.tsx           # Questionnaire form
├── enroll/page.tsx             # Pre-filled form → Cal.com
├── api/
│   ├── webhooks/cal/route.ts   # Cal.com webhook
│   ├── discovery-call/         # Discovery call APIs
│   └── payment/                # Razorpay APIs
```

---

*Last Updated: December 16, 2025*
