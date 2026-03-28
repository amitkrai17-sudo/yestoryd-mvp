# Session Manifest: Homework Intelligence Gaps — All 8 Fixes
**Date:** 2026-03-29
**Scope:** Transform homework from binary done/not-done into rich intelligence signal

---

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260329120000_homework_intelligence_gaps.sql` | Migration: difficulty_rating, practice_duration, content_item_id, photo_analysis |
| `lib/homework/analyze-photo.ts` | Gemini Vision analysis of homework photos (completeness, effort, handwriting) |
| `lib/homework/suggestion-templates.ts` | Skill-based homework suggestion templates for structured capture |

## Files Modified

| File | Change |
|------|--------|
| `lib/database.types.ts` | Regenerated with 4 new columns |
| `app/parent/tasks/page.tsx` | 2-step completion: photo → micro-feedback (difficulty + duration pills) → submit |
| `app/api/parent/tasks/[childId]/complete/route.ts` | Accepts difficulty_rating + practice_duration; enriched learning_event with both |
| `app/api/parent/tasks/[childId]/upload-photo/route.ts` | Fire-and-forget Gemini Vision analysis; stores photo_analysis JSONB |
| `app/api/coach/sessions/[id]/brief/route.ts` | practice_intelligence section (struggled/easy skills, avg completion time, photo count) |
| `app/coach/sessions/[id]/page.tsx` | Photo thumbnails show analysis labels (completeness/effort) |
| `components/coach/structured-capture/cards/EngagementSubmitCard.tsx` | Homework suggestion chips from session skills |
| `components/coach/structured-capture/index.tsx` | Passes selectedSkillSlugs to EngagementSubmitCard |
| `lib/tasks/generate-daily-tasks.ts` | Content warehouse linking via textSearch on el_content_items |
| `app/api/cron/intelligence-practice-recommendations/route.ts` | Practice-history-aware task generation (boost struggled, deprioritize easy) |
| `app/api/cron/practice-nudge/route.ts` | Engagement scoring: high=skip, medium=48h, low=24h, zero=coach alert |
| `docs/CURRENT-STATE.md` | Updated parent_daily_tasks column count (15 -> 19) |

## Database Changes

### parent_daily_tasks (4 new columns)

| Column | Type | Purpose |
|--------|------|---------|
| `difficulty_rating` | TEXT CHECK (easy, just_right, struggled) | Parent micro-feedback on task difficulty |
| `practice_duration` | TEXT CHECK (under_5, 5_to_15, 15_to_30, over_30) | Parent-reported practice time |
| `content_item_id` | UUID FK -> el_content_items | Link to content warehouse |
| `photo_analysis` | JSONB | Gemini Vision analysis result |

### Index Added
- `idx_parent_daily_tasks_content` on content_item_id (partial, WHERE NOT NULL)

## Gap-to-Phase Mapping

| Gap | Problem | Solution | Phase |
|-----|---------|----------|-------|
| 1 | Photos are dead JPEGs | Gemini Vision analysis → photo_analysis JSONB | 3 |
| 2 | No difficulty signal | Parent taps easy/just_right/struggled → difficulty_rating | 2 |
| 3 | No practice→performance correlation | practice_intelligence in brief API (struggled/easy skills) | 6 |
| 4 | AI tasks don't learn from completion patterns | Cron now boosts struggled skills, deprioritizes easy ones | 6 |
| 5 | Coach types homework from scratch | Suggestion chips from session skills in structured capture | 4 |
| 6 | No practice duration signal | Parent taps duration bucket → practice_duration | 2 |
| 7 | Tasks disconnected from content warehouse | content_item_id FK + textSearch linking in task generation | 5 |
| 8 | Fixed 48h nudge for all parents | Engagement-scored nudging (high=skip, low=24h, zero=coach alert) | 7 |

## What Was Verified

- TypeScript build clean (only pre-existing errors)
- No hardcoded phones/emails/prices in modified files
- No inline Gemini client instantiation (uses getGenAI())
- No emoji in rendered output
- `getAntiHallucinationRules()` requires `name` parameter — fixed
- `hwSinceDate` scoping issue in brief — hoisted out of try block
- Set/Map spread requires Array.from() for TS target — fixed
- el_content_items has only 8 rows — content linking is plumbed but will rarely match until warehouse is populated

## What Was Assumed

- Gemini 2.5 Flash handles Vision (inlineData) — confirmed by 9 existing Vision usage patterns in codebase
- `photo_analysis` background fire-and-forget won't be killed by Vercel function timeout — typical photo analysis takes 2-5s, within the 10s default
- Parent micro-feedback is truly optional — skipping sends null values (no CHECK constraint violation)
- Coach alert for zero-engagement parents logs to `activity_log` — no in-app notification system exists yet
- Content warehouse linking via textSearch is a best-effort match — will improve as content grows
