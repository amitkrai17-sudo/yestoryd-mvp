# scheduled_sessions status SSOT — guard & soak

Two layers protect the single-source-of-truth invariant that
`transitionSessionStatus` (`lib/scheduling/transition-session-status.ts`) is the
SOLE writer of `scheduled_sessions.status`:

1. **Grep layer (CI / build):** `scripts/check-status-ssot.mjs` — fails the build
   if an inline object writes `scheduled_sessions.status` outside the sole writer
   and the documented allowlist (births, reschedule owner, recall webhook).
2. **DB-trigger layer (prod):** a Postgres trigger logs every guarded MUTATE into
   the `ssot_violations` table. Currently observe-only (`RAISE WARNING`), not a
   hard block. Repo parity migrations live in `supabase/migrations/` (the guard
   was applied via MCP on 2026-06-19).

## SOAK (Phase V→VI)

`ssot_violations` logs *every* guarded MUTATE, including the sanctioned owner
writes — it is a census, not an alarm by itself. Analysis = recognize owner
**shapes**: `status + completed_at + disposition` together ⇒ `transitionSessionStatus`;
a **bare `status`** flip with no companions ⇒ a bypass. A quiet log post-funnel
(only owner-shaped rows) = no live bypass. Keep the trigger at `RAISE WARNING`
(observe-only) through the soak. Promote to **hard-block** in Phase VI via a GUC
marker (e.g. `SET LOCAL app.ssot_owner='transition'` inside the owner, trigger
blocks writes lacking it) once all owners are RPC/txn-wrapped.

## Observability note (A2)

`RAISE WARNING` from the trigger does NOT reach Sentry/Vercel — `supabase-js`
(PostgREST/HTTP) only surfaces `RAISE EXCEPTION`; warnings land only in Supabase's
own Postgres logs. The durable, queryable signal is the `ssot_violations` table.
Planned alarm path: the existing `daily-health-check` cron queries
`ssot_violations` for bypass-shaped rows in the last 24h and surfaces the count in
the admin health WhatsApp + a `Sentry.captureMessage` when `> 0`. (Not yet wired.)

**TODO (A2 soak companion):** wire `daily-health-check` cron to count bypass-shaped
`ssot_violations` rows in last 24h → `Sentry.captureMessage` + admin health WhatsApp
when `>0`. Activate at soak start (post-push). `RAISE WARNING` alone does NOT reach
Sentry (PostgREST swallows it); the table is the durable alarm.
