# Deprecated Tables Codebase Audit

**Date:** 2026-02-14
**Auditor:** Claude Code
**Method:** Full codebase grep across .ts, .tsx, .js, .jsx, .sql, .md files (excluding node_modules, .next)

---

## Summary

- **13 deprecated tables found** in `lib/supabase/database.types.ts`
- **0 application code references** to any `_deprecated_*` table
- **All 13 are SAFE TO DROP** from codebase perspective

---

## Deprecated Tables Found in database.types.ts

| # | Table Name | Line in database.types.ts | App Code Refs | Type File Refs | Migration Refs | Doc Refs | VERDICT |
|---|-----------|--------------------------|--------------|----------------|----------------|----------|---------|
| 1 | `_deprecated_child_badges` | L17 | NONE | YES | YES | YES | SAFE TO DROP |
| 2 | `_deprecated_child_gamification` | L66 | NONE | YES | YES | YES | SAFE TO DROP |
| 3 | `_deprecated_child_unit_progress` | L161 | NONE | YES | YES | NO | SAFE TO DROP |
| 4 | `_deprecated_child_video_progress` | L249 | NONE | YES | YES | NO | SAFE TO DROP |
| 5 | `_deprecated_elearning_content_pools` | L341 | NONE | YES | YES | YES | SAFE TO DROP |
| 6 | `_deprecated_elearning_quizzes` | L400 | NONE | YES | YES | NO | SAFE TO DROP |
| 7 | `_deprecated_elearning_skills` | L441 | NONE | YES | YES | YES | SAFE TO DROP |
| 8 | `_deprecated_elearning_sub_skills` | L486 | NONE | YES | YES | YES | SAFE TO DROP |
| 9 | `_deprecated_elearning_units` | L530 | NONE | YES | YES | YES | SAFE TO DROP |
| 10 | `_deprecated_learning_games` | L628 | NONE | YES | YES | YES | SAFE TO DROP |
| 11 | `_deprecated_learning_levels` | L717 | NONE | YES | YES | YES | SAFE TO DROP |
| 12 | `_deprecated_learning_modules` | L765 | NONE | YES | YES | YES | SAFE TO DROP |
| 13 | `_deprecated_learning_videos` | L834 | NONE | YES | YES | YES | SAFE TO DROP |

---

## Base Name Cross-Reference

Checked if any application code references the ORIGINAL table names (without `_deprecated_` prefix). This catches code that might break if the deprecated table is actually being used under its old name.

| Base Table Name | Active Code Refs | Notes |
|----------------|-----------------|-------|
| `learning_videos` | NONE | Safe — consolidated into new e-learning system |
| `learning_modules` | NONE | Safe — consolidated into new e-learning system |
| `learning_levels` | NONE | Safe — consolidated into new e-learning system |
| `learning_games` | NONE | Safe — consolidated into new e-learning system |
| `elearning_units` | NONE | Safe — active code uses `el_units` |
| `elearning_skills` | NONE | Safe — active code uses `el_skills` |
| `elearning_sub_skills` | NONE | Safe — active code uses `el_sub_skills` |
| `elearning_content_pools` | NONE | Safe — active code uses `el_content_pools` |
| `elearning_quizzes` | NONE | Safe — active code uses `el_quizzes` |
| `elearning_leaderboard` | NONE | Zero matches anywhere |
| `elearning_progress` | NONE | Zero matches anywhere |
| `child_badges` | 7 files | Active table exists (NOT deprecated) — code uses current `child_badges` table |
| `child_gamification` | 12 files | Active table exists (NOT deprecated) — code uses current `child_gamification` table |
| `child_unit_progress` | 8 files | Active table exists (NOT deprecated) — code uses current `child_unit_progress` table |
| `child_video_progress` | 6 files | Active table exists (NOT deprecated) — code uses current `child_video_progress` table |

**Note:** `child_badges`, `child_gamification`, `child_unit_progress`, and `child_video_progress` have BOTH a current active table AND a `_deprecated_*` version. The active code references the current (non-deprecated) tables. The deprecated copies are safe to drop.

---

## Where References Exist (Non-Application Code)

### Type Definition Files
- `lib/supabase/database.types.ts` — Contains table definitions and FK references for all 13 tables
- `types/supabase.ts` — Older type file, also contains definitions

### Migration SQL
- `supabase/migrations/20260211_elearning_consolidation.sql` — The migration that renamed tables to `_deprecated_*`

### Documentation
- `docs/CURRENT-STATE.md` — Mentions deprecated tables exist
- `docs/session1-consolidation-report.md` — Documents the rename operation

---

## Final Verdict

**ALL 13 DEPRECATED TABLES ARE SAFE TO DROP** from codebase perspective:
- Zero application code references
- Only exist in type definitions (which will be regenerated after drop)
- Only exist in migration history (read-only) and docs (informational)
- Base names are either unused OR reference currently-active non-deprecated tables
