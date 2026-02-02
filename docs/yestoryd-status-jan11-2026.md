# Yestoryd Platform Status
## Updated: January 11, 2026

---

## Executive Summary

**Platform Completion: ~92%**

Yestoryd is an AI-powered reading intelligence platform for children aged 4-12 in India, combining Gemini 2.5 Flash Lite AI assessment with personalized 1:1 human coaching.

- **Core Product:** ₹5,999 for 3-month coaching program (9 sessions)
- **Lead Magnet:** FREE 5-minute AI reading assessment
- **Live at:** yestoryd.com

---

## ✅ Fully Complete (100%)

### Core Platform

| Component | Details |
|-----------|---------|
| **AI Reading Assessment** | Gemini 2.5 Flash Lite - Clarity, Fluency, Speed metrics |
| **Landing Page + CRO** | Dynamic content from site_settings, AIDA/LIFT optimized |
| **Parent Dashboard** | Progress tracking, session history, rAI chat |
| **Coach Dashboard** | Earnings, schedule, students, dark theme (#0f1419, #FF0099, #00ABFF) |
| **Admin Portal + CRM** | Leads tab, Discovery tab, Coach management, Site settings |
| **Razorpay Payments** | LIVE mode working ✅ |
| **Google Calendar Integration** | Auto-schedules 9 sessions on enrollment |

### AI & Intelligence

| Component | Details |
|-----------|---------|
| **rAI v2.0 Chat System** | Unified `/api/chat` endpoint, hybrid search (SQL + Vector) |
| **Intent Classification** | Tier 0 (regex) + Tier 1 (Gemini) routing |
| **Session Intelligence** | Recall.ai recording, transcription, Gemini analysis |
| **RAG Architecture** | pgvector embeddings, 768-dim, HNSW index |

### Recording & Completion

| Component | Details |
|-----------|---------|
| **Recall.ai Integration** | Auto-scheduling bots, webhooks, MP3 storage (128kbps) |
| **Completion Flow** | Auto-triggers session 9, PDF certificates, NPS surveys |
| **Gemini Feedback** | AI-generated progress summaries |

### Security & Compliance

| Component | Details |
|-----------|---------|
| **Authentication** | Dual system: NextAuth (admin) + Supabase OAuth (coach/parent) |
| **API Auth** | `lib/api-auth.ts` - JWT verification, admin whitelist |
| **Rate Limiting** | Upstash Redis (IP-based) + In-memory (user-based) dual layer |
| **Database Triggers** | Bidirectional sync discovery_calls ↔ children |
| **Error Monitoring** | Sentry integration |
| **Legal** | Privacy Policy, Terms of Service (DPDP Act compliant) |

### Group Classes ✅ NEW

| Feature | Status |
|---------|--------|
| **Public Page** `/classes` | Hero section, class type filters, age filters, session cards |
| **Registration** `/classes/register/[id]` | Razorpay payment integration |
| **Admin Panel** `/admin/group-classes` | Create/edit/cancel sessions |
| **Google Meet** | Auto-generated meeting links |
| **Recall.ai** | Bot auto-scheduling for group sessions |
| **Email Confirmation** | SendGrid integration |
| **Enrolled FREE Access** | Auto-applied ENROLLED100 coupon |
| **Variable Pricing** | ₹199-₹400+ per class type |
| **Revenue Split** | Configurable (default 50/50) |
| **Capacity Management** | 5-7 children, waitlist support |
| **Age Bands** | 4-6, 7-9, 10-12 grouping |

### Infrastructure

| Component | Details |
|-----------|---------|
| **Hosting** | Vercel |
| **Database** | Supabase (PostgreSQL + pgvector) |
| **Background Jobs** | QStash (Upstash) |
| **WhatsApp API** | AiSensy (configured) |
| **Email** | SendGrid (domain authenticated) |
| **Calendar** | Google Calendar API (coaching) + Cal.com (discovery) |

---

## 🟡 In Progress / Partial

| Component | Status | Notes |
|-----------|--------|-------|
| **WhatsApp Automation** | 20% | Infrastructure ready, 82+ touchpoints not triggering |
| **E-Learning System** | 0% content | Database schema complete, admin portal built, no videos recorded |
| **Group Classes Notifications** | ⏳ | Designed, needs WhatsApp/email implementation |
| **Communication Templates** | ⏳ | Awaiting Meta approval |

---

## 🔴 Not Started (Phase 2)

| Component | Effort | Priority |
|-----------|--------|----------|
| **E-Learning Video Content** | 477-1,178 videos | High |
| **Digital Book Library** | Curation system | Medium |
| **Live Competitions** | Event-based | Low |
| **Automated Testing** | Coverage | Medium |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Database | Supabase (PostgreSQL + pgvector) |
| AI | Gemini 2.5 Flash Lite |
| Payments | Razorpay (LIVE) |
| Calendar | Google Calendar API |
| Recording | Recall.ai |
| WhatsApp | AiSensy |
| Email | SendGrid |
| Hosting | Vercel |
| Background Jobs | QStash (Upstash) |
| Rate Limiting | Upstash Redis |
| Error Monitoring | Sentry |

---

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Hot Pink | #FF0099 | CTAs, headlines, earnings |
| Electric Blue | #00ABFF | Primary elements, links |
| Yellow | #FFDE00 | Highlights, badges |
| Dark Background | #0f1419 | Coach portal internal pages |
| WhatsApp Green | #25D366 | WhatsApp CTAs only |

---

## Revenue Model

| Scenario | Lead Cost (20%) | Coach Cost (50%) | Platform (30%) |
|----------|-----------------|------------------|----------------|
| Yestoryd Lead | → Yestoryd | → Coach | → Yestoryd |
| Coach Lead | → Coach | → Coach | → Yestoryd |
| Rucha Coaching | → Yestoryd | → Internal | → Yestoryd |

---

## Key Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI Branding | rAI (not Vedant) | Tech-forward, avoids coach confusion |
| Discovery Calendar | Cal.com | Pre-payment booking |
| Coaching Calendar | Google Calendar | Post-payment sessions |
| Session Recording | Recall.ai | Replaced tl;dv, better API |
| WhatsApp Provider | AiSensy | India-focused, better rates |
| Rate Limiting | Upstash Redis | Serverless-friendly, persistent |

---

## Database Key Tables

| Table | Purpose |
|-------|---------|
| `children` | All assessed children (Leads) |
| `parents` | Parent accounts |
| `coaches` | Coach profiles |
| `discovery_calls` | Cal.com discovery bookings |
| `enrollments` | Paid enrollments |
| `scheduled_sessions` | Post-payment coaching sessions |
| `learning_events` | Unified tracking (JSONB) + embeddings |
| `site_settings` | Dynamic site content |
| `group_class_types` | Class types (Phonics, Kahani Times, etc.) |
| `group_class_sessions` | Scheduled group sessions |
| `group_class_registrations` | Registration records |

---

## Customer Journey Status

### Parent Journey (10 Stages)
```
✅ Homepage → ✅ Assessment → ✅ Results → ✅ Discovery Booking →
✅ Discovery Call → ✅ Payment → ✅ Enrollment → ✅ Sessions →
✅ Completion → 🔄 E-Learning (infrastructure only)
```

### Coach Journey (8 Stages)
```
✅ Login → ✅ Dashboard → ✅ Discovery Calls → ✅ Session Management →
✅ Session Notes → ✅ Completion → ✅ Earnings → 🔄 Onboarding polish
```

### Admin Journey (4 Stages)
```
✅ CRM (Leads + Discovery) → ✅ Coach Management → ✅ Revenue Tracking →
✅ Site Settings → ✅ Group Classes
```

---

## Security Audit Status (Jan 11, 2026)

| Finding | Status | Notes |
|---------|--------|-------|
| Split-Brain Auth | ✅ Validated | JWT signature verified via Supabase |
| Bidirectional DB Triggers | ✅ Validated | `IS DISTINCT FROM` prevents loops |
| WhatsApp State Machine | 🟡 Phase 2 | Backlog item |
| Rate Limiting | ✅ Fixed | Upstash (IP) + In-memory (user) dual layer |

---

## Monthly Operational Costs

| Mode | Cost |
|------|------|
| Lean | ₹12,502/month |
| Full | ₹35,455/month |

**Break-even:** 3 children/month (lean) / 12 children/month (full)

---

## Next Priority Actions

| Priority | Action | Effort |
|----------|--------|--------|
| P1 | E-learning video content creation | 4 months |
| P2 | WhatsApp automation (82 touchpoints) | 1-2 weeks |
| P3 | Migrate to cookie-based auth | 5-6 hours |
| P4 | Group classes notifications | 1 day |

---

*Last Updated: January 11, 2026*
*Version: 3.0*
