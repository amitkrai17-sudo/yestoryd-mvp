# WhatsApp Engine Migration Manifest

**Date:** 2026-04-19
**Scope:** Migrate direct `sendWhatsAppMessage()` callers → unified `sendNotification()` engine
**Engine:** `lib/communication/notify.ts`

---

## Summary

- **Files migrated:** 24 files (from 30 direct `sendWhatsAppMessage` callers in audit)
- **Files remaining as architectural defers:** 4
- **Infrastructure files (must stay):** 3
- **New infrastructure:** `lib/communication/notify.ts` with `NotifyMeta` interface
- **DB templates:** 64 total, 62 active WA, 62/62 have `cost_per_send` + `wa_variables`
- **Type errors introduced:** 0

---

## Engine: `lib/communication/notify.ts`

### `sendNotification(templateCode, recipientId, namedParams, meta?)`

**Flow:** template lookup → param validation → phone resolution → daily cap → quiet hours → idempotency → channel-routed send → log annotation.

### `NotifyMeta` (added Apr 2026)

```typescript
export interface NotifyMeta {
  triggeredBy?: 'system' | 'coach' | 'admin' | 'cron';
  triggeredByUserId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
}
```

**Threading:** Meta flows into 4 places:
1. `logBase` object → all `logCommunication()` calls
2. Quiet-hours raw insert → `triggered_by`, `triggered_by_user_id`
3. `sendWhatsAppMessage()` meta → `triggeredBy`, `triggeredByUserId`, `contextType`, `contextId`
4. Post-send log annotation UPDATE → all 4 columns

---

## Migrated Files

### Admin-triggered (triggeredBy: 'admin')

| # | File | Template | Meta |
|---|------|----------|------|
| 8 | `app/api/coach/notify-assignment/route.ts` | `coach_child_assigned_v4` | admin, contextType: enrollment/child |
| 20 | `app/api/admin/tuition/[id]/resend/route.ts` | `parent_tuition_onboarding_v3` | admin, triggeredByUserId, contextType: enrollment |
| 21 | `app/api/admin/tuition/create/route.ts` | `parent_tuition_onboarding_v3` | admin, triggeredByUserId, contextType: enrollment |
| 25 | `app/api/admin/completion/send-final-assessment/route.ts` | `parent_final_assessment_v3` | admin, triggeredByUserId, contextType: enrollment |
| 29 | `app/api/admin/sessions/[id]/offline-decision/route.ts` | `parent_offline_notification_v3` | admin, triggeredByUserId, contextType: session |

### Coach-triggered (triggeredBy: 'coach')

| # | File | Template | Meta |
|---|------|----------|------|
| 28 | `app/api/coach/sessions/[id]/request-offline/route.ts` | `parent_offline_notification_v3` | coach, triggeredByUserId: coachId, contextType: session |

### Cron-triggered (triggeredBy: 'cron')

| # | File | Template | Meta |
|---|------|----------|------|
| 1 | `app/api/cron/smoke-test/route.ts` | `admin_daily_health_v3` | cron |
| 2 | `app/api/cron/daily-health-check/route.ts` | `admin_daily_health_v3` | cron |
| 3 | `app/api/cron/payment-reconciliation-alert/route.ts` | `admin_scheduling_alert_v3` | cron |
| 4 | `app/api/cron/group-class-notifications/route.ts` | `parent_group_micro_insight_v3` | cron, contextType: group_class |
| 5 | `app/api/cron/group-class-reminders/route.ts` | `group_class_reminder_*` | cron, contextType: group_class |
| 6 | `app/api/cron/group-class-feedback-request/route.ts` | dynamic | cron, contextType: group_class |
| 7 | `app/api/cron/group-class-completion-nudge/route.ts` | `admin_group_class_overdue` | cron, contextType: group_class |
| 9 | `app/api/cron/coach-reminders-1h/route.ts` (line 155) | `coach_session_reminder_1h_v3` | cron, contextType: scheduled_session |
| 9 | `app/api/cron/coach-reminders-1h/route.ts` (line 258) | `coach_report_deadline_v3` | cron, contextType: session |
| 10 | `app/api/cron/enrollment-lifecycle/route.ts` | `coach_session_reminder_1h_v3` | cron, contextType: scheduled_session |
| 11 | `app/api/cron/tuition-onboarding-nudge/route.ts` | `parent_tuition_onboarding_v3` | cron, contextType: tuition_onboarding |
| 27 | `app/api/cron/session-completion-nudge/route.ts` | `parent_feedback_request_v3` | cron, contextType: session |
| 32 | `app/api/jobs/goals-capture/route.ts` | `parent_goals_capture_v3` | cron, contextType: assessment |
| B | `app/api/cron/discovery-followup/route.ts` | `parent_discovery_reminder_v3` | cron, contextType: discovery_call |

### System-triggered (triggeredBy: 'system')

| # | File | Template | Meta |
|---|------|----------|------|
| 12 | `lib/notifications/admin-alerts.ts` | `admin_new_lead_v4` / `admin_discovery_booked_v4` / `admin_daily_digest_v3` | system |
| 13 | `lib/group-classes/waitlist-promotion.ts` | `parent_group_promotion_v3` | system, contextType: group_class |
| 14 | `lib/tuition/create-onboarding.ts` | `parent_tuition_onboarding_v3` | system, contextType: tuition_onboarding |
| 15-17 | `lib/tuition/balance-tracker.ts` | `parent_tuition_renewal_v3` / `parent_tuition_low_balance_v3` / `parent_tuition_paused_v3` | system, contextType: tuition_balance |
| 18 | `app/api/leads/hot-alert/route.ts` | `admin_hot_lead_alert_v3` | system |
| 19 | `app/api/tuition/onboard/[token]/route.ts` | `parent_tuition_payment_v3` | system, contextType: tuition_onboarding |
| 26 | `app/api/sessions/parent-checkin/route.ts` | `parent_final_assessment_v3` | system, contextType: enrollment |
| 30 | `lib/rai/proactive-notifications.ts` | `parent_proactive_notification_v3` | system, contextType: proactive_notification |
| 31 | `lib/triggers/goals-capture.ts` | `parent_goals_capture_v3` | system, contextType: assessment |
| A | `app/api/assessment/analyze/route.ts` | `parent_assessment_results_v3` | system, contextType: assessment |
| 33 | `app/api/webhooks/aisensy/catch-all/route.ts` | `parent_auto_reply_redirect_v3` | system, contextType: auto_reply |

---

## Architectural Defers (4 remaining — not schema issues)

All DB-schema-blocked files now resolved. These 4 remain as architectural defers:

| File | Reason |
|------|--------|
| `app/api/auth/send-otp/route.ts` | AiSensy button param limitation — raw fetch with custom OTP payload, not a standard template send |
| `app/api/backops/command/route.ts` | Runtime dynamic template — admin CLI sends arbitrary template names from user input, needs separate design |
| `app/api/coach/tier-change/route.ts` | Dynamic template per tier — template name resolved at runtime based on tier change direction, needs tier template registry |
| `app/api/cron/coach-engagement/route.ts` | Dynamic engagement template — template name from engagement scheduler row, same pattern as tier-change |

---

## Infrastructure (must stay on `sendWhatsAppMessage`)

| File | Role |
|------|------|
| `lib/communication/aisensy.ts` | Canonical `sendWhatsAppMessage()` definition |
| `lib/communication/notify.ts` | Unified engine — delegates to `sendWhatsAppMessage` |
| `lib/communication/index.ts` | Legacy `sendCommunication()` wrapper |

---

## Known shims / TODOs

1. **C9 `last_focus` / `next_focus`** — Both callers (`coach-reminders-1h` line 155, `enrollment-lifecycle` line 358) pass placeholder values. Real data should come from `session_prep_data` or last SCF response. Tagged: `// TODO: ... (C9 shim — Apr 2026)`.

2. **`coach_child_assigned_v4` buttons** — The `buttons` param (dynamic URL suffix for `/coach/dashboard`) was dropped during migration. AiSensy template has the button URL configured statically. If dynamic URL routing is needed later, `sendNotification` needs a `buttons` passthrough.

3. **`notify-assignment` auth** — This route uses bare `POST` handler without `withApiHandler`. No auth check. Pre-existing — not introduced by migration.

---

## DB State (post-migration)

| Metric | Count |
|--------|-------|
| Total templates | 64 |
| Active WA (`use_whatsapp=true AND is_active=true`) | 62 |
| With `cost_per_send` | 62 |
| With `wa_variables` schema | 62 |
| Inactive (cancel/noshow, `use_whatsapp=false`) | 2 |

---

## Verification (Phase 5 — 2026-04-19, updated after Phase 4 completion)

1. **`sendWhatsAppMessage` outside aisensy.ts:** 3 architectural defers (`backops/command`, `coach/tier-change`, `coach-engagement`) + 1 raw fetch bypass (`send-otp`) + 3 infrastructure = 7 total (expected)
2. **Raw `app.aisensy.com` fetch outside aisensy.ts:** 0
3. **tsc `error TS` outside tests:** 0
4. **DB schema completeness:** 62/62 active WA templates have cost + variable schema
5. **No regressions:** All 24 migrated files pass type check individually
6. **assessment/analyze + discovery-followup:** Confirmed removed from bypass list, now in migrated files
