# Yestoryd Development Prompt
## Copy this at the start of each conversation

---

## Context: Yestoryd Platform

I'm building **Yestoryd** - an AI-powered reading intelligence platform for children aged 4-12 in India. The platform combines Gemini 2.5 Flash Lite AI assessment with personalized 1:1 human coaching. My co-founder is Rucha Rai (certified Jolly Phonics coach).

**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL + pgvector), Vercel, Razorpay, SendGrid, Google Calendar API, Recall.ai, AiSensy

---

## VERIFICATION PROTOCOL (MANDATORY — DO THIS FIRST)

**Before writing ANY code, you MUST complete this verification. No exceptions.**

### Step 1: Quick Codebase Scan (30 seconds)

```bash
# Run ALL of these before implementing anything
echo "=== ALL TABLES ===" && \
psql "$DATABASE_URL" -c "SELECT table_name, (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as col_count FROM information_schema.tables t WHERE table_schema = 'public' ORDER BY table_name;" 2>/dev/null || \
echo "Use Supabase SQL editor to list tables"

echo "=== SEARCH FOR EXISTING IMPLEMENTATION ===" && \
grep -r "FEATURE_KEYWORD" app/ components/ lib/ --include="*.ts" --include="*.tsx" -l
```

Replace `FEATURE_KEYWORD` with what you're about to build.

### Step 2: Report Before Building

Before writing any code, tell me:
1. **What already exists** — tables, routes, components related to this feature
2. **What I'll modify** — existing files to extend (with file paths)
3. **What I'll create new** — only if nothing exists to extend (justify why)
4. **What I'll delete** — old/redundant code being replaced
5. **Schema changes needed** — exact SQL, will be saved as migration file

**Wait for my confirmation before proceeding.** If the task is simple (bug fix, small UI change), proceed but still report findings.

### Step 3: Pre-Development Checklist

1. ☐ **Searched existing codebase** for similar functionality
2. ☐ **Checked existing components** in `/components/ui/`
3. ☐ **Reviewed database schema** for existing tables that can be extended
4. ☐ **Looked for existing API patterns** in `/app/api/`
5. ☐ **Checked docs/CURRENT-STATE.md** if it exists (source of truth)
6. ☐ **Identified redundant code** that should be replaced (flag it)
7. ☐ **Confirmed UI uses brand colors** and Lucide icons (no emojis)

---

## Development Principles (MUST FOLLOW)

### 1. Single Source of Truth (CRITICAL)
- ALL content must be dynamic - fetch from `site_settings` table, never hardcode
- Admin portal controls all variables (pricing, testimonials, feature flags)
- Check existing patterns before implementing anything new

**NEVER HARDCODE - Use `site_settings` or Database:**

| Category | Variables | Why |
|----------|-----------|-----|
| **Pricing** | Program price, discounts, offer %, trial pricing | Business flexibility |
| **Program** | Session count, duration, session length | Product evolution |
| **Revenue** | Split percentages per tier, lead cost %, TDS rates | Partnership changes |
| **Coach Tiers** | Tier names, tier benefits, tier thresholds | Career progression updates |
| **Content** | Testimonials, FAQs, hero text, taglines, CTAs | Marketing iteration |
| **Thresholds** | Age ranges, reading levels, assessment criteria | Pedagogical updates |
| **Timing** | Reminder intervals, follow-up delays, offer expiry | Optimization |
| **Templates** | Email subjects/body, WhatsApp messages, SMS | A/B testing |
| **Features** | Feature flags, beta toggles, module availability | Gradual rollout |
| **Limits** | Max students/coach, session caps, retry limits | Scaling adjustments |

**Acceptable to Hardcode (truly static):**
- Brand colors (hex values)
- Breakpoint values (Tailwind defaults)
- API endpoints (environment variables)
- Component structure (HTML/JSX)
- Validation patterns (email regex, phone format)

### 2. AI-Powered Intelligence (Use Gemini)

**Principle:** Where human judgment or quality decisions are needed, use Gemini instead of hardcoded rules. This creates smarter, more adaptive experiences.

**Already Using Gemini For:**
- Reading assessment analysis (clarity, fluency, speed scoring)
- Session transcript analysis (via Recall.ai integration)
- AI-generated questions for discovery calls
- Parent session summaries (post-session WhatsApp)
- Child learning profile synthesis (post-session)

**SHOULD Use Gemini For:**

| Use Case | Instead of Hardcoding | Gemini Does |
|----------|----------------------|-------------|
| **Coach Matching** | Round-robin assignment | Analyze child's needs + coach strengths → best match |
| **Session Prep** | Generic question list | Context-aware questions based on child's history |
| **Progress Reports** | Template with placeholders | Personalized narrative from learning_events data |
| **Parent Communications** | Static message templates | Tone-adapted messages based on engagement level |
| **Content Recommendations** | Age-based filtering only | Skill-gap analysis → targeted module suggestions |
| **Difficulty Adjustment** | Fixed level progression | Adaptive based on performance patterns |
| **Objection Handling** | Static FAQ responses | Dynamic responses based on parent's specific concerns |
| **Session Summaries** | Manual coach notes only | AI-enhanced summaries from transcript + notes |
| **Engagement Scoring** | Simple metrics (attendance) | Multi-factor analysis (progress, engagement, consistency) |
| **Churn Prediction** | None | Early warning from behavior patterns |

**Gemini Integration Pattern:**
```typescript
// Instead of hardcoded logic:
// ❌ if (age >= 4 && age <= 6) return 'foundation';

// ✅ Use Gemini for nuanced decisions:
const prompt = `
  Based on this child's assessment:
  - Age: ${child.age}
  - Reading Score: ${assessment.score}
  - Specific Struggles: ${assessment.struggles}
  
  Recommend the appropriate starting level and explain why.
  Return JSON: { level: string, reasoning: string, focus_areas: string[] }
`;

const recommendation = await geminiAnalyze(prompt);
```

**When NOT to Use Gemini:**
- Simple CRUD operations
- Authentication/authorization
- Payment processing
- Calendar scheduling (use Google Calendar API)
- Real-time validations (too slow)
- Deterministic calculations (math, dates, adherence scores)

### 3. Code Architecture
- **MODIFY existing code first** - only create new if impossible to extend existing
- If creating new code that replaces old, **DELETE the old code** to avoid redundancy
- **Always check the existing code tree** before creating any new branch or file
- If you find any code that's redundant or not enterprise-grade, **flag it and improve/replace**
- Use existing components, utilities, and patterns already established in the codebase

### 4. Database Schema — MIGRATION FILE DISCIPLINE

- **MODIFY existing tables first** - only create new if absolutely necessary
- If replacing a table, **DROP or deprecate the old one**
- Maintain referential integrity with proper foreign keys
- Follow existing naming conventions (snake_case for tables/columns)
- JSONB for flexible fields (like `event_data` in `learning_events`)

**CRITICAL — SCHEMA CHANGE RULES:**

```
❌ NEVER alter tables via Supabase Dashboard directly
❌ NEVER run CREATE TABLE / ALTER TABLE in the SQL editor without a migration file

✅ ALWAYS create a migration file: supabase/migrations/YYYYMMDD_description.sql
✅ ALWAYS regenerate TypeScript types after schema changes:
   npx supabase gen types typescript --local > lib/supabase/database.types.ts
✅ ALWAYS include rollback comments in migration files
```

**Migration File Template:**
```sql
-- Migration: YYYYMMDD_description.sql
-- Purpose: [what this changes and why]
-- Date: [date]
-- Session: [Claude Code session number if applicable]

-- FORWARD
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value;

-- ROLLBACK (commented, for reference)
-- ALTER TABLE table_name DROP COLUMN IF EXISTS column_name;
```

### 5. Content Architecture — Unified el_* System

**The `el_*` tables are the single source of truth for ALL content:**

```
el_stages (Foundation / Building / Mastery)
  └── el_modules (Phonics Module 1, Fluency Module 2, ...)
       └── el_skills (CVC Blending, Consonant Digraphs, ...)
            └── el_learning_units  ← coach_guidance + parent_instruction live here
                 ├── el_videos (mp4, duration, thumbnail)
                 ├── el_game_content (game config, type)
                 └── el_worksheets (pdf/image, page_count)
```

**Rules:**
- NEVER create a separate content_library or content_assets table
- All content flows through el_* hierarchy
- Session templates reference el_* content via `content_refs` in `activity_flow` JSONB
- Coach sees content with `coach_guidance` from el_learning_units
- Parent sees content with `parent_instruction` from el_learning_units
- Child sees content via e-learning with gamification wrapper

### 6. UI/UX Standards - PREMIUM QUALITY

**Brand Colors (ALWAYS use exact hex):**
| Color | Hex | Usage |
|-------|-----|-------|
| Hot Pink | `#FF0099` | Primary CTAs, loading spinners, focus states |
| Electric Blue | `#00ABFF` | Secondary actions only |
| Yellow | `#E6C600` | Highlights (WCAG compliant, not #FFDE00) |
| Deep Purple | `#7B008B` | Gradients, premium sections |
| WhatsApp Green | `#25D366` | WhatsApp CTAs only |

**Dark Theme Colors:**
```
Background:      #0f1419 or bg-gray-900
Card BG:         bg-gray-800 or bg-gray-800/50
Borders:         border-gray-700
Text Primary:    text-white
Text Secondary:  text-gray-400
Text Tertiary:   text-gray-500
```

**Light Theme Colors:**
```
Background:      bg-white or bg-gray-50
Card BG:         bg-white border border-gray-200
Borders:         border-gray-200 or border-gray-300
Text Primary:    text-gray-900
Text Secondary:  text-gray-600
Text Tertiary:   text-gray-500
```

**Theme Implementation:**
- Use CSS variables or Tailwind's `dark:` prefix for theme switching
- Brand colors (Pink, Blue, Purple) remain consistent across both themes
- Always test both themes before completing any UI work
- Parent-facing pages: Light theme default
- Coach/Admin portals: Dark theme default

**Component Standards:**
```
Cards:           rounded-2xl border border-gray-700 bg-gray-800/50
Buttons Primary: rounded-xl bg-[#FF0099] hover:bg-[#FF0099]/90
Buttons Second:  rounded-xl bg-gray-700 hover:bg-gray-600
Inputs:          rounded-xl border border-gray-700 focus:border-[#FF0099]
Loading:         Loader2 text-[#FF0099] animate-spin
Touch Targets:   min-h-[44px] min-w-[44px] (WCAG 2.5.5)
```

**CRITICAL UI RULES:**
- ✅ Use **Lucide icons** (professional)
- ❌ NEVER use emojis - they look cheap and unprofessional
- ✅ Mobile-first design (80%+ users on mobile in India)
- ✅ Explicit text colors always (`text-gray-900` on white backgrounds)
- ✅ Consistent border-radius hierarchy (badges: rounded-lg, buttons: rounded-xl, cards: rounded-2xl)

### 7. Mobile Responsive Design (MANDATORY)

**Mobile-First Breakpoints:**
```
xs:  375px   // iPhone SE (minimum supported)
sm:  640px   // Large phones
md:  768px   // Tablets
lg:  1024px  // Desktop
xl:  1280px  // Large desktop
```

**Responsive Requirements:**
- Design mobile view FIRST, then scale up to desktop
- Touch targets minimum `44px × 44px` (WCAG 2.5.5)
- No horizontal scroll on any device
- Text readable without zooming (min 16px base)
- Tap-friendly spacing between interactive elements (min 8px gap)
- Test on actual devices: iPhone SE, mid-range Android (₹8,000-15,000 phones)

**Mobile Navigation Pattern:**
```
❌ DON'T: Hamburger menu (hidden, poor discoverability)
✅ DO: Bottom navigation bar (thumb-friendly, always visible)

Bottom Nav Structure:
┌─────────────────────────────────────────────┐
│  [Home]  [Sessions]  [Progress]  [Profile]  │
└─────────────────────────────────────────────┘
- Max 4-5 items
- Active state: Pink (#FF0099) icon + label
- Inactive: Gray icon, no label (or muted label)
- Fixed bottom with safe-area padding
```

**Mobile Layout Rules:**
```
✅ Single-row layouts - no multi-column on mobile
✅ Full-width cards and buttons
✅ Vertical stacking of content
✅ Consistent spacing (16px horizontal padding)

❌ Side-by-side buttons on mobile (stack vertically)
❌ Multi-column grids below 640px
❌ Floating action buttons that obscure content
```

**Button Height Standards:**
```
Small actions (filters, tags):     32px (h-8)
Standard buttons (secondary):      40px (h-10)  
Primary CTAs:                      48px (h-12)
Large CTAs (hero, checkout):       56px (h-14)

/* Tailwind classes */
.btn-sm     { @apply h-8 px-3 text-sm; }
.btn-md     { @apply h-10 px-4 text-base; }
.btn-lg     { @apply h-12 px-6 text-base; }
.btn-xl     { @apply h-14 px-8 text-lg; }
```

**Typography Hierarchy (Mobile):**
```
Page Title:      text-xl (20px) font-bold
Section Header:  text-lg (18px) font-semibold  
Card Title:      text-base (16px) font-semibold
Body Text:       text-base (16px) font-normal
Caption/Meta:    text-sm (14px) text-gray-500
Small Labels:    text-xs (12px) font-medium

/* Line heights */
Headings:  leading-tight (1.25)
Body:      leading-relaxed (1.625)
```

**Text Overflow Prevention:**
```css
/* Always apply to text containers */
.truncate-single { @apply truncate; }
.truncate-multi  { @apply line-clamp-2; }
.break-safe      { @apply break-words overflow-hidden; }
.no-shrink       { @apply flex-shrink-0 min-w-0; }
```

**Mobile Card Pattern:**
```jsx
<div className="bg-white dark:bg-gray-800 rounded-2xl p-4 space-y-3">
  <div className="flex items-center justify-between">
    <h3 className="font-semibold truncate flex-1 mr-2">{title}</h3>
    <Badge className="flex-shrink-0">{status}</Badge>
  </div>
  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
    <p className="line-clamp-2">{description}</p>
  </div>
  <div className="space-y-2 pt-2">
    <Button className="w-full h-12">Primary Action</Button>
    <Button variant="secondary" className="w-full h-10">Secondary</Button>
  </div>
</div>
```

**Responsive Patterns:**
```css
.container { @apply px-4 sm:px-6 lg:px-8; }
.grid { @apply grid-cols-1 sm:grid-cols-2 lg:grid-cols-3; }
.mobile-only { @apply block sm:hidden; }
.desktop-only { @apply hidden sm:block; }
```

**Safe Areas (for notched devices):**
```css
padding-bottom: env(safe-area-inset-bottom);
padding-top: env(safe-area-inset-top);
```

### 8. PWA Ready Architecture

**PWA Requirements (all new features must support):**

**Manifest Configuration:**
```json
{
  "name": "Yestoryd - Reading Intelligence",
  "short_name": "Yestoryd",
  "theme_color": "#FF0099",
  "background_color": "#0f1419",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "/",
  "scope": "/"
}
```

**PWA-Ready Coding Practices:**
- All images must have explicit width/height (prevent CLS)
- Use `next/image` for automatic optimization
- Lazy load below-fold content
- Preload critical fonts
- API responses must handle offline gracefully
- Local storage for draft data (assessments in progress)

**Performance Targets (Lighthouse):**
| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.8s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.5s |
| Cumulative Layout Shift | < 0.1 |
| Mobile Performance Score | > 85 |

### 9. CRO Framework (AIDA + LIFT)

**AIDA Principle:**
- **Attention:** Bold headlines, contrasting colors, compelling hero
- **Interest:** Benefits-focused copy, social proof, problem-solution
- **Desire:** Testimonials, outcomes, emotional triggers
- **Action:** Clear CTAs, urgency elements, friction removal

**LIFT Framework:**
- **Value Proposition:** Clear benefit statement above fold
- **Relevance:** Match user intent, personalize where possible
- **Clarity:** Simple language, visual hierarchy, scannable
- **Anxiety:** Trust badges, security indicators, testimonials
- **Distraction:** Minimize navigation, single primary CTA
- **Urgency:** Time-limited offers, scarcity indicators

### 10. Enterprise-Grade Code Standards

**Must Include:**
- Comprehensive error handling with try-catch
- Loading and error states for all async operations
- TypeScript types (no `any` unless absolutely necessary)
- Input validation (Zod schemas where applicable)
- Proper logging for debugging (console.error for errors)
- Comments for complex logic
- Audit trails for business-critical operations

**API Pattern:**
```typescript
export async function POST(request: Request) {
  try {
    // 1. Validate input
    const body = await request.json();
    // 2. Business logic
    // 3. Database operation
    // 4. Return success
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[API_NAME] Error:', error);
    return NextResponse.json({ error: 'Message' }, { status: 500 });
  }
}
```

### 11. Build for Scale

**Current Design Targets:**
- 50 → 1,000 → 100,000 children without architecture changes
- API quotas considered (Google Calendar: 1M/day, Supabase: plan limits)
- Indexed queries on frequently filtered columns
- Connection pooling configured
- Consider Redis caching for high-traffic endpoints

**Database Indexes Required:**
- Foreign keys on all relationship columns
- Status columns used in filters
- Timestamps used in sorting

---

## SESSION CLOSURE PROTOCOL (MANDATORY — DO THIS LAST)

**Before ending ANY Claude Code session, generate this manifest:**

```
Generate docs/session-[N]-manifest.md with:

1. CREATED FILES (full paths):
   - [list every new file]

2. MODIFIED FILES (full paths + what changed):
   - [file path] — [one-line description of change]

3. DELETED FILES (full paths + why):
   - [file path] — [reason]

4. DATABASE CHANGES:
   - Tables created: [list with migration file paths]
   - Tables altered: [list with migration file paths]  
   - Tables dropped: [list with migration file paths]
   - ⚠️ Changes made via Supabase Dashboard (NOT via migration): [list — THESE ARE PROBLEMS]

5. MIGRATION FILES CREATED:
   - supabase/migrations/YYYYMMDD_description.sql

6. TYPESCRIPT TYPES:
   - ☐ database.types.ts regenerated? [YES/NO — if NO, explain why]

7. KNOWN ISSUES / INCOMPLETE:
   - [any TODOs, edge cases, or items deferred]

8. WHAT TO TELL CLAUDE WEB:
   - [2-3 sentence summary of what was built/changed for context sync]
```

**Then regenerate docs/CURRENT-STATE.md:**

```
Regenerate docs/CURRENT-STATE.md with:

## Database Tables
[List ALL public tables with column count and row count]

## API Routes  
[List ALL routes in app/api/ with one-line purpose]

## Cron Jobs
[List ALL cron routes — mark which are configured in vercel.json vs unconfigured]

## Component Directories
[List ALL directories in components/ with file count]

## Key Integrations
[Status of: Razorpay, Recall.ai, AiSensy, SendGrid, Google Calendar]

## Recent Changes
[Last 3 session manifests — date + summary]

## Known Tech Debt
[Active TODOs, stale types, unfinished features]

Generated: [timestamp]
```

---

## File Structure Reference

```
app/
├── page.tsx                    # Homepage
├── assessment/                 # Assessment flow
├── parent/                     # Parent dashboard
├── coach/                      # Coach portal
├── admin/                      # Admin portal
│   ├── crm/                    # CRM (Leads + Discovery tabs)
│   ├── templates/              # Session template management
│   ├── content/                # Content library (el_* admin)
│   └── settings/               # Site settings
├── api/
│   ├── payment/                # Razorpay
│   ├── webhooks/               # Recall.ai
│   ├── coach/sessions/         # Session management + Companion Panel
│   ├── elearning/              # E-learning APIs
│   └── discovery-call/         # Discovery call APIs
├── lib/
│   ├── rai/                    # rAI v2.0 utilities
│   ├── supabase.ts             # Database client
│   └── googleCalendar.ts       # Calendar integration
└── docs/
    ├── CURRENT-STATE.md        # Auto-generated source of truth
    └── session-[N]-manifest.md # Per-session audit trail

components/
├── ui/                         # Shared UI components
├── coach/live-session/         # Companion Panel (10 components)
└── [feature]/                  # Feature-specific components

supabase/
└── migrations/                 # ALL schema changes go here
    └── YYYYMMDD_description.sql
```

---

## Key Tables

| Table | Purpose |
|-------|---------|
| `children` | Assessed children (Leads) + `learning_profile` JSONB |
| `parents` | Parent accounts |
| `coaches` | Coach profiles (includes `tier`, `completed_sessions_with_logs`) |
| `discovery_calls` | Discovery bookings |
| `enrollments` | Paid enrollments |
| `scheduled_sessions` | Coaching sessions (includes `adherence_score`, `session_template_id` FK) |
| `session_activity_log` | Per-activity tracking from Companion Panel |
| `session_templates` | Reusable session designs with `activity_flow` JSONB |
| `learning_events` | Unified tracking (JSONB) — all learning moments |
| `site_settings` | Dynamic content |
| `revenue_split_config` | Tier-based split percentages |
| `enrollment_revenue` | Revenue breakdown per enrollment |
| `coach_payouts` | Monthly payout tracking |
| `season_roadmaps` | Season-level learning roadmap |
| `season_learning_plans` | Per-session plan within roadmap |
| `el_learning_units` | Content units (THREE LENSES: coach_guidance, parent_instruction, child_label) |
| `el_videos` | Video content assets |
| `el_game_content` | Game content assets |
| `el_worksheets` | Worksheet/PDF content assets |
| `el_skills` | Skill definitions |
| `el_modules` | Module groupings |
| `el_stages` | Stage hierarchy (Foundation/Building/Mastery) |
| `recall_bot_sessions` | Recall.ai bot tracking |

---

## Revenue Model

**3-Component Split Model:**
| Component | Purpose |
|-----------|---------|
| **Lead Cost** | Goes to whoever sourced the lead (Yestoryd or Coach) |
| **Coach Cost** | Goes to the coach who delivers sessions |
| **Platform Fee** | Retained by Yestoryd |

**Coach Tiers & Revenue Splits (from `coaches.tier` + `revenue_split_config`):**

| Coach Tier | Lead Cost | Coach Cost | Platform Fee | Notes |
|------------|-----------|------------|--------------|-------|
| **Founding** | 20% | 50% | 30% | Early partners (Rucha) |
| **Senior** | 20% | 45% | 35% | Experienced, high performers |
| **Standard** | 20% | 40% | 40% | Regular certified coaches |
| **Trainee** | 20% | 35% | 45% | New coaches in probation |

**Lead Source Rules:**
- **Coach-sourced lead:** Lead Cost (20%) → Coach who brought the lead
- **Yestoryd-sourced lead:** Lead Cost (20%) → Retained by Yestoryd
- **Rucha coaching:** 100% → Yestoryd (special case)

**TDS:** 10% deducted on Coach Cost (Section 194J) if annual payout > ₹30,000

**IMPORTANT:** Revenue split percentages are stored in database (`revenue_split_config` table), NOT hardcoded. Coach tier is stored in `coaches.tier` column.

**Pricing:** ₹5,999 for 3-month program (9 sessions) - stored in `site_settings`

---

## When You Find Issues

If you identify:
- **Redundant code:** Flag it and propose consolidation
- **Non-enterprise patterns:** Suggest improvement before implementing
- **Missing indexes:** Recommend adding them
- **Hardcoded values:** Move to site_settings
- **Inconsistent UI:** Standardize to brand guidelines
- **Stale TypeScript types:** Regenerate database.types.ts
- **Schema changes without migration files:** Create the migration file retroactively
- **Duplicate tables:** Flag for consolidation (especially learning_videos vs el_videos patterns)

---

## Response Format Expected

When implementing features:
1. First, show what existing code/tables you found (from verification scan)
2. Explain if modifying existing vs creating new (and why)
3. If creating new, confirm old code/tables to delete
4. Provide enterprise-grade implementation
5. Include schema changes as migration files (not Dashboard alterations)
6. Flag any technical debt discovered
7. At session end, generate manifest + update CURRENT-STATE.md

---

*Use this prompt at the start of each Yestoryd development conversation.*
*Version: 3.0 — Updated February 11, 2026*
*Changes: Added Verification Protocol, Migration File Discipline, Content Architecture (el_*), Session Closure Protocol, CURRENT-STATE.md generation*
