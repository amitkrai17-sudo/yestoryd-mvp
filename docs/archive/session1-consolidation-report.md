# E-Learning Schema Consolidation Report

**Date:** 2026-02-11
**Status:** Complete (pending migration execution)

---

## Summary

Consolidated three parallel e-learning schemas onto canonical `el_*` tables:

| System | Tables | Status |
|--------|--------|--------|
| System 1 (`el_*`) | Canonical tables | **Extended** with new columns |
| System 2 (`elearning_*`) | elearning_units, elearning_skills, etc. | **Deprecated** (renamed `_deprecated_*`) |
| System 3 (`learning_*`/`child_*`) | learning_videos, child_gamification, etc. | **Deprecated** (renamed `_deprecated_*`) |

---

## Migration File

`supabase/migrations/20260211_elearning_consolidation.sql`

### Schema Changes

| Table | Change | Columns Added |
|-------|--------|---------------|
| `el_learning_units` | Extended | slug, sequence, sub_skill_tag, status, min_age, max_age, level, icon_emoji, color_hex, thumbnail_url, tags, display_order, activity_count, is_featured, published_at, is_mini_challenge, goal_area, video_url, coach_guidance, parent_instruction, content_code, arc_stage, quest_title, estimated_minutes, difficulty |
| `el_videos` | Extended | has_quiz, key_concepts, status, is_free, slug, approved_at, approved_by, video_source, video_id, video_url, display_order, is_active, module_id |
| `el_child_video_progress` | Extended | quiz_attempted, quiz_score, quiz_passed, best_quiz_score, quiz_attempts, quiz_completed_at, is_completed |
| `el_child_unit_progress` | Extended | step_progress, completion_percentage, total_xp_earned, next_review_at, review_count, interval_days, current_step, best_score, status, started_at, completed_at, last_activity_at |
| `el_child_gamification` | Extended | total_quizzes_completed, total_readings_completed, total_time_minutes, total_units_completed, total_perfect_scores, total_videos_completed, total_games_completed, perfect_quiz_count, total_coins, current_streak_days, longest_streak_days, last_activity_date, total_xp, current_level |
| `el_worksheets` | **Created** | id, unit_id, title, asset_url, asset_format, page_count, thumbnail_url, description, display_order, is_active |

### Data Migration
- `elearning_units` -> `el_learning_units` (INSERT ON CONFLICT DO NOTHING)
- `learning_videos` -> `el_videos` (INSERT ON CONFLICT DO NOTHING)
- No progress data migration needed (0-1 rows in child_* tables)

### Compatibility Views Created
- `child_gamification` -> `el_child_gamification`
- `child_unit_progress` -> `el_child_unit_progress`
- `child_video_progress` -> `el_child_video_progress`
- `child_badges` -> `el_child_badges`
- `badge_definitions` -> `el_badges`

### Tables Renamed (Deprecated)
- `learning_videos` -> `_deprecated_learning_videos`
- `learning_modules` -> `_deprecated_learning_modules`
- `learning_levels` -> `_deprecated_learning_levels`
- `learning_games` -> `_deprecated_learning_games`
- `elearning_units` -> `_deprecated_elearning_units`
- `elearning_skills` -> `_deprecated_elearning_skills`
- `elearning_sub_skills` -> `_deprecated_elearning_sub_skills`
- `elearning_content_pools` -> `_deprecated_elearning_content_pools`

---

## Code Files Modified

| # | File | Changes |
|---|------|---------|
| 1 | `lib/gamification.ts` | ~20 table refs migrated: child_gamification->el_child_gamification, child_badges->el_child_badges, badge_definitions->el_badges, child_video_progress->el_child_video_progress, learning_games->el_game_content, child_game_results->el_game_sessions, elearning_leaderboard->el_child_gamification |
| 2 | `app/api/elearning/gamification/route.ts` | child_gamification->el_child_gamification, child_badges->el_child_badges with el_badges join |
| 3 | `app/api/elearning/complete/route.ts` | child_unit_progress->el_child_unit_progress, child_gamification->el_child_gamification, child_badges->el_child_badges, awardBadge uses el_badges lookup |
| 4 | `app/api/elearning/submit-quiz/route.ts` | child_video_progress->el_child_video_progress, child_gamification->el_child_gamification, child_badges->el_child_badges with el_badges lookup |
| 5 | `app/api/elearning/progress/route.ts` | child_unit_progress->el_child_unit_progress, elearning_units->el_learning_units, child_gamification->el_child_gamification, child_game_progress->el_game_sessions |
| 6 | `app/api/elearning/session/route.ts` | elearning_units->el_learning_units with el_skills join, child_gamification->el_child_gamification, child_unit_progress->el_child_unit_progress |
| 7 | `app/api/elearning/unit/[unitId]/route.ts` | elearning_units->el_learning_units with el_skills join, elearning_content_pools->el_game_content, child_unit_progress->el_child_unit_progress |
| 8 | `app/api/elearning/recommendations/route.ts` | learning_videos->el_videos with el_skills join, child_video_progress->el_child_video_progress |
| 9 | `app/api/elearning/video/[videoId]/route.ts` | learning_videos->el_videos |
| 10 | `app/api/elearning/quiz/[quizId]/route.ts` | Removed elearning_quizzes try, kept video_quizzes only |
| 11 | `app/admin/elearning/page.tsx` | learning_levels->el_stages, learning_modules->el_modules, learning_videos->el_videos |
| 12 | `lib/mini-challenge/content.ts` | elearning_units->el_learning_units |
| 13 | `app/api/completion/report/[enrollmentId]/route.ts` | elearning_progress->el_child_gamification query |

---

## Verification Results

### Legacy Table Reference Grep (all zero)
- `child_gamification`: 0 refs
- `child_badges`: 0 refs
- `child_video_progress`: 0 refs
- `child_unit_progress`: 0 refs
- `badge_definitions`: 0 refs
- `elearning_units`: 0 refs
- `elearning_*` (non-leaderboard): 0 refs
- `learning_videos`: 0 refs
- `learning_modules`: 0 refs
- `learning_levels`: 0 refs
- `learning_games`: 0 refs
- `child_game_results`: 0 refs
- `child_game_progress`: 0 refs
- `elearning_progress`: 0 refs
- `elearning_content_pools`: 0 refs
- `elearning_leaderboard`: 0 refs

### TypeScript Compilation
- **0 errors** in modified files (tsc --noEmit passes)

---

## Tables Intentionally Kept

| Table | Reason |
|-------|--------|
| `video_quizzes` | Quiz content table, no el_* equivalent yet. ~30 rows. |
| `child_daily_goals` | Daily goal tracking, no naming conflict. |
| `xp_levels` | Config/reference table. |
| `learning_events` | RAG/analytics table, NOT e-learning content. |
| `reading_passages` | Assessment table. |
| `child_reading_results` | Reading results, no el_* equivalent. |

---

## Rollback Strategy

1. Compatibility views bridge old code -> new tables
2. Old tables renamed `_deprecated_*`, not dropped. Rename back to rollback.
3. All new columns are nullable with defaults -- can't break existing queries.
4. Code changes on feature branch -- revert commit to rollback code.
5. Drop `_deprecated_*` tables after 1-week soak period (separate PR).

---

## Next Steps

1. Run migration against Supabase: `supabase db push` or apply via dashboard
2. Regenerate types: `npx supabase gen types typescript --project-id <ref> > lib/supabase/database.types.ts`
3. Test key endpoints: `/api/elearning/session`, `/api/elearning/recommendations`, `/api/elearning/gamification`
4. Monitor logs for 24h for any missed references
5. After 1-week soak: drop `_deprecated_*` tables
