// lib/constants/goals.ts
// Single source of truth for learning goal definitions

export interface LearningGoal {
  id: string;
  label: string;
  shortLabel: string;
  emoji: string;
  description: string;
  minAge: number;
  maxAge: number;
}

export const LEARNING_GOALS: Record<string, LearningGoal> = {
  reading: {
    id: 'reading',
    label: 'Reading & Phonics',
    shortLabel: 'Reading',
    emoji: '📖',
    description: 'Decoding, fluency, phonemic awareness',
    minAge: 4,
    maxAge: 12,
  },
  grammar: {
    id: 'grammar',
    label: 'Grammar & Sentences',
    shortLabel: 'Grammar',
    emoji: '✏️',
    description: 'Sentence structure, tenses, parts of speech',
    minAge: 6,
    maxAge: 12,
  },
  comprehension: {
    id: 'comprehension',
    label: 'Reading Comprehension',
    shortLabel: 'Comprehension',
    emoji: '🧠',
    description: 'Understanding, inference, analysis',
    minAge: 6,
    maxAge: 12,
  },
  creative_writing: {
    id: 'creative_writing',
    label: 'Creative Writing',
    shortLabel: 'Writing',
    emoji: '🎨',
    description: 'Storytelling, essays, expression',
    minAge: 7,
    maxAge: 12,
  },
  olympiad: {
    id: 'olympiad',
    label: 'Olympiad Prep',
    shortLabel: 'Olympiad',
    emoji: '🏅',
    description: 'English Olympiad, Spell Bee preparation',
    minAge: 6,
    maxAge: 12,
  },
  competition_prep: {
    id: 'competition_prep',
    label: 'Competition Prep',
    shortLabel: 'Competitions',
    emoji: '🏆',
    description: 'Spell Bee, quiz competitions',
    minAge: 8,
    maxAge: 12,
  },
};

export type LearningGoalId = 'reading' | 'grammar' | 'comprehension' | 'creative_writing' | 'olympiad' | 'competition_prep';

/**
 * Get age-appropriate goals for a child
 */
export function getGoalsForAge(age: number): LearningGoalId[] {
  return (Object.keys(LEARNING_GOALS) as LearningGoalId[]).filter((goalId) => {
    const goal = LEARNING_GOALS[goalId];
    return age >= goal.minAge && age <= goal.maxAge;
  });
}

/**
 * Validate goal IDs
 */
export function isValidGoal(goalId: string): goalId is LearningGoalId {
  return goalId in LEARNING_GOALS;
}

/**
 * WhatsApp reply number to goal mapping
 */
export const WHATSAPP_GOAL_MAPPING: Record<string, LearningGoalId> = {
  '1': 'grammar',
  '2': 'comprehension',
  '3': 'creative_writing',
  '4': 'olympiad',
  '5': 'competition_prep',
};
