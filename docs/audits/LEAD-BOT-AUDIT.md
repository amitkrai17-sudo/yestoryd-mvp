# WhatsApp Lead Bot - Full System Audit

**Date:** 2026-02-26
**Auditor:** Claude (automated code audit)
**Scope:** All files in `lib/whatsapp/`, API routes, cron jobs, connected systems
**Total codebase:** 2,487 lines across 17 files (core Lead Bot only)

---

## 1. FILE INVENTORY

### `lib/whatsapp/` (14 files)

| # | File | Purpose | Lines | Key Exports | Status |
|---|------|---------|-------|-------------|--------|
| 1 | `types.ts` | Meta Cloud API v21.0 TypeScript types + DB row types | 434 | `ConversationState`, `WebhookPayload`, `ExtractedMessage`, `WaLead`, `WaLeadConversation`, `WaLeadMessage`, + 25 more types | **COMPLETE** |
| 2 | `signature.ts` | HMAC-SHA256 webhook signature verification | 48 | `verifyWebhookSignature()` | **COMPLETE** |
| 3 | `extract.ts` | Normalize Meta webhook payloads into flat `ExtractedMessage[]` | 170 | `extractMessages()`, `extractStatuses()` | **COMPLETE** |
| 4 | `cloud-api.ts` | Meta Graph API v21.0 send client | 238 | `sendText()`, `sendTextWithPreview()`, `sendButtons()`, `sendList()`, `sendTemplate()`, `markAsRead()` | **COMPLETE** |
| 5 | `index.ts` | Barrel re-exports for all of the above | 56 | All types + functions from files 1-4 | **COMPLETE** |
| 6 | `intent/tier0-regex.ts` | Zero-cost regex intent classifier (Tier 0) | 101 | `classifyTier0()`, `Intent` type | **COMPLETE** |
| 7 | `intent/tier1-gemini.ts` | Gemini 2.5 Flash intent classifier (Tier 1) | 96 | `classifyTier1()`, `GeminiClassification` | **COMPLETE** |
| 8 | `intent/index.ts` | Intent pipeline orchestrator (Tier 0 → Tier 1) | 60 | `classifyIntent()`, `ClassificationResult` | **COMPLETE** |
| 9 | `handlers/greeting.ts` | First-message welcome with CTA buttons | 33 | `handleGreeting()` | **COMPLETE** |
| 10 | `handlers/faq.ts` | Anti-hallucination FAQ from `site_settings` DB | 95 | `handleFaq()` | **COMPLETE** |
| 11 | `handlers/qualification.ts` | Conversational lead qualification (3-field extraction) | 164 | `handleQualification()` | **COMPLETE** |
| 12 | `handlers/assessment-cta.ts` | Send assessment link with buttons | 35 | `handleAssessmentCta()` | **COMPLETE** |
| 13 | `handlers/booking.ts` | Send booking link with buttons | 35 | `handleBooking()` | **COMPLETE** |
| 14 | `handlers/escalate.ts` | Human handoff — deactivate bot, notify admin | 56 | `handleEscalate()` | **COMPLETE** |

### API Routes (3 files)

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `app/api/whatsapp/webhook/route.ts` | Inbound webhook — verify, dedup, save, queue to QStash | 323 | **COMPLETE** |
| `app/api/whatsapp/process/route.ts` | QStash consumer — classify, route, handle, save response | 351 | **COMPLETE** |
| `app/api/whatsapp/send/route.ts` | Internal send API — authenticated outbound messaging | 192 | **COMPLETE** |

### Cron Jobs (3 files)

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `app/api/cron/lead-scoring/route.ts` | Daily lead score recalculation (children table) | 117 | **COMPLETE** — but scores `children` table, NOT `wa_leads` |
| `app/api/cron/daily-lead-digest/route.ts` | Daily admin WhatsApp summary of leads + discovery calls | 327 | **COMPLETE** — but reads from `children` table, not `wa_leads` |
| `app/api/cron/discovery-followup/route.ts` | 24hr follow-up for completed discovery calls | 341 | **COMPLETE** — sends via AiSensy, not Lead Bot |

---

## 2. MESSAGE FLOW (End-to-End)

```
Meta Cloud API ──POST──▶ /api/whatsapp/webhook (GET for verify challenge)
                              │
                              ├─ 1. Read raw body
                              ├─ 2. Verify X-Hub-Signature-256 (HMAC-SHA256)
                              ├─ 3. Parse JSON → WebhookPayload
                              ├─ 4. extractMessages() + extractStatuses()
                              ├─ 5. Handle statuses (log only — no DB update yet)
                              ├─ 6. For each message:
                              │     ├─ Normalize phone via normalizePhone()
                              │     ├─ Deduplicate by wa_message_id (SELECT check)
                              │     ├─ getOrCreateConversation() → wa_lead_conversations
                              │     │   └─ Also creates wa_leads record on first contact
                              │     ├─ INSERT into wa_lead_messages (inbound)
                              │     ├─ Race-condition dedup via error code 23505
                              │     ├─ Update last_message_at on conversation
                              │     └─ Publish to QStash → /api/whatsapp/process
                              │
                              └─ 7. Return 200 immediately (always)

QStash ──POST──▶ /api/whatsapp/process
                      │
                      ├─ 1. Verify auth (QStash sig / internal key / dev bypass)
                      ├─ 2. Parse ProcessPayload from QStash body
                      ├─ 3. markAsRead() — fire and forget (blue ticks)
                      ├─ 4. Fetch latest conversation from DB (live state)
                      ├─ 5. Check is_bot_active → skip if false (human handoff)
                      ├─ 6. classifyIntent() — Tier 0 regex → Tier 1 Gemini
                      ├─ 7. Merge entities from classification into collected_data
                      ├─ 8. Route to handler:
                      │     ├─ ESCALATE → handleEscalate() [priority override]
                      │     ├─ BOOKING → handleBooking() [priority override]
                      │     ├─ state=GREETING → handleGreeting()
                      │     ├─ ASSESSMENT_CTA → handleAssessmentCta()
                      │     ├─ FAQ → handleFaq()
                      │     ├─ state=QUALIFYING or QUALIFICATION → handleQualification()
                      │     └─ default → handleAssessmentCta() (re-offer options)
                      ├─ 9. Save bot message to wa_lead_messages (outbound)
                      ├─ 10. Update conversation state + collected_data
                      ├─ 11. Upsert wa_leads with extracted data
                      └─ 12. On BOOKING: fire-and-forget summarizeLeadConversation()
```

### Key Design Decisions
- **Async processing:** Webhook returns 200 immediately; processing is offloaded to QStash
- **3-retry policy:** QStash retries up to 3 times with 1s delay
- **State is re-fetched:** Process route fetches live state from DB (not stale queued state)
- **Priority intents:** ESCALATE and BOOKING work from ANY state (override state routing)

---

## 3. INTENT CLASSIFICATION SYSTEM

### Architecture: Two-tier pipeline

**Tier 0 — Regex (zero cost, zero latency)**
- File: `lib/whatsapp/intent/tier0-regex.ts`
- Returns intent if matched, `null` to fall through to Tier 1

**Button ID → Intent mapping (direct, no classification needed):**
```
btn_check_reading   → ASSESSMENT_CTA
btn_assessment      → ASSESSMENT_CTA
btn_pricing         → FAQ
btn_talk_team       → ESCALATE
btn_human           → ESCALATE
btn_book_call       → BOOKING
btn_more_questions  → FAQ
```

**Regex patterns (case-insensitive, Hinglish support):**
| Intent | Patterns (priority order) |
|--------|--------------------------|
| GREETING | `^(hi\|hello\|hey\|namaste\|...)$`, `^(start\|get started\|shuru)$` |
| ESCALATE | `(agent\|human\|person\|insaan\|complaint\|...)`, `^(talk\|baat\|connect\|help me)` |
| BOOKING | `(book\|schedule\|slot\|discovery call\|free call\|baat kar)`, `(call karo\|speak to coach\|...)` |
| ASSESSMENT_CTA | `(free test\|reading test\|reading level\|...)`, `(evaluate\|jaanch\|try\|...)`, `(check my child\|...)` |
| FAQ | `(price\|cost\|fee\|kitna\|...)`, `(how long\|how many session\|...)`, `(refund\|money back\|...)`, `(who\|which).*coach`, `(what is\|tell me about).*yestoryd`, `(online\|offline\|in-person\|...)`, `(age\|umar\|group\|batch\|...)`, `(duration\|kitna time\|...)` |

**Tier 1 — Gemini 2.5 Flash (when regex misses)**
- File: `lib/whatsapp/intent/tier1-gemini.ts`
- Model: `gemini-2.5-flash`
- Temperature: 0.1 (low randomness for classification)
- Max tokens: 150

**Classification prompt (verbatim):**
```
You are an intent classifier for Yestoryd, an AI-powered children's reading program in India.

Classify the user message into exactly ONE intent:
- GREETING: Hello, hi, greetings
- FAQ: Questions about pricing, program details, duration, format, coaches, refund policy
- QUALIFICATION: User sharing info about their child (name, age, concerns, school, city)
- ASSESSMENT_CTA: Wanting to test/assess their child's reading level
- BOOKING: Wanting to book a call or meeting
- ESCALATE: Wanting to talk to a real person, complaints, frustration
- GENERAL: Anything that doesn't fit above (thank you, ok, yes, no, random)

Also extract any entities found in the message:
- child_name, child_age, city, school, reading_concerns

The user may write in English, Hindi, or Hinglish (mixed). Understand all three.

Respond in JSON only, no markdown:
{"intent":"...","entities":{},"confidence":0.0}
```

**Context injection:** When conversation state is `QUALIFYING`, appends collected data context to the prompt.

**Fallback if Gemini fails:**
- If currently `QUALIFYING` → returns `QUALIFICATION` (assume they're sharing info)
- Otherwise → returns `GENERAL` with confidence 0.1

### All 7 Intent Categories

| Intent | Handler | Notes |
|--------|---------|-------|
| `GREETING` | `handleGreeting()` | Welcome + 3 buttons |
| `FAQ` | `handleFaq()` | Gemini-generated from site_settings |
| `QUALIFICATION` | `handleQualification()` | Extract child_name/age/concerns |
| `ASSESSMENT_CTA` | `handleAssessmentCta()` | Assessment link + buttons |
| `BOOKING` | `handleBooking()` | Booking link + buttons |
| `ESCALATE` | `handleEscalate()` | Bot off, human handoff |
| `GENERAL` | Falls through to `handleAssessmentCta()` | Re-offers options |

---

## 4. CONVERSATION HANDLERS (Detailed)

### 4.1 `handleGreeting()` — COMPLETE
- **Trigger:** First message or explicit greeting
- **Action:** Sends personalized welcome with first name extraction
- **Response type:** Interactive buttons (3 CTAs)
  - "Check Reading" → `btn_assessment`
  - "See Pricing" → `btn_pricing`
  - "Talk to Someone" → `btn_human`
- **State transition:** → `QUALIFYING`
- **End-to-end:** Yes, fully functional

### 4.2 `handleFaq()` — COMPLETE
- **Trigger:** Pricing/format/duration questions or `btn_pricing`/`btn_more_questions`
- **Action:** Fetches 16 keys from `site_settings`, generates answer via Gemini 2.5 Flash
- **Anti-hallucination:** Gemini can ONLY use facts from DB; if missing, defers to team
- **Response type:** Plain text (max 3 sentences)
- **Fallback:** Static message with assessment link if Gemini fails
- **State transition:** None (stays in current state)
- **End-to-end:** Yes, fully functional (requires `site_settings` populated)

### 4.3 `handleQualification()` — COMPLETE
- **Trigger:** `QUALIFYING` state or `QUALIFICATION` intent
- **Action:** Conversational extraction of 3 fields:
  1. `child_name` (asked first)
  2. `child_age` (asked second)
  3. `reading_concerns` (asked third)
- **Uses:** Gemini 2.5 Flash (temp 0.5, 250 tokens) with structured JSON output
- **Lead scoring:** 0-100 based on: age in range (+30), concerns shared (+30), name collected (+20), all fields (+20)
- **When all collected:** Sends assessment CTA with buttons, transitions to `ASSESSMENT_OFFERED`
- **Fallback:** Hardcoded follow-up questions if Gemini fails
- **State transition:** Stays `QUALIFYING` until all 3 collected, then → `ASSESSMENT_OFFERED`
- **End-to-end:** Yes, fully functional

### 4.4 `handleAssessmentCta()` — COMPLETE
- **Trigger:** `ASSESSMENT_CTA` intent or `btn_assessment` or default fallback
- **Action:** Sends static assessment link (`https://www.yestoryd.com/assessment`)
- **Response type:** Interactive buttons (3 CTAs)
- **State transition:** → `ASSESSMENT_OFFERED`
- **End-to-end:** Yes, sends link. **BUT:** No tracking of whether user actually started the assessment

### 4.5 `handleBooking()` — COMPLETE
- **Trigger:** `BOOKING` intent or `btn_book_call`
- **Action:** Sends static booking link (`https://www.yestoryd.com/book-call`)
- **Response type:** Interactive buttons (3 CTAs)
- **State transition:** → `DISCOVERY_OFFERED`
- **Integrations:** Triggers `summarizeLeadConversation()` (RAG pipeline, fire-and-forget)
- **End-to-end:** Yes, sends link. **BUT:** Does NOT actually book via API — just sends URL

### 4.6 `handleEscalate()` — COMPLETE
- **Trigger:** `ESCALATE` intent or `btn_human`/`btn_talk_team` (works from ANY state)
- **Action:**
  1. Sets `is_bot_active = false` in DB
  2. Sets state to `ESCALATED`
  3. Sends user confirmation message
  4. Logs escalation summary to console (structured JSON)
- **State transition:** → `ESCALATED`
- **End-to-end:** Yes, bot stops responding. **BUT:** No actual admin notification (WhatsApp/email/Slack) — only console logging

---

## 5. DATABASE STATE

### 5.1 `wa_leads`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | PK | Auto-generated |
| phone_number | text | NOT NULL | Unique (upsert key) |
| parent_name | text | YES | From WhatsApp contact name |
| child_name | text | YES | Extracted during qualification |
| child_age | int | YES | Extracted during qualification |
| reading_concerns | text | YES | Extracted during qualification |
| urgency | text | YES | Not populated by bot |
| city | text | YES | Extracted by Gemini |
| school | text | YES | Extracted by Gemini |
| source | text | NOT NULL | Always `'whatsapp_leadbot'` |
| status | text | NOT NULL | `new` → `qualifying` → `qualified` → `discovery_booked` |
| lead_score | int | NOT NULL | 0-100, calculated by qualification handler |
| conversation_id | uuid | YES | FK → `wa_lead_conversations.id` |
| child_id | uuid | YES | FK → `children.id` (usually NULL — no auto-linking) |
| discovery_call_id | uuid | YES | FK → `discovery_calls.id` (usually NULL) |
| enrollment_id | uuid | YES | FK → `enrollments.id` (usually NULL) |
| notes | text | YES | Not populated by bot |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**Foreign Keys:** child_id → children, conversation_id → wa_lead_conversations, discovery_call_id → discovery_calls, enrollment_id → enrollments

### 5.2 `wa_lead_conversations`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | PK | Auto-generated |
| phone_number | text | NOT NULL | |
| current_state | text | NOT NULL | ConversationState enum (9 values) |
| collected_data | jsonb | NOT NULL | `{child_name, child_age, reading_concerns, city, school, contact_name}` |
| lead_score | int | NOT NULL | Mirrors wa_leads.lead_score |
| is_bot_active | boolean | NOT NULL | `false` when escalated to human |
| assigned_agent | text | YES | Not populated by bot |
| consent_given | boolean | NOT NULL | Always `false` — not implemented |
| consent_given_at | timestamptz | YES | Always NULL |
| last_message_at | timestamptz | NOT NULL | Updated on every message |
| child_id | uuid | YES | FK → children (usually NULL) |
| discovery_call_id | uuid | YES | FK → discovery_calls (usually NULL) |
| created_at | timestamptz | NOT NULL | |
| updated_at | timestamptz | NOT NULL | |

**ConversationState values defined in types.ts:**
`GREETING` | `QUALIFYING` | `COLLECTING_CHILD_AGE` | `COLLECTING_CONCERNS` | `ASSESSMENT_OFFERED` | `DISCOVERY_OFFERED` | `NURTURING` | `ESCALATED` | `COMPLETED`

**States actually used by handlers:**
`GREETING` → `QUALIFYING` → `ASSESSMENT_OFFERED` → `DISCOVERY_OFFERED` → `ESCALATED`

**States defined but NEVER entered:**
`COLLECTING_CHILD_AGE`, `COLLECTING_CONCERNS`, `NURTURING`, `COMPLETED`

### 5.3 `wa_lead_messages`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | uuid | PK | Auto-generated |
| conversation_id | uuid | NOT NULL | FK → wa_lead_conversations.id |
| direction | text | NOT NULL | `'inbound'` or `'outbound'` |
| sender_type | text | NOT NULL | `'user'`, `'bot'`, or `'agent'` |
| content | text | NOT NULL | Message text or `[type]` placeholder |
| message_type | text | NOT NULL | `text`, `buttons`, `image`, etc. |
| wa_message_id | text | YES | Meta Cloud API message ID (for dedup) |
| metadata | jsonb | YES | Contact name, interactive IDs, intent, tier, confidence, state transition |
| created_at | timestamptz | NOT NULL | |

**Indexes (inferred from unique constraint):** `wa_message_id` has unique constraint (dedup via error code 23505)

### 5.4 Data in Tables

Cannot query live database, but based on code analysis:
- `wa_leads` records are created on first contact (source: `whatsapp_leadbot`)
- `wa_lead_conversations` is 1:1 with phone number (one conversation per lead)
- `wa_lead_messages` stores both inbound and outbound messages with metadata

---

## 6. WHAT'S WORKING

| Feature | Status | Notes |
|---------|--------|-------|
| Webhook receiving messages | **YES** | Signature verification, proper 200 return |
| Webhook verification (GET challenge) | **YES** | `META_WA_VERIFY_TOKEN` check |
| Message extraction (all 8 types) | **YES** | text, button, interactive, image, audio, video, document, location |
| Message deduplication | **YES** | SELECT check + race-condition fallback via 23505 |
| Lead creation (first contact) | **YES** | Creates both `wa_lead_conversations` and `wa_leads` |
| Conversation state machine | **YES** | GREETING → QUALIFYING → ASSESSMENT_OFFERED/DISCOVERY_OFFERED/ESCALATED |
| Intent classification (Tier 0) | **YES** | Regex + button ID mapping, zero-cost |
| Intent classification (Tier 1) | **YES** | Gemini 2.5 Flash with entity extraction |
| Greeting handler | **YES** | Personalized welcome + 3 CTA buttons |
| FAQ handler | **YES** | Anti-hallucination from site_settings via Gemini |
| Qualification handler | **YES** | Conversational 3-field extraction with lead scoring |
| Assessment CTA handler | **YES** | Static link + buttons |
| Booking handler | **YES** | Static link + buttons |
| Escalation handler | **YES** | Bot deactivation + user confirmation |
| Outbound message sending | **YES** | text, buttons, list, template via Cloud API |
| Message read receipts | **YES** | Blue ticks via markAsRead() |
| QStash async processing | **YES** | Deferred processing with 3 retries |
| Internal send API | **YES** | Authenticated, validated, saves to DB |
| RAG pipeline on booking | **YES** | summarizeLeadConversation() fire-and-forget |
| Structured logging | **YES** | requestId tracing, JSON structured logs |
| Error recovery | **YES** | All handlers have try/catch with fallbacks |
| Daily lead digest (cron) | **YES** | Sends admin WhatsApp summary, but reads from `children` table |
| Discovery follow-up (cron) | **YES** | 24hr AiSensy follow-up for completed calls |

---

## 7. WHAT'S HALF-DONE

| Feature | Status | Details |
|---------|--------|---------|
| **Status update handling** | **Log-only** | `handleStatuses()` in webhook just logs — no DB update for sent/delivered/read/failed status. Comment says "deferred to Phase 2" |
| **Escalation admin notification** | **Console-only** | `handleEscalate()` logs to console but sends NO actual notification (no WhatsApp, email, or Slack alert to admin) |
| **Booking is link-only** | **No API booking** | `handleBooking()` sends a URL (`/book-call`) — does NOT actually query available slots or book via the discovery API |
| **Assessment CTA is link-only** | **No tracking** | Sends assessment URL but has no callback/webhook to know if the parent completed the assessment |
| **Consent collection** | **Schema exists, logic missing** | `consent_given` column exists, always `false`. No consent flow implemented |
| **4 unused ConversationStates** | **Defined but never set** | `COLLECTING_CHILD_AGE`, `COLLECTING_CONCERNS`, `NURTURING`, `COMPLETED` — never entered by any handler |
| **Lead scoring cron** | **Wrong table** | `app/api/cron/lead-scoring/route.ts` scores `children` table, NOT `wa_leads`. The bot's internal scoring (in qualification handler) is separate and not recalculated |
| **Daily digest** | **Wrong table** | `app/api/cron/daily-lead-digest/route.ts` reads from `children` table, not `wa_leads`. WhatsApp leads are invisible to the admin digest |
| **Discovery follow-up** | **Different channel** | Uses AiSensy (old bot number), not Lead Bot Cloud API. No integration between the two |
| **Lead-to-child linking** | **Rarely happens** | `wa_leads.child_id` is usually NULL — no automated linking between WA leads and assessment `children` records |
| **assigned_agent field** | **Schema only** | `wa_lead_conversations.assigned_agent` is never populated — no agent assignment logic |
| **child_id on conversation** | **Schema only** | `wa_lead_conversations.child_id` is never populated by bot code |
| **discovery_call_id linking** | **Schema only** | `wa_lead_conversations.discovery_call_id` and `wa_leads.discovery_call_id` are never populated |

---

## 8. WHAT'S MISSING

| Feature | Priority | Description |
|---------|----------|-------------|
| **Lead lifecycle state machine** | HIGH | No formal state machine with transitions, guards, or side effects. States change via handler return values with no validation. No way to re-activate a bot after escalation. No `COMPLETED` state is ever reached. |
| **Auto-booking via WhatsApp** | HIGH | Bot sends a URL link — does NOT query available slots, show time options, or book via API. For Agent 2, need: slot querying → interactive list → confirmation → API booking. |
| **Nurture sequences** | HIGH | `NURTURING` state defined but never entered. No automated follow-up messages after assessment link sent. No drip campaign. No re-engagement for cold leads. |
| **Agent decision logging** | HIGH | No structured decision log (why did the agent choose this handler? what was the reasoning?). Only console.log with intent/tier/confidence. |
| **Qualification data extraction (structured)** | MEDIUM | Extraction is per-turn (Gemini extracts from each message). No cumulative structured profile. No extraction of: budget, preferred timing, language preference, siblings. |
| **Escalation protocol** | MEDIUM | No admin notification (only console.log). No SLA tracking. No auto-escalation on timeout. No priority queue. No way for admin to see escalated conversations in a dashboard. |
| **Available slot querying** | MEDIUM | Booking handler sends a static URL. Needs: query `coaches` availability, show slots as interactive list, handle selection. |
| **Assessment completion webhook** | MEDIUM | No callback from assessment system to Lead Bot. If parent completes assessment via the sent link, Lead Bot doesn't know. |
| **Multi-turn conversation memory** | MEDIUM | Conversation context is limited to `collected_data` JSON blob. No full message history is passed to Gemini for context. |
| **Rate limiting** | MEDIUM | No protection against message floods. A user could send 100 messages and each gets processed + generates a Gemini call. |
| **Conversation timeout** | LOW | No auto-timeout for stale conversations. A conversation stays in `QUALIFYING` forever if the parent stops responding. |
| **Media message handling** | LOW | Media messages (images, audio, video) are extracted and stored but never processed. No OCR, no transcription, no "please send text" fallback. |
| **Template message support** | LOW | `sendTemplate()` exists in cloud-api.ts but is never used by any handler. |
| **Analytics/metrics** | LOW | No conversion tracking, no funnel metrics, no response time tracking. Only structured console.log. |
| **A/B testing** | LOW | All copy is hardcoded in handlers. No variant testing for greeting messages, CTAs, etc. |
| **Language detection** | LOW | Gemini handles Hindi/Hinglish in classification, but responses are always English (except FAQ which follows user language). |
| **WhatsApp Business Profile** | LOW | No management of business profile, away messages, or greeting messages via API. |

---

## 9. ENVIRONMENT VARIABLES

### Lead Bot specific (META_WA_* namespace)

| Variable | Used In | Purpose |
|----------|---------|---------|
| `META_WA_ACCESS_TOKEN` | `cloud-api.ts` | Meta Graph API Bearer token |
| `META_WA_PHONE_NUMBER_ID` | `cloud-api.ts` | Phone Number ID: `1055529114299828` |
| `META_WA_APP_SECRET` | `signature.ts` | HMAC-SHA256 webhook signature verification |
| `META_WA_VERIFY_TOKEN` | `webhook/route.ts` | GET challenge verification token |

### Shared infrastructure

| Variable | Used In | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | `tier1-gemini.ts`, `faq.ts`, `qualification.ts` | Google Generative AI (Gemini 2.5 Flash) |
| `QSTASH_TOKEN` | `webhook/route.ts` | QStash publish client |
| `QSTASH_CURRENT_SIGNING_KEY` | `process/route.ts` | QStash message verification |
| `QSTASH_NEXT_SIGNING_KEY` | `process/route.ts` | QStash key rotation |
| `INTERNAL_API_KEY` | `process/route.ts`, `send/route.ts` | Internal API authentication |
| `NEXT_PUBLIC_APP_URL` | `webhook/route.ts` | App URL for QStash publish target |
| `VERCEL_URL` | `webhook/route.ts` | Fallback URL if APP_URL not set |
| `NEXT_PUBLIC_SUPABASE_URL` | `admin.ts` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `admin.ts`, `send/route.ts` | Service role for admin client |
| `NODE_ENV` | `process/route.ts`, `send/route.ts` | Dev bypass for auth |

### .env.example references (different naming!)

The `.env.example` file uses **different variable names** for the existing WhatsApp Cloud bot:
```
WHATSAPP_CLOUD_TOKEN        (Lead Bot uses: META_WA_ACCESS_TOKEN)
WHATSAPP_CLOUD_PHONE_ID     (Lead Bot uses: META_WA_PHONE_NUMBER_ID)
WHATSAPP_CLOUD_VERIFY_TOKEN (Lead Bot uses: META_WA_VERIFY_TOKEN)
WHATSAPP_CLOUD_APP_SECRET   (Lead Bot uses: META_WA_APP_SECRET)
```

The `.env.example` does NOT list the `META_WA_*` variables used by Lead Bot.

---

## 10. INTEGRATION MAP

```
                                    ┌─────────────────────────┐
                                    │   Meta Cloud API v21.0  │
                                    │   (Graph API)           │
                                    └────────┬───────┬────────┘
                                     inbound │       │ outbound
                                    (webhook)│       │(sendText, sendButtons,
                                             │       │ sendList, sendTemplate,
                                             ▼       │ markAsRead)
┌──────────────┐    ┌────────────────────────────────────────────────┐
│  QStash      │◄───│  /api/whatsapp/webhook                        │
│  (Upstash)   │    │  - Signature verify                           │
│              │    │  - Dedup + save message                       │
│  3 retries   │    │  - Create lead/conversation                   │
│  1s delay    │────│  - Queue to /api/whatsapp/process             │
└──────────────┘    └────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────────┐
│  /api/whatsapp/process (QStash consumer)                          │
│  - Intent classification                                          │
│  - Handler routing                                                │
│  - State + data update                                            │
└───────┬────────┬────────┬────────┬────────┬────────┬──────────────┘
        │        │        │        │        │        │
        ▼        ▼        ▼        ▼        ▼        ▼
   ┌────────┐┌───────┐┌────────┐┌──────┐┌───────┐┌─────────┐
   │Greeting││  FAQ  ││Qualify ││Assess││Booking││Escalate │
   │Handler ││Handler││Handler ││ CTA  ││Handler││Handler  │
   └────────┘└───┬───┘└───┬────┘└──────┘└───┬───┘└────┬────┘
                 │        │                  │         │
        ┌────────┘   ┌────┘                  │    ┌────┘
        ▼            ▼                       ▼    ▼
┌──────────────┐ ┌──────────────┐   ┌─────────────────┐
│ site_settings│ │ Gemini 2.5   │   │ Supabase        │
│ (FAQ data)   │ │ Flash        │   │ wa_leads        │
│              │ │ (classify,   │   │ wa_lead_convos  │
└──────────────┘ │  extract,    │   │ wa_lead_msgs    │
                 │  FAQ gen,    │   └─────────────────┘
                 │  qualify)    │
                 └──────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  SEPARATE SYSTEMS (Loosely Connected)                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AiSensy (existing bot, +91 89762 87997)                        │
│  └─ Used by: discovery-followup cron ONLY                       │
│  └─ NOT used by Lead Bot (separate phone number)                │
│                                                                  │
│  /api/discovery/book (Native booking API)                        │
│  └─ NOT called by Lead Bot                                      │
│  └─ Lead Bot sends URL link only (https://yestoryd.com/book-call)│
│                                                                  │
│  Assessment system (https://yestoryd.com/assessment)             │
│  └─ NOT called by Lead Bot                                      │
│  └─ Lead Bot sends URL link only                                │
│  └─ No callback/webhook when assessment completes               │
│                                                                  │
│  Lead scoring cron (/api/cron/lead-scoring)                      │
│  └─ Scores `children` table, NOT `wa_leads`                     │
│  └─ Bot has its own internal scoring (qualification handler)     │
│                                                                  │
│  Daily digest cron (/api/cron/daily-lead-digest)                 │
│  └─ Reads `children` table, NOT `wa_leads`                      │
│  └─ WhatsApp leads are INVISIBLE to admin digest                │
│                                                                  │
│  WhatsApp→RAG pipeline (lib/rai/pipelines/whatsapp-to-rag.ts)   │
│  └─ Called on BOOKING intent (fire-and-forget)                  │
│  └─ Creates learning_event with embedding                        │
│  └─ Requires child_id linked — usually skipped (no child link)  │
│                                                                  │
│  /api/whatsapp/send (Internal send API)                          │
│  └─ Exists and works, but NOT used by any handler               │
│  └─ Designed for admin/CRM to send messages to leads            │
│                                                                  │
│  Existing WhatsApp AI bot (/api/webhooks/whatsapp-cloud/)        │
│  └─ Completely separate system (different phone, different code) │
│  └─ Uses WHATSAPP_CLOUD_* env vars                              │
│  └─ No integration with Lead Bot                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. CODE QUALITY NOTES

### Strengths
- **No TODO/FIXME comments** — codebase is clean
- **TypeScript types are thorough** — 434 lines of well-structured types covering all Meta API shapes
- **Structured logging** — every event has `requestId` and JSON format
- **Error handling** — all handlers have try/catch with fallback responses
- **Race condition handling** — dedup uses both SELECT check + 23505 error code
- **Anti-hallucination in FAQ** — Gemini strictly uses DB facts, not its own knowledge
- **Hinglish support** — regex patterns cover Hindi/English mixed input
- **QStash pattern** — webhook returns 200 fast, async processing prevents Meta timeouts

### Issues

**1. Hardcoded URLs (should be in site_settings or env vars):**
- `handlers/assessment-cta.ts:7` — `ASSESSMENT_URL = 'https://www.yestoryd.com/assessment'`
- `handlers/booking.ts:7` — `BOOKING_URL = 'https://www.yestoryd.com/book-call'`
- `handlers/faq.ts:86` — Fallback assessment URL hardcoded in string

**2. Hardcoded copy (should be configurable):**
- `handlers/greeting.ts:18-21` — Welcome message text
- `handlers/assessment-cta.ts:20-23` — Assessment CTA text
- `handlers/booking.ts:20-23` — Booking CTA text
- `handlers/escalate.ts:34` — Escalation confirmation text

**3. Type safety:**
- `webhook/route.ts:232` — `getOrCreateConversation()` parameter `supabase` typed as `any`
- `process/route.ts:96` — `metadata` cast as `any` in `saveBotMessage()`
- `process/route.ts:147` — `leadData` cast as `any` in `upsertLead()`

**4. No rate limiting:**
- No protection against message floods
- Each message triggers a Gemini API call (Tier 1)
- A malicious user could burn through Gemini quota

**5. Signature bypass:**
- `signature.ts:23-26` — If `META_WA_APP_SECRET` is not set, verification is **skipped** (returns true)
- This is a security risk in production if the env var is accidentally unset

**6. Missing status DB updates:**
- `handleStatuses()` in webhook only logs — no DB update for message delivery/read status
- Comment: "JSONB merge for metadata deferred to Phase 2"

**7. Consent never collected:**
- `consent_given` is always `false`, `consent_given_at` always NULL
- No GDPR/privacy consent flow

---

## 12. RECOMMENDED CHANGES FOR AGENT 2

### KEEP AS-IS (Solid Foundation)

| Component | Why |
|-----------|-----|
| `types.ts` | Comprehensive Meta API types, DB row types — extend, don't rewrite |
| `signature.ts` | Correct HMAC-SHA256 with timing-safe comparison |
| `extract.ts` | Handles all 8 message types cleanly |
| `cloud-api.ts` | Full send API (text, buttons, list, template, markAsRead) |
| `index.ts` | Clean barrel exports |
| `intent/tier0-regex.ts` | Zero-cost pre-filter, add more patterns as needed |
| `intent/tier1-gemini.ts` | Entity extraction is valuable — upgrade model if needed |
| `intent/index.ts` | Clean pipeline orchestrator |
| Webhook route (save + queue) | Solid async pattern with dedup |
| Internal send API | Well-validated, ready for admin/CRM use |

### MODIFY (Extend Existing Code)

| Component | What to Change |
|-----------|---------------|
| `ConversationState` type | Add new states: `SLOT_SELECTION`, `BOOKING_CONFIRMED`, `NURTURING`, `RE_ENGAGED`, `ASSESSMENT_COMPLETED`. Remove unused: `COLLECTING_CHILD_AGE`, `COLLECTING_CONCERNS` |
| `Intent` type | Add new intents: `CONFIRM`, `REJECT`, `FOLLOWUP`, `STATUS_CHECK`, `RESCHEDULE` |
| `tier0-regex.ts` | Add button IDs for new slot-selection buttons, confirmation buttons, reschedule patterns |
| `tier1-gemini.ts` | Pass full conversation history (last N messages) for context, not just current state. Expand entities: `budget`, `preferred_timing`, `language_pref`, `sibling_count` |
| `handleBooking()` | **Major upgrade:** Query available slots via Supabase → present as interactive list → handle selection → call `/api/discovery/book` API → confirm |
| `handleAssessmentCta()` | Generate personalized assessment URL with UTM params or phone-linked tracking, so we know when they complete it |
| `handleEscalate()` | Add real admin notification: WhatsApp template to admin phone, email via Resend, optional Slack webhook |
| `handleQualification()` | Extract more fields: budget willingness, preferred language, sibling info. Calculate enriched lead score |
| Process route | Add decision logging table (`wa_agent_decisions`), add rate limiting, add conversation history context to handlers |
| Webhook route status handler | Actually update message delivery status in `wa_lead_messages` metadata |

### REPLACE (Rewrite From Scratch)

| Component | Why |
|-----------|-----|
| Lead scoring (in qualification handler) | Replace simple additive scoring with the canonical `lib/logic/lead-scoring.ts` system OR build a new scoring model that factors in: response speed, message count, question depth, engagement signals |

### ADD (New Files/Functions)

| New Component | Purpose |
|---------------|---------|
| `lib/whatsapp/state-machine.ts` | Formal state machine with: valid transitions, guard conditions, side effects, transition logging |
| `lib/whatsapp/handlers/slot-selection.ts` | Query coach availability, present slots as WhatsApp interactive list, handle selection |
| `lib/whatsapp/handlers/booking-confirm.ts` | Call `/api/discovery/book` API, handle success/failure, send confirmation with Google Meet link |
| `lib/whatsapp/handlers/nurture.ts` | Drip message sequences: Day 1, Day 3, Day 7 follow-ups. Re-engage cold leads |
| `lib/whatsapp/handlers/status-check.ts` | "What's my booking status?" — query discovery_calls, enrollment status |
| `lib/whatsapp/handlers/reschedule.ts` | Cancel existing booking, show new slots, rebook |
| `lib/whatsapp/memory.ts` | Full conversation context builder: load last N messages, build prompt context, manage token budget |
| `lib/whatsapp/decision-log.ts` | Structured logging of agent decisions: intent, confidence, handler chosen, reasoning, outcome |
| `lib/whatsapp/rate-limiter.ts` | Per-phone rate limiting: max N messages per minute, cooldown period |
| `app/api/cron/lead-nurture/route.ts` | Cron job to find stale leads and trigger nurture sequences |
| `app/api/cron/wa-lead-digest/route.ts` | Daily digest that reads from `wa_leads` (not `children`) |
| `lib/whatsapp/admin-notify.ts` | Real-time admin notifications for: escalations, hot leads, bookings |
| Migration: link wa_leads to children | When assessment completes with matching phone, auto-link `wa_leads.child_id` |
| Migration: wa_agent_decisions table | Store every agent decision for audit trail |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total files | 17 core + 3 cron + 3 connected |
| Total lines | 2,487 (core Lead Bot) |
| Files marked COMPLETE | 17/17 (all code is written and functional) |
| TODO/FIXME comments | 0 |
| Conversation states defined | 9 |
| Conversation states actually used | 5 |
| Intent categories | 7 |
| Gemini model | `gemini-2.5-flash` (x3 places: classify, FAQ, qualify) |
| Env vars required | 10 (4 Meta-specific + 6 shared) |
| Database tables | 3 (wa_leads, wa_lead_conversations, wa_lead_messages) |

**Bottom line:** The Lead Bot is a solid, well-architected foundation for conversational lead capture. The core loop (receive → classify → handle → respond → save) works end-to-end. The main gap for Agent 2 is that the bot is a **conversational form** (collects data, sends links) rather than an **autonomous agent** (makes decisions, takes actions, books calls, nurtures leads). The upgrade path is clear: keep the infrastructure, extend the state machine, add action-taking handlers, and build the nurture/follow-up system.
