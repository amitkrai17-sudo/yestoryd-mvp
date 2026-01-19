'use client';

import { useState, useEffect } from 'react';
import { LEARNING_GOALS, getGoalsForAge, LearningGoalId } from '@/lib/constants/goals';
import { Check } from 'lucide-react';

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
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      <div className="p-4 border-b border-gray-100">
        <p className="text-gray-800 font-semibold text-center">
          Beyond reading, what else would help {childName}?
        </p>
        <p className="text-gray-500 text-sm text-center mt-1">
          Optional — helps us prepare for your session
        </p>
      </div>

      <div className="p-4 space-y-3">
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
                  ? 'border-[#ff0099] bg-pink-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{goal.emoji}</span>
                <span className={`text-base ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                  {goal.label}
                </span>
              </div>

              {/* Custom checkbox */}
              <div className={`
                w-6 h-6 rounded-md border-2 flex items-center justify-center
                transition-all flex-shrink-0
                ${isSelected
                  ? 'border-[#ff0099] bg-[#ff0099]'
                  : 'border-gray-300'
                }
              `}>
                {isSelected && (
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Status indicator */}
      {(isSaving || hasSaved) && (
        <div className="px-4 pb-4">
          <p className={`text-xs text-center ${isSaving ? 'text-gray-400' : 'text-green-600'}`}>
            {isSaving ? 'Saving...' : '✓ Preferences saved'}
          </p>
        </div>
      )}
    </div>
  );
}
