# Yestoryd Development Prompt
## Copy this at the start of each conversation

---

## Context: Yestoryd Platform

I'm building **Yestoryd** - an AI-powered reading intelligence platform for children aged 4-12 in India. The platform combines Gemini 2.5 Flash Lite AI assessment with personalized 1:1 human coaching. My co-founder is Rucha Rai (certified Jolly Phonics coach).

**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL + pgvector), Vercel, Razorpay, SendGrid, Google Calendar API, Recall.ai, AiSensy

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
- Deterministic calculations (math, dates)

### 3. Code Architecture
- **MODIFY existing code first** - only create new if impossible to extend existing
- If creating new code that replaces old, **DELETE the old code** to avoid redundancy
- **Always check the existing code tree** before creating any new branch or file
- If you find any code that's redundant or not enterprise-grade, **flag it and improve/replace**
- Use existing components, utilities, and patterns already established in the codebase

### 4. Database Schema
- **MODIFY existing tables first** - only create new if absolutely necessary
- If replacing a table, **DROP or deprecate the old one**
- Maintain referential integrity with proper foreign keys
- Follow existing naming conventions (snake_case for tables/columns)
- JSONB for flexible fields (like `event_data` in `learning_events`)

### 5. UI/UX Standards - PREMIUM QUALITY

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

### 6. Mobile Responsive Design (MANDATORY)

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
│    🏠        📅          📊         👤       │
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
.truncate-single { 
  @apply truncate;  /* single line with ellipsis */
}

.truncate-multi {
  @apply line-clamp-2;  /* max 2 lines then ellipsis */
}

/* For long names/titles */
.break-safe {
  @apply break-words overflow-hidden;
}

/* Prevent layout breaking */
.no-shrink {
  @apply flex-shrink-0 min-w-0;
}
```

**Mobile Card Pattern:**
```jsx
// Consistent mobile card structure
<div className="bg-white dark:bg-gray-800 rounded-2xl p-4 space-y-3">
  {/* Header row - single line */}
  <div className="flex items-center justify-between">
    <h3 className="font-semibold truncate flex-1 mr-2">{title}</h3>
    <Badge className="flex-shrink-0">{status}</Badge>
  </div>
  
  {/* Content - stacked */}
  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
    <p className="line-clamp-2">{description}</p>
  </div>
  
  {/* Actions - full width stacked */}
  <div className="space-y-2 pt-2">
    <Button className="w-full h-12">Primary Action</Button>
    <Button variant="secondary" className="w-full h-10">Secondary</Button>
  </div>
</div>
```

**Responsive Patterns:**
```css
/* Mobile-first approach */
.container { @apply px-4; }           /* Mobile: 16px padding */
.container { @apply sm:px-6; }        /* Tablet: 24px padding */
.container { @apply lg:px-8; }        /* Desktop: 32px padding */

/* Grid responsive */
.grid { @apply grid-cols-1; }         /* Mobile: single column */
.grid { @apply sm:grid-cols-2; }      /* Tablet: 2 columns */
.grid { @apply lg:grid-cols-3; }      /* Desktop: 3 columns */

/* Hide/show by device */
.mobile-only { @apply block sm:hidden; }
.desktop-only { @apply hidden sm:block; }
```

**Safe Areas (for notched devices):**
```css
padding-bottom: env(safe-area-inset-bottom);
padding-top: env(safe-area-inset-top);
```

### 7. PWA Ready Architecture

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

**Service Worker Considerations:**
- Cache critical assets (logo, fonts, brand colors CSS)
- Offline fallback page with brand styling
- Background sync for form submissions when offline
- Push notification ready (for session reminders)

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

**Installability Checklist:**
- ✅ Valid manifest.json
- ✅ Service worker registered
- ✅ HTTPS (Vercel provides)
- ✅ Appropriate icons (192px, 512px)
- ✅ Splash screens for iOS

### 8. CRO Framework (AIDA + LIFT)

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

### 9. Enterprise-Grade Code Standards

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

### 10. Build for Scale

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

## Pre-Development Checklist

Before writing ANY code, Claude must:

1. ☐ **Search existing codebase** for similar functionality
2. ☐ **Check existing components** in `/components/ui/`
3. ☐ **Review database schema** for existing tables that can be extended
4. ☐ **Look for existing API patterns** in `/app/api/`
5. ☐ **Identify redundant code** that should be replaced (flag it)
6. ☐ **Confirm UI uses brand colors** and Lucide icons (no emojis)

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
│   └── settings/               # Site settings
├── api/
│   ├── payment/                # Razorpay
│   ├── webhooks/               # Cal.com, Recall.ai
│   └── discovery-call/         # Discovery call APIs
└── lib/
    ├── supabase.ts             # Database client
    └── googleCalendar.ts       # Calendar integration

components/
├── ui/                         # Shared UI components
└── [feature]/                  # Feature-specific components
```

---

## Key Tables

| Table | Purpose |
|-------|---------|
| `children` | Assessed children (Leads) |
| `parents` | Parent accounts |
| `coaches` | Coach profiles (includes `tier` column) |
| `discovery_calls` | Discovery bookings |
| `enrollments` | Paid enrollments |
| `scheduled_sessions` | Coaching sessions |
| `site_settings` | Dynamic content |
| `learning_events` | Unified tracking (JSONB) |
| `revenue_split_config` | Tier-based split percentages |
| `enrollment_revenue` | Revenue breakdown per enrollment |
| `coach_payouts` | Monthly payout tracking |

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

---

## Response Format Expected

When implementing features:
1. First, show what existing code/tables you found
2. Explain if modifying existing vs creating new (and why)
3. If creating new, confirm old code/tables to delete
4. Provide enterprise-grade implementation
5. Include any schema changes needed
6. Flag any technical debt discovered

---

*Use this prompt at the start of each Yestoryd development conversation.*
