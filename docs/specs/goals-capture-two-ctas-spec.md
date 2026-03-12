# Goals Capture Enhancement - Two CTAs + Email Fallback

## Overview

**Problem:** When parent clicks email CTA without having selected goals on results page, goals are never captured.

**Solution:** 
1. Restore "Talk to Coach" CTA on results page (separate from enroll)
2. Add GoalsCapture fallback on landing pages when goals are missing

---

## PART 1: Results Page - Two Distinct CTAs

**File:** `app/assessment/results/[id]/page.tsx`

### Current State:
- Only "Boost {name}'s Reading" button exists
- "Talk to Coach" either missing or goes to same /enroll page

### Required State:
Two separate CTAs with different destinations:

| CTA | Text | Destination | Purpose |
|-----|------|-------------|---------|
| Primary (Pink) | "🚀 Boost {name}'s Reading" | `/enroll?childId=X&childName=Y&goals=Z` | Direct enrollment |
| Secondary (Outline) | "📅 Questions? Talk to Coach" | `/book-call?childId=X&childName=Y&goals=Z` | Book FREE discovery call |

### Implementation:

```tsx
// Build URLs with goals
const goalsParam = selectedGoals.length > 0 
  ? `&goals=${encodeURIComponent(selectedGoals.join(','))}` 
  : '';

const baseParams = `childId=${assessmentId}&childName=${encodeURIComponent(childName)}&childAge=${childAge}&parentEmail=${encodeURIComponent(parentEmail)}&parentPhone=${encodeURIComponent(parentPhone)}`;

const enrollUrl = `/enroll?source=results&${baseParams}${goalsParam}`;
const bookCallUrl = `/book-call?source=results&${baseParams}${goalsParam}`;

// Primary CTA - Enroll
<Link href={enrollUrl}>
  <button className="w-full bg-gradient-to-r from-[#FF0099] to-[#FF6D00] text-white font-semibold py-3 px-6 rounded-full">
    🚀 Boost {childName}'s Reading
  </button>
</Link>

// Secondary CTA - Talk to Coach
<Link href={bookCallUrl}>
  <button className="w-full border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-full hover:bg-gray-50">
    📅 Questions? Talk to Coach
  </button>
</Link>
```

---

## PART 2: Create /book-call Page (If Not Exists)

**File:** `app/book-call/page.tsx`

This page is for booking a FREE discovery call (separate from enrollment).

### Key Features:
1. Read childId, childName, childAge, goals from URL params
2. If goals exist → Show badges
3. If goals empty → Show GoalsCapture component
4. Cal.com embed or native booking for discovery call

### Basic Structure:

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { GoalsCapture } from '@/components/assessment/GoalsCapture';
import { LEARNING_GOALS } from '@/lib/constants/goals';

export default function BookCallPage() {
  const searchParams = useSearchParams();
  
  const childId = searchParams.get('childId') || '';
  const childName = searchParams.get('childName') || '';
  const childAge = parseInt(searchParams.get('childAge') || '7');
  const parentEmail = searchParams.get('parentEmail') || '';
  const parentPhone = searchParams.get('parentPhone') || '';
  const goalsParam = searchParams.get('goals') || '';
  
  const [goals, setGoals] = useState<string[]>(
    goalsParam ? goalsParam.split(',').filter(Boolean) : []
  );
  const [childData, setChildData] = useState<any>(null);

  // If no childAge in URL, fetch from DB
  useEffect(() => {
    if (childId && !searchParams.get('childAge')) {
      fetch(`/api/children/${childId}`)
        .then(res => res.json())
        .then(data => setChildData(data));
    }
  }, [childId]);

  const actualChildAge = childData?.age || childAge;
  const displayName = childName.charAt(0).toUpperCase() + childName.slice(1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            Book a FREE Discovery Call
          </h1>
          <p className="text-gray-600 mt-2">
            15 minutes with Coach Rucha to discuss {displayName}'s reading journey
          </p>
        </div>

        {/* Goals Section */}
        {goals.length > 0 ? (
          // Show badges if goals exist
          <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border">
            <p className="text-gray-700 font-medium mb-3">
              🎯 {displayName}'s focus areas:
            </p>
            <div className="flex flex-wrap gap-2">
              {goals.map((goalId) => {
                const goal = LEARNING_GOALS[goalId as keyof typeof LEARNING_GOALS];
                if (!goal) return null;
                return (
                  <span 
                    key={goalId}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-pink-50 rounded-full text-sm font-medium text-pink-700 border border-pink-200"
                  >
                    {goal.emoji} {goal.shortLabel || goal.label}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          // Show GoalsCapture if goals not yet captured
          <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border">
            <GoalsCapture
              childId={childId}
              childName={displayName}
              childAge={actualChildAge}
              onGoalsSaved={(savedGoals) => setGoals(savedGoals)}
            />
          </div>
        )}

        {/* What to Expect */}
        <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border">
          <h3 className="font-semibold text-gray-800 mb-3">📞 What to Expect</h3>
          <ul className="space-y-2 text-gray-600 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              Understand {displayName}'s current reading level
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              Get personalized recommendations
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              Ask any questions about the program
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              No obligation - 100% free
            </li>
          </ul>
        </div>

        {/* Booking Calendar - Use your existing booking component */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h3 className="font-semibold text-gray-800 mb-4">📅 Select a Time</h3>
          
          {/* 
            INSERT YOUR EXISTING BOOKING COMPONENT HERE
            Either Cal.com embed or your native booking system
            Make sure to pass:
            - childId
            - childName  
            - parentEmail
            - parentPhone
            - goals (to store in discovery_calls)
          */}
          
          {/* Placeholder - replace with actual booking component */}
          <div className="text-center py-8 text-gray-500">
            [Booking Calendar Component]
          </div>
        </div>

        {/* Trust indicators */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>🔒 Your information is secure</p>
          <p className="mt-1">100+ families have booked discovery calls</p>
        </div>

      </div>
    </div>
  );
}
```

---

## PART 3: Update /enroll Page - Add GoalsCapture Fallback

**File:** `app/enroll/page.tsx`

### Current State:
- Shows goal badges if goals in URL
- Shows nothing if goals empty

### Required State:
- Shows goal badges if goals in URL ✅
- Shows GoalsCapture component if goals empty (NEW)

### Find This Code Block:

```tsx
{goals.length > 0 && (
  <div className="...">
    <p>🎯 {childName}'s focus areas:</p>
    {/* badges */}
  </div>
)}
```

### Replace With:

```tsx
{goals.length > 0 ? (
  // Show badges if goals captured
  <div className="bg-gradient-to-r from-[#FF0099]/10 to-[#00ABFF]/10 rounded-xl p-4 mb-6">
    <p className="text-gray-700 font-medium mb-2">
      🎯 {displayName}'s focus areas:
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
) : childId ? (
  // Show GoalsCapture if no goals yet but we have childId
  <div className="bg-gradient-to-r from-[#FF0099]/10 to-[#00ABFF]/10 rounded-xl p-4 mb-6">
    <GoalsCapture
      childId={childId}
      childName={displayName}
      childAge={childAge || 7}
      onGoalsSaved={(savedGoals) => setGoals(savedGoals)}
    />
  </div>
) : null}
```

### Also Need:
1. Import GoalsCapture at top of file
2. Convert goals from const to state so it can be updated:

```tsx
// Change from:
const goals = goalsParam ? goalsParam.split(',') : [];

// To:
const [goals, setGoals] = useState<string[]>(
  goalsParam ? goalsParam.split(',').filter(Boolean) : []
);
```

3. Fetch childAge if not in URL params (for age-appropriate goals)

---

## PART 4: Update Certificate Email CTAs

**File:** `app/api/certificate/send/route.ts`

### Current Email CTAs:
Both might be pointing to /enroll

### Required:
| Button | URL |
|--------|-----|
| "🚀 Boost {name}'s Reading" | `https://yestoryd.com/enroll?source=email&childId=X&childName=Y&goals=Z` |
| "📅 Questions? Talk to Coach" | `https://yestoryd.com/book-call?source=email&childId=X&childName=Y&goals=Z` |

### Find in buildEmailHtml function and update:

```html
<!-- Primary CTA - Enroll -->
<a href="https://yestoryd.com/enroll?source=email&childId=${childId}&childName=${encodeURIComponent(childName)}${goalsParam}" 
   style="background: linear-gradient(to right, #FF0099, #FF6D00); color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 600;">
  🚀 Boost ${childName}'s Reading
</a>

<!-- Secondary CTA - Book Call -->
<a href="https://yestoryd.com/book-call?source=email&childId=${childId}&childName=${encodeURIComponent(childName)}${goalsParam}"
   style="border: 2px solid #E5E7EB; color: #374151; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 600;">
  📅 Questions? Talk to Coach
</a>
```

---

## PART 5: Fetch Child Age for GoalsCapture (API)

**File:** `app/api/children/[id]/route.ts` (create if not exists)

GoalsCapture needs child's age for age-appropriate goals. Create simple API:

```tsx
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  
  const { data: child, error } = await supabase
    .from('children')
    .select('id, name, age, parent_goals, goals_captured_at')
    .eq('id', params.id)
    .single();

  if (error || !child) {
    return NextResponse.json({ error: 'Child not found' }, { status: 404 });
  }

  return NextResponse.json(child);
}
```

---

## FILES TO MODIFY/CREATE

| File | Action |
|------|--------|
| `app/assessment/results/[id]/page.tsx` | Add "Talk to Coach" CTA with /book-call URL |
| `app/book-call/page.tsx` | CREATE - New page for discovery booking |
| `app/enroll/page.tsx` | Add GoalsCapture fallback when goals empty |
| `app/api/certificate/send/route.ts` | Update email CTAs to use correct URLs |
| `app/api/children/[id]/route.ts` | CREATE - API to fetch child data |

---

## DATA FLOW

```
RESULTS PAGE (goals captured)
├── "Boost Reading" → /enroll?goals=X
└── "Talk to Coach" → /book-call?goals=X
         ↓
    Both pages show goal badges ✅

EMAIL (goals may be empty)  
├── "Boost Reading" → /enroll?childId=X
└── "Talk to Coach" → /book-call?childId=X
         ↓
    Goals in URL? 
    ├── YES → Show badges
    └── NO → Show GoalsCapture component → Save → Then proceed
```

---

## TESTING CHECKLIST

### Results Page:
- [ ] Two CTAs visible: "Boost Reading" + "Talk to Coach"
- [ ] Select goals → Both URLs contain goals param
- [ ] "Boost Reading" goes to /enroll
- [ ] "Talk to Coach" goes to /book-call

### Email:
- [ ] "Boost Reading" URL goes to /enroll
- [ ] "Talk to Coach" URL goes to /book-call

### /enroll Page:
- [ ] With goals in URL → Shows badges
- [ ] Without goals in URL → Shows GoalsCapture
- [ ] Select goals in GoalsCapture → Badges appear, saved to DB

### /book-call Page:
- [ ] With goals in URL → Shows badges
- [ ] Without goals in URL → Shows GoalsCapture
- [ ] Booking captures goals in discovery_calls table

---

## IMPORTANT NOTES

1. **Don't break existing /enroll page** - Only add GoalsCapture as fallback
2. **GoalsCapture is optional** - User can still proceed without selecting goals
3. **Child age needed** - Fetch from DB if not in URL params
4. **Goals save to DB** - Both results_page and landing page capture methods should save
