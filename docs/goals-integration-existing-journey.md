# Goals Integration into Existing Journey
## Claude Code Implementation Spec

**Principle:** Build on existing pages, NO new pages. Single source of truth.

---

## OVERVIEW

Goals captured on results page should flow through the entire journey:

```
Results Page (goals captured)
    ↓
Email CTAs (goals in URL)
    ↓
/enroll page (goals displayed + saved to booking)
    ↓
discovery_calls record (goals stored)
    ↓
Coach Discovery Detail (goals visible)
```

---

## TASK 1: Update Certificate Email Template

**File:** `app/api/certificate/send/route.ts`

### Changes:
1. Accept `goals` parameter in the request body
2. Include goals as URL params in both CTA buttons

### Request Body (add goals):
```typescript
const { 
  email, 
  childName, 
  childId,  // Need this for linking
  childAge, 
  score, 
  goals,    // NEW: string[] like ['grammar', 'olympiad']
  // ... other fields
} = body;
```

### Build Goals URL Param:
```typescript
const goalsParam = goals && goals.length > 0 
  ? `&goals=${encodeURIComponent(goals.join(','))}` 
  : '';
```

### Update CTA URLs in email HTML:

**"Let's Talk" button:**
```html
<a href="https://yestoryd.com/enroll?source=email&childId=${childId}&childName=${encodeURIComponent(childName)}${goalsParam}">
  Let's Talk
</a>
```

**"Unlock Potential" button:**
```html
<a href="https://yestoryd.com/enroll?source=email&childId=${childId}&childName=${encodeURIComponent(childName)}${goalsParam}&direct=true">
  Boost ${childName}'s Reading
</a>
```

---

## TASK 2: Update Results Page to Pass Goals to Email API

**File:** `app/assessment/results/[id]/page.tsx`

### Changes:
Find where the certificate email API is called and include goals:

```typescript
// When calling /api/certificate/send
const response = await fetch('/api/certificate/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: parentEmail,
    childName,
    childId: assessmentId,  // Pass the child ID
    childAge,
    score,
    goals: selectedGoals,   // Pass captured goals
    // ... other fields
  })
});
```

### Also update the page CTAs to include goals:

Find the "Boost {name}'s Reading" and "Questions? Talk to Coach" buttons and update their hrefs:

```tsx
// Build goals param from state
const goalsParam = selectedGoals.length > 0 
  ? `&goals=${encodeURIComponent(selectedGoals.join(','))}` 
  : '';

// Primary CTA
<Link href={`/enroll?source=results&childId=${assessmentId}&childName=${encodeURIComponent(childName)}${goalsParam}`}>
  🚀 Boost {childName}'s Reading
</Link>

// Secondary CTA  
<Link href={`/enroll?source=results&childId=${assessmentId}&childName=${encodeURIComponent(childName)}${goalsParam}`}>
  🎁 Questions? Talk to Coach
</Link>
```

---

## TASK 3: Update /enroll Page to Display Goals

**File:** `app/enroll/page.tsx`

### Changes:

#### 1. Read goals from URL params:
```typescript
const searchParams = useSearchParams();
const goalsParam = searchParams.get('goals');
const goals = goalsParam ? goalsParam.split(',') : [];
```

#### 2. Import goal labels for display:
```typescript
import { LEARNING_GOALS } from '@/lib/constants/goals';
```

#### 3. Add personalized section (show only if goals exist):
```tsx
{goals.length > 0 && (
  <div className="bg-gradient-to-r from-[#FF0099]/10 to-[#00ABFF]/10 rounded-xl p-4 mb-6">
    <p className="text-gray-700 font-medium mb-2">
      🎯 {childName}'s focus areas:
    </p>
    <div className="flex flex-wrap gap-2">
      {goals.map((goalId) => {
        const goal = LEARNING_GOALS[goalId as keyof typeof LEARNING_GOALS];
        if (!goal) return null;
        return (
          <span 
            key={goalId}
            className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200"
          >
            {goal.emoji} {goal.shortLabel || goal.label}
          </span>
        );
      })}
    </div>
  </div>
)}
```

#### 4. Pass goals when booking discovery call:
When the booking is created (Cal.com webhook or native booking), include goals in the data:

```typescript
// In the booking submission
const bookingData = {
  // ... existing fields
  goals: goals,  // Pass goals array
};
```

---

## TASK 4: Update Discovery Call Creation to Store Goals

**File:** `app/api/webhooks/cal/route.ts` (or native booking route)

### Changes:
When creating the discovery_calls record, store goals:

```typescript
// If goals are passed in booking metadata
const goals = bookingData.goals || [];

// When inserting to discovery_calls
const { error } = await supabase
  .from('discovery_calls')
  .insert({
    // ... existing fields
    parent_goals: goals,  // Store goals array
  });
```

**Note:** The `discovery_calls` table should have a `parent_goals` column. If it doesn't exist, also update the `children` table goals when discovery call is created:

```typescript
// Update children table with goals if provided
if (goals.length > 0 && childId) {
  await supabase
    .from('children')
    .update({
      parent_goals: goals,
      goals_captured_at: new Date().toISOString(),
      goals_capture_method: 'discovery_booking',
    })
    .eq('id', childId);
}
```

---

## TASK 5: Verify Coach Discovery Detail Shows Goals

**File:** `app/coach/discovery-calls/[id]/page.tsx`

This may already be implemented from previous session. Verify that goals display correctly:

```tsx
{/* Goals Display */}
{discoveryCall.child?.parent_goals?.length > 0 && (
  <div className="bg-gray-800/50 rounded-xl p-4">
    <h3 className="text-white font-medium mb-2">🎯 Parent Goals</h3>
    <div className="flex flex-wrap gap-2">
      {discoveryCall.child.parent_goals.map((goalId: string) => {
        const goal = LEARNING_GOALS[goalId as keyof typeof LEARNING_GOALS];
        if (!goal) return null;
        return (
          <span 
            key={goalId}
            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-200"
          >
            {goal.emoji} {goal.shortLabel || goal.label}
          </span>
        );
      })}
    </div>
  </div>
)}
```

---

## TASK 6: Update WhatsApp Share to Include Goals

**File:** Results page - WhatsApp share button

If there's a WhatsApp share button, update the message to include goals context:

```typescript
const goalsText = selectedGoals.length > 0 
  ? `\n\nFocus areas: ${selectedGoals.map(g => LEARNING_GOALS[g]?.shortLabel).filter(Boolean).join(', ')}`
  : '';

const whatsappMessage = `${childName} completed their reading assessment!\n\nScore: ${score}/10\n${feedback}${goalsText}\n\nBook a free session: https://yestoryd.com/enroll?childId=${childId}${goalsParam}`;
```

---

## FILES TO MODIFY SUMMARY

| File | Changes |
|------|---------|
| `app/api/certificate/send/route.ts` | Accept goals, add to CTA URLs |
| `app/assessment/results/[id]/page.tsx` | Pass goals to email API, update CTA hrefs |
| `app/enroll/page.tsx` | Read goals from URL, display personalized section |
| `app/api/webhooks/cal/route.ts` | Store goals in discovery_calls/children |
| `app/coach/discovery-calls/[id]/page.tsx` | Verify goals display (may already work) |

---

## DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                     RESULTS PAGE                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ GoalsCapture Component                                   │    │
│  │ selectedGoals = ['grammar', 'olympiad']                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           │                                      │
│            ┌──────────────┼──────────────┐                      │
│            ▼              ▼              ▼                      │
│     Email API        Page CTA      WhatsApp Share               │
│     (goals in       (goals in      (goals in                    │
│      body)           URL)           message)                    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EMAIL                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ "Let's Talk" → /enroll?goals=grammar,olympiad           │    │
│  │ "Boost Reading" → /enroll?goals=grammar,olympiad&direct │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    /ENROLL PAGE                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ "🎯 Anaya's focus areas:"                               │    │
│  │ [✏️ Grammar] [🏅 Olympiad]                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│                    Book Discovery                                │
│                    (goals passed)                                │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 DISCOVERY_CALLS TABLE                            │
│  parent_goals: ['grammar', 'olympiad']                          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              COACH DISCOVERY DETAIL                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🎯 Parent Goals                                         │    │
│  │ [✏️ Grammar] [🏅 Olympiad]                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│  Coach sees goals BEFORE the call!                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## TESTING CHECKLIST

- [ ] Complete assessment and select goals
- [ ] Check email CTAs have `?goals=grammar,olympiad` in URLs
- [ ] Click email CTA → /enroll page shows goals badges
- [ ] Book discovery call
- [ ] Check discovery_calls table has parent_goals
- [ ] Coach portal → discovery detail shows goals
- [ ] Results page CTAs also pass goals correctly

---

## IMPORTANT NOTES

1. **Don't create new pages** - enhance existing /enroll page
2. **Goals are optional** - all displays should handle empty goals gracefully
3. **URL encode** - always encode goal values in URLs
4. **Merge don't overwrite** - if goals already exist in children table, merge new ones
