# Yestoryd Products (canonical — verified 2026-05-29)

Quick model: identity = `enrollment_type` + `billing_model`. No `products` table.
`getProgramLabel()` (`lib/utils/program-label.ts`) discriminates on `billing_model` only.
Workshops bypass enrollments entirely (`group_sessions` / `group_class_*`).

For the operational quick-reference (flow steps, threshold templates, gotchas), see
the `## Products` block in `/CLAUDE.md`. This file is the deeper spec.

---

## Comparison (verbatim from the live /pricing compare grid)

Source: `app/pricing/PricingPageClient.tsx` L118-160 (`COMPARE_SECTIONS` array). Update this
table when that constant changes. The headline product cards above the grid live in the
`PRODUCTS` constant at L27-100 of the same file — featured-bullet copy lives there.

### What makes each tier different

| | Workshops | English Classes | 1:1 Coaching |
|---|---|---|---|
| Session type | Group event | Group or Individual | 1:1 only |
| Coach | Rotating instructor | Assigned coach | Dedicated personal coach |
| Schedule | Drop-in events | Weekly schedule | Per age band |
| Duration | 45 min | 45-120 min | 30/45/60 min by age |
| Commitment | None | Prepaid session pack | Season (90 days) |

### Parent experience

| | Workshops | English Classes | 1:1 Coaching |
|---|---|---|---|
| Post-session insight | Micro-insight | Session summary | Detailed AI analysis |
| Homework tracking | — | Upload + AI feedback | SmartPractice (AI daily) |
| Progress reports | — | Periodic snapshots | Continuous + shareable cards |
| rAI Chat | — | ✓ | ✓ |
| Parent check-ins | — | ✓ | ✓ |
| WhatsApp updates | Confirmation only | Session + balance alerts | 40+ touchpoint automation |

Note: the "40+" WhatsApp count is flagged in source (`PricingPageClient.tsx:137`) for migration
to `site_settings.whatsapp_touchpoint_count` — do not treat as a stable number.

### AI intelligence depth

| | Workshops | English Classes | 1:1 Coaching |
|---|---|---|---|
| AI learning profile | Basic | Moderate | Deep (full flywheel) |
| Session recording | — | — | Every online session |
| SmartPractice | — | — | Gamified, adaptive |
| E-learning games | — | — | Full access |
| Reading tests | — | ✓ | Every 4th session |

### Extras

| | Workshops | English Classes | 1:1 Coaching |
|---|---|---|---|
| Book library | ✓ | ✓ | ✓ |
| Badges | Workshop badges | — | Full gamification |
| Certificates | Per series | — | Season certificate |
| Skill boosters | — | — | On-demand |
| Workshops free | — | — | Included |

---

## English Classes (tuition / prepaid session-pack)

### Identity
- `enrollment_type = 'tuition'`
- `billing_model = 'prepaid_sessions'` (or legacy `'session_pack'` — both treated as tuition by `isTuitionEnrollment()`)
- All 13 live enrollments today are this (per Supabase MCP, 2026-05-29).

### Billing
- Price = `session_rate × sessions_purchased` (paise).
- `session_rate` is per-onboarding (set by admin or coach at `tuition_onboarding` creation), NOT from `pricing_plans`. There is no DB source of truth for English Classes pricing — see `PricingPageClient.tsx:24-26` TODO note ("workshops and English Classes are per-batch / per-onboarding priced").
- Admin route schema bounds the rate: `5000-100000` paise (₹50-₹1,000) — source: `app/api/admin/tuition/create/route.ts:19` Zod schema.
- Admin route schema bounds session count: `1-50` — source: same file L20.

### Coach model
- Assigned coach (single `coach_id` on the onboarding + enrollment).
- Coach can onboard their own students via `/api/coach/onboard-student` — schema `app/api/coach/onboard-student/route.ts:19-32`.
- Batches: `batch_id` UUID on `tuition_onboarding`. Joining an existing batch inherits `session_rate`, `session_duration_minutes`, `sessions_per_week`, `default_session_mode` from a sibling row (coach route L57-79).

### Online / offline + approval workflow
- `default_session_mode` set at onboarding: `'online' | 'offline'`. Admin route default is `'offline'` (admin schema L24); coach route default is `'online'` (coach schema L28).
- Copied to `scheduled_sessions.session_mode` at session creation.
- Coach requests an offline conversion: `POST /api/coach/sessions/[id]/request-offline`. Auto-approves for qualified coaches; otherwise sets `offline_request_status='pending'`.
- Admin decides: `POST /api/admin/sessions/[id]/offline-decision`. Approve sets `offline_approved_by` + `offline_approved_at`; reject clears the pending state.
- Admin direct mode change: `POST /api/admin/sessions/[id]/change-mode`. Currently `offline → online` ONLY. `online → offline` returns 501 (`change-mode/route.ts:49-54`).

### Full 7-step lifecycle

1. **Onboarding created.** `POST /api/admin/tuition/create` OR `POST /api/coach/onboard-student` →
   `createTuitionOnboarding()` helper (`lib/tuition/create-onboarding.ts`).
   - Token: `crypto.randomBytes(32).toString('hex')`, 7-day expiry (`create-onboarding.ts:60-61`).
   - Inserts `tuition_onboarding` with `status='parent_pending'`, `parent_form_token`, `parent_form_token_expires_at`.
   - Fires WhatsApp `parent_tuition_onboarding_v4` (utility_cta button carrying the magic-link URL).

2. **Parent form submission.** `POST /api/tuition/onboard/[token]` (`app/api/tuition/onboard/[token]/route.ts:242-260`):
   - Creates `enrollments` row with `enrollment_type='tuition'`, `billing_model='prepaid_sessions'`,
     `sessions_remaining=0`, `status='payment_pending'`,
     `program_description = (categoryParentLabel ? "{label} Sessions" : null)`.
   - Inserts initial ledger row: `reason='enrollment_created'`, `change_amount=0`, `balance_after=0` (L284-293).
   - Updates `tuition_onboarding.status='parent_completed'`, links `enrollment_id`, `child_id`, `parent_id`.
   - Fires WhatsApp `parent_tuition_payment_v3` with checkout URL.

3. **Payment.** Razorpay flow. Order metadata carries `enrollment_type='tuition'` (`app/api/payment/create/route.ts:185,203`).
   - Webhook: `app/api/payment/webhook/route.ts:223` branches on `meta.enrollment_type === 'tuition'`.
   - Verify: `app/api/payment/verify/route.ts:196` parallel branch.
   - Offline (cash/UPI): `app/api/payment/record-offline/route.ts:61` guards `enrollment_type !== 'tuition'`.
   - On success: `sessions_remaining` set to `sessions_purchased`, ledger row added,
     `parent_payment_confirmed_v3` fires.

4. **Scheduling.** `POST /api/tuition/schedule` (tuition-guarded at L47: `enrollment_type !== 'tuition'` returns early).
   Creates `scheduled_sessions` rows carrying `session_mode` from the onboarding default.
   Offline conversions follow the approval workflow above.

5. **Coach completes the session.** Path: SCF capture → session complete.
   - SCF write: `POST /api/intelligence/capture` validates payload and inserts
     `structured_capture_responses` row. Captures may be drafts (`coach_confirmed=false`).
   - Coach confirms: separate flow flips `coach_confirmed=true`.
   - Session complete: `POST /api/coach/sessions/[id]/complete`. Requires either
     `payload.captureId` OR an existing confirmed SCF row (otherwise 400 `pending_capture` /
     `capture_required` — `complete/route.ts:115-143`).
   - Idempotency: 409 if `session.status === 'completed'` already (`complete/route.ts:79-81`).
   - **The decrement happens here, NOT at SCF submit.** `complete/route.ts:390` calls
     `deductTuitionBalance()` if `enrollment_type === 'tuition'`.

6. **Balance-tracker thresholds** (`lib/tuition/balance-tracker.ts`):
   - `newBalance === 1` AND `parent_renewal_check_sent_at IS NULL`:
     fires `parent_renewal_intent_v1` (marketing_quick_reply buttons with titles
     'Yes, renew' / 'Pause for now' / 'Talk to coach'); stamps
     `parent_renewal_check_sent_at` (one-shot per cycle) (L158-205).
   - `newBalance <= 2` (excluding the 1-case above) AND intent in `['pending', 'needs_more_info']`
     AND `low_balance_nudges_sent < 2` AND NOT paused:
     fires `parent_tuition_low_balance_v3`; increments `low_balance_nudges_sent`,
     stamps `last_low_balance_nudge_at` (L244-279). Lifetime cap = 2 nudges per enrollment.
   - `newBalance <= 0`: fires `parent_tuition_renewal_v3`; triggers `checkAndPause()` (L120-156).
   - `checkAndPause()`: if balance has been ≤0 for 3+ days, sets `status='tuition_paused'`,
     fires `parent_tuition_paused_v3` (L320-410). Day threshold computed from earliest
     `tuition_session_ledger` row with `balance_after <= 0`.

7. **Top-up / renewal.** Parent taps WhatsApp button or visits `/parent/topup/[enrollmentId]`.
   New payment → ledger row with `reason='top_up'` or `'renewal'` (positive `change_amount`)
   → `sessions_remaining` increases → `parent_renewal_check_sent_at` reset to NULL
   (so next cycle's `==1` intent capture can fire again). Cycle repeats.

### Intelligence depth (English Classes specifically)
- Moderate — labelled "Moderate" in the public compare grid.
- NO Recall recording (`PricingPageClient.tsx:145`: "Session recording" is "—" for Classes,
  "Every online session" for Coaching).
- Signal sources for `learning_events`:
  - SCF structured capture (after every session, gated by `coach_confirmed`).
  - Homework uploads + AI feedback (artifact analysis pipeline).
  - Reading tests (✓ for Classes per compare grid).
  - Parent check-ins (`/api/sessions/parent-checkin` → `learning_events`).
- `signal_confidence` for these sources lives on each `learning_events` row — see
  `lib/rai/learning-events.ts` for the insert helper and the valid event-type set
  (extended for `parent_renewal_decision` in migration `20260529040000_extend_event_type_for_renewal_decisions.sql`).

### Feature gates
- Resolver: `lib/features/get-child-features.ts`.
- Database source: `product_features` table + `children.feature_overrides` JSON column.
- This file is the per-product gate for things like SmartPractice, E-learning games,
  Recall recording — read the resolver before assuming a feature is available for
  a given child / enrollment.

---

## 1:1 Coaching (tiered + seasons)

### Identity
- `enrollment_type = 'coaching'` (or similar non-tuition value).
- `billing_model` is NOT `'prepaid_sessions'` / `'session_pack'` (anything else makes
  `getProgramLabel` return `'1:1 Coaching'`).
- Zero live enrollments (per Supabase MCP, 2026-05-29).

### Tiers
- Three tiers: Starter, Continuation, Full.
- **Source of truth for tier prices: `pricing_plans` table, accessed via
  `lib/config/pricing-config.ts` (`getPricingConfig()`).** Do NOT inline rupee
  numbers. Headline-only prices (Starter ₹1,499 / Continuation ₹5,999 / Full ₹6,999)
  appear in `lib/whatsapp/handlers/faq.ts:38-42` as a fallback ONLY — that file's
  hardcoded fallback values (3999/7499/6999) DRIFT from the headline numbers and
  must not be trusted as canonical.
- Tier slugs used in code: `'starter'`, `'continuation'`, `'full'` (per
  `faq.ts:27-31`, `complete/route.ts:431`).

### Age bands (Foundation / Building / Mastery)
- **Source of truth: `age_band_config` table.** Columns include `sessions_per_season`,
  `skill_booster_credits`, `coaching_session_duration_mins`, `weekly_pattern` (JSON).
- The CLAUDE.md "Session Structure by Age Band" table (in the pre-slim layout at L262-272)
  is a documentation snapshot, not the source — `age_band_config` table is.
- Per-child age band lives on `enrollments.age_band` (per-enrollment, NOT per-child).
- Reading-test interval lives on `age_band_config.progress_pulse_interval` (used by
  `complete/route.ts:313-317`).

### Seasons + skill boosters
- 90-day seasons (per the compare grid; "Commitment: Season (90 days)" — `PricingPageClient.tsx:126`).
- Skill boosters (remedial sessions) — count comes from `age_band_config.skill_booster_credits` (see the
  config row for each band). The exact per-band counts: **see `age_band_config` table.**

### Recording + flywheel
- Recall.ai recording on every online session (compare grid: "Session recording: Every online session").
- Full intelligence flywheel: deep AI learning profile, SmartPractice (AI daily homework),
  E-learning games, reading tests every 4th session, season certificate, on-demand skill
  boosters. All workshops included free for coaching enrollments.

### Intelligence depth
- Deep — "Deep (full flywheel)" in the compare grid.
- Online 1:1 with Recall transcript: ~90-100% modality quality (approximate per the
  yestoryd-unified-intelligence-protocol intelligence-modality matrix; the exact
  protocol document is the source).
- In-person 1:1 (offline-approved): ~80-90% modality quality, via structured capture
  (no Recall transcript).

---

## Workshops (group drop-in)

### Identity
- Lives in `group_sessions` and `group_class_*` tables.
- NOT a row in `enrollments`. `getProgramLabel` is never called for workshops.
- Per-event billing (drop-in, no commitment).

### Coach model
- Rotating instructor (compare grid: "Coach: Rotating instructor").

### Intelligence depth
- Basic — "Basic" in the compare grid; "AI micro-insight after each session" in the
  `workshops` product summary card (`PricingPageClient.tsx:40`).
- Group_class capture quality: ~65-80% (approximate per the
  yestoryd-unified-intelligence-protocol).

### Code paths
- Crons: `group-class-feedback-request`, `group-class-reminders`,
  `group-class-notifications`, `group-class-completion-nudge`.
- Capture: `app/api/group-classes/session/[id]/capture/route.ts` (writes `learning_events`).
- Completion: `app/api/group-classes/session/[id]/complete/route.ts`.
- Activity submission: `app/api/group-classes/activity/submit/route.ts`.
- Parent view: `app/api/parent/group-classes/route.ts`.
- Refund: `app/api/admin/group-classes/refund/route.ts`.

---

## Revenue splits

**Single source of truth: `lib/config/payout-config.ts`.** Do NOT restate percentages
in this doc.

- Calculator: `calculateEnrollmentBreakdown(...)` — the entry point for all three products.
- Tuition coach % helper: `getTuitionCoachPercent(...)`.
- Workshop split keys: `workshop_default_coach_percent` (default 45 per fallback at
  `payout-config.ts:189`), `workshop_lead_cost_percent` (default 0). These live as
  `site_settings` keys and are loaded by the same loader.
- Live fallbacks in code are NOT the source — the loader pulls from `site_settings`. The
  fallbacks shipped in code default the rate when DB lookup fails. See `payout-config.ts:319-320`
  for the read-with-fallback shape.
- For the per-product split semantics (coach % vs platform % vs lead %) — read
  `payout-config.ts` directly. The math differs between tuition, coaching, and workshops.

---

## Intelligence modality matrix

Single source: the `yestoryd-unified-intelligence-protocol` doc + `learning_events`
table (`signal_source` and `signal_confidence` columns). The values below are
approximations supplied by the protocol; refer to the protocol for the authoritative numbers.

| Modality | Capture mechanism | Approx quality | `signal_confidence` typical |
|---|---|---|---|
| Online 1:1 | Recall transcript + post-session SCF | ~90-100% | `high` |
| In-person 1:1 (offline-approved) | Structured capture (SCF) only | ~80-90% | `high` / `medium` |
| Group class (workshop / class group mode) | Instructor console capture + individual moments | ~65-80% | `medium` |
| Practice / homework | Supplementary (artifact upload, parent task completion) | ~30-40% | `low` |

`signal_confidence` enum across these is `'high' | 'medium' | 'low'`. See
`lib/rai/learning-events.ts` for the insert helper and the rule that
`event_type='parent_renewal_decision'` uses `signal_source='parent_whatsapp'`,
`signal_confidence='high'` (per `lib/whatsapp/handlers/renewal-intent.ts`).

Event-type CHECK constraint: see migration
`supabase/migrations/20260529040000_extend_event_type_for_renewal_decisions.sql` for
the canonical allowed-values list. `learning_events.event_type` rejects values outside
this set silently (per the supabase skill's CHECK-constraint-silent-rejection rule —
this is BACKLOG B6 to surface).

---

## Known holes (verified during the 2026-05-29 audit)

- **admin force-complete is billing-free AND brain-invisible.** Path:
  `POST /api/admin/sessions/[id]/force-complete`. File header explicitly states the
  omissions (`force-complete/route.ts:14-19`): "parent_summary generation,
  learning_events insertion, QStash post-capture-orchestrator dispatch, WhatsApp
  parent_session_summary template send." Also does NOT call `deductTuitionBalance`
  (no balance-tracker import in the file). Explains the 51-completed-vs-48-ledger
  delta documented in the same audit.

- **WhatsApp FAQ free-text reaches Gemini but writes NO `learning_event`.**
  Path: `app/api/whatsapp/process/route.ts:33` imports `handleFaq` →
  `lib/whatsapp/handlers/faq.ts` calls Gemini 2.0 Flash Lite with knowledge-stuffed
  prompt (L20). FAQ.ts does NOT import `insertLearningEvent`. Compare with
  `app/api/chat/route.ts:632` which DOES write `parent_inquiry` learning_events
  for web-dashboard chat. "Conversation must learn" rule has a gap on the WhatsApp
  surface.

- **SCF draft state vs completion.** 28 of 79 `structured_capture_responses` rows are
  in `coach_confirmed=false` state (per the Supabase MCP audit) — captured but not
  confirmed by coach. These never trigger downstream effects until confirmed.

- **`session_pack` billing_model value.** `isTuitionEnrollment()` accepts both
  `'prepaid_sessions'` and `'session_pack'` (`program-label.ts:37`). Ground truth says
  all 13 live tuition rows are `'prepaid_sessions'`. The `'session_pack'` value is a
  documented synonym; confirm its history (legacy / aspirational) before relying on it.

- **Workshop label in `program-label.ts` header (FIXED 2026-05-29).** Stale claim
  that the function returned `"Workshop"` was removed; it never did. Workshops route
  through `group_sessions`, not `enrollments`, and never reach this function.

---

## Source citations

This doc cites code files and tables rather than restating numbers. When a number
disagrees between code and this doc, **the code/table wins** and this doc should
be updated. The Supabase MCP findings underpinning this doc were collected on
2026-05-29; numbers like "13 live enrollments" are point-in-time and will drift.
