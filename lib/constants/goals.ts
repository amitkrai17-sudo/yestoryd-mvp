// lib/constants/goals.ts
// Single source of truth for learning goal definitions

export interface LearningGoal {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
  minAge: number;
  maxAge: number;
  /** Maps to skill_categories.slug — canonical taxonomy link */
  categorySlug: string;
}

export const LEARNING_GOALS: Record<string, LearningGoal> = {
  reading: {
    id: 'reading',
    label: 'Reading & Phonics',
    shortLabel: 'Reading',
    icon: 'BookOpen',
    description: 'Decoding, fluency, phonemic awareness',
    minAge: 4,
    maxAge: 12,
    categorySlug: 'phonics_letter_sounds',
  },
  grammar: {
    id: 'grammar',
    label: 'Grammar & Sentences',
    shortLabel: 'Grammar',
    icon: 'Pencil',
    description: 'Sentence structure, tenses, parts of speech',
    minAge: 4,
    maxAge: 12,
    categorySlug: 'grammar_syntax',
  },
  comprehension: {
    id: 'comprehension',
    label: 'Reading Comprehension',
    shortLabel: 'Comprehension',
    icon: 'Brain',
    description: 'Understanding, inference, analysis',
    minAge: 4,
    maxAge: 12,
    categorySlug: 'reading_comprehension',
  },
  creative_writing: {
    id: 'creative_writing',
    label: 'Creative Writing',
    shortLabel: 'Writing',
    icon: 'Palette',
    description: 'Storytelling, essays, expression',
    minAge: 4,
    maxAge: 12,
    categorySlug: 'creative_writing',
  },
  olympiad: {
    id: 'olympiad',
    label: 'Olympiad Prep',
    shortLabel: 'Olympiad',
    icon: 'Award',
    description: 'English Olympiad, Spell Bee preparation',
    minAge: 4,
    maxAge: 12,
    categorySlug: 'olympiad_prep',
  },
  competition_prep: {
    id: 'competition_prep',
    label: 'Competition Prep',
    shortLabel: 'Competitions',
    icon: 'Trophy',
    description: 'Spell Bee, quiz competitions',
    minAge: 4,
    maxAge: 12,
    categorySlug: 'competition_prep',
  },
  speaking: {
    id: 'speaking',
    label: 'Speaking Confidence',
    shortLabel: 'Speaking',
    icon: 'Mic',
    description: 'Public speaking, presentation skills',
    minAge: 4,
    maxAge: 12,
    categorySlug: 'pronunciation',
  },
};

export type LearningGoalId = 'reading' | 'grammar' | 'comprehension' | 'creative_writing' | 'speaking' | 'olympiad' | 'competition_prep';

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

/**
 * Convert a goal ID to its canonical skill_categories slug.
 */
export function goalToCategory(goalId: string): string | null {
  const goal = LEARNING_GOALS[goalId];
  return goal?.categorySlug ?? null;
}

/**
 * Convert a skill_categories slug to the matching goal ID.
 * Returns null if no goal maps to that category.
 */
export function categoryToGoal(categorySlug: string): LearningGoalId | null {
  for (const [id, goal] of Object.entries(LEARNING_GOALS)) {
    if (goal.categorySlug === categorySlug) return id as LearningGoalId;
  }
  return null;
}
