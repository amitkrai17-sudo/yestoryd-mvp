# Yestoryd — Claude Code Project Memory

## What is Yestoryd?
AI-powered reading coaching platform for children aged 4–12 in India. Combines AI assessment with 1:1 human coaching using the ARC method (Assess → Remediate → Celebrate). Mobile-first (80%+ mobile users). Founded by Amit (tech lead) and Rucha (certified Jolly Phonics instructor, primary coach).

## Tech Stack
- **Framework:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Database:** Supabase (PostgreSQL + pgvector, HNSW indexing, 768-dim vectors)
- **Hosting:** Vercel
- **AI:** Gemini 2.5 Flash + Pro (primary), Flash Lite (cost-sensitive), gemini-embedding-001
- **Payments:** Razorpay (inbound), RazorpayX/Cashfree (coach payouts)
- **WhatsApp:** AiSensy (outbound templates — 918976287997), Meta Cloud API (Lead Bot — 918591287997)
- **Email:** Resend (engage@yestoryd.com, 3000/month free)
- **Calendar:** Google Calendar API (service account + domain-wide delegation)
- **Recording:** Recall.ai (auto-join Meet, MP3 128kbps permanent, 7-day video)
- **Background Jobs:** Upstash QStash (2 slots: dispatcher every 15min + goals-capture every 5min)
- **Monitoring:** Sentry, GA4, Meta Pixel, Google Ads
- **PWA:** Service worker + push subscriptions

## Golden Rules (ENFORCE ALWAYS)

1. **ZERO Hardcoded Business Values** — ALL prices, session counts, durations, emails, phone numbers, thresholds, and config come from the database. The ONLY place a hardcoded fallback may exist is inside the shared config loader file for that concern (e.g., `lib/config/pricing-config.ts` for prices, `lib/config/company-config.ts` for contact info). Route files, components, and pages must NEVER contain hardcoded business values — they import from config loaders which read from DB.
2. **Config Loaders Are Law** — Prices → `getPricingConfig()`. Contact info → `COMPANY_CONFIG` from `lib/config/company-config.ts`. Session counts/durations → `age_band_config` table. Revenue splits → `coach_groups` table. Referral % → `site_settings` key `parent_referral_credit_percent`. Thresholds → `site_settings` or `getSiteSetting()` from `lib/config/site-settings-loader.ts`. If a config loader doesn't exist for something, create one — don't hardcode.
3. **Modify Over Create** — Audit existing code before building new. One source of truth per concern. If replacing, DELETE the old.
4. **Verification-First** — Before writing ANY code: `grep -r "KEYWORD" app/ components/ lib/ --include="*.ts" --include="*.tsx" -l` → Report what exists → Wait for confirmation.
5. **Mobile-First** — India 80%+ mobile. Bottom nav on mobile, sidebar on desktop. Single-column cards. 44px min touch targets. No nested scroll.
6. **Gemini-First Intelligence** — Where human judgment is needed, use Gemini. Assessment prompts MUST use builders from `lib/gemini/assessment-prompts.ts`. Anti-hallucination rules via shared `getAntiHallucinationRules()`.
7. **Migration File Discipline** — ALL schema changes via `supabase/migrations/YYYYMMDD_description.sql`. NEVER via Supabase Dashboard.
8. **No Emojis in UI** — Lucide React icons only. Zero emoji in ANY rendered output — website, portals, emails, admin alerts, children's UI, certificates, calendar events. Premium brand, no exceptions.
9. **Enterprise-Grade TypeScript** — No `any` unless necessary (mark `// TODO: type properly`). Proper error handling, loading + empty states, audit trails.
10. **Baby-Step Development** — Small changes, verify each, then proceed.

## Post-Change Verification (MANDATORY after every multi-file change)

After ANY change that touches more than 3 files, run ALL these checks BEFORE reporting done. Fix any violations found — do not report done with violations present.

```bash
# 1. No hardcoded phone numbers leaked
grep -rn "8976287997\|8591287997\|9687606177\|98765" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep -v "company-config.ts" | grep -v "node_modules" | grep -v "// "

# 2. No hardcoded emails leaked
grep -rn "engage@yestoryd\|system@yestoryd\|amitkrai17@\|rucha.rai@" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep -v "company-config.ts" | grep -v "node_modules" | grep -v "// "

# 3. No hardcoded prices leaked
grep -rn "\b5999\b\|\b6999\b\|\b1499\b\|\b7499\b\|\b9999\b" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep -v "pricing-config.ts" | grep -v "node_modules" | grep -v "// " | grep -v "types/"

# 4. No hardcoded session counts leaked
grep -rn "|| 9\b\|?? 9\b\|= 9;" app/ lib/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | grep -v "// "

# 5. No emoji in rendered output
grep -rP "[\x{1F300}-\x{1F9FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]" app/ components/ lib/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"

# 6. Auth check on any new/modified API route (except webhooks/ and cron/)
# Verify every non-public route has auth within first 20 lines

# 7. No new as any introduced in changed files
# grep -rn "as any" <changed-files>

# 8. No inline Gemini client instantiation
grep -rn "new GoogleGenerativeAI" app/ lib/ --include="*.ts" | grep -v "lib/gemini/client.ts"
```

### Local Build Discipline (MANDATORY before push)

**Local `npm run build` is mandatory before push for any commit that:**
- Adds new Supabase queries with `.eq()` / `.single()` / `.maybeSingle()` chains
- Adds new SELECT columns or JOINs
- Touches files with new variable references (e.g. lifting a query to a new scope, switching between try blocks)
- Modifies more than 5 files in one commit

Skip the build only for: doc-only commits, migration-only commits, comment-only changes, or single-line config tweaks.

**Reasoning:** Vercel build budget concerns are NEVER worth a divergent production state. A failed Vercel deploy with already-applied DB migrations leaves production code stale while DB expects new shape — silent runtime failures result. Local build catches TS2345 / type errors that Vercel would catch 3 minutes later, but without the cost of a broken deploy.

The 2026-04-25 four-template alignment incident demonstrated this: two consecutive deploys ERRORED on nullable-type guards (commits `a461f731` and `698ff708`), leaving DB migrations applied while production code stayed on stale deploy. 60-minute divergence window — zero send attempts during it by luck only.

## Plugin & Skill Usage Rules (ENFORCE ALWAYS)

- ALWAYS use **frontend-design** plugin for any UI/component/page work — even small changes
- ALWAYS use **code-review** plugin before completing any multi-file change
- ALWAYS use **context7** plugin to check current docs before using Next.js, Supabase, or Tailwind APIs — training data may be stale
- ALWAYS use **supabase** plugin for database operations, RLS policies, or query optimization
- ALWAYS use **sentry** plugin when adding error handling, monitoring, or new API routes
- ALWAYS use **feature-dev** plugin for codebase exploration and architecture design on larger features
- ALWAYS use **vercel** plugin for deployment, build, and hosting operations
- ALWAYS load relevant `.claude/skills/` for Yestoryd-specific patterns (api-route, gemini-prompt, migration, ui-component, cron-task, deploy-check, supabase-query)

## AI Prompt Rules (CRITICAL)

- All Gemini assessment prompts MUST use builders from `lib/gemini/assessment-prompts.ts`
- All age bracket logic MUST come from `getAgeConfig()` — NEVER define age brackets inline
- NEVER hardcode a Gemini prompt inline in a route file for assessment/scoring tasks
- Before creating any new AI prompt, check `lib/gemini/` for existing shared modules — `session-prompts.ts` has 4 shared builders already
- Anti-hallucination rules MANDATORY for any prompt that analyzes audio input — use `getAntiHallucinationRules()`
- Fluency enum: `"Poor" | "Fair" | "Good" | "Excellent"` — no alternatives
- Overall scores computed SERVER-SIDE (weighted average), never asked from Gemini
- ALL Gemini client instantiation via `getGenAI()` from `lib/gemini/client.ts` — NEVER `new GoogleGenerativeAI()` in route files
- **Intelligence synthesis** — use `buildSynthesisPrompt()` from `lib/intelligence/synthesis.ts` (V2, writes to `child_intelligence_profiles`). `generateLearningProfileSynthesis()` in `lib/gemini/session-prompts.ts` is V1 LEGACY — DO NOT use for new code
- **Coach hiring assessment scoring** — use `buildCoachAssessmentScorePrompt()` from `lib/gemini/assessment-prompts.ts` (discriminated union: `{type:'voice', durationSeconds}` or `{type:'chat', conversationText}`) — NEVER inline

## Known Issues (DO NOT ASSUME CANONICAL)

- **Session type label mismatch** — `SESSION_TYPE_LABELS['parent_checkin']` in `lib/utils/session-labels.ts` returns `'Check-in (Legacy)'`, but `app/api/jobs/enrollment-complete/route.ts:988` emits `'Parent Check-in'` for the same session type. Needs alignment — do not reference either as canonical until resolved.
- **Known N+1** — `app/api/cron/group-class-feedback-request/route.ts` and `app/api/cron/group-class-notifications/route.ts` do per-row parent / child / `learning_events` lookups inside loops. Batch-query refactor needed before scale.

## Contact Info — Two WhatsApp Numbers (DO NOT MIX)

| Number | Constant | Purpose | Used In |
|--------|----------|---------|---------|
| 918591287997 | `COMPANY_CONFIG.leadBotWhatsApp` | Lead Bot — ALL website wa.me links, prospect/parent/coach facing | Footer, error pages, booking, enroll, support, FAQ, RAI prompts, login pages |
| 918976287997 | `COMPANY_CONFIG.aiSensyWhatsApp` | AiSensy — outbound template sending ONLY | Communication lib, cron routes, template dispatch |

**Rule:** If a user SEES the number or clicks a wa.me link → `leadBotWhatsApp`. If the system SENDS a template message → `aiSensyWhatsApp`. When in doubt, use `leadBotWhatsApp`.

All contact info centralized in `lib/config/company-config.ts`. NEVER hardcode emails or phone numbers in any other file.

## Portal Themes

| Portal | Theme | Accent | Primary CTA |
|--------|-------|--------|-------------|
| Parent | Light (white/cream) | Hot Pink `#FF0099` | `bg-[#FF0099] text-white` |
| Coach | Dark | Electric Blue `#00ABFF` | `bg-[#00ABFF] text-white` |
| Admin | Dark | Neutral Grey/White | `bg-white text-[#0a0a0f]` |

Theme system: `lib/theme/` (ThemeProvider + PortalLayout). All portals use unified `PortalLayout` → `ThemeProvider` → Sidebar (desktop) + BottomNav (mobile).

## Hard UI Rules

- **Buttons:** `rounded-xl` always. Heights: `h-9` (small), `h-10` (standard), `h-12` (primary CTA). Single row layout. NEVER `rounded-lg`, `rounded-md`, or `rounded-sm` on buttons.
- **Cards:** `rounded-2xl` always. `shadow-sm` on light theme, none on dark. NEVER `rounded-xl` or `rounded-lg` on cards.
- **Scroll:** PortalLayout owns the scroll. No `h-screen`/`overflow-y-auto` on pages. Horizontal: `snap-x snap-mandatory`.
- **Fonts:** Display = Plus Jakarta Sans (`font-display`), Body = Inter (`font-body`), Reading = Lexend (`font-reading`).
- **Date/Time inputs:** Use `DateInput`, `TimeInput`, `DateRangeInput` from `components/ui/`. NEVER use native `<input type="date">` or `<input type="time">`.
- **Date formatting:** Use functions from `lib/utils/date-format.ts` (formatDate, formatDateLong, formatDateShort, formatTime, formatDateTime, formatDateRelative). NEVER use inline `toLocaleDateString()`.
- **Icons:** Lucide React only. Zero emoji. Use shared components where available.
- **Loading states:** Use `Spinner` from `components/ui/spinner.tsx`. NEVER use inline `Loader2 + animate-spin`.

## Session Structure by Age Band (from age_band_config — NEVER hardcode)

| Band | Coaching | Skill Building | Total | Duration | Frequency |
|------|----------|----------------|-------|----------|-----------|
| Foundation (4–6) | 18 | 6 | 24 | 30 min | 1.5x/week |
| Building (7–9) | 12 | 4 | 16 | 45 min | 1x/week |
| Mastery (10–12) | 9 | 3 | 12 | 60 min | 0.75x/week |

All bands = 9 coaching hrs + 3 skill building hrs = 12 total hrs per season.
Source of truth: `age_band_config` table. Columns: `sessions_per_season`, `skill_booster_credits`, `coaching_session_duration_mins`, `weekly_pattern` (JSON).
Pricing: ₹1,499 (Starter) / ₹5,999 (Continuance) / ₹6,999 (Full) — from `pricing_plans` table via `getPricingConfig()`.

## Cron Architecture

- 22 crons → 1 dispatcher route (`/api/cron/dispatcher`, every 15 min, IST time-matching) + `goals-capture` (every 5 min) = 2 QStash slots
- All cron results log to `activity_log` (NOT `cron_logs`)
- Daily health check at 7AM IST monitors 20 crons, enrollments, recordings, embeddings, payments, Sentry
- Cron auth: use `verifyCronRequest()` from `lib/api/verify-cron.ts` — NEVER inline verification

## Revenue Split (V2 — March 2026)

3-component: Lead (0-10% by referrer type) + Coach (50-60% by tier) + Platform (remainder). Source of truth: `coach_groups` table + `payout-config.ts`. Rucha = internal (100% to Yestoryd). Per-session payouts monthly on 7th. Earnings use per-session calculation where skill building = 50% of coaching rate.

## Shared Utilities (USE THESE — don't reinvent)

| Utility | Location | Purpose |
|---------|----------|---------|
| `withApiHandler()` | `lib/api/with-api-handler.ts` | HOF wrapping routes with auth + error handling |
| `verifyCronRequest()` | `lib/api/verify-cron.ts` | QStash signature verification for crons |
| `getCoachSession()` | `lib/api/get-coach-session.ts` | Coach session lookup + ownership check |
| `getGenAI()` | `lib/gemini/client.ts` | Singleton Gemini client — NEVER instantiate directly |
| `getSiteSetting()` | `lib/config/site-settings-loader.ts` | Cached site_settings reader (5-min cache) |
| `getPricingConfig()` | `lib/config/pricing-config.ts` | Cached pricing_plans reader (5-min cache) |
| `COMPANY_CONFIG` | `lib/config/company-config.ts` | All contact info (phones, emails, URLs) |
| `formatDate()` etc. | `lib/utils/date-format.ts` | 7 unified date formatters (en-IN, Asia/Kolkata) |

## Shared UI Components (USE THESE — don't recreate)

| Component | Location | Purpose |
|-----------|----------|---------|
| `StatusBadge` | `components/shared/StatusBadge.tsx` | Status pills (completed, pending, active, etc.) |
| `StatCard` | `components/shared/StatCard.tsx` | Stat display (value + label + icon + trend) |
| `EmptyState` | `components/shared/EmptyState.tsx` | Empty data states (icon + title + CTA) |
| `WhatsAppButton` | `components/shared/WhatsAppButton.tsx` | WhatsApp wa.me links (uses COMPANY_CONFIG) |
| `PageHeader` | `components/shared/PageHeader.tsx` | Page title + subtitle + action |
| `Avatar` | `components/shared/Avatar.tsx` | Portal-aware initials/image avatar |
| `Spinner` | `components/ui/spinner.tsx` | Loading spinner (NEVER inline Loader2) |
| `DateInput` | `components/ui/date-input.tsx` | Premium date picker (NEVER native input) |
| `TimeInput` | `components/ui/time-input.tsx` | Premium time picker with AM/PM |
| `DateRangeInput` | `components/ui/date-range-input.tsx` | Date range filter |

## Key Config Locations

| Config | Source | Loader |
|--------|--------|--------|
| Pricing | `pricing_plans` table | `getPricingConfig()` from `lib/config/pricing-config.ts` (5-min cache) |
| Contact info | `lib/config/company-config.ts` | `COMPANY_CONFIG` constant |
| Session structure | `age_band_config` table | Direct query via enrollment's `age_band` |
| Site settings | `site_settings` table | `getSiteSetting()` from `lib/config/site-settings-loader.ts` (5-min cache) |
| Revenue splits | `coach_groups` table | `payout-config.ts` |
| Skill categories | `skill_categories` table | `lib/config/skill-categories.ts` (5-min cache) |
| Referral % | `site_settings` | Key: `parent_referral_credit_percent` |
| Feature flags | `site_settings` | `getSiteSetting()` |
| Themes | `lib/theme/` | ThemeProvider + PortalLayout |
| Navigation | `components/config/navigation.ts` | Direct import |
| Crons | `/api/cron/dispatcher` | IST time-matching in dispatcher |

## Database Quick Reference

| Table | Purpose |
|-------|---------|
| `site_settings` | Dynamic config (NO HARDCODING) |
| `children` | Child profiles, assessment data, learning_profile (JSONB) |
| `enrollments` | Paid program enrollments (age_band is per-enrollment, not per-child) |
| `scheduled_sessions` | Coaching sessions (Google Calendar linked) |
| `learning_events` | Unified event tracking with embeddings (RAG) |
| `coaches` | Coach profiles, calendar, earnings, schedule rules |
| `coach_groups` | Revenue tier splits + min_children_threshold (source of truth for payouts) |
| `pricing_plans` | Pricing tiers (Starter/Continuance/Full) |
| `age_band_config` | Session counts, durations, weekly patterns by age band |
| `skill_categories` | 10 rows, 3-level tree: categories → el_modules → el_skills |
| `el_content_items` | Unified content warehouse with embeddings |
| `activity_log` | All cron/system activity logging |
| `coupon_usages` | Coupon tracking (NOT coupon_uses — unified March 2026) |

## Communication Stack

- AiSensy (918976287997): WhatsApp outbound templates to enrolled parents/coaches — system sends, user never sees this number
- Lead Bot (918591287997): WhatsApp inbound for website prospects — user-facing, all wa.me links
- Resend: Email fallback on all WhatsApp alerts
- 7 channels live, 9 AiSensy templates pending approval

## Check Before Coding

- [ ] Searched codebase for similar functionality
- [ ] Checked `components/shared/` and `components/ui/` for reusable components
- [ ] Reviewed database schema for extendable tables
- [ ] Looked for existing API patterns in `/app/api/` and `lib/api/` utilities
- [ ] Checked config loaders exist for any business value being used
- [ ] Verified NO hardcoded prices, session counts, emails, or phone numbers
- [ ] Verified auth check exists on any new API route (use `withApiHandler()`)
- [ ] Flagged redundant code to replace
- [ ] Confirmed UI uses brand colors + Lucide icons (NO emojis)
- [ ] Used shared components (StatusBadge, StatCard, EmptyState, WhatsAppButton, etc.)
- [ ] Used `DateInput`/`TimeInput` for date fields (NEVER native HTML inputs)
- [ ] Used `formatDate()` etc. from `lib/utils/date-format.ts` (NEVER inline formatting)
- [ ] Used `getGenAI()` from `lib/gemini/client.ts` (NEVER `new GoogleGenerativeAI()`)
- [ ] Loaded relevant plugins (frontend-design, code-review, context7, supabase, sentry)

## Check After Every Multi-File Change (MANDATORY)

Run post-change verification grep checks (see Post-Change Verification section above). Fix any violations BEFORE reporting done. This is non-negotiable.

## Graphify — interpretation rules

Graphify audits run Apr 24 2026 on lib/ + app/api/ (1658 nodes, 2841 edges). Outputs in graphify-out/. Invoked via /graphify-windows in Claude Code.

**Interpretation rule — AST edges ≠ runtime cost.** God-node scoring measures "how many files import this symbol," not runtime resource consumption. For infrastructure-layer findings (database clients, loggers, connection managers, API clients), always validate the structural signal against SDK/library mechanics before prioritizing refactor work.

**Tool boundaries:**
- Graphify answers "what bridges what" — structure, god nodes, community clustering, cross-module coupling.
- Grep answers "who calls X" — AST name-matching misses cross-file imports. Example: graphify found 3 `sendNotification()` callers; grep found 33. For enumerating callers of a named symbol, always grep.

**Edge confidence tags:**
- `EXTRACTED` — found directly in source via tree-sitter AST. Ground truth.
- `INFERRED` — reasonable inference with confidence score. Treat as "probably right, worth spot-checking."
- `AMBIGUOUS` — flagged for review. Do not act on without verification.

## Architecture decisions — closed findings

### createAdminClient() scale concern — CLOSED (non-finding, Apr 24 2026)

**Graphify signal:** 47 edges across 10 communities (later confirmed 232 actual call sites). Concern: PgBouncer pool exhaustion at scale.

**Resolution:** Hypothesis test confirmed Supabase JS SDK's `createClient()` is a stateless HTTPS wrapper around PostgREST. Zero network I/O at construction. No TCP socket, no connection pool held per client instance. All queries execute as one-shot HTTPS POSTs; connection pooling is entirely Supabase-server-side.

**Scale projection:** Connection saturation is driven by concurrent in-flight query volume × p95 latency, not client-object count. At 500 students, estimated 30-100 concurrent queries at peak — well within Supabase Pro pool defaults. Pool pressure threshold ~600 sustained concurrent queries (≈3000 DAU with aggressive fan-out).

**Do not refactor createAdminClient() to a shared factory** based on graphify edge-count alone. The pattern as currently implemented is correct for Supabase's HTTP-based architecture.

## Debt log — createAdminClient cleanup (low priority)

Three style/documentation inconsistencies found during the Apr 24 hypothesis test. None are correctness or scale issues. Fix organically on clean days when touching these files; no dedicated sprint.

- **D1 — Doc canon conflict:** `lib/supabase/admin.ts:9-10` comment says "For a singleton, use supabaseAdmin from './server'." `lib/supabase/server.ts:4` comment says "CANONICAL PATTERN: Use createAdminClient() from '@/lib/supabase/admin'." These contradict. Pick one canonical pattern and update the other file's comment to reference it.

- **D2 — Single bypass:** `app/api/cron/daily-health-check/route.ts:39` calls `createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)` inline instead of using the `createAdminClient()` helper. Not a security issue (same env vars, same scope), but inconsistent. Migrate when next touching that cron.

- **D3 — Mixed instantiation pattern:** Some callers use module-level `const` (per-worker singleton); others construct per-function. No functional difference given Supabase SDK is stateless. Choose one convention, document in this file, migrate organically.

- **D4 — Three parallel `database.types.ts` files:** `lib/database.types.ts`, `lib/supabase/database.types.ts`, and `types/database.ts` all hold the same generated types but drift independently. Currently kept in sync via Copy-Item. Consolidate to a single source with re-exports from the other two paths. Required before PR 2 (writer migration touches all three import roots).
