# Known Issues (read-on-demand)

Extracted from CLAUDE.md on 2026-05-29. Drift-prone — update when fixed.

---

## Known Issues (DO NOT ASSUME CANONICAL)

- **Session type label mismatch** — `SESSION_TYPE_LABELS['parent_checkin']` in `lib/utils/session-labels.ts` returns `'Check-in (Legacy)'`, but `app/api/jobs/enrollment-complete/route.ts:988` emits `'Parent Check-in'` for the same session type. Needs alignment — do not reference either as canonical until resolved.
- **Known N+1** — `app/api/cron/group-class-feedback-request/route.ts` and `app/api/cron/group-class-notifications/route.ts` do per-row parent / child / `learning_events` lookups inside loops. Batch-query refactor needed before scale.
