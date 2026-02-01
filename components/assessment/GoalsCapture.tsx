'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LEARNING_GOALS, getGoalsForAge, LearningGoalId } from '@/lib/constants/goals';
import { BookOpen, Pencil, Brain, Palette, Award, Trophy, Mic, type LucideIcon } from 'lucide-react';

// Icon mapping for goals (parent-facing, premium feel)
const GOAL_ICONS: Record<string, LucideIcon> = {
  reading: BookOpen,
  grammar: Pencil,
  comprehension: Brain,
  creative_writing: Palette,
  olympiad: Award,
  competition_prep: Trophy,
  speaking: Mic,
};

interface GoalsCaptureProps {
  childId: string;
  childName: string;
  childAge: number;
  onGoalsSaved?: (goals: string[]) => void;
  className?: string;
}

export function GoalsCapture({
  childId,
  childName,
  childAge,
  onGoalsSaved,
  className = ''
}: GoalsCaptureProps) {
  const [selectedGoals, setSelectedGoals] = useState<Set<LearningGoalId>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get age-appropriate goals (excludes 'reading' since they just did reading assessment)
  const availableGoals = getGoalsForAge(childAge).filter(g => g !== 'reading');

  // Debounced save function
  const saveGoals = useCallback(async (goals: Set<LearningGoalId>) => {
    setIsSaving(true);
    setHasSaved(false);
    try {
      const response = await fetch('/api/children/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          goals: Array.from(goals),
          captureMethod: 'results_page',
        }),
      });

      if (response.ok) {
        setHasSaved(true);
        onGoalsSaved?.(Array.from(goals));
      }
    } catch (error) {
      console.error('Failed to save goals:', error);
    } finally {
      setIsSaving(false);
    }
  }, [childId, onGoalsSaved]);

  const toggleGoal = (goalId: LearningGoalId) => {
    const newGoals = new Set(selectedGoals);
    if (newGoals.has(goalId)) {
      newGoals.delete(goalId);
    } else {
      newGoals.add(goalId);
    }
    setSelectedGoals(newGoals);

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Reset hasSaved while user is selecting
    setHasSaved(false);

    // Set new debounced save (1.5 seconds after last selection)
    if (newGoals.size > 0) {
      saveTimeoutRef.current = setTimeout(() => {
        saveGoals(newGoals);
      }, 1500);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (availableGoals.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="text-center px-2">
        <p className="text-white text-base font-semibold">
          Beyond reading, what else would help {childName}?
        </p>
        <p className="text-text-tertiary text-xs mt-1">
          Optional — helps us prepare for your session
        </p>
      </div>

      {/* Goals Grid - 2 columns */}
      <div className="grid grid-cols-2 gap-3">
        {availableGoals.map((goalId) => {
          const goal = LEARNING_GOALS[goalId];
          const isSelected = selectedGoals.has(goalId);
          const IconComponent = GOAL_ICONS[goalId];

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
                  : 'border-border bg-surface-1 hover:border-[#FF0099]/50 active:scale-[0.98]'
                }
              `}
            >
              {/* Icon */}
              {IconComponent && (
                <IconComponent className={`w-8 h-8 mb-2 ${isSelected ? 'text-[#FF0099]' : 'text-text-secondary'}`} />
              )}

              {/* Label - use shortLabel for mobile */}
              <span className={`text-sm text-center leading-tight font-medium ${isSelected ? 'text-[#FF0099]' : 'text-text-secondary'}`}>
                {goal.shortLabel || goal.label}
              </span>

              {/* Checkmark indicator - top right corner */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#FF0099] flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Status indicator */}
      {(isSaving || hasSaved) && (
        <p className={`text-center text-xs ${isSaving ? 'text-text-tertiary' : 'text-green-400 font-medium'}`}>
          {isSaving ? 'Saving...' : 'Preferences saved'}
        </p>
      )}
    </div>
  );
}
