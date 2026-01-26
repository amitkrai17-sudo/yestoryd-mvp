'use client';

import { Check, Target } from 'lucide-react';
import { LEARNING_GOALS } from '@/lib/constants/goals';
import { GoalsCapture } from '@/components/assessment/GoalsCapture';

interface FocusAreasCardProps {
  goals: string[];
  displayChildName: string;
  childId?: string;
  childAgeForGoals: number;
  onGoalsSaved: (goals: string[]) => void;
}

export function FocusAreasCard({
  goals,
  displayChildName,
  childId,
  childAgeForGoals,
  onGoalsSaved,
}: FocusAreasCardProps) {
  if (goals.length === 0 && !childId) return null;

  return (
    <section className="bg-gradient-to-br from-[#FF0099]/10 to-[#00ABFF]/10 rounded-2xl p-5 border border-[#FF0099]/20">
      {goals.length > 0 ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-[#FF0099]" />
            <p className="text-white font-semibold text-sm">
              {displayChildName}&apos;s Focus Areas
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {goals.map((goalId) => {
              const goal = LEARNING_GOALS[goalId];
              if (!goal) return null;
              return (
                <span
                  key={goalId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 rounded-full text-xs font-medium text-text-secondary border border-border"
                >
                  <Check className="w-3 h-3 text-[#FF0099]" />
                  {goal.shortLabel || goal.label}
                </span>
              );
            })}
          </div>
        </>
      ) : childId ? (
        <GoalsCapture
          childId={childId}
          childName={displayChildName}
          childAge={childAgeForGoals}
          onGoalsSaved={onGoalsSaved}
        />
      ) : null}
    </section>
  );
}
