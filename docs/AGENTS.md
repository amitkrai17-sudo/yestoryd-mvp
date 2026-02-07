# AGENTS.md — Yestoryd Business Context

## The Business

**Yestoryd** is an AI-powered reading intelligence platform for children aged 4-12 in India. It combines Gemini AI assessment with personalized 1:1 human coaching.

**Website:** yestoryd.com
**Tagline:** "AI finds the reading gaps. Expert coaches fill them. You see everything."

## Core Method: ARC (Assess → Remediate → Celebrate)
1. **Assess** — Free 5-minute AI reading assessment (Gemini 2.5 Flash Lite analyzes audio)
2. **Remediate** — ₹5,999 three-month coaching program (6 coaching + 3 parent check-in sessions)
3. **Celebrate** — PDF certificates, progress dashboards, gamification

## Revenue Model

| Lead Source | Coach Share | Yestoryd Share |
|-------------|-------------|----------------|
| Yestoryd-sourced | 50% | 50% |
| Coach-sourced | 70% | 30% |
| Rucha coaching directly | 0% | 100% |

- **Program price:** ₹5,999 for 3 months (9 sessions total)
- **Break-even:** 3 enrollments/month (lean mode ₹12,500/month) or 12 enrollments/month (full mode ₹35,000/month)
- **Master Key:** Enrolled families get free access to all services (e-learning, workshops, group classes)

## Tech Stack
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS on Vercel
- **Database:** Supabase PostgreSQL + pgvector for RAG
- **AI:** Gemini 2.5 Flash Lite (assessment analysis + session summaries)
- **Payments:** Razorpay (LIVE and working)
- **Calendar:** Google Calendar API with domain-wide delegation
- **Recording:** Recall.ai (auto-joins sessions, records audio, transcribes)
- **Email:** SendGrid (domain authenticated)
- **WhatsApp outbound:** AiSensy (template-based, 82 touchpoints mapped)
- **Background jobs:** QStash
- **Error monitoring:** Sentry

## Three WhatsApp Channels

| Channel | Number | Purpose | Tech |
|---------|--------|---------|------|
| **1. AiSensy** | 8976287997 | Outbound templates, reminders, broadcasts to parents/coaches | AiSensy API, template-based |
| **2. Lead Bot** | New SIM (planned) | Prospect-facing AI assistant, answers parent queries | Meta Cloud API direct → Gemini |
| **3. Personal** | New SIM (this bot) | Amit + Rucha co-pilot | OpenClaw → Claude Max |

## Key People
- **Amit Kumar Rai** — Co-founder, tech lead, Head of HR & Business Transformation (day job). Builds everything.
- **Rucha Rai** — Co-founder, Head Coach. Certified Jolly Phonics coach. 7+ years teaching children.
- **Vedant** — The AI persona name used in the platform (Sanskrit for "knowledge"). Not a real person.
- **rAI** — The Reading AI system name. Handles chat, insights, pedagogy within the platform.

## Platform Status (~92-95% complete)
- ✅ Landing page + assessment (live)
- ✅ Parent dashboard with progress tracking
- ✅ Coach dashboard with earnings, schedule
- ✅ Google Calendar integration (auto-schedules 9 sessions)
- ✅ Razorpay live payments
- ✅ Native booking system (bypasses Cal.com)
- ✅ CRM with leads + discovery tabs
- ✅ Recall.ai recording integration
- ✅ Completion flow (certificates, NPS, Gemini feedback)
- ✅ rAI infrastructure (HNSW indexing, hybrid search, ChatWidget)
- 🔄 AiSensy templates (mapped but not all created in production)
- 🔄 E-learning modules (0% — planned)
- 🔄 Gamification (planned)
- 🔄 Lead-facing WhatsApp bot (planned)

## Competitors (Blue Ocean — no direct competitor does all of this)
- **PlanetSpark** — ₹10-25K, no AI assessment
- **Vedantu** — General tutoring, not reading-specific
- **Byju's** — ₹15-40K, content-only, no 1:1 coaching
- **Local tutors** — ₹3-8K, no tracking/accountability

## Key Decisions Already Made
- Single source of truth: all content database-driven via admin portal
- Mobile-first design (80%+ Indian users on mobile)
- WhatsApp as primary communication channel (95% open rate in India)
- Proprietary over third-party (built own booking, calendar, recording pipeline)
- Gemini for AI (cost-effective for India market)
- LLP conversion planned (currently proprietorship)

## Common Tasks You'll Help With
- Draft WhatsApp messages to parents (warm, professional, Indian English)
- Draft coach communication templates
- Think through pricing/offer strategies
- Plan marketing campaigns and social media content
- Debug technical approaches (talk through architecture, not write code)
- Create workshop/webinar content ideas
- Revenue calculations and projections
- Competitive research and market analysis
- Content creation for the platform
- Task management and priority setting
