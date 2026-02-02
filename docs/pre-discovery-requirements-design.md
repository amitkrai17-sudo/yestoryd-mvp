# Pre-Discovery Requirements Capture - Design Document

**Feature:** Hybrid approach to capture parent goals before discovery call  
**Date:** January 19, 2026  
**Principles:** Single source of truth, mobile-first, extend existing schema, zero friction

---

## 🎯 OBJECTIVES

1. **Capture parent goals** beyond reading (grammar, comprehension, creative writing, etc.)
2. **Position Yestoryd** as complete English confidence platform
3. **Zero friction** — both touchpoints are optional
4. **Equip coaches** with context before discovery calls

---

## 📊 ARCHITECTURE DECISION: SINGLE SOURCE OF TRUTH

### ❌ What We're NOT Doing
- No new `parent_requirements` table
- No separate `goals` table
- No duplicating data across tables

### ✅ What We ARE Doing
- Extend `children` table with 3 columns
- Goals travel with the child record everywhere
- Coach, Admin, rAI all read from same source

---

## 🗄️ DATABASE CHANGES

### Extend `children` Table (Single Migration)

```sql
-- Migration: Add parent goals columns to children table
-- Location: Run in Supabase SQL Editor

ALTER TABLE children 
ADD COLUMN IF NOT EXISTS parent_goals TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS goals_captured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS goals_capture_method TEXT;

-- Add check constraint for capture method
ALTER TABLE children 
ADD CONSTRAINT valid_goals_capture_method 
CHECK (goals_capture_method IS NULL OR goals_capture_method IN ('results_page', 'whatsapp', 'discovery_call', 'coach_noted'));

-- Index for filtering children by goals (for future analytics)
CREATE INDEX IF NOT EXISTS idx_children_parent_goals ON children USING GIN (parent_goals);

-- Comment for documentation
COMMENT ON COLUMN children.parent_goals IS 'Array of parent-selected learning goals: reading, grammar, comprehension, creative_writing, speaking, competition_prep';
COMMENT ON COLUMN children.goals_captured_at IS 'When goals were first captured';
COMMENT ON COLUMN children.goals_capture_method IS 'How goals were captured: results_page, whatsapp, discovery_call, coach_noted';
```

### Goal Options (Standardized Values)

```typescript
// lib/constants/goals.ts

export const LEARNING_GOALS = {
  reading: {
    id: 'reading',
    label: 'Reading & Phonics',
    emoji: '📖',
    description: 'Decoding, fluency, phonemic awareness',
    minAge: 4,
    maxAge: 12,
  },
  grammar: {
    id: 'grammar',
    label: 'Grammar & Sentences',
    emoji: '✏️',
    description: 'Sentence structure, tenses, parts of speech',
    minAge: 6,
    maxAge: 12,
  },
  comprehension: {
    id: 'comprehension',
    label: 'Reading Comprehension',
    emoji: '🧠',
    description: 'Understanding, inference, analysis',
    minAge: 6,
    maxAge: 12,
  },
  creative_writing: {
    id: 'creative_writing',
    label: 'Creative Writing',
    emoji: '🎨',
    description: 'Storytelling, essays, expression',
    minAge: 7,
    maxAge: 12,
  },
  speaking: {
    id: 'speaking',
    label: 'Speaking Confidence',
    emoji: '🎤',
    description: 'Pronunciation, presentation, confidence',
    minAge: 4,
    maxAge: 12,
  },
  competition_prep: {
    id: 'competition_prep',
    label: 'Olympiad / Competition',
    emoji: '🏆',
    description: 'Spell Bee, English Olympiad prep',
    minAge: 8,
    maxAge: 12,
  },
} as const;

export type LearningGoalId = keyof typeof LEARNING_GOALS;

// Helper: Get age-appropriate goals
export function getGoalsForAge(age: number): LearningGoalId[] {
  return (Object.keys(LEARNING_GOALS) as LearningGoalId[]).filter(
    (goalId) => {
      const goal = LEARNING_GOALS[goalId];
      return age >= goal.minAge && age <= goal.maxAge;
    }
  );
}
```

---

## 🖥️ TOUCHPOINT 1: ENHANCED RESULTS PAGE

### Location
`app/results/[assessmentId]/page.tsx` (or wherever results are shown)

### Design: Mobile-First Goals Section

```
┌─────────────────────────────────────────────────────────────────┐
│                    📊 Assessment Results                        │
│                                                                 │
│  [Existing score display, feedback, rAI insights...]           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Beyond reading, what else would help Aarav?                   │
│  (Optional - helps us prepare for your call)                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✏️  Grammar & Sentences                             ☐  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🧠  Reading Comprehension                           ☐  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🎨  Creative Writing                                ☐  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🎤  Speaking Confidence                             ☐  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Book FREE Discovery Call →                      │   │
│  │              (Primary CTA - Pink)                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Component: GoalsCapture

```tsx
// components/assessment/GoalsCapture.tsx

'use client';

import { useState } from 'react';
import { LEARNING_GOALS, getGoalsForAge, LearningGoalId } from '@/lib/constants/goals';

interface GoalsCaptureProps {
  childId: string;
  childAge: number;
  onGoalsSaved?: (goals: string[]) => void;
  className?: string;
}

export function GoalsCapture({ childId, childAge, onGoalsSaved, className }: GoalsCaptureProps) {
  const [selectedGoals, setSelectedGoals] = useState<Set<LearningGoalId>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  
  // Get age-appropriate goals (excludes 'reading' since they just did reading assessment)
  const availableGoals = getGoalsForAge(childAge).filter(g => g !== 'reading');
  
  const toggleGoal = (goalId: LearningGoalId) => {
    const newGoals = new Set(selectedGoals);
    if (newGoals.has(goalId)) {
      newGoals.delete(goalId);
    } else {
      newGoals.add(goalId);
    }
    setSelectedGoals(newGoals);
  };
  
  const saveGoals = async () => {
    if (selectedGoals.size === 0) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/children/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          goals: Array.from(selectedGoals),
          captureMethod: 'results_page'
        })
      });
      
      if (response.ok) {
        onGoalsSaved?.(Array.from(selectedGoals));
      }
    } catch (error) {
      console.error('Failed to save goals:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Auto-save when selection changes (debounced)
  // Or save on CTA click - design decision
  
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="text-center">
        <p className="text-white text-lg font-medium">
          Beyond reading, what else would help?
        </p>
        <p className="text-gray-400 text-sm mt-1">
          Optional — helps us prepare for your call
        </p>
      </div>
      
      <div className="space-y-3">
        {availableGoals.map((goalId) => {
          const goal = LEARNING_GOALS[goalId];
          const isSelected = selectedGoals.has(goalId);
          
          return (
            <button
              key={goalId}
              onClick={() => toggleGoal(goalId)}
              className={`
                w-full flex items-center justify-between
                p-4 rounded-xl border-2 transition-all
                min-h-[56px] touch-manipulation
                ${isSelected 
                  ? 'border-[#FF0099] bg-[#FF0099]/10' 
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{goal.emoji}</span>
                <span className={`text-base ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                  {goal.label}
                </span>
              </div>
              
              {/* Custom checkbox */}
              <div className={`
                w-6 h-6 rounded-md border-2 flex items-center justify-center
                transition-all
                ${isSelected 
                  ? 'border-[#FF0099] bg-[#FF0099]' 
                  : 'border-gray-500'
                }
              `}>
                {isSelected && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### Mobile Responsiveness Rules

```css
/* Ensure in your globals.css or component */

/* Touch targets: minimum 44px (Apple HIG), we use 56px */
.touch-manipulation {
  touch-action: manipulation; /* Removes 300ms delay */
}

/* Goal buttons */
@media (max-width: 375px) {
  /* iPhone SE and smaller */
  .goal-button {
    padding: 12px 14px;
    font-size: 14px;
  }
}

@media (min-width: 376px) and (max-width: 640px) {
  /* Standard phones */
  .goal-button {
    padding: 16px;
    font-size: 16px;
  }
}
```

---

## 📱 TOUCHPOINT 2: WHATSAPP FOLLOW-UP

### Template: P7_goals_capture

**Trigger:** 30 minutes after assessment completion (if goals not captured on results page)

**Template Name:** `p7_goals_capture`  
**Category:** UTILITY (to avoid marketing approval delays)

```
Hi {{1}}! 👋

Thank you for {{2}}'s reading assessment! 📖

Before your FREE discovery call, help us prepare:

What would you like {{2}} to improve?
Reply with numbers (e.g., 1,3):

1️⃣ Grammar & Sentences
2️⃣ Reading Comprehension
3️⃣ Creative Writing
4️⃣ Speaking Confidence
5️⃣ Competition Prep

This helps Coach {{3}} create a personalized plan! 🎯
```

**Variables:**
- {{1}} = Parent name
- {{2}} = Child name
- {{3}} = Assigned coach name (or "our coach" if not assigned)

### Webhook Handler for WhatsApp Replies

```typescript
// app/api/webhooks/aisensy/goals/route.ts

import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const GOAL_MAPPING: Record<string, string> = {
  '1': 'grammar',
  '2': 'comprehension',
  '3': 'creative_writing',
  '4': 'speaking',
  '5': 'competition_prep',
};

export async function POST(request: Request) {
  const supabase = createClient();
  
  try {
    const payload = await request.json();
    
    // AiSensy webhook structure
    const { from, text, messageId } = payload;
    
    // Normalize phone
    const phone = normalizePhone(from);
    
    // Parse goal numbers from reply (e.g., "1,3" or "1 3" or "1, 3")
    const numbers = text.match(/[1-5]/g);
    if (!numbers || numbers.length === 0) {
      // Not a goals reply, ignore
      return NextResponse.json({ status: 'ignored' });
    }
    
    // Map to goal IDs
    const goals = [...new Set(numbers)].map(n => GOAL_MAPPING[n]).filter(Boolean);
    
    if (goals.length === 0) {
      return NextResponse.json({ status: 'no_valid_goals' });
    }
    
    // Find child by parent phone (most recent assessment)
    const { data: child } = await supabase
      .from('children')
      .select('id, parent_goals')
      .eq('parent_phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!child) {
      return NextResponse.json({ status: 'child_not_found' });
    }
    
    // Merge with existing goals (don't overwrite)
    const existingGoals = child.parent_goals || [];
    const mergedGoals = [...new Set([...existingGoals, ...goals])];
    
    // Update child record
    const { error } = await supabase
      .from('children')
      .update({
        parent_goals: mergedGoals,
        goals_captured_at: child.goals_captured_at || new Date().toISOString(),
        goals_capture_method: child.goals_capture_method || 'whatsapp',
      })
      .eq('id', child.id);
    
    if (error) throw error;
    
    // Optional: Send confirmation
    // await sendWhatsApp(phone, 'Thanks! We\'ve noted your preferences. 🎯');
    
    return NextResponse.json({ status: 'success', goals: mergedGoals });
    
  } catch (error) {
    console.error('Goals webhook error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
```

### Trigger Logic (When to Send P7)

```typescript
// lib/triggers/assessment-complete.ts

export async function onAssessmentComplete(childId: string) {
  const supabase = createClient();
  
  // Check if goals already captured
  const { data: child } = await supabase
    .from('children')
    .select('parent_goals, parent_phone, parent_name, name')
    .eq('id', childId)
    .single();
  
  if (!child) return;
  
  // If goals already captured on results page, skip WhatsApp
  if (child.parent_goals && child.parent_goals.length > 0) {
    console.log('Goals already captured, skipping P7');
    return;
  }
  
  // Schedule P7 message for 30 minutes later
  await scheduleWhatsAppMessage({
    templateName: 'p7_goals_capture',
    phone: child.parent_phone,
    variables: [child.parent_name, child.name, 'our coach'],
    scheduledFor: new Date(Date.now() + 30 * 60 * 1000), // 30 mins
    childId,
    triggerType: 'goals_capture',
  });
}
```

---

## 👨‍🏫 COACH VISIBILITY: DISCOVERY PREP

### Update Coach Discovery Call View

**Location:** `app/coach/discovery-calls/[id]/page.tsx`

Add a section showing parent goals:

```tsx
// Add to existing discovery call detail page

interface ParentGoalsDisplayProps {
  goals: string[];
  capturedAt?: string;
  captureMethod?: string;
}

function ParentGoalsDisplay({ goals, capturedAt, captureMethod }: ParentGoalsDisplayProps) {
  if (!goals || goals.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <h3 className="text-gray-400 text-sm font-medium mb-2">Parent Goals</h3>
        <p className="text-gray-500 text-sm italic">
          Not captured yet — explore during call
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium">Parent Goals</h3>
        {captureMethod && (
          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
            via {captureMethod.replace('_', ' ')}
          </span>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {goals.map((goalId) => {
          const goal = LEARNING_GOALS[goalId as LearningGoalId];
          if (!goal) return null;
          
          return (
            <span
              key={goalId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 
                         bg-[#FF0099]/10 border border-[#FF0099]/30 
                         rounded-full text-sm text-white"
            >
              <span>{goal.emoji}</span>
              <span>{goal.label}</span>
            </span>
          );
        })}
      </div>
      
      {capturedAt && (
        <p className="text-xs text-gray-500 mt-3">
          Captured {new Date(capturedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
```

### Update Discovery Call API to Include Goals

```typescript
// app/api/discovery-call/[id]/route.ts

// In the GET handler, join with children to get goals
const { data: call } = await supabase
  .from('discovery_calls')
  .select(`
    *,
    children (
      id,
      name,
      age,
      parent_name,
      parent_phone,
      parent_email,
      assessment_score,
      assessment_wpm,
      parent_goals,
      goals_captured_at,
      goals_capture_method
    )
  `)
  .eq('id', id)
  .single();
```

---

## 🔌 API ENDPOINTS

### 1. Save Goals from Results Page

```typescript
// app/api/children/goals/route.ts

import { createClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { LEARNING_GOALS, LearningGoalId } from '@/lib/constants/goals';

export async function POST(request: Request) {
  const supabase = createClient();
  
  try {
    const { childId, goals, captureMethod } = await request.json();
    
    // Validate goals
    const validGoals = goals.filter(
      (g: string) => Object.keys(LEARNING_GOALS).includes(g)
    );
    
    if (validGoals.length === 0) {
      return NextResponse.json(
        { error: 'No valid goals provided' },
        { status: 400 }
      );
    }
    
    // Get existing goals to merge (don't overwrite)
    const { data: child } = await supabase
      .from('children')
      .select('parent_goals, goals_captured_at')
      .eq('id', childId)
      .single();
    
    const existingGoals = child?.parent_goals || [];
    const mergedGoals = [...new Set([...existingGoals, ...validGoals])];
    
    // Update child record
    const { error } = await supabase
      .from('children')
      .update({
        parent_goals: mergedGoals,
        goals_captured_at: child?.goals_captured_at || new Date().toISOString(),
        goals_capture_method: child?.goals_capture_method || captureMethod,
      })
      .eq('id', childId);
    
    if (error) throw error;
    
    return NextResponse.json({ 
      success: true, 
      goals: mergedGoals 
    });
    
  } catch (error) {
    console.error('Save goals error:', error);
    return NextResponse.json(
      { error: 'Failed to save goals' },
      { status: 500 }
    );
  }
}

// GET: Retrieve goals for a child
export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const childId = searchParams.get('childId');
  
  if (!childId) {
    return NextResponse.json({ error: 'childId required' }, { status: 400 });
  }
  
  const { data, error } = await supabase
    .from('children')
    .select('parent_goals, goals_captured_at, goals_capture_method')
    .eq('id', childId)
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data);
}
```

### 2. Coach Can Add Goals (During/After Discovery)

```typescript
// Extend the existing discovery call update endpoint
// app/api/discovery-call/[id]/route.ts

// In the PATCH handler, allow updating child goals
if (body.parentGoals) {
  const { error: goalsError } = await supabase
    .from('children')
    .update({
      parent_goals: body.parentGoals,
      goals_captured_at: new Date().toISOString(),
      goals_capture_method: 'discovery_call',
    })
    .eq('id', call.child_id);
  
  if (goalsError) {
    console.error('Failed to update goals:', goalsError);
  }
}
```

---

## 📁 FILE STRUCTURE

```
lib/
├── constants/
│   └── goals.ts                    # NEW: Goal definitions + helpers

components/
├── assessment/
│   └── GoalsCapture.tsx            # NEW: Reusable goals checkbox component

app/
├── api/
│   ├── children/
│   │   └── goals/
│   │       └── route.ts            # NEW: Save/get goals API
│   └── webhooks/
│       └── aisensy/
│           └── goals/
│               └── route.ts        # NEW: WhatsApp reply handler
├── results/
│   └── [assessmentId]/
│       └── page.tsx                # MODIFY: Add GoalsCapture component

Coach portal (read goals):
├── coach/
│   └── discovery-calls/
│       └── [id]/
│           └── page.tsx            # MODIFY: Add ParentGoalsDisplay
```

---

## 🧪 TESTING CHECKLIST

### Results Page Goals
- [ ] Goals appear after assessment score
- [ ] Age-appropriate goals shown (e.g., no competition_prep for 5-year-old)
- [ ] Checkboxes have 44px+ touch targets
- [ ] Selection saves to database
- [ ] Can proceed to booking without selecting any
- [ ] Mobile: Test on 375px width (iPhone SE)
- [ ] Mobile: Test on 390px width (iPhone 14)

### WhatsApp Flow
- [ ] P7 sends 30 min after assessment (if no goals captured)
- [ ] P7 does NOT send if goals already captured
- [ ] Reply "1,3" correctly maps to goals
- [ ] Reply "1 3 5" (spaces) works
- [ ] Invalid reply (e.g., "hello") is ignored
- [ ] Goals merge (don't overwrite) if already exist

### Coach Visibility
- [ ] Goals display on discovery call detail page
- [ ] Shows "Not captured" if empty
- [ ] Shows capture method badge
- [ ] Coach can add/edit goals after call

---

## 📊 ANALYTICS EVENTS (Optional)

```typescript
// Track for funnel optimization
trackEvent('goals_viewed', { childId, age });
trackEvent('goals_selected', { childId, goals: selectedGoals });
trackEvent('goals_saved', { childId, method: 'results_page', count: goals.length });
trackEvent('goals_whatsapp_sent', { childId });
trackEvent('goals_whatsapp_replied', { childId, goalsCount });
```

---

## 🚀 IMPLEMENTATION ORDER (For Claude Code)

1. **Database migration** — Run SQL in Supabase
2. **Constants file** — `lib/constants/goals.ts`
3. **API endpoint** — `app/api/children/goals/route.ts`
4. **GoalsCapture component** — `components/assessment/GoalsCapture.tsx`
5. **Integrate into results page** — Modify existing file
6. **Coach discovery view** — Add ParentGoalsDisplay
7. **WhatsApp template** — Create P7 in AiSensy
8. **WhatsApp webhook** — `app/api/webhooks/aisensy/goals/route.ts`
9. **Testing** — Mobile + end-to-end

---

## ⚠️ IMPORTANT NOTES FOR CLAUDE CODE

1. **Don't create new tables** — Only extend `children` table
2. **Reuse existing patterns** — Check how other components handle mobile responsiveness
3. **Follow auth patterns** — Results page is public, API needs appropriate checks
4. **Use existing WhatsApp infra** — Extend AiSensy integration, don't rebuild
5. **Goals are optional** — Never block user flow if they skip
6. **Merge, don't overwrite** — If goals exist, add new ones to array

---

**Ready for Claude Code implementation!** 🎯
