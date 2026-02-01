# YESTORYD - Claude Code Context

## What is Yestoryd?
AI-powered reading intelligence platform for children aged 4-12 in India. Combines Gemini AI assessment with certified human coaching. Free 5-minute assessment → Discovery call → ₹5,999 paid 3-month program.

**Core Value:** The "ARC Method" (Assess, Remediate, Celebrate) through triangulation of rAI (Reading Intelligence) + Human Coaches + Parent Visibility.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth (role-based: parent, coach, admin) |
| AI | Gemini 2.5 Flash Lite |
| Payments | Razorpay (LIVE - working) |
| Calendar | Google Calendar API (sessions), Cal.com (discovery) |
| WhatsApp | AiSensy |
| Email | SendGrid |
| Recording | Recall.ai |
| Background Jobs | QStash (Upstash) |
| Hosting | Vercel |
| Error Monitoring | Sentry |

---

## Directory Structure

```
/app
  /admin          → Admin portal (CRM, coaches, content management)
  /assessment     → Free reading assessment flow
  /coach          → Coach portal (sessions, students)
  /parent         → Parent dashboard
  /enroll         → Discovery call booking + payment
  /api
    /assessment   → AI assessment endpoints
    /chat         → rAI chatbot
    /communication → WhatsApp/email sending
    /discovery    → Native booking system (/api/discovery/book)
    /payment      → Razorpay integration
    /webhooks     → Cal.com, Razorpay, Recall.ai webhooks

/components       → Reusable React components
/lib              → Utilities, Supabase client, API helpers
/public           → Static assets
```

---

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `parents` | Parent accounts |
| `children` | Child profiles + assessment data (this is the Leads table) |
| `coaches` | Coach profiles with calendar_id |
| `enrollments` | Paid program enrollments |
| `scheduled_sessions` | Coaching sessions (linked to Google Calendar) |
| `discovery_calls` | Cal.com + native bookings |
| `learning_events` | Unified event tracking with embeddings (RAG) |
| `communication_templates` | WhatsApp/email templates by category |
| `communication_logs` | Sent message history |
| `site_settings` | Dynamic site content (NO HARDCODING!) |
| `bookings` | Payment records |

---

## Critical Patterns

### 1. NO HARDCODING - Use Enterprise Config Loader
```typescript
// WRONG - hardcoded values
const price = 5999;
const currency = 'INR';
const ADMIN_EMAILS = ['rucha@...'];

// WRONG - raw Supabase query with fallback
const { data } = await supabase.from('site_settings')...;
const value = data?.value || 'fallback'; // NO silent fallbacks!

// RIGHT - use typed config loader (fails loudly if missing)
import { loadPaymentConfig, loadAuthConfig } from '@/lib/config/loader';
const paymentConfig = await loadPaymentConfig();
const authConfig = await loadAuthConfig();
```

**Config categories:** `auth`, `coach`, `payment`, `scheduling`, `revenueSplit`, `notification`, `enrollment`, `email`, `integrations`, `pricingPlans`

**Architecture:** `lib/config/types.ts` (types) + `lib/config/loader.ts` (cached loaders, 5min TTL)

**Cache invalidation:** POST `/api/admin/config/invalidate` with optional `{ category }` body

**Structural constants** (HTTP codes, status enums, regex, session type keys) → `lib/constants/structural.ts`

**Deleted files** (do NOT recreate):
- `lib/site-settings.ts` → use `lib/config/loader.ts`
- `lib/utils/constants.ts` → structural moved to `lib/constants/structural.ts`, business deleted
- `lib/settings/coach-settings.ts` → merged into `loadCoachConfig()`

**Adding new config:**
1. Add to `site_settings` table with appropriate category
2. Add type to `lib/config/types.ts`
3. Add loader in `lib/config/loader.ts` — NO hardcoded fallbacks, fail loudly

### 2. Mobile-First Design
80%+ users are on mobile. Always test responsive layouts.

### 3. Webhook Pattern
All external service webhooks go to `/api/webhooks/[service]` and use QStash for long-running tasks to avoid timeouts.

### 4. Authentication Checks
```typescript
// API routes
import { validateAdminToken } from '@/lib/admin-auth';
const { valid, user } = await validateAdminToken(request);

// Pages use layout-level auth checks
```

### 5. Revenue Split Logic
- Coach-sourced leads: 70% coach / 30% Yestoryd
- Yestoryd-sourced leads: 50% / 50%
- Rucha's direct coaching: 100% Yestoryd

---

## Current Status (Jan 2026)

### ✅ Complete
- Assessment flow + AI analysis
- Discovery call booking (native system)
- Payment processing (Razorpay)
- Coaching session scheduling (Google Calendar)
- Recall.ai session recording + transcription
- Completion flow with PDF certificates
- Admin CRM (Leads + Discovery tabs)
- Communication automation (82+ touchpoints)
- rAI chat infrastructure (hybrid search, HNSW index)

### 🚧 Remaining
- E-learning module content (477-1,178 videos needed)
- Technical video player UI exists, needs content

---

## Common Tasks

### Run locally
```bash
npm run dev
```

### Check build
```bash
npm run build
```

### Database
- Supabase Dashboard: Check table data, run SQL
- Migrations: Use Supabase CLI or dashboard

### Deployments
Auto-deploy on push to main (Vercel)

---

## Key Integrations

| Service | Webhook Endpoint | Purpose |
|---------|------------------|---------|
| Razorpay | `/api/payment/webhook` | Payment confirmation → enrollment |
| Cal.com | `/api/webhooks/cal` | Discovery call bookings |
| Recall.ai | `/api/webhooks/recall` | Session transcripts + analysis |
| AiSensy | via `/api/communication/send` | WhatsApp messages |

---

## DO NOT

1. **Hardcode content** - Always use site_settings table
2. **Skip mobile testing** - Most users are mobile
3. **Use sudo for npm** - Permission issues
4. **Ignore Sentry errors** - Check dashboard
5. **Bypass auth checks** - Security critical
6. **Change revenue split logic** without business approval

---

## Environment Variables (Key Ones)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
SENDGRID_API_KEY
AISENSY_API_KEY
RECALL_API_KEY
GEMINI_API_KEY
SENTRY_DSN
```

---

## When Starting Work

1. `git pull` to get latest
2. Check Sentry for any production errors
3. Review what area you're working on
4. Run `npm run dev` to start local server
5. Test changes on mobile viewport before committing

---

## Contact

- **Amit Kumar Rai** - Technical Lead
- **Rucha Rai** - Lead Coach, Content Creator
