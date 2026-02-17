# Duplicate Tables Codebase Audit

**Date:** 2026-02-14
**Auditor:** Claude Code
**Method:** Full codebase grep across .ts, .tsx, .sql files (excluding node_modules, .next)

---

## 1. `elearning_game_engines` vs `el_game_engines`

### `elearning_game_engines` — CANDIDATE FOR DROP

| Location | File | Type |
|----------|------|------|
| Migration SQL | `migrations/001_elearning_units_schema.sql:97` | CREATE TABLE definition |
| Migration SQL | `migrations/001_elearning_units_schema.sql:133` | INSERT seed data |
| Migration SQL | `migrations/001_elearning_units_schema.sql:805` | RAISE NOTICE |
| Type file | `types/supabase.ts:5786` | Type definition |
| Type file | `lib/supabase/database.types.ts:6425` | Type definition |

**Active code references: 0**

### `el_game_engines` — KEEPER

| Location | File | Type |
|----------|------|------|
| Active code | `lib/gamification.ts:624` | `.select('game_engine_id, el_game_engines(slug)')` |
| Active code | `lib/gamification.ts:632` | Result access `el_game_engines?.slug` |
| Active code | `app/api/elearning/dashboard/route.ts:147` | `engine:el_game_engines(*)` |
| Active code | `app/api/elearning/games/[gameId]/route.ts:34` | `engine:el_game_engines(*)` |
| Type file | `types/supabase.ts:5196,5208,5365` | FK refs + type definition |
| Type file | `lib/supabase/database.types.ts:5811,5823,5973` | FK refs + type definition |

**Active code references: 4 (across 3 files)**

### VERDICT
- **KEEP:** `el_game_engines` — actively used in gamification and e-learning routes
- **DROP:** `elearning_game_engines` — zero application code references, only in old migration + types

---

## 2. `communication_log` (singular) vs `communication_logs` (plural)

### `communication_log` (singular) — CANDIDATE FOR DROP

| Location | File | Type |
|----------|------|------|
| Type file | `types/supabase.ts:3640` | Type definition |
| Type file | `types/supabase.ts:3712` | FK name reference |
| Type file | `types/supabase.ts:3837` | Referenced relation |
| Type file | `lib/supabase/database.types.ts:4179` | Type definition |
| Type file | `lib/supabase/database.types.ts:4251` | FK name reference |
| Type file | `lib/supabase/database.types.ts:4421` | Referenced relation |

**Active code references: 0** (type definitions only)

### `communication_logs` (plural) — KEEPER

| Location | File | Type |
|----------|------|------|
| Active code | `app/api/webhooks/whatsapp-cloud/route.ts:252,284` | INSERT operations |
| Active code | `app/api/leads/hot-alert/route.ts:199` | INSERT |
| Active code | `app/api/certificate/send/route.ts:594` | INSERT |
| Active code | `app/api/communication/send/route.ts:163` | SELECT |
| Active code | `app/api/coach/notify-assignment/route.ts:245` | INSERT |
| Active code | `app/api/coach/sessions/[id]/parent-update/route.ts:63` | INSERT |
| Active code | `app/api/cron/daily-lead-digest/route.ts:251` | INSERT |
| Active code | `app/api/cron/re-enrollment-nudge/route.ts:158` | SELECT |
| Active code | `lib/communication/index.ts:270` | INSERT |
| Active code | `lib/notifications/admin-alerts.ts:158,254,370,396,417` | INSERT + logging |
| Type file | `lib/supabase/database.types.ts:4259` | Type definition |

**Active code references: 15+ (across 10 files)**

### VERDICT
- **KEEP:** `communication_logs` (plural) — heavily used across communication, notifications, webhooks
- **DROP:** `communication_log` (singular) — zero application code references, only in type definitions

---

## 3. Suspicious Tables Audit

| # | Table Name | Active Code Refs | Type-Only Refs | Active Files | VERDICT |
|---|-----------|-----------------|----------------|-------------|---------|
| 1 | `communication_analytics` | 1 | 2 | `app/admin/communication/page.tsx:40` | ACTIVE (low usage) |
| 2 | `communication_preferences` | 0 | 1 | — | DEAD / PLACEHOLDER |
| 3 | `parent_communications` | 0 | 19 | — | DEAD / PLACEHOLDER |
| 4 | `communication_queue` | 6 | 8 | `lib/communication/index.ts`, `app/api/webhooks/recall/route.ts`, `app/api/discovery/book/route.ts`, `app/api/jobs/recall-reconciliation/route.ts`, `app/api/jobs/process-session/route.ts` | ACTIVE |
| 5 | `scheduling_queue` | 4 | 17 | `lib/scheduling/manual-queue.ts`, `app/api/admin/scheduling/queue/route.ts` | ACTIVE |
| 6 | `session_holds` | 10 | 16 | `app/api/scheduling/hold/route.ts`, `app/api/scheduling/slots/route.ts` | ACTIVE |
| 7 | `coach_groups` | 7 | 13 | `app/admin/coach-groups/page.tsx`, `components/coach/CoachTierCard.tsx`, `app/api/payment/verify/route.ts` | ACTIVE |
| 8 | `coach_assignment_status` | 0 | 9 | — | DEAD / PLACEHOLDER |
| 9 | `group_sessions` | 18 | 50 | 8 API route files under `app/api/group-classes/` and `app/api/admin/group-classes/` | HEAVILY USED |
| 10 | `group_class_types` | 8 | 7 | 6 API route files under group-classes | ACTIVE |
| 11 | `group_session_participants` | 7 | 29 | 5 API route files under group-classes | ACTIVE |

### Suspicious Tables Detail

**DEAD / PLACEHOLDER tables (0 active code refs):**
- `communication_preferences` — Only in database.types.ts. No queries anywhere. Likely placeholder for future feature.
- `parent_communications` — Only in type files (supabase.ts + database.types.ts). No queries. Schema defined but never used.
- `coach_assignment_status` — Only in type files. No queries. Likely replaced by direct status field on coaches/enrollments.

**These tables should NOT be dropped yet** — they may be planned for future features. Mark as NEEDS INVESTIGATION.

---

## Summary

| Action | Table | Reason |
|--------|-------|--------|
| DROP | `elearning_game_engines` | 0 code refs, superseded by `el_game_engines` |
| DROP | `communication_log` | 0 code refs, superseded by `communication_logs` |
| KEEP | `el_game_engines` | 4 active refs across 3 files |
| KEEP | `communication_logs` | 15+ active refs across 10 files |
| INVESTIGATE | `communication_preferences` | 0 code refs, possibly planned |
| INVESTIGATE | `parent_communications` | 0 code refs, possibly planned |
| INVESTIGATE | `coach_assignment_status` | 0 code refs, possibly planned |
| KEEP | All other suspicious tables | Active code references confirmed |
