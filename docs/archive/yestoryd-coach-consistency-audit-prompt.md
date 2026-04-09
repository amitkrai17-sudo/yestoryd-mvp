# Claude Code Audit Prompt — Coach Consistency & Content Architecture

## Copy this into Claude Code and run it

---

```
I need you to audit the Yestoryd codebase for features related to coach consistency, content management, and session delivery standardization. Generate a comprehensive audit document at `docs/coach-consistency-audit.md`.

## AUDIT SCOPE

Scan the following areas and document EXACTLY what exists today — no assumptions, only verified code.

### 1. Session Templates
- Find the `session_templates` table schema (check Supabase migrations or SQL files)
- Document the `activity_flow` JSONB structure — what fields does each activity have?
- How many templates exist? What are the template_codes?
- Where are templates loaded? Check: `app/api/admin/templates/`, `app/api/coach/sessions/`
- Is there admin CRUD for templates? Check: `app/admin/templates/`

### 2. Companion Panel (Live Session)
- Scan `components/coach/live-session/` — list every file and its purpose
- Scan `app/coach/sessions/[id]/live/` — document the page and API routes
- How does ActivityTab.tsx render activities? Does it show just text labels or actual content?
- What data does `/api/coach/sessions/[id]/live` return? Document the JOINs.
- How does ActionButton work? What statuses are captured?
- What happens on session complete? Trace the POST to `/api/coach/sessions/[id]/activity-log`

### 3. Session Activity Log
- Find `session_activity_log` table — document full schema
- What columns were added to `scheduled_sessions`? (session_started_at, companion_panel_completed, parent_summary, etc.)
- What's in `coaches.completed_sessions_with_logs`?

### 4. Data Streams & Learning Events
- How do activity logs merge into `learning_events`? Trace the flow.
- Where does Recall.ai transcript get stored? Check webhook: `app/api/webhooks/recall/route.ts`
- Where does Gemini analysis happen post-session? Check the parent-summary route.
- What `event_type` values exist in learning_events?

### 5. Struggle Flags & Continuity
- How are struggle flags created? (Check activity-log POST route)
- How do they appear in next session? (Check the live GET route's JOINs)
- Is there any "Areas to Revisit" logic in InfoTab.tsx?

### 6. Pre-Session Brief
- Document `/api/coach/sessions/[id]/brief/route.ts` — what data does it return?
- Does it include previous session's activity_logs, struggle flags, coach notes?
- Is there a daily digest for coaches? (Check cron jobs)

### 7. rAI Coach Support
- Check `/api/coach/ai-suggestion` — what context does it receive?
- Does rAI have access to learning_events, activity_logs, struggle flags?
- Is Chain of Thought reasoning implemented for coach queries?
- Check `lib/rai/` — what utilities exist?

### 8. Content Assets (THE KEY GAP)
- Is there any `content_library` or `content_items` or `content_assets` table? Search all migrations and SQL.
- Do activities in `activity_flow` reference any content IDs or just text descriptions?
- Is there any video/worksheet/material management in the codebase?
- Check if e-learning has any tables or routes started: `app/api/elearning/`, `app/elearning/`

### 9. Parent Dashboard — Session Content
- Check `app/parent/` — does the parent see any session content post-session?
- Is there homework assignment functionality?
- Does the parent summary include links to practice materials?

### 10. Compliance & Quality
- Document the 45-min nudge cron (check `vercel.json` for cron entries)
- Is there any adherence scoring? Any comparison of activity_log vs template?
- Is there session effectiveness tracking? Check for `session_effectiveness` table.
- Is there any coach comparison or quality dashboard in admin?

## OUTPUT FORMAT

Generate the audit as `docs/coach-consistency-audit.md` with this structure:

# Yestoryd Coach Consistency Audit
**Generated:** [date]
**Audited by:** Claude Code

## Executive Summary
[3-4 sentences on current state]

## What Exists (Verified)

### Session Templates
- Schema: [exact columns]
- Activity Flow Structure: [exact JSONB shape with example]
- Template Count: [number]
- Admin Management: [yes/no, which routes]

### Companion Panel
- Files: [list with one-line purpose each]
- Activity Rendering: [what coach sees per activity]
- Data Capture: [what gets saved per activity]
- Session Complete Flow: [trace from submit to DB]

### Data Continuity
- Activity Logs → Learning Events: [how they merge]
- Recall.ai Integration: [current state]
- Gemini Analysis: [what it does, where stored]
- Struggle Flag Flow: [creation → next session display]

### Pre-Session Preparation
- Brief API: [what it returns]
- rAI Coach Support: [capabilities]
- Daily Digest: [exists or not]

### Compliance
- Nudge System: [what triggers, how delivered]
- Coach Streak: [how tracked]

## What's Missing (Gaps)

### Content Library
- [Current state of content management]
- [What activity_flow contains vs what it should contain]

### Child Learning Profile
- [Does a synthesized profile exist?]
- [What data would feed it?]

### Adherence Scoring
- [Any comparison of actual vs planned?]
- [Any quality metrics?]

### Parent Content Delivery
- [Post-session content sharing?]
- [Homework/practice assignment?]

### E-Learning
- [Any tables, routes, or UI started?]

## File Inventory
[List every file touched by coach session delivery, grouped by function]

## Database Tables Inventory
[List every table involved in session delivery with column counts]

## Recommended Build Sequence
[Based on gaps found, what to build first]
```

---

**Run the above in Claude Code. It will scan your actual codebase and produce `docs/coach-consistency-audit.md` with verified findings.**

After the audit is generated, share the file contents back here so we can validate against what we know and then proceed with builds.
