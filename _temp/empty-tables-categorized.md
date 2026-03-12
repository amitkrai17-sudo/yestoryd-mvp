# Empty Tables — Categorized Analysis

Generated: 2026-03-05

---

## Category 1: OPERATIONAL (Keep — will populate naturally)

These tables have active code paths (inserts/reads) and are empty only because the relevant feature hasn't been triggered yet by real users.

| # | Table | Code Refs | Why It's Empty | Populates When... |
|---|-------|-----------|----------------|-------------------|
| 1 | `agreement_signing_log` | 1 | No coach has signed an agreement yet | Coach signs agreement |
| 2 | `enrollment_revenue` | 6 | No payments processed yet | Parent pays for enrollment |
| 3 | `interactions` | 2 | CRM not yet used | Admin logs CRM interaction |
| 4 | `coach_payouts` | 9 | No payouts due yet | First payout cycle runs |
| 5 | `child_skill_progress` | 1 | No sessions completed with skill tracking | Session completes with skill data |
| 6 | `tds_ledger` | 3 | No payouts processed yet | Payout with TDS deduction |
| 7 | `homework_assignments` | 1 | No sessions completed yet | Session completes |
| 8 | `coach_tier_changes` | 1 | No coach tier changes yet | Admin changes coach tier |
| 9 | `communication_queue` | 6 | Queue drains on processing | Discovery booked / session event |
| 10 | `admin_audit_log` | 1 | No admin shadow actions yet | Admin uses shadow feature |
| 11 | `completion_certificates` | 2 | No enrollments completed yet | Enrollment completes |
| 12 | `coupon_usages` | 3 | No coupons redeemed yet | Parent redeems coupon |
| 13 | `verification_tokens` | 2 | Tokens are deleted after use | OTP sent (ephemeral) |
| 14 | `launch_waitlist` | 1 | No waitlist entries yet | User joins waitlist |
| 15 | `messages` | 2 | No parent-coach messages yet | Parent or coach sends message |
| 16 | `structured_capture_responses` | 6 | No structured observations yet | Coach completes session capture |
| 17 | `child_daily_goals` | 6 | No elearning activity yet | Elearning cron generates goals |
| 18 | `lead_status_history` | 0* | Schema only — scaffolded for CRM v2 | *See note below |
| 19 | `group_class_certificates` | 2 | No group classes completed yet | Group class completes |
| 20 | `child_artifacts` | 4 | No artifacts uploaded yet | Parent uploads artifact |
| 21 | `referral_credit_transactions` | 2 | No referral payments yet | Referred parent pays |
| 22 | `coach_scores` | 1 | Monthly cron hasn't run yet | End of first month |
| 23 | `support_tickets` | 2 | No tickets filed yet | User submits support ticket |
| 24 | `nps_responses` | 3 | No NPS surveys completed yet | Parent submits NPS |
| 25 | `session_incidents` | 0* | Schema-defined for incident tracking | *See note below |
| 26 | `proactive_notifications` | 2 | rAI notifications not triggered yet | Session processing triggers notification |
| 27 | `processed_webhooks` | 2 | Tokens deleted/ephemeral | Webhook received (idempotency guard) |
| 28 | `group_class_waitlist` | 3 | No group class waitlist entries yet | Parent joins waitlist |
| 29 | `session_notes` | 1 | No notes written yet | Coach writes session notes |
| 30 | `recall_reconciliation_logs` | 1 | No Recall reconciliation runs yet | Reconciliation job runs |
| 31 | `el_game_sessions` | 3 | No elearning games played yet | Child plays elearning game |
| 32 | `session_holds` | 2 | Holds are ephemeral (expire quickly) | Parent starts booking flow |
| 33 | `payment_retry_tokens` | 2 | No failed payments yet | Payment fails |
| 34 | `el_child_badges` | 7 | No elearning badges earned yet | Child completes elearning activity |
| 35 | `season_roadmaps` | 7 | No season plans created yet | Enrollment creates season plan |
| 36 | `season_learning_plans` | 4 | No learning plans generated yet | Plan generation runs |
| 37 | `enrollment_terminations` | 3 | No refunds initiated yet | Parent requests refund |
| 38 | `micro_assessments` | 3 | No micro-assessments triggered yet | Assessment cron triggers |
| 39 | `referral_conversions` | 1 | No referral conversions yet | Referred parent converts |
| 40 | `rai_chat_feedback` | 1 | No chat feedback submitted yet | Parent thumbs-up/down chat |
| 41 | `quiz_attempts` | 1 | No quizzes attempted yet | Child submits quiz |
| 42 | `elearning_sessions` | 4 | Brand new table (created today) | Child starts elearning session |
| 43 | `parent_daily_tasks` | 6 | No practice tasks generated yet | Intelligence cron generates tasks |
| 44 | `el_child_identity` | 2 | No elearning identities created yet | Child enters elearning |
| 45 | `coach_specializations` | 2 | No specializations assigned yet | Admin assigns specialization |
| 46 | `el_child_video_progress` | 4 | No videos watched yet | Child watches elearning video |
| 47 | `failed_payments` | 3 | No failed payments yet | Payment webhook reports failure |
| 48 | `pending_assessments` | 3 | No failed assessments for retry | Assessment analysis fails |
| 49 | `re_enrollment_nudges` | 2 | No seasons completed yet | Season completes |
| 50 | `coach_reassignment_log` | 2 | No coach reassignments yet | Coach is reassigned |
| 51 | `scheduling_queue` | 2 | No manual scheduling items yet | Scheduling needs manual intervention |
| 52 | `session_change_requests` | 5 | No reschedule/cancel requests yet | Parent requests reschedule |

> *`lead_status_history` and `session_incidents`: Scaffolded in schema but no app code writes to them yet. Keeping because they're clearly part of planned features (CRM status tracking and incident reporting). If these features are abandoned, move to Category 3.

---

## Category 2: GENUINELY REDUNDANT (Recommend DROP)

These tables have a confirmed replacement that the codebase actively uses. The redundant table is either fully dead (0 code refs) or has minimal refs that should be migrated.

| # | DROP This Table | Rows | Replacement Table | Replacement Refs | Migration Needed? |
|---|----------------|------|-------------------|-----------------|-------------------|
| 1 | `termination_logs` | 0 | `enrollment_terminations` | 3 files | None — `termination_logs` has 0 code refs |
| 2 | `coach_earnings` | 0 | `coach_payouts` | 9 files | None — `coach_earnings` has 0 code refs |
| 3 | `book_reads` | 0 | `el_child_video_progress` | 4 files | None — `book_reads` has 0 code refs |
| 4 | `phone_backup_20260117` | 17 | `parents` (original) | — | None — date-suffixed backup, 0 code refs |
| 5 | `child_rag_profiles` | 0 | `child_intelligence_profiles` | 14 files | **Yes** — migrate `assessment/final/submit` write |
| 6 | `coupon_uses` | 0 | `coupon_usages` | 3 files | **Yes** — migrate `payment/create` write |

### Migration notes for #5 and #6:

**`child_rag_profiles` → `child_intelligence_profiles`:**
- `app/api/assessment/final/submit/route.ts` writes to `child_rag_profiles` (lines ~56, ~145)
- Needs to write to `child_intelligence_profiles` instead, or the write can be removed if the intelligence synthesis cron already handles profile creation from assessment data

**`coupon_uses` → `coupon_usages`:**
- `app/api/payment/create/route.ts` (lines ~245, ~780) checks and inserts into `coupon_uses`
- Needs to be changed to `coupon_usages` to match `coupons/validate/route.ts` and `admin/coupons/[id]/route.ts`
- **This is a split-brain bug** — the validate route checks `coupon_usages` but the payment route writes to `coupon_uses`, so per-user limits are enforced against different tables

---

## Category 3: UNCLEAR (Flag for review)

These tables have **zero code references** AND no obvious active role. They exist only in `database.types.ts` / migration files.

| # | Table | Seq Scans | Size | Possible Origin | Notes |
|---|-------|-----------|------|-----------------|-------|
| 1 | `book_requests` | 360 | 56 kB | Book recommendation feature? | 0 code refs, but 360 seq scans suggests something queries it (RLS policy? DB trigger? View?) |
| 2 | `reading_goals` | 280 | 32 kB | Reading goal tracking? | 0 code refs, but 280 seq scans — same mystery as above |
| 3 | `book_collection_items` | 70 | 32 kB | Book library feature? | 0 code refs |
| 4 | `communication_preferences` | 4 | 32 kB | Notification opt-in/out? | 0 code refs |
| 5 | `coach_assignment_status` | 63 | 40 kB | Coach assignment tracking? | 0 code refs, appears in a DROP migration |
| 6 | `parent_communications` | 800 | 32 kB | Parent notification log? | 0 code refs, 800 scans (!), appears in a DROP migration |
| 7 | `child_game_progress` | 47 | 32 kB | Elearning game tracking? | Only a stale comment; actual writes go to `el_game_sessions` |
| 8 | `cron_logs` | 52 | 24 kB | Cron execution logging? | 0 code refs |
| 9 | `video_watch_sessions` | 67 | 24 kB | Video consumption tracking? | 0 code refs, superseded by `el_child_video_progress`? |
| 10 | `coach_triggered_assessments` | 60 | 24 kB | Coach-initiated assessments? | 0 code refs |

### Investigation needed:

- **`book_requests` (360 scans)** and **`reading_goals` (280 scans)** and **`parent_communications` (800 scans)**: High seq scan counts despite zero app code. This could mean:
  - A database view or function queries them
  - An RLS policy references them
  - A trigger fires against them
  - The scans are from `pg_stat_user_tables` being stale (counts accumulate and don't reset)

  **Recommendation:** Before dropping, run `SELECT * FROM pg_stat_user_tables WHERE relname IN ('book_requests','reading_goals','parent_communications') AND last_seq_scan > NOW() - interval '7 days'` to check if scans are recent.

- **`coach_assignment_status`** and **`parent_communications`**: Both appear in `20260214_drop_deprecated_tables.sql` — they may already be dropped. Verify with `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('coach_assignment_status','parent_communications')`.

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| 1. OPERATIONAL (keep) | 52 | No action |
| 2. GENUINELY REDUNDANT (drop) | 6 | DROP after migrating 2 code refs |
| 3. UNCLEAR (review) | 10 | Investigate before deciding |
| **Total** | **68** | |
