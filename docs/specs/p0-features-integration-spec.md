# P0 Features - Integration Specification
## Extending Existing Systems (NOT Creating Parallel)

**Date:** January 12, 2026  
**Principle:** Every feature must integrate with existing APIs, tables, and patterns.

---

## 🔍 EXISTING SYSTEM AUDIT

### Current Database Tables We'll USE (Not Create)

| Table | Key Columns for P0 | Purpose |
|-------|-------------------|---------|
| `scheduled_sessions` | id, session_number, child_id, coach_id, status, coach_notes, ai_analysis, scheduled_date, scheduled_time, google_meet_link | Session data |
| `children` | id, child_name, child_age, latest_assessment_score, assessment_feedback, last_session_summary, child_preferences (JSONB) | Child data + cached summary |
| `enrollments` | id, child_id, program_start, sessions_completed, total_sessions | Progress tracking |
| `learning_events` | id, child_id, event_type, event_data (JSONB) | Session insights, embeddings for RAG |

### Current API Patterns We'll FOLLOW

| Pattern | Location | Example |
|---------|----------|---------|
| Auth | `lib/api-auth.ts` | `requireAdminOrCoach()` |
| Data JOINs | Discovery call API | Always JOIN to `children` for assessment data |
| Response format | All APIs | `{ success: boolean, data: {...}, error?: string }` |
| Coach routes | `/api/coach/*` | Existing coach-specific endpoints |

### Current Coach Portal Pages

| Page | Status | We Will |
|------|--------|---------|
| `/coach/sessions` | ✅ Built | EXTEND with prep modal |
| `/coach/students/[id]` | ✅ Built | EXTEND with progress dashboard |
| `/coach/discovery-calls/[id]` | ✅ Built | Pattern for detail pages |

---

## 📋 P0 FEATURE 1: Pre-Session Brief

### ❌ WRONG Approach (What I Almost Did)
- Create new `/api/coach/session-prep/[id]/route.ts`
- Create new PreSessionBrief component from scratch
- Duplicate data fetching logic

### ✅ RIGHT Approach (Integration)

**1. EXTEND existing `/coach/sessions` page**

The sessions page already lists sessions. We add a "Prep" button that opens a modal.

**2. EXTEND existing session detail query**

Instead of new API, extend the existing session fetch in `/coach/sessions/page.tsx`:

```typescript
// CURRENT: Basic session fetch
const { data: sessions } = await supabase
  .from('scheduled_sessions')
  .select('id, scheduled_date, child_id, status')
  .eq('coach_id', coachId);

// EXTENDED: Include prep data in same query
const { data: sessions } = await supabase
  .from('scheduled_sessions')
  .select(`
    id, 
    session_number,
    scheduled_date, 
    scheduled_time,
    google_meet_link,
    status,
    child_id,
    children (
      id,
      child_name,
      child_age,
      latest_assessment_score,
      assessment_feedback,
      last_session_summary,
      child_preferences
    ),
    enrollment:enrollments (
      sessions_completed,
      total_sessions
    )
  `)
  .eq('coach_id', coachId)
  .gte('scheduled_date', today)
  .order('scheduled_date');
```

**3. Get last session notes via separate query (already exists)**

```typescript
// Get previous session for this child
const { data: lastSession } = await supabase
  .from('scheduled_sessions')
  .select('coach_notes, ai_analysis, scheduled_date')
  .eq('child_id', childId)
  .eq('status', 'completed')
  .order('scheduled_date', { ascending: false })
  .limit(1)
  .single();
```

**4. Use EXISTING `children.last_session_summary` cache**

This field already stores AI-generated summaries from Recall.ai webhook. Don't regenerate!

**5. Generate AI recommendations ONLY when modal opens (lazy load)**

Create ONE small API endpoint for AI recommendations only:

```
POST /api/coach/session/[id]/prep-recommendations
```

This is the ONLY new endpoint needed. It:
- Receives session ID
- Uses existing data (assessment, last session notes)
- Calls Gemini for recommendations
- Returns focus areas + suggested activities

### Files to MODIFY (Not Create)

| File | Change |
|------|--------|
| `app/coach/sessions/page.tsx` | Add "Prep" button + modal |
| `components/coach/SessionCard.tsx` | Add prep modal trigger (if exists) |
| `app/api/coach/session/[id]/prep-recommendations/route.ts` | NEW but minimal - AI only |

### Database Changes: NONE

All data already exists:
- Session data → `scheduled_sessions`
- Child data → `children` 
- Assessment → `children.latest_assessment_score`, `assessment_feedback`
- Last session summary → `children.last_session_summary`
- Child preferences → `children.child_preferences` (JSONB)
- AI analysis → `scheduled_sessions.ai_analysis`

---

## 📋 P0 FEATURE 2: Post-Session Form

### ❌ WRONG Approach
- Create new `homework_assignments` table
- Create new `/api/coach/post-session/route.ts`
- Build complex new workflow

### ✅ RIGHT Approach (Integration)

**1. Use EXISTING columns in `scheduled_sessions`**

Check what columns already exist:
- `coach_notes` ✅ Already exists
- `session_highlights` - May need to add (JSONB array)
- `session_struggles` - May need to add (JSONB array)
- `homework_assigned` - May need to add (TEXT)

**2. EXTEND the session status update flow**

When coach marks session as "completed", show the form:

```typescript
// In /coach/sessions page or modal
async function completeSession(sessionId: string, formData: PostSessionData) {
  const { error } = await supabase
    .from('scheduled_sessions')
    .update({
      status: 'completed',
      coach_notes: formData.notes,
      session_highlights: formData.highlights,  // JSONB array
      session_struggles: formData.struggles,    // JSONB array
      homework_assigned: formData.homework,     // TEXT
      completed_at: new Date().toISOString()
    })
    .eq('id', sessionId);
}
```

**3. Homework tracking via EXISTING `learning_events` table**

Don't create new table. Use learning_events with event_type = 'homework_assigned':

```typescript
// When homework is assigned
await supabase.from('learning_events').insert({
  child_id: childId,
  event_type: 'homework_assigned',
  event_data: {
    session_id: sessionId,
    description: homeworkDescription,
    due_date: dueDate,
    status: 'pending'
  }
});

// When parent marks complete (in parent dashboard)
await supabase.from('learning_events')
  .update({ 
    event_data: { ...existingData, status: 'completed', completed_at: now }
  })
  .match({ child_id, event_type: 'homework_assigned', 'event_data->session_id': sessionId });
```

### Database Changes: MINIMAL

```sql
-- Only if columns don't exist
ALTER TABLE scheduled_sessions 
ADD COLUMN IF NOT EXISTS session_highlights JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS session_struggles JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS homework_assigned TEXT;
```

### Files to MODIFY

| File | Change |
|------|--------|
| `app/coach/sessions/page.tsx` | Add post-session form modal |
| (migration) | Add 3 columns to scheduled_sessions if needed |

---

## 📋 P0 FEATURE 3: One-Click Parent Update

### ❌ WRONG Approach
- Create new communication table
- Build new WhatsApp integration
- Create parallel notification system

### ✅ RIGHT Approach (Integration)

**1. Use EXISTING `children.last_session_summary` field**

This is ALREADY populated by Recall.ai webhook with parent-friendly summary.

**2. Use EXISTING AiSensy integration**

AiSensy templates are already set up. We just trigger them.

**3. Add button to post-session form**

```typescript
// After saving post-session notes
async function sendParentUpdate(childId: string, sessionId: string) {
  // Get cached summary (already generated by Recall.ai)
  const { data: child } = await supabase
    .from('children')
    .select('parent_phone, child_name, last_session_summary')
    .eq('id', childId)
    .single();
  
  // Send via existing AiSensy API
  await fetch('/api/communication/send', {
    method: 'POST',
    body: JSON.stringify({
      template: 'session_summary',  // Already exists
      phone: child.parent_phone,
      variables: {
        child_name: child.child_name,
        summary: child.last_session_summary
      }
    })
  });
  
  // Log that update was sent
  await supabase.from('scheduled_sessions')
    .update({ parent_notified: true, parent_notified_at: new Date() })
    .eq('id', sessionId);
}
```

### Database Changes: MINIMAL

```sql
ALTER TABLE scheduled_sessions
ADD COLUMN IF NOT EXISTS parent_notified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_notified_at TIMESTAMPTZ;
```

### Files to MODIFY

| File | Change |
|------|--------|
| `app/coach/sessions/page.tsx` | Add "Notify Parent" button in post-session form |
| (migration) | Add 2 columns to scheduled_sessions |

---

## 📋 P0 FEATURE 4: Student Progress Dashboard

### ❌ WRONG Approach
- Create new progress API
- Build complex analytics system
- Duplicate data fetching

### ✅ RIGHT Approach (Integration)

**1. EXTEND existing `/coach/students/[id]` page**

This page already exists! We add visualizations using existing data.

**2. Use EXISTING data sources**

```typescript
// Already available via JOINs
const progressData = {
  // From children table
  assessmentScore: child.latest_assessment_score,
  assessmentFeedback: child.assessment_feedback,
  
  // From scheduled_sessions - aggregate query
  sessionsCompleted: sessions.filter(s => s.status === 'completed').length,
  totalSessions: enrollment.total_sessions,
  attendanceRate: (completed / total) * 100,
  
  // From learning_events - aggregate
  homeworkCompletionRate: completedHomework / totalHomework,
  
  // From scheduled_sessions with ai_analysis
  recentTrends: sessions
    .filter(s => s.ai_analysis)
    .map(s => ({
      date: s.scheduled_date,
      progressRating: s.ai_analysis.progress_rating,
      engagement: s.ai_analysis.engagement_level
    }))
};
```

**3. Add simple chart component**

Use existing recharts (already in dependencies from artifacts system).

### Database Changes: NONE

All data already exists in:
- `children` → assessment data
- `scheduled_sessions` → session completion, ai_analysis
- `enrollments` → total sessions
- `learning_events` → homework tracking

### Files to MODIFY

| File | Change |
|------|--------|
| `app/coach/students/[id]/page.tsx` | Add progress charts section |

---

## 📋 P0 FEATURE 5: Homework Tracker

### Already Covered in Feature 2

Homework is tracked via `learning_events` table with `event_type = 'homework_assigned'`.

**Parent Dashboard Integration:**

```typescript
// In /parent/dashboard - show pending homework
const { data: homework } = await supabase
  .from('learning_events')
  .select('*')
  .eq('child_id', childId)
  .eq('event_type', 'homework_assigned')
  .eq('event_data->status', 'pending');
```

### Files to MODIFY

| File | Change |
|------|--------|
| `app/parent/dashboard/page.tsx` | Add homework section |
| `app/coach/students/[id]/page.tsx` | Show homework status |

---

## 🏗️ IMPLEMENTATION ORDER

### Step 1: Database Migration (5 mins)
```sql
ALTER TABLE scheduled_sessions 
ADD COLUMN IF NOT EXISTS session_highlights JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS session_struggles JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS homework_assigned TEXT,
ADD COLUMN IF NOT EXISTS parent_notified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_notified_at TIMESTAMPTZ;
```

### Step 2: Post-Session Form (2-3 hrs)
- Extend `/coach/sessions` with completion modal
- Form saves to existing columns
- Creates `learning_events` for homework

### Step 3: One-Click Parent Update (1 hr)
- Add button to post-session form
- Uses existing `last_session_summary`
- Uses existing AiSensy integration

### Step 4: Pre-Session Brief (3-4 hrs)
- Add prep modal to session cards
- Extend session query to include child + last session
- Create ONE API for AI recommendations only

### Step 5: Progress Dashboard (2-3 hrs)
- Extend `/coach/students/[id]` with charts
- Use existing data with aggregation

---

## ✅ CHECKLIST BEFORE CODING

- [ ] Verify `scheduled_sessions` columns exist (check Supabase)
- [ ] Verify `children.last_session_summary` is populated
- [ ] Verify `children.child_preferences` JSONB exists
- [ ] Check existing AiSensy templates
- [ ] Review `/api/communication/send` for template format
- [ ] Check if `session_highlights`, `session_struggles` columns exist

---

## 📊 SUMMARY: What We're Creating vs Extending

| Item | Creating New? | Extending Existing? |
|------|---------------|---------------------|
| Database tables | ❌ No | ✅ Add 5 columns to scheduled_sessions |
| API endpoints | 1 small one | ✅ Use existing patterns |
| Coach pages | ❌ No | ✅ Add modals to existing pages |
| Data fetching | ❌ No | ✅ Extend existing queries with JOINs |
| Auth patterns | ❌ No | ✅ Use requireAdminOrCoach() |
| WhatsApp | ❌ No | ✅ Use existing AiSensy |
| AI calls | ❌ No | ✅ Use existing Gemini patterns |

**Total New Code: ~30%**  
**Extending Existing: ~70%**

This is the correct approach for maintainability and code hygiene.
