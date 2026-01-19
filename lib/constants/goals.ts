// lib/constants/goals.ts
// Single source of truth for learning goal definitions

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
  '4': 'speaking',
  '5': 'competition_prep',
};
