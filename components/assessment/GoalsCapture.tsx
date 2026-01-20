'use client';

import { useState, useEffect } from 'react';
import { LEARNING_GOALS, getGoalsForAge, LearningGoalId } from '@/lib/constants/goals';

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

  // Auto-save when selection changes (with debounce)
  useEffect(() => {
    if (selectedGoals.size === 0) return;

    const timer = setTimeout(async () => {
      setIsSaving(true);
      try {
        const response = await fetch('/api/children/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childId,
            goals: Array.from(selectedGoals),
            captureMethod: 'results_page',
          }),
        });

        if (response.ok) {
          setHasSaved(true);
          onGoalsSaved?.(Array.from(selectedGoals));
        }
      } catch (error) {
        console.error('Failed to save goals:', error);
      } finally {
        setIsSaving(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedGoals, childId, onGoalsSaved]);

  if (availableGoals.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="text-center px-2">
        <p className="text-gray-800 text-base font-semibold">
          Beyond reading, what else would help {childName}?
        </p>
        <p className="text-gray-500 text-xs mt-1">
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
                  : 'border-gray-200 bg-white hover:border-gray-300 active:scale-[0.98]'
                }
              `}
            >
              {/* Emoji */}
              <span className="text-3xl mb-2">{goal.emoji}</span>

              {/* Label - use shortLabel for mobile */}
              <span className={`text-sm text-center leading-tight font-medium ${isSelected ? 'text-[#FF0099]' : 'text-gray-700'}`}>
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
        <p className={`text-center text-xs ${isSaving ? 'text-gray-400' : 'text-green-600 font-medium'}`}>
          {isSaving ? 'Saving...' : '✓ Preferences saved'}
        </p>
      )}
    </div>
  );
}
