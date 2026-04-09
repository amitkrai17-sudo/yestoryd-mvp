# Goals Capture Enhancement - Complete Implementation Spec

## Overview

**Problems to Solve:**
1. "Talk to Coach" CTA missing from results page
2. Goals not captured when parent clicks email CTA (lands on page without goals)
3. Multiple duplicate emails sent for same assessment (4 emails in 3 mins)

**Solutions:**
1. Restore two distinct CTAs on results page
2. Add GoalsCapture fallback on landing pages when goals missing
3. Add idempotency check to prevent duplicate emails

---

## PRE-REQUISITE: Database Migration

**Run in Supabase SQL Editor FIRST:**

```sql
-- Add column to track certificate email sent time (for idempotency)
ALTER TABLE children 
ADD COLUMN IF NOT EXISTS certificate_email_sent_at TIMESTAMPTZ;
```

---

## PART 1: Results Page - Two Distinct CTAs

**File:** `app/assessment/results/[id]/page.tsx`

### Required:
Two separate CTAs with different destinations:

| CTA | Text | Destination | Style |
|-----|------|-------------|-------|
| Primary | "🚀 Boost {name}'s Reading" | `/enroll?...` | Pink gradient button |
| Secondary | "📅 Questions? Talk to Coach" | `/book-call?...` | Outline/bordered button |

### Implementation:

Find where CTAs are rendered and ensure BOTH exist:

```tsx
// Build URLs with goals
const goalsParam = selectedGoals.length > 0 
  ? `&goals=${encodeURIComponent(selectedGoals.join(','))}` 
  : '';

const baseParams = `childId=${assessmentId}&childName=${encodeURIComponent(childName)}&childAge=${childAge}&parentEmail=${encodeURIComponent(parentEmail)}&parentPhone=${encodeURIComponent(parentPhone)}`;

const enrollUrl = `/enroll?source=results&${baseParams}${goalsParam}`;
const bookCallUrl = `/book-call?source=results&${baseParams}${goalsParam}`;
```

```tsx
{/* Primary CTA - Enroll */}
<Link href={enrollUrl} className="block w-full">
  <button className="w-full bg-gradient-to-r from-[#FF0099] to-[#FF6D00] text-white font-semibold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all whitespace-nowrap">
    🚀 Boost {childName}'s Reading
  </button>
</Link>

<p className="text-center text-gray-500 text-sm my-2">100% Refund Guarantee • Start within 3-5 days</p>

{/* Secondary CTA - Talk to Coach */}
<Link href={bookCallUrl} className="block w-full">
  <button className="w-full border-2 border-gray-300 bg-white text-gray-700 font-semibold py-3 px-6 rounded-full hover:bg-gray-50 transition-all whitespace-nowrap">
    📅 Questions? Talk to Coach
  </button>
</Link>
```

---

## PART 2: Create /book-call Page

**File:** `app/book-call/page.tsx` (CREATE NEW)

This page is for booking a FREE discovery call (separate from paid enrollment).

### Key Features:
1. Read childId, childName, childAge, goals from URL params
2. If goals exist → Show badges
3. If goals empty → Show GoalsCapture component
4. Show booking calendar/form

### Complete Implementation:

```tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { GoalsCapture } from '@/components/assessment/GoalsCapture';
import { LEARNING_GOALS } from '@/lib/constants/goals';
import Link from 'next/link';

function BookCallContent() {
  const searchParams = useSearchParams();
  
  const childId = searchParams.get('childId') || '';
  const childName = searchParams.get('childName') || '';
  const childAgeParam = searchParams.get('childAge');
  const parentEmail = searchParams.get('parentEmail') || '';
  const parentPhone = searchParams.get('parentPhone') || '';
  const goalsParam = searchParams.get('goals') || '';
  const source = searchParams.get('source') || 'direct';
  
  const [goals, setGoals] = useState<string[]>(
    goalsParam ? goalsParam.split(',').filter(Boolean) : []
  );
  const [childAge, setChildAge] = useState<number>(
    childAgeParam ? parseInt(childAgeParam) : 7
  );
  const [loading, setLoading] = useState(!childAgeParam && !!childId);

  // Fetch child data if age not in URL
  useEffect(() => {
    if (childId && !childAgeParam) {
      setLoading(true);
      fetch(`/api/children/${childId}`)
        .then(res => res.json())
        .then(data => {
          if (data.age) setChildAge(data.age);
          if (data.parent_goals?.length > 0 && goals.length === 0) {
            setGoals(data.parent_goals);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [childId, childAgeParam]);

  // Capitalize first letter of name
  const displayName = childName 
    ? childName.charAt(0).toUpperCase() + childName.slice(1).toLowerCase()
    : 'your child';

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-block mb-4">
            <span className="text-2xl font-bold">
              <span className="text-gray-800">Yesto</span>
              <span className="text-[#FF0099]">ryd</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">
            Book a FREE Discovery Call
          </h1>
          <p className="text-gray-600 mt-2">
            15 minutes with Coach Rucha to discuss {displayName}'s reading journey
          </p>
        </div>

        {/* Goals Section */}
        {!loading && (
          <>
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
            ) : childId ? (
              // Show GoalsCapture if goals not yet captured
              <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border">
                <GoalsCapture
                  childId={childId}
                  childName={displayName}
                  childAge={childAge}
                  onGoalsSaved={(savedGoals) => setGoals(savedGoals)}
                />
              </div>
            ) : null}
          </>
        )}

        {/* What to Expect */}
        <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border">
          <h3 className="font-semibold text-gray-800 mb-3">📞 What to Expect</h3>
          <ul className="space-y-2 text-gray-600 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Understand {displayName}'s current reading level</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Get personalized recommendations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Ask any questions about the program</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>No obligation - 100% free</span>
            </li>
          </ul>
        </div>

        {/* Coach Info */}
        <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
              R
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Coach Rucha T</h3>
              <p className="text-sm text-gray-600">Founder & Lead Reading Coach</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-yellow-500">⭐</span>
                <span className="text-sm text-gray-600">4.9 • 10+ years • 100+ families</span>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Form/Calendar */}
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h3 className="font-semibold text-gray-800 mb-4">📅 Book Your Slot</h3>
          
          {/* Simple form that redirects to native booking or Cal.com */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              // Build URL with all params including goals
              const bookingUrl = `/enroll?source=${source}&type=discovery&childId=${childId}&childName=${encodeURIComponent(childName)}&childAge=${childAge}&parentEmail=${encodeURIComponent(parentEmail)}&parentPhone=${encodeURIComponent(parentPhone)}${goals.length > 0 ? `&goals=${goals.join(',')}` : ''}`;
              window.location.href = bookingUrl;
            }}
          >
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#FF0099] to-[#FF6D00] text-white font-semibold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all"
            >
              📅 Schedule Free Call
            </button>
          </form>
          
          <p className="text-center text-xs text-gray-500 mt-3">
            You'll be redirected to select a convenient time slot
          </p>
        </div>

        {/* Trust indicators */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>🔒 Your information is secure</p>
          <p className="mt-1">Join 100+ families who started their journey with us</p>
        </div>

        {/* Alternative CTA */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm mb-2">Ready to enroll directly?</p>
          <Link 
            href={`/enroll?source=${source}&childId=${childId}&childName=${encodeURIComponent(childName)}&childAge=${childAge}${goals.length > 0 ? `&goals=${goals.join(',')}` : ''}`}
            className="text-[#FF0099] font-medium hover:underline"
          >
            Skip call & enroll now →
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function BookCallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF0099]"></div>
      </div>
    }>
      <BookCallContent />
    </Suspense>
  );
}
```

---

## PART 3: Update /enroll Page - Add GoalsCapture Fallback

**File:** `app/enroll/page.tsx`

### Changes Required:

#### 1. Add imports at top:
```tsx
import { GoalsCapture } from '@/components/assessment/GoalsCapture';
```

#### 2. Convert goals from const to state:

Find:
```tsx
const goalsParam = searchParams.get('goals');
const goals = goalsParam ? goalsParam.split(',') : [];
```

Replace with:
```tsx
const goalsParam = searchParams.get('goals') || '';
const [goals, setGoals] = useState<string[]>(
  goalsParam ? goalsParam.split(',').filter(Boolean) : []
);
```

#### 3. Add childAge state and fetch if needed:

```tsx
const childAgeParam = searchParams.get('childAge');
const [childAge, setChildAge] = useState<number>(
  childAgeParam ? parseInt(childAgeParam) : 7
);

// Fetch child data if age not in URL but childId exists
useEffect(() => {
  if (childId && !childAgeParam) {
    fetch(`/api/children/${childId}`)
      .then(res => res.json())
      .then(data => {
        if (data.age) setChildAge(data.age);
        if (data.parent_goals?.length > 0 && goals.length === 0) {
          setGoals(data.parent_goals);
        }
      })
      .catch(console.error);
  }
}, [childId, childAgeParam]);
```

#### 4. Update goals display section:

Find the goals badges section and replace with conditional:

```tsx
{/* Goals Section - Show badges OR GoalsCapture */}
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
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200"
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
      childAge={childAge}
      onGoalsSaved={(savedGoals) => setGoals(savedGoals)}
    />
  </div>
) : null}
```

#### 5. Capitalize childName for display:

```tsx
const displayName = childName 
  ? childName.charAt(0).toUpperCase() + childName.slice(1).toLowerCase()
  : 'your child';
```

---

## PART 4: Update Certificate Email CTAs

**File:** `app/api/certificate/send/route.ts`

### In the buildEmailHtml function, update the CTA buttons:

Find the CTA section and ensure TWO buttons with DIFFERENT URLs:

```html
<!-- Primary CTA - Enroll -->
<div style="text-align: center; margin: 24px 0;">
  <a href="https://yestoryd.com/enroll?source=email&childId=${childId}&childName=${encodeURIComponent(childName)}&childAge=${childAge}${goalsParam}" 
     style="display: inline-block; background: linear-gradient(to right, #FF0099, #FF6D00); color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 16px;">
    🚀 Boost ${childName}'s Reading
  </a>
</div>

<p style="text-align: center; color: #6B7280; font-size: 14px; margin: 8px 0;">
  100% Refund Guarantee • Start within 3-5 days
</p>

<!-- Secondary CTA - Book Call -->
<div style="text-align: center; margin: 16px 0;">
  <a href="https://yestoryd.com/book-call?source=email&childId=${childId}&childName=${encodeURIComponent(childName)}&childAge=${childAge}${goalsParam}"
     style="display: inline-block; border: 2px solid #E5E7EB; background: white; color: #374151; padding: 12px 28px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 14px;">
    📅 Questions? Talk to Coach
  </a>
</div>
```

### Ensure goalsParam is built correctly:

```typescript
const goalsParam = goals && goals.length > 0 
  ? `&goals=${encodeURIComponent(goals.join(','))}` 
  : '';
```

---

## PART 5: Create Child Data API

**File:** `app/api/children/[id]/route.ts` (CREATE NEW)

```tsx
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const childId = params.id;

    if (!childId) {
      return NextResponse.json(
        { error: 'Child ID required' },
        { status: 400 }
      );
    }

    const { data: child, error } = await supabase
      .from('children')
      .select('id, name, age, parent_goals, goals_captured_at, goals_capture_method')
      .eq('id', childId)
      .single();

    if (error || !child) {
      console.error('Child fetch error:', error);
      return NextResponse.json(
        { error: 'Child not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(child);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## PART 6: Fix Duplicate Certificate Emails (CRITICAL)

**File:** `app/api/certificate/send/route.ts`

### Problem:
Multiple emails (4 in 3 minutes) sent for same assessment due to:
- React Strict Mode double renders
- useEffect running multiple times
- No idempotency check

### Solution:
Add idempotency check using `certificate_email_sent_at` timestamp.

### Add at the START of POST handler (after parsing body):

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      childName, 
      childId,  // REQUIRED for idempotency
      childAge, 
      score, 
      goals,
      // ... other fields
    } = body;

    // ============================================
    // IDEMPOTENCY CHECK - Prevent duplicate emails
    // ============================================
    if (childId) {
      const { data: child } = await supabase
        .from('children')
        .select('certificate_email_sent_at')
        .eq('id', childId)
        .single();
      
      if (child?.certificate_email_sent_at) {
        const lastSent = new Date(child.certificate_email_sent_at);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (lastSent > fiveMinutesAgo) {
          console.log(`[Certificate] Email already sent for ${childId} at ${lastSent.toISOString()}, skipping`);
          return NextResponse.json({ 
            success: true, 
            message: 'Email already sent recently',
            skipped: true,
            lastSentAt: child.certificate_email_sent_at
          });
        }
      }
    }

    // ... rest of validation and email building ...
```

### Add AFTER successful email send (after sgMail.send):

```typescript
    // Send email via SendGrid
    await sgMail.send(msg);
    console.log(`[Certificate] Email sent to ${email} for child ${childId}`);

    // ============================================
    // MARK EMAIL AS SENT - For idempotency
    // ============================================
    if (childId) {
      const { error: updateError } = await supabase
        .from('children')
        .update({ 
          certificate_email_sent_at: new Date().toISOString() 
        })
        .eq('id', childId);
      
      if (updateError) {
        console.error('[Certificate] Failed to update sent timestamp:', updateError);
        // Don't throw - email was still sent successfully
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Certificate email sent',
      // ... other response fields
    });
```

### Ensure childId is in validation schema:

```typescript
const schema = z.object({
  email: z.string().email(),
  childName: z.string(),
  childId: z.string().optional(),  // Add this if not present
  childAge: z.number().optional(),
  score: z.number(),
  goals: z.array(z.string()).optional(),
  // ... other fields
});
```

---

## FILES SUMMARY

| File | Action | Purpose |
|------|--------|---------|
| `app/assessment/results/[id]/page.tsx` | MODIFY | Add "Talk to Coach" CTA → /book-call |
| `app/book-call/page.tsx` | CREATE | New discovery call booking page |
| `app/enroll/page.tsx` | MODIFY | Add GoalsCapture fallback |
| `app/api/certificate/send/route.ts` | MODIFY | Update CTAs + Add idempotency |
| `app/api/children/[id]/route.ts` | CREATE | API to fetch child data |

---

## DATABASE MIGRATION (Run First!)

```sql
-- Add column for email idempotency
ALTER TABLE children 
ADD COLUMN IF NOT EXISTS certificate_email_sent_at TIMESTAMPTZ;
```

---

## TESTING CHECKLIST

### Results Page:
- [ ] Two CTAs visible: "Boost Reading" + "Talk to Coach"
- [ ] Select goals → Both URLs contain goals param
- [ ] "Boost Reading" → /enroll with goals
- [ ] "Talk to Coach" → /book-call with goals

### /book-call Page:
- [ ] Page loads without errors
- [ ] With goals in URL → Shows badges
- [ ] Without goals → Shows GoalsCapture component
- [ ] "Schedule Free Call" redirects to booking

### /enroll Page:
- [ ] With goals in URL → Shows badges
- [ ] Without goals in URL → Shows GoalsCapture
- [ ] GoalsCapture saves to DB and updates UI

### Certificate Email:
- [ ] Has two CTAs with correct URLs
- [ ] "Boost Reading" → /enroll?childId=X
- [ ] "Talk to Coach" → /book-call?childId=X

### Duplicate Email Fix:
- [ ] First assessment → Email sent ✅
- [ ] Refresh page within 5 mins → No duplicate email
- [ ] Check logs: "Email already sent recently, skipping"

### End-to-End:
- [ ] Complete assessment (no goals selected)
- [ ] Receive email
- [ ] Click email CTA → Land on /enroll or /book-call
- [ ] GoalsCapture appears (since no goals in URL)
- [ ] Select goals → Saved to DB
- [ ] Proceed with booking

---

## COMMAND FOR CLAUDE CODE

```
Read this spec and implement all 6 parts:

1. Results page: Add "Talk to Coach" CTA going to /book-call with goals
2. Create /book-call page with GoalsCapture fallback when goals empty
3. Update /enroll page: Add GoalsCapture fallback when goals empty  
4. Update certificate email: Two CTAs - /enroll and /book-call
5. Create /api/children/[id] endpoint to fetch child age/goals
6. Fix duplicate emails: Add idempotency check using certificate_email_sent_at

Key logic: If goals in URL → show badges. If goals empty → show GoalsCapture.
Idempotency: Skip email if sent within last 5 minutes for same childId.

Database migration to run first:
ALTER TABLE children ADD COLUMN IF NOT EXISTS certificate_email_sent_at TIMESTAMPTZ;
```
