# Supabase Schema Audit Report

Generated: 2026-03-05T16:25:37.495Z

Total tables: **151**
Tables in TypeScript types: **150**
Empty tables (0 rows): **68**

## 1. Deprecated / Backup Tables

| Table | Rows | Size | Recommendation |
|-------|------|------|----------------|
| `phone_backup_20260117` | 17 | 16 kB | DROP after verifying data is backed up |

## 2. Tables with Similar Names (Potential Duplicates)

| Table A | Rows | Table B | Rows | Match Type | Score |
|---------|------|---------|------|------------|-------|
| `el_child_unit_progress` | 1 | `el_child_video_progress` | 0 | word_overlap | 0.75 |
| `child_rag_profiles` | 0 | `child_intelligence_profiles` | 42 | word_overlap | 0.67 |
| `activity_log` | 1278 | `session_activity_log` | 6 | word_overlap | 0.67 |
| `wa_lead_messages` | 210 | `wa_lead_conversations` | 4 | word_overlap | 0.67 |
| `el_content_items` | 8 | `el_game_content` | 13 | word_overlap | 0.67 |
| `el_content_items` | 8 | `el_content_tags` | 10 | word_overlap | 0.67 |
| `el_content_items` | 8 | `el_unit_content` | 3 | word_overlap | 0.67 |
| `el_game_content` | 13 | `el_content_tags` | 10 | word_overlap | 0.67 |
| `el_game_content` | 13 | `el_unit_content` | 3 | word_overlap | 0.67 |
| `el_game_content` | 13 | `el_game_engines` | 5 | word_overlap | 0.67 |
| `el_game_content` | 13 | `el_game_sessions` | 0 | word_overlap | 0.67 |
| `coach_availability_slots` | 2 | `coach_availability` | 1 | word_overlap | 0.67 |
| `el_content_tags` | 10 | `el_unit_content` | 3 | word_overlap | 0.67 |
| `group_class_coupons` | 5 | `group_class_types` | 7 | word_overlap | 0.67 |
| `group_class_coupons` | 5 | `group_class_blueprints` | 2 | word_overlap | 0.67 |
| `group_class_coupons` | 5 | `group_class_certificates` | 0 | word_overlap | 0.67 |
| `group_class_coupons` | 5 | `group_class_waitlist` | 0 | word_overlap | 0.67 |
| `child_skill_progress` | 0 | `child_game_progress` | 0 | word_overlap | 0.67 |
| `group_class_types` | 7 | `group_class_blueprints` | 2 | word_overlap | 0.67 |
| `group_class_types` | 7 | `group_class_certificates` | 0 | word_overlap | 0.67 |
| `group_class_types` | 7 | `group_class_waitlist` | 0 | word_overlap | 0.67 |
| `group_class_blueprints` | 2 | `group_class_certificates` | 0 | word_overlap | 0.67 |
| `group_class_blueprints` | 2 | `group_class_waitlist` | 0 | word_overlap | 0.67 |
| `el_child_avatars` | 1 | `el_child_gamification` | 2 | word_overlap | 0.67 |
| `el_child_avatars` | 1 | `el_child_badges` | 0 | word_overlap | 0.67 |
| `el_child_avatars` | 1 | `el_child_identity` | 0 | word_overlap | 0.67 |
| `group_class_certificates` | 0 | `group_class_waitlist` | 0 | word_overlap | 0.67 |
| `el_game_engines` | 5 | `el_game_sessions` | 0 | word_overlap | 0.67 |
| `el_badges` | 12 | `el_child_badges` | 0 | word_overlap | 0.67 |
| `el_child_gamification` | 2 | `el_child_badges` | 0 | word_overlap | 0.67 |
| `el_child_gamification` | 2 | `el_child_identity` | 0 | word_overlap | 0.67 |
| `el_child_badges` | 0 | `el_child_identity` | 0 | word_overlap | 0.67 |

## 3. Empty Tables (0 Rows)

These tables have been created but never populated, or were emptied.

| Table | Size (incl index) | Seq Scans | Recommendation |
|-------|-------------------|-----------|----------------|
| `child_rag_profiles` | 1248 kB | 73 (Some queries) | KEEP — actively queried, may be populated soon |
| `agreement_signing_log` | 120 kB | 81 (Some queries) | KEEP — actively queried, may be populated soon |
| `enrollment_revenue` | 120 kB | 162 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `interactions` | 96 kB | 93 (Some queries) | KEEP — actively queried, may be populated soon |
| `coach_payouts` | 80 kB | 276 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `child_skill_progress` | 80 kB | 84 (Some queries) | KEEP — actively queried, may be populated soon |
| `tds_ledger` | 64 kB | 97 (Some queries) | KEEP — actively queried, may be populated soon |
| `book_reads` | 64 kB | 72 (Some queries) | KEEP — actively queried, may be populated soon |
| `homework_assignments` | 64 kB | 643 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `coach_tier_changes` | 64 kB | 71 (Some queries) | KEEP — actively queried, may be populated soon |
| `communication_queue` | 64 kB | 87 (Some queries) | KEEP — actively queried, may be populated soon |
| `admin_audit_log` | 56 kB | 36 (Some queries) | Review — possibly unused, candidate for DROP |
| `completion_certificates` | 56 kB | 60 (Some queries) | KEEP — actively queried, may be populated soon |
| `book_requests` | 56 kB | 360 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `coupon_uses` | 56 kB | 44 (Some queries) | Review — possibly unused, candidate for DROP |
| `verification_tokens` | 56 kB | 27 (Some queries) | Review — possibly unused, candidate for DROP |
| `launch_waitlist` | 56 kB | 6 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `messages` | 56 kB | 37 (Some queries) | Review — possibly unused, candidate for DROP |
| `structured_capture_responses` | 56 kB | 6 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `child_daily_goals` | 56 kB | 45 (Some queries) | Review — possibly unused, candidate for DROP |
| `lead_status_history` | 48 kB | 92 (Some queries) | KEEP — actively queried, may be populated soon |
| `group_class_certificates` | 48 kB | 71 (Some queries) | KEEP — actively queried, may be populated soon |
| `child_artifacts` | 48 kB | 5 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `referral_credit_transactions` | 48 kB | 143 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `coach_scores` | 48 kB | 91 (Some queries) | KEEP — actively queried, may be populated soon |
| `support_tickets` | 48 kB | 85 (Some queries) | KEEP — actively queried, may be populated soon |
| `nps_responses` | 48 kB | 123 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `session_incidents` | 40 kB | 248 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `proactive_notifications` | 40 kB | 108 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `processed_webhooks` | 40 kB | 42 (Some queries) | Review — possibly unused, candidate for DROP |
| `group_class_waitlist` | 40 kB | 91 (Some queries) | KEEP — actively queried, may be populated soon |
| `session_notes` | 40 kB | 96 (Some queries) | KEEP — actively queried, may be populated soon |
| `coupon_usages` | 40 kB | 155 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `recall_reconciliation_logs` | 40 kB | 4 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `el_game_sessions` | 40 kB | 52 (Some queries) | KEEP — actively queried, may be populated soon |
| `session_holds` | 40 kB | 60 (Some queries) | KEEP — actively queried, may be populated soon |
| `coach_assignment_status` | 40 kB | 63 (Some queries) | KEEP — actively queried, may be populated soon |
| `communication_preferences` | 32 kB | 4 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `payment_retry_tokens` | 32 kB | 3 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `el_child_badges` | 32 kB | 51 (Some queries) | KEEP — actively queried, may be populated soon |
| `season_roadmaps` | 32 kB | 4 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `season_learning_plans` | 32 kB | 4 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `reading_goals` | 32 kB | 280 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `book_collection_items` | 32 kB | 70 (Some queries) | KEEP — actively queried, may be populated soon |
| `enrollment_terminations` | 32 kB | 3 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `referral_visits` | 32 kB | 243 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `micro_assessments` | 32 kB | 3 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `parent_communications` | 32 kB | 800 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `referral_conversions` | 32 kB | 3 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `rai_chat_feedback` | 32 kB | 3 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `quiz_attempts` | 32 kB | 96 (Some queries) | KEEP — actively queried, may be populated soon |
| `elearning_sessions` | 32 kB | 3 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `termination_logs` | 32 kB | 295 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `parent_daily_tasks` | 32 kB | 4 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `child_game_progress` | 32 kB | 47 (Some queries) | Review — possibly unused, candidate for DROP |
| `el_child_identity` | 24 kB | 50 (Some queries) | Review — possibly unused, candidate for DROP |
| `cron_logs` | 24 kB | 52 (Some queries) | KEEP — actively queried, may be populated soon |
| `coach_specializations` | 24 kB | 2 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `el_child_video_progress` | 24 kB | 52 (Some queries) | KEEP — actively queried, may be populated soon |
| `failed_payments` | 24 kB | 16 (Some queries) | Review — possibly unused, candidate for DROP |
| `pending_assessments` | 24 kB | 2 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `re_enrollment_nudges` | 24 kB | 3 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `video_watch_sessions` | 24 kB | 67 (Some queries) | KEEP — actively queried, may be populated soon |
| `coach_triggered_assessments` | 24 kB | 60 (Some queries) | KEEP — actively queried, may be populated soon |
| `coach_reassignment_log` | 24 kB | 2 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `scheduling_queue` | 24 kB | 3 (Rarely queried) | Review — possibly unused, candidate for DROP |
| `coach_earnings` | 16 kB | 265 (Actively queried despite empty) | KEEP — actively queried, may be populated soon |
| `session_change_requests` | 16 kB | 19 (Some queries) | Review — possibly unused, candidate for DROP |

## 4. Tables Missing from TypeScript Types

These tables exist in the DB but are NOT in `lib/database.types.ts`.
They cannot be used with typed Supabase client queries.

| Table | Rows | Size | Notes |
|-------|------|------|-------|
| `skill_categories` | 10 | 80 kB | 10 rows — needs types |

## 5. Semantic Grouping — Potential Overlaps

### `el_child_*` (6 tables)
| Table | Rows | Size |
|-------|------|------|
| `el_child_unit_progress` | 1 | 80 kB |
| `el_child_avatars` | 1 | 48 kB |
| `el_child_gamification` | 2 | 40 kB |
| `el_child_badges` | 0 | 32 kB |
| `el_child_identity` | 0 | 24 kB |
| `el_child_video_progress` | 0 | 24 kB |

### `group_class_*` (5 tables)
| Table | Rows | Size |
|-------|------|------|
| `group_class_coupons` | 5 | 80 kB |
| `group_class_types` | 7 | 80 kB |
| `group_class_blueprints` | 2 | 80 kB |
| `group_class_certificates` | 0 | 48 kB |
| `group_class_waitlist` | 0 | 40 kB |

### `el_game_*` (3 tables)
| Table | Rows | Size |
|-------|------|------|
| `el_game_content` | 13 | 96 kB |
| `el_game_engines` | 5 | 48 kB |
| `el_game_sessions` | 0 | 40 kB |

## 6. Confirmed Duplicates & Overlapping Schemas

Manual analysis of similar-named tables:

- **`coupon_uses`** (0 rows) vs **`coupon_usages`** (0 rows): Both track coupon usage. Likely one is deprecated.
- **`coach_availability`** (1 rows) vs **`coach_availability_slots`** (2 rows): Both store coach availability. `coach_availability_slots` may be the v2.
- **`coach_schedule_rules`** (12 rows) vs **`system_schedule_defaults`** (7 rows): Both define scheduling rules. May overlap in purpose.
- **`session_notes`** (0 rows) vs **`session_activity_log`** (6 rows): Both store session-level coach notes. Different granularity.
- **`book_reads`** (0 rows) vs **`video_watch_sessions`** (0 rows): Both track content consumption. Different content types (OK).
- **`termination_logs`** (0 rows) vs **`enrollment_terminations`** (0 rows): Both track enrollment terminations. Likely overlap.
- **`reading_skills`** (17 rows) vs **`el_skills`** (79 rows): Both define skills. `reading_skills` may be legacy, `el_skills` is the elearning system.
- **`reading_skills`** (17 rows) vs **`skill_tags_master`** (27 rows): `reading_skills` vs `skill_tags_master` — both define skill taxonomies.
- **`reading_skills`** (17 rows) vs **`skill_categories`** (10 rows): `reading_skills` (17 rows) may overlap with `skill_categories` (10 rows) — different taxonomy levels.
- **`communication_logs`** (22 rows) vs **`communication_analytics`** (1 rows): Both track communication. logs=delivery, analytics=engagement.
- **`communication_queue`** (0 rows) vs **`communication_logs`** (22 rows): Queue (pending) vs logs (sent). Complementary if used correctly.
- **`parent_communications`** (0 rows) vs **`communication_logs`** (22 rows): `parent_communications` (0 rows, 800 scans) vs `communication_logs` (22 rows). May be redundant.
- **`child_rag_profiles`** (0 rows) vs **`child_intelligence_profiles`** (42 rows): Both store child AI profiles. `child_rag_profiles` (0 rows) may be deprecated in favor of `child_intelligence_profiles` (42 rows).
- **`coach_scores`** (0 rows) vs **`coach_payouts`** (0 rows): Both empty. `coach_scores` may be unused. `coach_payouts` likely pending first payout cycle.
- **`coach_earnings`** (0 rows) vs **`coach_payouts`** (0 rows): Both empty. `coach_earnings` is likely a view or deprecated.

## 7. Recommended Actions

### High Priority (Clear cleanup)

| Action | Table | Reason |
|--------|-------|--------|
| **DROP** | `phone_backup_20260117` | Date-suffixed backup table, 17 rows |
| **MERGE or DROP** | `coupon_uses` + `coupon_usages` | Both empty, duplicate purpose |
| **DROP** | `child_rag_profiles` | 0 rows, 1.2MB index. Superseded by `child_intelligence_profiles` |
| **DROP** | `termination_logs` | 0 rows, 295 scans. Overlaps with `enrollment_terminations` |
| **REVIEW** | `reading_skills` | 17 rows. May overlap with `el_skills` (79 rows) + `skill_categories` (10 rows) |
| **REVIEW** | `parent_communications` | 0 rows, 800 scans. May be superseded by `communication_logs` |

### Medium Priority (Review before acting)

| Action | Table | Reason |
|--------|-------|--------|
| REVIEW | `admin_audit_log` | 0 rows, 36 scans, 56 kB |
| REVIEW | `verification_tokens` | 0 rows, 27 scans, 56 kB |
| REVIEW | `launch_waitlist` | 0 rows, 6 scans, 56 kB |
| REVIEW | `messages` | 0 rows, 37 scans, 56 kB |
| REVIEW | `structured_capture_responses` | 0 rows, 6 scans, 56 kB |
| REVIEW | `child_daily_goals` | 0 rows, 45 scans, 56 kB |
| REVIEW | `child_artifacts` | 0 rows, 5 scans, 48 kB |
| REVIEW | `processed_webhooks` | 0 rows, 42 scans, 40 kB |
| REVIEW | `recall_reconciliation_logs` | 0 rows, 4 scans, 40 kB |
| REVIEW | `communication_preferences` | 0 rows, 4 scans, 32 kB |
| REVIEW | `payment_retry_tokens` | 0 rows, 3 scans, 32 kB |
| REVIEW | `season_roadmaps` | 0 rows, 4 scans, 32 kB |
| REVIEW | `season_learning_plans` | 0 rows, 4 scans, 32 kB |
| REVIEW | `enrollment_terminations` | 0 rows, 3 scans, 32 kB |
| REVIEW | `micro_assessments` | 0 rows, 3 scans, 32 kB |
| REVIEW | `referral_conversions` | 0 rows, 3 scans, 32 kB |
| REVIEW | `rai_chat_feedback` | 0 rows, 3 scans, 32 kB |
| REVIEW | `elearning_sessions` | 0 rows, 3 scans, 32 kB |
| REVIEW | `parent_daily_tasks` | 0 rows, 4 scans, 32 kB |
| REVIEW | `child_game_progress` | 0 rows, 47 scans, 32 kB |
| REVIEW | `coach_specializations` | 0 rows, 2 scans, 24 kB |
| REVIEW | `failed_payments` | 0 rows, 16 scans, 24 kB |
| REVIEW | `pending_assessments` | 0 rows, 2 scans, 24 kB |
| REVIEW | `re_enrollment_nudges` | 0 rows, 3 scans, 24 kB |
| REVIEW | `coach_reassignment_log` | 0 rows, 2 scans, 24 kB |
| REVIEW | `scheduling_queue` | 0 rows, 3 scans, 24 kB |
| REVIEW | `session_change_requests` | 0 rows, 19 scans, 16 kB |

### Low Priority (Keep — actively used or expected)

30 tables are actively used (>0 rows, >100 seq scans). No action needed.

### TypeScript Types Regeneration

Run `npx supabase gen types typescript --linked > lib/database.types.ts` after applying all pending migrations to:
- Add `skill_categories` table types
- Add any other new tables from recent migrations