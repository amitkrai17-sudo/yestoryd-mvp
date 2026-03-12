# GoalsCapture UI Fix - Claude Code Instructions

**Issue:** Goal selection checkboxes and CTA button text are wrapping to 2 lines on mobile, looking unprofessional.

**Screenshot Reference:** User provided screenshot showing:
1. "Grammar & Sentences" wrapping to 2 lines
2. "Reading Comprehension" wrapping to 2 lines  
3. "Speaking Confidence" wrapping to 2 lines
4. CTA "Accelerate anaya's Progress" wrapping to 2 lines

---

## TASK 1: Update Goal Constants with Short Labels

**File:** `lib/constants/goals.ts`

Add `shortLabel` property to each goal for mobile display:

```typescript
export const LEARNING_GOALS: Record<LearningGoalId, LearningGoal> = {
  grammar: {
    id: 'grammar',
    label: 'Grammar & Sentences',
    shortLabel: 'Grammar',
    emoji: '✏️',
    ageRange: [6, 12],
  },
  comprehension: {
    id: 'comprehension',
    label: 'Reading Comprehension',
    shortLabel: 'Comprehension',
    emoji: '🧠',
    ageRange: [6, 12],
  },
  creative_writing: {
    id: 'creative_writing',
    label: 'Creative Writing',
    shortLabel: 'Creative Writing',
    emoji: '🎨',
    ageRange: [8, 12],
  },
  speaking: {
    id: 'speaking',
    label: 'Speaking Confidence',
    shortLabel: 'Speaking',
    emoji: '🎤',
    ageRange: [4, 12],
  },
  competition_prep: {
    id: 'competition_prep',
    label: 'Competition Prep',
    shortLabel: 'Competitions',
    emoji: '🏆',
    ageRange: [8, 12],
  },
};
```

Also update the `LearningGoal` interface to include `shortLabel?: string`

---

## TASK 2: Redesign GoalsCapture Component

**File:** `components/assessment/GoalsCapture.tsx`

### Design Changes:
1. **Switch to 2-column grid** instead of single column list
2. **Vertical card layout** - emoji on top, text below (not side by side)
3. **Use shortLabel** for display
4. **Checkmark in corner** instead of checkbox on right
5. **Smaller text** that won't wrap

### Complete Updated Component:

```tsx
// components/assessment/GoalsCapture.tsx

'use client';

import { useState } from 'react';
import { LEARNING_GOALS, getGoalsForAge, LearningGoalId } from '@/lib/constants/goals';

interface GoalsCaptureProps {
  childId: string;
  childName: string;
  childAge: number;
  onGoalsSaved?: (goals: string[]) => void;
  className?: string;
}

export function GoalsCapture({ childId, childName, childAge, onGoalsSaved, className }: GoalsCaptureProps) {
  const [selectedGoals, setSelectedGoals] = useState<Set<LearningGoalId>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const availableGoals = getGoalsForAge(childAge).filter(g => g !== 'reading');
  
  const toggleGoal = async (goalId: LearningGoalId) => {
    const newGoals = new Set(selectedGoals);
    if (newGoals.has(goalId)) {
      newGoals.delete(goalId);
    } else {
      newGoals.add(goalId);
    }
    setSelectedGoals(newGoals);
    
    // Auto-save on each toggle
    if (newGoals.size > 0) {
      await saveGoals(newGoals);
    }
  };
  
  const saveGoals = async (goals: Set<LearningGoalId>) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/children/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          goals: Array.from(goals),
          captureMethod: 'results_page'
        })
      });
      
      if (response.ok) {
        setSaved(true);
        onGoalsSaved?.(Array.from(goals));
      }
    } catch (error) {
      console.error('Failed to save goals:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="text-center px-2">
        <p className="text-gray-800 text-lg font-semibold">
          Beyond reading, what else would help {childName}?
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Optional — helps us prepare for your session
        </p>
      </div>
      
      {/* Goals Grid - 2 columns */}
      <div className="grid grid-cols-2 gap-3">
        {availableGoals.map((goalId) => {
          const goal = LEARNING_GOALS[goalId];
          const isSelected = selectedGoals.has(goalId);
          
          return (
            <button
              key={goalId}
              onClick={() => toggleGoal(goalId)}
              className={`
                relative flex flex-col items-center justify-center
                p-4 rounded-xl border-2 transition-all
                min-h-[90px] touch-manipulation
                ${isSelected 
                  ? 'border-[#FF0099] bg-[#FF0099]/10' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              {/* Emoji */}
              <span className="text-3xl mb-2">{goal.emoji}</span>
              
              {/* Label - use shortLabel */}
              <span className={`text-sm text-center leading-tight font-medium ${isSelected ? 'text-[#FF0099]' : 'text-gray-700'}`}>
                {goal.shortLabel || goal.label}
              </span>
              
              {/* Checkmark indicator - top right corner */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#FF0099] flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Saved confirmation */}
      {saved && selectedGoals.size > 0 && (
        <p className="text-center text-sm text-green-600 font-medium">
          ✓ Preferences saved
        </p>
      )}
    </div>
  );
}
```

---

## TASK 3: Fix CTA Button Text Wrapping

**File:** `app/assessment/results/[assessmentId]/page.tsx`

Find the main CTA button (pink button with rocket emoji) and:

1. **Shorten the text** from "Accelerate {name}'s Progress" to just "Accelerate Progress" or "Boost {name}'s Skills"
2. **Add `whitespace-nowrap`** class to prevent wrapping
3. **Ensure proper padding** so text fits

### Before (find this pattern):
```tsx
<button className="... bg-[#FF0099] ...">
  🚀 Accelerate {childName}'s Progress
</button>
```

### After:
```tsx
<button className="... bg-[#FF0099] ... whitespace-nowrap text-base">
  🚀 Boost {childName}'s Reading
</button>
```

OR even shorter:
```tsx
<button className="... bg-[#FF0099] ... whitespace-nowrap">
  🚀 Start {childName}'s Journey
</button>
```

---

## TASK 4: Verify Mobile Responsiveness

After making changes, test at these widths:
- 355px (current screenshot width)
- 375px (iPhone SE)
- 390px (iPhone 14)

Ensure:
- [ ] All goal cards fit in 2-column grid without text wrapping
- [ ] Emojis are centered above text
- [ ] Checkmarks appear correctly when selected
- [ ] CTA button text stays on single line
- [ ] Touch targets are at least 44px

---

## Files to Modify Summary

| File | Changes |
|------|---------|
| `lib/constants/goals.ts` | Add `shortLabel` to interface and all goals |
| `components/assessment/GoalsCapture.tsx` | Redesign to 2-column grid with vertical cards |
| `app/assessment/results/[assessmentId]/page.tsx` | Shorten CTA button text, add whitespace-nowrap |

---

## Expected Result

**Before:** Single column list with horizontal cards, text wrapping to 2 lines
**After:** 2-column grid with vertical cards (emoji on top), single-line labels, checkmark in corner

The design should look premium and uniform on mobile devices.
