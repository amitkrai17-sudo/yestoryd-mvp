# Destructive Operation Discipline (read-on-demand)

Extracted from CLAUDE.md on 2026-05-29. This is the authoritative source for destructive DB ops. CLAUDE.md links here.

---

## Destructive Operation Discipline (ENFORCE ALWAYS)

The recovery layer (nightly pg_dump → engage@yestoryd.com Drive, verified restore via `pgvector/pgvector:pg17` + `vault.secrets` stub) earns us a 24-hour RPO worst case. This section is the *prevention* layer. PocketOS-shaped accidents — an agent or a typo wiping production in one tool call — are stopped here, before the recovery net is even tested.

These rules apply to **anyone with write access to the database**: Claude (this assistant), Claude Code, OpenClaw, future agents, and Amit at 2 AM. The friction is the point.

### What counts as destructive

A destructive operation is any one of:

1. **Schema-destructive DDL** — `DROP TABLE`, `DROP COLUMN`, `DROP INDEX`, `ALTER TABLE … DROP CONSTRAINT`, `TRUNCATE`. Includes `IF EXISTS` variants, which silently no-op on the wrong name and look successful.
2. **Bulk DML** — any `DELETE` or `UPDATE` whose WHERE clause does not pin to a single primary key (`.eq('id', X)` or `.match({ id: X })`). Filters that look bulk: `.in()`, `.lt()`, `.gt()`, `.is()`, `.neq()`, `.like()`, multi-column composites.
3. **Mutation on a Tier-1 protected table** — even single-row, including INSERT and UPDATE. See the tier table below.
4. **Migration application** — running `apply_migration` via Supabase MCP, or pushing a migration file via Supabase CLI. Migration discipline (Rule 7) addresses *how* migrations are written, not whether they should be applied right now against production.
5. **Service-account credential rotation** — DB passwords, Supabase API keys, Resend keys, AiSensy keys, OPENCLAW_GATEWAY_TOKEN, RAZORPAY keys.
6. **Backup pipeline modification** — anything under `/opt/yestoryd-backups/` on the OpenClaw droplet, or the cron entry that runs it.

### Protected tables — by blast radius

**Tier 1 — Hard stop for ANY mutation, including single-row INSERT/UPDATE/DELETE**

Touching one wrong row in these tables wipes large CASCADE descendants or breaks customer identity. `children` alone has 26 CASCADE descendants — one bad delete erases an entire learner's history.

- `children` — 26 CASCADE refs (artifacts, intelligence profiles, learning events, sessions, notes, communications, homework, messages, interactions, goals)
- `enrollments` — 5 CASCADE refs (events, revenue, change requests, onboarding, ledger)
- `parents` — CASCADE → children → 26 more

**Tier 2 — Hard stop for bulk; single-row by-ID is free pass**

- `learning_events` — rAI intelligence with 768-dim embeddings; irrecoverable in real time even from backup
- `payments` — financial record-of-truth (Razorpay reconciliation depends on this)
- `scheduled_sessions` — 5 CASCADE refs (per-session captures, notes, activity log)
- `coaches` — small but load-bearing; FK target of 52 tables

**Tier 3 — Hard stop because every row is load-bearing config**

These tables have small row counts but every individual row breaks something concrete if lost.

- `pricing_plans` (≈4 rows; one wrong row breaks billing)
- `coach_groups` (≈5 rows; drives payout calculations)
- `site_settings` (≈269 rows; single source of truth for prices, contact info, thresholds — losing one row reverts to hardcoded fallback or crashes loaders)
- `communication_templates` (≈70 rows; losing one silently breaks a send path)

**Explicitly NOT protected — cleanup allowed without confirmation**

- `activity_log` — append-only audit, OK to truncate if it grows out of hand
- `session_holds` — ephemeral by design (TTL purge is the wa-lead-cleanup pattern)
- Any `_deprecated_*` table — already on a cleanup path
- Any `*_archive`, `*_test_*`, `phone_backup_20260117`-style snapshot tables

### The protocol — three tiers of friction

**🟢 Free pass — just do it, mention what you did**

- `SELECT`, `EXPLAIN`, `\d`, schema introspection
- File reads, log fetches, Sentry queries
- Single-row `INSERT` / `UPDATE` / `DELETE` on a non-protected table with `.eq('id', X)`
- Adding new columns / indexes (additive DDL only)

**🟡 Show & confirm — paste the exact statement, ask "proceed?", wait for yes/no**

- Bulk `INSERT` (>100 rows)
- Single-row mutations on Tier-2 / Tier-3 protected tables
- Schema changes via migration files (writing the file is free; *applying* it is yellow)
- Code changes that touch >5 files
- Vercel production deploys

**🔴 Hard stop — require Amit to type `PROCEED-DESTRUCTIVE` verbatim before executing**

- Anything matching the "What counts as destructive" list above
- Any mutation on a Tier-1 protected table (children, enrollments, parents)
- Bulk `DELETE` / `UPDATE` (any WHERE that isn't single-PK)
- `DROP` / `TRUNCATE` of any kind, including `IF EXISTS` variants
- Migration application against production
- Credential rotation
- Backup pipeline modification

### How a hard-stop confirmation looks

When an agent (or Amit, when scripting) is about to run a 🔴 operation, the protocol is:

1. **Print the exact operation** — full SQL, full filter chain, target table name. No paraphrasing. If it's a `.delete()`, write out what it'd be in raw SQL.
2. **State the blast radius** — "this will affect approximately N rows in `<table>`, and CASCADE delete from `<descendant tables>`."
3. **State the rollback plan** — "if this is wrong, recovery requires restoring from `/opt/yestoryd-backups/dumps/<latest>` per RESTORE-RUNBOOK.md, RPO ≈ N hours."
4. **Require literal `PROCEED-DESTRUCTIVE` in the next user message.** No variants, no shortcuts. "PROCEED" alone is not enough. "yes" is not enough. Typing `PROCEED-DESTRUCTIVE` is the proof of intent.
5. **Log to `activity_log` BEFORE executing** with `event_type='destructive_op_authorized'` and metadata containing the operation, target, authorizing user, and timestamp.
6. **Execute. Report what happened. Do NOT chain another destructive op without a fresh authorization** — one PROCEED-DESTRUCTIVE authorizes one operation.

### Two specific anti-patterns to refuse

These come from the Phase 2 audit and represent the most likely real failure modes:

**A. The widening filter**
A `.delete()` whose filter chain *looks* scoped but isn't pinned to a primary key. Example: `.delete().eq('coach_id', X)` instead of `.delete().eq('id', sessionId)`. If you're about to write a `.delete()` whose WHERE is anything other than `id=X` or composite-PK, treat it as 🔴.

Existing legitimate cases (from audit): `app/api/cron/wa-lead-cleanup/route.ts`, `app/api/admin/coaches/[id]/specializations/route.ts`. New ones need explicit justification in the commit message.

**B. The `IF EXISTS` typo**
Migrations using `DROP TABLE IF EXISTS <name>` will silently no-op on the wrong name — looks successful, did nothing. Two real precedents in repo: `20260214_drop_deprecated_tables.sql`, `20260306_drop_redundant_tables.sql`. Future migrations dropping tables must:
- List exact table names in a comment block at the top of the migration
- Pair every `DROP` with a corresponding restore in the `.down.sql` (e.g. `CREATE TABLE … (LIKE original_table INCLUDING ALL)`)
- Be applied with explicit `PROCEED-DESTRUCTIVE` per the protocol — *migration discipline (Rule 7) writes the file, this rule applies it*

### Closing the inline-createClient surface (debt D2 — relevant here)

8 production routes call `createClient(URL, SERVICE_ROLE_KEY)` inline instead of using `createAdminClient()` from `lib/supabase/admin.ts`. Each inline call is a place where a future `.delete()` or `.update()` will succeed against any row regardless of RLS — i.e., where this whole protocol can be bypassed by accident. Migration target: collapse all 8 to the canonical helper so the destructive-op surface is auditable in one file.

This is debt, not a tonight-fix. Logged here so it doesn't get forgotten when Phase 2 is referenced.

### What this rule does NOT cover (yet)

- **Vercel production deploys** — currently in 🟡 (show & confirm). Promote to 🔴 in Phase 2B if a deploy ever causes an outage.
- **Bulk Gmail / WhatsApp sends** — Pillar 2B validator + daily cap inside `notify.ts` already provide one layer; Phase 2C will add a second.
- **Killing the OpenClaw gateway service** — recoverable in 5 sec via `Restart=always` in the systemd unit, no need to gate.
- **`npm install -g openclaw@latest`** — non-destructive; rollback is `npm install -g openclaw@<previous>` and we keep the prior version pinned in `OPENCLAW_SERVICE_VERSION`.

### Why this section exists

On 2026-05-01 the disk on the OpenClaw droplet hit 100%, OpenClaw was actively spinning a `setTimeout` overflow loop, and the platform had zero external backups. We spent four hours building Phase 1 (recovery layer): nightly pg_dump → engage@yestoryd.com Drive, Healthchecks-monitored, restore-tested with verified row counts.

Phase 1 is the safety net for accidents that already happened. **This section is the bumper rails to make those accidents harder.** Recovery is expensive (hours of restore + reconciliation against Razorpay/Gmail/WhatsApp logs); a `PROCEED-DESTRUCTIVE` typing exercise is cheap.

The PocketOS incident (Jul 2026) — Cursor running Claude Opus 4.6 deleted Railway production database in 9 seconds — is the mental model. The fix isn't "trust the agent more"; it's "make the destructive path require a deliberate human-in-the-loop step that survives fatigue."
