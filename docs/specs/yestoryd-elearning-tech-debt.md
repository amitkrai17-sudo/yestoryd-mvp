# TECH DEBT: E-Learning Table Consolidation

**Created:** February 1, 2026  
**Priority:** P3 (Do before e-learning content creation)  
**Effort:** 4-8 hours  
**Owner:** Amit  
**Status:** 🟡 PENDING

---

## Problem Summary

Three parallel e-learning schemas exist, causing:
- Column mismatch errors (`age_group` doesn't exist)
- Confusion about which tables to use
- Risk of content being created in wrong tables

---

## Current State: 12 Content Tables

| Table | Rows | System | Status |
|-------|------|--------|--------|
| `el_videos` | 63 | el_* (child portal) | ✅ KEEP |
| `video_quizzes` | 30 | shared | ✅ KEEP |
| `learning_videos` | 20 | learning_* (admin) | 🔄 MIGRATE |
| `video_details` | 19 | orphaned? | ❓ CHECK |
| `el_game_content` | 13 | el_* | ✅ KEEP |
| `reading_passages` | 8 | assessment | ✅ KEEP |
| `elearning_content_pools` | 1 | elearning_* | 🗑️ DELETE |
| `el_child_video_progress` | 0 | el_* | ✅ KEEP (tracking) |
| `child_video_progress` | 0 | duplicate | 🗑️ DELETE |
| `video_watch_sessions` | 0 | orphaned | 🗑️ DELETE |
| `coach_video_assignments` | 0 | orphaned | 🗑️ DELETE |
| `learning_reading_passages` | 0 | duplicate | 🗑️ DELETE |

---

## Target State: 6 Tables

| Table | Purpose |
|-------|---------|
| `el_videos` | All video content (merged) |
| `el_game_content` | Game content |
| `video_quizzes` | Quiz questions |
| `reading_passages` | Assessment passages |
| `el_child_video_progress` | Child progress tracking |
| `learning_events` | RAG/AI events (different purpose) |

---

## Code Files to Update

| File | Current Table | Change To |
|------|---------------|-----------|
| `app/admin/elearning/page.tsx` | `learning_videos`, `learning_modules`, `learning_levels` | `el_videos`, `el_learning_units`, `el_stages` |
| `app/api/elearning/recommendations/route.ts` | `learning_videos` | `el_videos` |
| `app/api/elearning/video/[videoId]/route.ts` | `learning_videos` | `el_videos` |
| `app/api/elearning/unit/[unitId]/route.ts` | `elearning_content_pools` | `el_videos` or remove |
| `app/api/elearning/quiz/[quizId]/route.ts` | `elearning_quizzes` | `video_quizzes` |
| `app/api/elearning/progress/route.ts` | `elearning_units` | `el_learning_units` |

---

## Migration Steps

### Phase 1: Quick Fix (DONE ✅)

```sql
-- Applied Feb 1, 2026 to stop immediate error
ALTER TABLE elearning_content_pools 
ADD COLUMN IF NOT EXISTS age_group TEXT DEFAULT '7-9',
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS difficulty_level TEXT;

UPDATE elearning_content_pools SET 
  title = COALESCE(title, name),
  difficulty_level = COALESCE(difficulty_level, difficulty)
WHERE title IS NULL OR difficulty_level IS NULL;
```

### Phase 2: Delete Empty Tables (10 min)

```sql
-- Safe to delete - 0 rows, no code references
DROP TABLE IF EXISTS coach_video_assignments;
DROP TABLE IF EXISTS child_video_progress;
DROP TABLE IF EXISTS video_watch_sessions;
DROP TABLE IF EXISTS learning_reading_passages;
```

### Phase 3: Migrate learning_videos → el_videos (2 hrs)

```sql
-- Step 1: Check column compatibility
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('learning_videos', 'el_videos')
ORDER BY table_name, ordinal_position;

-- Step 2: Insert missing videos (after column mapping)
-- TBD based on schema comparison

-- Step 3: Update foreign key references
-- TBD
```

### Phase 4: Update Admin Panel (2-3 hrs)

Update `app/admin/elearning/page.tsx` to use `el_*` tables instead of `learning_*` tables.

### Phase 5: Delete Legacy Tables

```sql
-- Only after code migration complete
DROP TABLE IF EXISTS learning_videos;
DROP TABLE IF EXISTS learning_modules;
DROP TABLE IF EXISTS learning_levels;
DROP TABLE IF EXISTS elearning_content_pools;
DROP TABLE IF EXISTS elearning_quizzes;
DROP TABLE IF EXISTS elearning_units;
```

### Phase 6: Test

- [ ] Admin e-learning page loads
- [ ] Video recommendations work
- [ ] Child portal plays videos
- [ ] Quiz submission works
- [ ] Progress tracking works

---

## When To Do This

**Before:** Creating the 477+ e-learning videos for launch

**Why:** Don't want content scattered across multiple tables. Once videos are created in wrong tables, migration becomes much harder.

**Ideal Timing:** During a quiet development week, not during active launch prep.

---

## Related Tables (Keep As-Is)

These `el_*` tables are the canonical child portal tables - keep them:

- `el_stages` - Learning stages
- `el_learning_units` - Units within stages
- `el_videos` - Video content
- `el_game_content` - Game content
- `el_game_sessions` - Game play sessions
- `el_child_avatars` - Child avatars
- `el_child_identity` - Child identity/preferences
- `el_child_gamification` - XP, streaks, etc.
- `el_child_badges` - Earned badges
- `el_child_unit_progress` - Unit completion
- `el_child_video_progress` - Video watch progress
- `el_badges` - Badge definitions

---

## Risk If Not Done

- Content created in wrong tables → lost work
- Continued column mismatch errors
- Confusion for future developers
- Harder to maintain/debug

---

*Added to tech debt backlog: February 1, 2026*
