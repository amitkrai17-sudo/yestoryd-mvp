# Yestoryd Knowledge Base

> Consolidated from 80+ documents in `/docs/`. Last updated: February 8, 2026.

---

## 1. Product Vision

Yestoryd is an **AI-powered reading intelligence platform** for children aged 4-12 in India. The core thesis is **"AI Brain + Human Heart"**: AI handles diagnosis, data intelligence, and automation, while certified human coaches deliver personalized 1:1 reading instruction. Parents get real-time visibility into their child's progress.

The platform follows the **ARC Method**: **Assess** (free AI reading assessment) -> **Remediate** (3-month coached program) -> **Celebrate** (progress tracking, certificates, gamification).

**Positioning:** Blue Ocean -- no competitor combines AI-powered assessment + 1:1 human coaching + parent visibility. Competitors (PlanetSpark, Vedantu, Byju's, local tutors) offer subsets but not the integrated model.

**Scale target:** 50 -> 10,000 -> 100,000 children. Currently pre-launch (92-95% platform completion). Break-even: 3 enrollments/month (lean) or 12/month (full operations).

---

## 2. Target Users

### Parents (Primary Buyer)
- Indian parents (including NRI families across 10 countries)
- Children aged 4-12 struggling with English reading
- 80%+ on mobile (mid-range Android phones Rs. 8,000-15,000)
- WhatsApp-native (95% open rate in India)
- Value "seeing progress" -- cumulative dashboards > individual session notes
- Key concerns: child safety, expert credibility, visible improvement

### Children (Primary Learner)
- Ages 4-12, segmented into three stages:
  - **Foundation** (4-6): phonemic awareness, letter sounds, CVC words
  - **Building** (7-9): blends, fluency, sight words, comprehension
  - **Mastery** (10-12): advanced comprehension, vocabulary, creative writing
- Need audio-first, gamified interfaces with large touch targets
- Engagement via celebration ladder (woosh -> star burst -> fire -> confetti -> special)

### Coaches (Service Delivery Partners)
- Not employees but platform partners with transparent revenue sharing
- Recruited via AI-screened application (Vedant AI conversation -> interview -> onboarding)
- Growth tiers: Rising -> Expert -> Master
- Need mobile-friendly tools, offline support, and minimal admin overhead
- Quality gated by configurable AI assessment pass score (default 6/10)

### Admin (Founders: Amit & Rucha)
- Amit: Technical founder, engineer background
- Rucha: Pedagogical authority, 7+ years Jolly Phonics certification, Lead Coach
- Manage CRM, coach assignments, content, and operations

---

## 3. User Journey & Funnel

### Full Parent Journey (8 Phases)

| Phase | Flow | Status |
|-------|------|--------|
| **1. Lead Acquisition** | Website/ads/WhatsApp -> Free 5-min AI reading assessment -> Gemini analyzes audio (Clarity, Fluency, Speed) -> Certificate + Report | Complete |
| **2. Goals Capture** | Results page: parent selects learning goals (grammar, comprehension, speaking, etc.) -> Goals flow via URL params through email CTAs to enrollment | Complete |
| **3. Discovery Booking** | Two CTAs: "Boost Reading" (direct enroll) or "Talk to Coach" (free discovery call) -> Cal.com 30-min booking | Complete |
| **4. Coach Assignment** | Admin CRM -> assigns coach (load-balanced + quality-weighted with discovery coach preference) | Complete |
| **5. Discovery Call** | Coach sees AI-generated questions + assessment data -> 30-min call -> fills questionnaire (likelihood, objections, goals) -> sends payment link via WhatsApp | Complete |
| **6. Payment & Enrollment** | Razorpay Rs. 5,999 -> enrollment created -> 9 Google Calendar sessions auto-scheduled (6 coaching + 3 parent check-ins) -> coach intro WhatsApp | Complete |
| **7. Service Delivery** | Coaching sessions via Google Meet -> Recall.ai records -> Gemini analyzes transcript -> AI report + coach notes merged -> parent summary via WhatsApp | Complete |
| **8. Completion & Retention** | Exit assessment -> certificate or renewal recommendation -> community access -> Master Key (free group classes, workshops, e-learning for enrolled families) | Partial |

**Conversion targets:** >80% assessment completion, >40% discovery booking, >30% discovery-to-payment.

### Coach Journey
Application -> AI screening (Vedant) -> Interview -> Approval -> Onboarding (agreement + bank details) -> Child assignment -> Session prep (rAI brief) -> Session delivery -> Post-session form -> Repeat.

**Gap:** Post-approval engagement is zero (no welcome email, no onboarding wizard, no shadow sessions).

### WhatsApp Channels (3)
1. **AiSensy** (+91 89762 87997): Outbound templates, reminders, session summaries
2. **Lead Bot** (+91 85912 87997): Prospect-facing AI chatbot (Gemini-powered), lead qualification, trial booking
3. **Co-Pilot** (OpenClaw/Claude): Internal tool for founders (strategy, drafting, scheduling)

---

## 4. Curriculum & Content Structure

### Assessment Framework (RAI - Reading Assessment Instrument)
- **5 Dimensions:** Phonemic Awareness, Phonics/Decoding, Fluency, Vocabulary, Comprehension
- **3 Scoring Axes:** Clarity, Fluency, Speed
- Adaptive difficulty (adjusts if child struggles)
- Maps to Cambridge reading levels for curriculum placement
- Administered at entry (free) and exit (determines continuation)

### Coaching Program
- **Duration:** 3 months (12 weeks)
- **Sessions:** 9 total (6 x 60-min coaching + 3 x 15-min parent check-ins)
- **Session sequence locked:** coaches cannot skip ahead or complete out of order
- **Post-session form:** Quick Pulse -> Deep Dive -> Planning -> Review (captures topics, engagement, progress, breakthroughs, homework)
- **Homework:** per-session with due date, topic categorization, and tracking

### Phonics Methodology
- Rooted in **Jolly Phonics** (Rucha's 7+ years certification)
- **PhonicSeeds**: branded curriculum modules (e.g., L-blends: bl, cl, fl, gl, pl, sl)
- Skill progression: letter sounds -> short/long vowels -> consonant blends -> digraphs -> vowel teams -> r-controlled vowels -> silent-e -> word families
- Contrast method for similar sounds (e.g., "sh" vs "th" minimal pairs)

### E-Learning System (Infrastructure Complete, Content 0%)
- **3 Stages:** Foundation (4-6), Building (7-9), Mastery (10-12)
- **Units** composed of sequences: Video -> Game -> Video -> Quiz
- **5 Game Engines:** Word Match, Phonics Pop, Sentence Builder, Story Sequence, Rhyme Time
- **Content Pools:** reusable word banks feeding all game engines
- **Gamification:** XP, badges, streaks, celebration ladder, spaced repetition (SM-2 algorithm)
- **Content needed:** 477-1,178 videos across 3 stages
- **Pipeline:** Script Writing -> Recording -> Editing -> YouTube Unlisted upload -> DB records -> Link quizzes
- **Focus Mode UI:** ONE clear action (Mission Card) + "Ask rAI" option -- reduces cognitive load for ages 4-7

### Mini-Challenge Question Bank
- **7 Goal Areas with Granular Skill Tags:**
  1. Phonics (letter sounds, vowels, blends, digraphs, word families)
  2. Reading Fluency (sight words, phrasing, expression, punctuation)
  3. Vocabulary (synonyms, antonyms, context clues, affixes)
  4. Comprehension (main idea, sequence, cause/effect, inference)
  5. Grammar (nouns, verbs, tenses, agreement)
  6. Speaking Confidence (pronunciation, stress, intonation)
  7. Writing (formation, spelling, sentence structure)
- Curated by Rucha via Google Sheets -> CSV import -> Admin portal
- Difficulty 1-10, age targeting 4-12, with hints and explanations
- Analytics: success rates, avg response times per question

### Group Classes
- Age bands: 4-6, 7-9, 10-12
- Capacity: 5-7 children per class
- Pricing: Rs. 199-400+
- Enrolled students get free access (auto-applied ENROLLED100 coupon)

---

## 5. Coaching Model & Intelligence Layer

### rAI (Reading AI) - The Intelligence Engine
- **Single `/api/chat` endpoint** with role-based access (parent, coach, admin)
- **Two-tier intent classification:**
  - Tier 0: Regex router (handles 35% of queries at zero latency/cost)
  - Tier 1: Gemini Flash Lite LLM (remaining 65%)
- **Four intent categories:** LEARNING (RAG), OPERATIONAL (SQL templates), SCHEDULE (SQL), OFF_LIMITS (redirects)

### Coach Intelligence Features
- **Pre-Session Brief:** child's assessment, last session summary, preferences, AI recommendations
- **Chain of Thought Reasoning:** 3-step pedagogical analysis (trajectory -> patterns -> recommendations)
- **Post-Session Processing:** Recall.ai transcript -> Gemini analysis -> merged with coach notes -> parent summary
- **Homework Tracking:** via `learning_events` table (event sourcing pattern)

### Data Pipeline (RAG)
- **Hybrid search:** SQL pre-filter (date, event type) + pgvector HNSW semantic search + keyword boost
- **Embeddings:** Google text-embedding-004 (768-dim), generated on assessment completion, session completion, transcript processing
- **Critical gap identified:** Coach observations from PostSessionForm (36 data points) are NOT yet vectorized into `learning_events` -- rAI currently uses only ~30% of available data
- **Cache-first strategy:** Parent queries hit 24-hour cache in `children.last_session_summary` (zero AI cost)
- **Cost per query:** Rs. 0 (regex/cache) to Rs. 0.015 (full hybrid RAG)

### Session Recording Pipeline
Enrollment -> Sessions in DB -> Google Calendar Events -> Recall.ai Bots -> Session happens -> `bot.done` webhook -> Svix signature verification -> Transcript fetched -> Gemini analysis -> DB updated -> Parent notified via WhatsApp

### Communication Engine
- **82+ touchpoints** mapped across parent (37), coach (17), admin (10), lead gen (8), reschedule (10)
- **Channel priority:** CRITICAL = WhatsApp + SMS + Email; HIGH = WhatsApp + Email; NORMAL = WhatsApp; LOW = Email
- **Consolidation needed:** 82 -> ~45 touchpoints to reduce alert fatigue

---

## 6. Revenue Model

### Pricing
- **Free Assessment** (anchored at Rs. 999 value)
- **3-Month Coaching Program:** Rs. 5,999

### Revenue Split (3-Component Model)
| Component | Yestoryd-Sourced | Coach-Sourced |
|-----------|-----------------|---------------|
| Lead Cost (20%) | Rs. 1,200 to Yestoryd | Rs. 1,200 to Coach |
| Coach Cost (50%) | Rs. 3,000 to Coach | Rs. 3,000 to Coach |
| Platform Fee (30%) | Rs. 1,799 to Yestoryd | Rs. 1,799 to Yestoryd |
| **Coach Total** | **Rs. 3,000 (50%)** | **Rs. 4,200 (70%)** |

- Rucha's direct coaching: 100% to Yestoryd
- Coach payouts: staggered monthly over 3 months
- TDS: 10% after Rs. 30,000 annual threshold (Section 194J)

### Unit Economics
- At 30 children: 69% margin (Rs. 4,139 profit/child)
- At 300 children: 24% margin (Rs. 1,440 profit/child)
- Operational costs: Rs. 35,455/month (full) or Rs. 12,502/month (lean)
- Google Workspace (11 users): Rs. 12,500/month (largest single cost)

---

## 7. Tech Stack & Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, Framer Motion |
| Backend | Next.js API Routes, Supabase (PostgreSQL + pgvector + Auth + Storage) |
| AI | Google Gemini 2.5 Flash Lite (assessment, rAI, coach prep) |
| Payments | Razorpay (live) |
| Scheduling | Google Calendar API (domain-wide delegation) |
| Recording | Recall.ai (Google Meet bot, transcript, diarization) |
| Email | SendGrid |
| WhatsApp | AiSensy (templates), Meta Cloud API (Lead Bot) |
| Queue | QStash (async jobs, cron) |
| Monitoring | Sentry |
| Hosting | Vercel Pro |
| DNS | Hostinger |

**Key architectural principles:**
- **No hardcoding:** All business config in `site_settings` table via typed config loaders with 5-min TTL cache
- **Fail loudly:** Missing config throws errors, never falls back to silent defaults
- **Database-driven everything:** Content, pricing, templates, feature flags -- all admin-changeable without deploys
- **Mobile-first:** 375px minimum, 44px touch targets, bottom navigation
- **Role-based portals:** `/parent/*`, `/coach/*`, `/admin/*` with API-level access enforcement

---

## 8. Gaps & Open Questions

### Critical Gaps (Pre-Launch Blockers)
1. **E-learning content:** Infrastructure complete, 0% content (477-1,178 videos needed)
2. **WhatsApp automation:** 82 touchpoints designed, only templates created (20% built)
3. **Coach post-session data not vectorized:** rAI uses only 30% of available intelligence
4. **Payment reconciliation cron missing:** If Razorpay webhook fails, parent pays but enrollment isn't created
5. **Gemini failure fallback:** If AI is down during assessment, audio is lost (should queue for retry)
6. **Coach background verification:** Coaches work with children based on self-declaration only

### High-Priority Gaps
7. **Admin auth vulnerability:** Admin pages download JS bundle before client-side auth redirects
8. **E-learning table confusion:** 3 parallel schemas (`el_*`, `learning_*`, `elearning_*`) -- admin writes to wrong tables
9. **Coach post-approval engagement:** Zero communication after approval (no welcome, onboarding, or shadow sessions)
10. **Refund processing:** No implementation for prorated refunds
11. **Parent self-service rescheduling:** API routes exist but no frontend calls them
12. **Mobile PWA:** Plan exists but not implemented (offline coach notes critical)

### Open Business Questions
- What differentiates Starter vs Full vs Continuation program tiers?
- Is e-learning bundled with all tiers or specific ones?
- Are group classes a separate paid product or retention tool only?
- Who conducts discovery calls -- always Rucha, or any coach?
- Operating hours and response time SLAs?
- Refund terms (duration, prorated vs full)?
- Session frequency (weekly vs twice weekly)?

### Recommended Launch Sequence
1. **Week 1-2:** Critical tech debt (Gemini fallback, payment reconciliation, audio retry)
2. **Week 2-4:** WhatsApp automation (consolidate to ~45 touchpoints)
3. **Week 3-6:** Mobile PWA (offline coach notes, push notifications)
4. **Week 4-16:** E-learning content creation (Foundation level minimum)
5. **Week 16+:** Soft launch with first 30 customers

---

## 9. Document Index

### Core Product & Vision
| File | Summary |
|------|---------|
| `AGENTS.md` | Complete business context: ARC method, tech stack, competitors, revenue model, platform status |
| `SOUL.md` | Co-pilot personality/behavioral guardrails for Amit and Rucha |
| `SKILL.md` | Google Calendar WhatsApp skill for session management |
| `README.md` | E-Learning V2 system: units, game engines, Focus Mode, gamification, spaced repetition |
| `yestoryd-development-prompt.md` | Master dev guidelines: 10 principles, CRO framework, mobile-first standards |

### User Journey & Flows
| File | Summary |
|------|---------|
| `YESTORYD-DIAGRAMS-README.md` | 8-phase business flow with color coding, 4 entry points, Mermaid diagrams |
| `yestoryd-session-lifecycle.md` | Complete session lifecycle: coach/parent parallel journeys, wireframes, WhatsApp templates |
| `yestoryd-visitor-flow-map.md.pdf` | Visitor flow map: all roles, navigation paths, page-by-page breakdown |
| `customer-journey-audit.md.pdf` | 7-stage journey audit: friction points, drop-off analysis |
| `yestoryd-journey-audit-report.md.pdf` | Technical recommendations for journey gaps |
| `YESTORYD-JOURNEY-EVALUATION.md.pdf` | End-to-end evaluation: 5 journeys, broken workflows identified |
| `yestoryd-communication-swimlanes.md.pdf` | All communication flows, channel priority matrix, template-trigger mapping |
| `pre-discovery-requirements-design.md` | Goals capture at two touchpoints (results page + WhatsApp follow-up) |
| `goals-capture-complete-spec-v2.md` | Definitive goals-capture spec: dual CTAs, idempotent emails, data flow |

### AI & Intelligence
| File | Summary |
|------|---------|
| `yestoryd-rai-design-v2.md` | rAI v2.0: two-tier classification, hybrid RAG, Chain of Thought, role boundaries |
| `yestoryd-rai-design.md.pdf` | rAI v1.0: single endpoint, 4 intents, cost analysis, admin weekly insights |
| `RAG-DATA-FLOW-ENHANCEMENT.md` | Critical gap: coach observations not vectorized, fix = 2-3 hours |
| `rai-implementation-techdebt.md` | rAI tech debt: broken `/api/coach/ai`, required unified `/api/chat` |
| `mini-challenge-question-bank-plan.md` | Curated question bank: 7 goal areas, skill tags, admin CSV import |

### Coaching & Curriculum
| File | Summary |
|------|---------|
| `PhonicSeeds- L blends- final.pdf` | Curriculum content: L-blend phonics (bl, cl, fl, gl, pl, sl) -- 30MB visual resource |
| `Yestoryd Mail - Hit's Reading Assessment Report.pdf` | Sample parent-facing assessment report email |
| `yestoryd-rai-design-v2.md.pdf` | RAI assessment instrument: 5 dimensions, adaptive difficulty, Cambridge levels |
| `rai-audit-checklist.md.pdf` | QA checklist for assessment: scoring accuracy, edge cases, report validation |
| `coach-features-audit-report.md` | 10 coach features audit: 0 fully built, 4 partial, 6 missing |
| `coach-ui-audit-report.md.pdf` | Coach UI/UX audit: session notes too long, no offline, missing onboarding |
| `p0-features-integration-spec.md` | 5 P0 coach features: pre-session brief, post-session form, parent update, progress, homework |

### Technical & Architecture
| File | Summary |
|------|---------|
| `CLAUDE.md` | Technical reference: stack, DB tables, coding patterns, discovery flow |
| `YESTORYD-TECHNICAL-GUIDE.md` | Implementation guide: CRM, API routes, Cal.com, Google Calendar, coach portal |
| `yestoryd-scheduling-engine-v1.md` | Scheduling engine: 11 event types, Redis idempotency, circuit breakers, Smart Slot Finder |
| `yestoryd-contingency-plan.md` | Fallback alternatives for every service, cost estimates, health checks |
| `recall-ai-webhook-troubleshooting.md` | Recall.ai setup: lobby fix, Svix verification, domain redirect issues |
| `yestoryd-authentication-guide.md.pdf` | Auth architecture: Supabase, magic links, role-based access |
| `yestoryd-mobile-pwa-plan.md.pdf` | PWA plan: offline notes, push notifications, curriculum caching |

### Audits & Tech Debt
| File | Summary |
|------|---------|
| `yestoryd-comprehensive-audit.md` | Most comprehensive audit: 92-95% complete, architecture 8.5/10, launch sequence |
| `YESTORYD-COMPREHENSIVE-AUDIT-REPORT.md` | Post-config-migration audit: 7 protected systems, 10 verified gaps |
| `YESTORYD-CLAUDE-CODE-AUDIT.md` | 56 issues across 7 categories, critical coach assignment bug |
| `YESTORYD_CODEBASE_AUDIT.md` | Full codebase audit: 130+ API routes, 84+ tables, data flows |
| `yestoryd-detailed-redundancy-audit.md` | 10 redundancy issues: duplicate routes, scattered payment data |
| `AUDIT_PARALLEL_STRUCTURES.md` | Data duplication fixes: `enrollments.coach_id` as single source of truth |
| `yestoryd-elearning-tech-debt.md` | 3 parallel e-learning schemas, consolidation plan |
| `YESTORYD-TECHNICAL-DEBT-SESSION-PLAN.md` | 13 feedback items validated: 4 built, 9 remaining (44 hours) |
| `yestoryd-tech-debt-admin-auth.md` | Admin auth workaround: localStorage vs cookies, 5-6 hour fix |

### Revenue & Business
| File | Summary |
|------|---------|
| `yestoryd-revenue-split-implementation.md` | 3-component revenue split, TDS compliance, LLP guide, payout processing |
| `YESTORYD-PAYMENT-VERIFICATION.md` | Payment flow health check: 9 verification steps post-config-migration |
| `YESTORYD-GAP-IMPLEMENTATION-PLAN.md` | 10 gap implementations with schemas, APIs, and 3-week timeline |
| `yestoryd-status-jan11-2026.md` | Platform status: 92% complete, revenue model, costs, journey status |
| `Yestoryd_Invoice_TS-INV-24-25 37_17_12_24.pdf` | Sample invoice with GST, fiscal-year numbering |

### Configuration & Standards
| File | Summary |
|------|---------|
| `YESTORYD-ENTERPRISE-CONFIG-REMEDIATION.md` | 7-phase plan to eliminate hardcoded config |
| `CLAUDE-CODE-SINGLE-SOURCE-OF-TRUTH.md` | 11-step execution guide for config migration |
| `YESTORYD-COMPREHENSIVE-LOGIC-AUDIT.md` | 8-phase audit framework: understand before changing |
| `YESTORYD-DUPLICATE-CODE-CHECK.md` | Post-implementation duplicate verification checklist |
| `yestoryd-phone-audit-report.md` | Phone number E.164 standardization across 10 countries |
| `emoji-audit-report.md` | Emoji -> Lucide icon migration for parent-facing surfaces |

### Session Summaries
| File | Summary |
|------|---------|
| `session10-summary.md` | Admin CRM complete, bidirectional DB sync triggers |
| `session11-summary (1).md` | Coach discovery + payment flows complete, 9 sessions auto-created |
| `session12-summary.md` | 6 coach portal features: pre-session brief, sequence locking, reschedule, cancel |
| `CORRECT-BUG-FIX.md` | PostSessionForm homework boolean bug fix |

### WhatsApp & Lead Bot
| File | Summary |
|------|---------|
| `WhatsApp Lead Bot Architecture.pdf` | Meta Cloud API + Gemini conversational lead capture system |
| `yestoryd-academy-enhancements-complete.md` | Coach recruitment platform: config migration, rate limiting, security |

### Other
| File | Summary |
|------|---------|
| `KNOWLEDGE_GAPS.md` | Unanswered business questions requiring founder input |
| `audit_map.txt` | Full directory listing of codebase |
| `yestoryd website details.pdf` | Original broader vision: library, classes, courses, podcasts |
| `yestoryd-notion-workspace.md.pdf` | Could not be read (requires PDF tools) |
| `yestoryd-code-simplification-guide.md` | File not found on disk |

---

## 10. Cross-Cutting Themes

1. **Human + AI Hybrid:** Every design decision reinforces that AI supports and enhances human coaches, never replaces them. The ARC method, session preparation, Chain of Thought reasoning, and the Learning Loop all serve this principle.

2. **WhatsApp as Universal Channel:** WhatsApp is the primary touchpoint for parents (reminders, summaries, payment links), coaches (assignments, schedules), and founders (co-pilot). Reflects 95% open rate in the Indian market.

3. **Database-Driven Everything:** From content to pricing to coach payouts to templates -- nothing is hardcoded. Enterprise config loader with typed schemas, 5-minute TTL cache, and explicit cache invalidation supports rapid iteration without deploys.

4. **Cost Consciousness at Scale:** rAI's tiered classification (35% regex at zero cost), caching for parent queries, pre-computed admin insights, Gemini Flash Lite over expensive models, YouTube Unlisted for initial hosting -- all target sustainability at 10,000 children.

5. **Graceful Degradation:** Multi-level fallbacks for every service. Manual coach assessment is the ultimate backstop. Emergency procedures prioritize maintaining the human coaching relationship through any technical failure.

6. **Structured Data Collection:** Rich pedagogical data at every touchpoint feeds into `learning_events` with vector embeddings, creating a compounding data asset that makes rAI smarter with every session.

7. **Clear Role Boundaries:** Parents, coaches, admin, and AI each have strictly defined access. Enforced at the API level, not just the UI level. rAI refuses financial queries; coaches can't see other coaches' students.

8. **Mobile-First for India:** 375px minimum, 44px touch targets, bottom navigation, audio-first for children, short labels, 2-column grids -- designed for parents on mid-range Android phones.
