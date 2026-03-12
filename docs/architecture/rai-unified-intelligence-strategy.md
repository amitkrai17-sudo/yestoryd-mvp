# rAI Unified Intelligence Strategy
## Every Touchpoint. One Brain. Zero Dead Ends.

**Date:** February 19, 2026
**Status:** Locked — Ready for Implementation
**Decided by:** Amit Kumar Rai

---

## Core Principles

1. **Single RAG Brain** — `learning_events` table with HNSW + `text-embedding-004` is the ONE source of intelligence
2. **Every touchpoint ingests** — if a human or AI generated it about a child/parent, it gets an embedding and goes into learning_events
3. **Tiered model routing** — simple queries never touch expensive models; complex queries get full Flash power
4. **Dashboard-first AND chat** — both are first-class; dashboard pushes insights, chat enables exploration
5. **Three-tier fallback everywhere** — retry with simpler model → cached/canned response → queue + notify

---

## Model Split (Locked)

| Purpose | Model | Token Cap | Cost/Call |
|---------|-------|-----------|-----------|
| **Chat — complex queries** | gemini-2.5-flash | 500 (parent) / 800 (coach) / 600 (admin) | ~₹0.03 |
| **Chat — simple queries** | gemini-2.5-flash-lite | 400 | ~₹0.008 |
| **Chat — intent classification** | gemini-2.5-flash-lite | 120 | ~₹0.001 |
| **Chat — Tier 0 (regex/cache/SQL)** | None | N/A | ₹0 |
| **WhatsApp lead replies** | gemini-2.5-flash-lite | 400 | ~₹0.008 |
| **WhatsApp enrolled parent** | gemini-2.5-flash (complex) / cache (simple) | 500 | ~₹0.03 / ₹0 |
| **Assessment analysis** | gemini-2.5-flash-lite | 800 | ~₹0.037 |
| **Transcript analysis** | gemini-2.5-flash-lite | 800 | ~₹0.015 |
| **Progress Pulse generation** | gemini-2.5-flash-lite | 600 | ~₹0.015 |
| **Learning profile synthesis** | gemini-2.5-flash-lite | 600 | ~₹0.02 |
| **Lead scoring** | gemini-2.5-flash-lite | 400 | ~₹0.008 |
| **ALL embeddings** | text-embedding-004 | 200 | ~₹0.002 |

**Cost at 1,000 children: ~₹1,300/month total**

---

## Embedding Standard (Locked)

- **Model:** `text-embedding-004` — ONLY this model, everywhere, no exceptions
- **Dimension:** 768
- **Index:** HNSW (m=16, ef_construction=64, ef_search=100)
- **Search:** `hybrid_match_learning_events` RPC with keyword boost

**CRITICAL:** `gemini-embedding-001` in lib/rai/ must be replaced with `text-embedding-004`.
Existing learning_events need backfill re-embedding.

---

## Tiered Query Router

```
TIER 0 — Regex + Cache + SQL (₹0, <100ms)
├── Greetings → Canned response
├── "When is next session?" → SQL lookup
├── "How was session?" (within 24h) → Cached last_session_summary
└── Off-limits topics → Polite redirect

TIER 1 — Flash Lite Intent Classification (₹0.001, ~200ms)
├── Classify intent: LEARNING | OPERATIONAL | SCHEDULE | OFF_LIMITS
├── Rate complexity: low | medium | high
└── Extract entities: child_name, date_range, skill_area

TIER 2a — Flash Lite (simple, ₹0.008)        TIER 2b — Flash (complex, ₹0.03)
├── Simple operational queries                ├── LEARNING queries with RAG
├── Basic schedule lookups                    ├── Coach CoT reasoning
├── WhatsApp lead replies                     ├── Multi-event synthesis
└── Single-fact parent questions              ├── Progress analysis
                                              └── Personalized recommendations
```

**Complexity signals for Tier 2b:**
- Query mentions multiple sessions or time ranges
- Query asks for comparison or trend
- Query requires pedagogical reasoning
- RAG returns 3+ relevant events to synthesize
- Coach role + learning intent (always gets CoT)

---

## Data Ingestion — What Feeds the Brain

### Currently Feeding learning_events ✅
- Assessment results (type: `diagnostic_assessment`)
- Session transcript analysis (type: `session`)
- Coach activity logs (type: `session_companion_log`)
- Struggle flags (type: `activity_struggle_flag`)
- Parent practice assignments (type: `parent_practice_assigned`)
- Parent session summaries (type: `parent_session_summary`)
- Progress Pulse reports (type: `progress_pulse`)

### Must Add to learning_events (rAI-2)
| Data Source | Event Type | What's Captured |
|-------------|-----------|-----------------|
| WhatsApp lead conversations | `lead_conversation` | Parent's initial questions, concerns, objections |
| Discovery call coach notes | `discovery_notes` | Parent goals, child attitude, coach observations |
| Parent rAI chat questions | `parent_inquiry` | What parents ask about (patterns inform content) |
| NPS survey responses | `nps_feedback` | Sentiment, satisfaction, specific feedback |
| Assessment retries | `assessment_attempt` | Reading progression even before enrollment |

**Rule:** Every insert into learning_events MUST include `content_for_embedding` + `embedding` (generated via text-embedding-004).

---

## Three-Tier Fallback (Every AI Call)

```typescript
async function intelligentCall(model: string, prompt: string, intent: string, role: string) {
  // Tier 1: Primary model
  try {
    return await callGemini(model, prompt);
  } catch (e1) {
    console.error('Tier 1 failed:', e1);
    
    // Tier 2: Fallback to simpler model
    try {
      return await callGemini('gemini-2.5-flash-lite', shortenPrompt(prompt));
    } catch (e2) {
      console.error('Tier 2 failed:', e2);
      
      // Tier 3: Canned response + queue retry
      await queueRetry({ model, prompt, intent, role });
      return getCannedFallback(intent, role);
    }
  }
}
```

Applied at: rAI Chat, WhatsApp Bot, Assessment, Transcript Analysis, Progress Pulse, Lead Scoring — every single AI touchpoint.

---

## Implementation Roadmap

| Session | Focus | Deliverables |
|---------|-------|-------------|
| **rAI-1** | Foundation | Embedding unification, streaming chat, model router (Tier 0/1/2a/2b), Flash upgrade, tiered fallback |
| **rAI-2** | Data + Memory | WhatsApp→learning_events pipeline, discovery→learning_events, chat persistence, conversation memory, prompt upgrades |
| **rAI-3** | Visibility | Parent dashboard AI cards, skill progress viz, assessment results enhancement, contextual quick prompts |
| **rAI-4** | Coach Power | CoT pipeline, session prep UI, student intelligence cards, trend arrows |
| **rAI-5** | Website + Growth | Dynamic counters, shareable results, AI credibility section, churn prediction |

---

## Success Metrics

| Metric | Current | Target | When |
|--------|---------|--------|------|
| Chat first-token latency | 2-5s (spinner) | <500ms (streaming) | rAI-1 |
| Hybrid search relevance | Unknown (mixed embeddings) | >85% relevant in top-5 | rAI-1 |
| Parent chat engagement | Unknown | >30% of active parents | rAI-3 |
| Chat response satisfaction | No tracking | >80% thumbs-up | rAI-2 |
| Dashboard intelligence views | 0 (doesn't exist) | >3 views/week per parent | rAI-3 |
| AI fallback rate | No tracking | <2% of queries | rAI-1 |
| Cost per child per month | Unknown | <₹1.50 | Ongoing |
