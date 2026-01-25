'use client';

import {
  BookOpen,
  PenTool,
  Brain,
  Palette,
  Medal,
  Trophy,
  Mic,
  Target,
} from 'lucide-react';
import { LearningGoal } from '@/lib/constants/goals';

// Map icon names to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  PenTool,
  Brain,
  Palette,
  Medal,
  Trophy,
  Mic,
  Target,
};

interface GoalIconProps {
  goal: LearningGoal;
  className?: string;
}

export function GoalIcon({ goal, className = 'w-4 h-4' }: GoalIconProps) {
  const IconComponent = iconMap[goal.icon] || Target;
  return <IconComponent className={className} />;
}
