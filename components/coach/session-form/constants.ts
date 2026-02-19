// =============================================================================
// FILE: components/coach/session-form/constants.ts
// PURPOSE: All constants for session completion form
// NO EMOJIS - Lucide icons only
// =============================================================================

import {
  Type, BookOpen, Brain, LayoutGrid, PenTool,
  Lightbulb, Mic, Search, TrendingUp, Rocket,
  ArrowRight, RefreshCw, AlertTriangle, Star,
  Smile, Meh, Frown, LucideIcon
} from 'lucide-react';
import { FocusAreaKey, ProgressLevel, EngagementLevel, OverallRating } from './types';

// =============================================================================
// BRAND COLORS
// =============================================================================
export const BRAND_COLORS = {
  hotPink: '#00ABFF',
  electricBlue: '#00ABFF',
  yellow: '#FFDE00',
  deepPurple: '#7B008B',
  successGreen: '#10B981',
  warningOrange: '#F59E0B',
  errorRed: '#EF4444',
  dark: '#121212',
  darkGray: '#1E1E1E',
  mediumGray: '#2D2D2D',
  lightGray: '#404040',
} as const;

// =============================================================================
// FOCUS AREAS
// =============================================================================
export interface FocusAreaConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  ageRange: string;
  minAge: number;
  maxAge: number;
}

export const FOCUS_AREAS: Record<FocusAreaKey, FocusAreaConfig> = {
  phonics_letter_sounds: {
    label: 'Phonics & Letter Sounds',
    icon: Type,
    color: BRAND_COLORS.hotPink,
    ageRange: '4-12',
    minAge: 4,
    maxAge: 12,
  },
  reading_fluency: {
    label: 'Reading Fluency',
    icon: BookOpen,
    color: BRAND_COLORS.electricBlue,
    ageRange: '6-12',
    minAge: 6,
    maxAge: 12,
  },
  reading_comprehension: {
    label: 'Reading Comprehension',
    icon: Brain,
    color: BRAND_COLORS.deepPurple,
    ageRange: '7-12',
    minAge: 7,
    maxAge: 12,
  },
  vocabulary_building: {
    label: 'Vocabulary Building',
    icon: LayoutGrid,
    color: BRAND_COLORS.yellow,
    ageRange: '6-12',
    minAge: 6,
    maxAge: 12,
  },
  grammar_syntax: {
    label: 'Grammar & Syntax',
    icon: PenTool,
    color: BRAND_COLORS.hotPink,
    ageRange: '8-12',
    minAge: 8,
    maxAge: 12,
  },
  creative_writing: {
    label: 'Creative Writing',
    icon: Lightbulb,
    color: BRAND_COLORS.electricBlue,
    ageRange: '9-12',
    minAge: 9,
    maxAge: 12,
  },
  pronunciation: {
    label: 'Pronunciation',
    icon: Mic,
    color: BRAND_COLORS.deepPurple,
    ageRange: '4-12',
    minAge: 4,
    maxAge: 12,
  },
  story_analysis: {
    label: 'Story Analysis',
    icon: Search,
    color: BRAND_COLORS.yellow,
    ageRange: '10-12',
    minAge: 10,
    maxAge: 12,
  },
};

// =============================================================================
// SKILLS BY FOCUS AREA (Age-grouped)
// =============================================================================
export interface SkillGroup {
  foundation: string[];
  building: string[];
  advanced: string[];
}

export const SKILLS_BY_FOCUS: Record<FocusAreaKey, SkillGroup> = {
  phonics_letter_sounds: {
    foundation: [
      'Letter Recognition',
      'Phonemic Awareness',
      'Single Letter Sounds',
      'CVC Words',
      'Beginning/Ending Sounds',
      'Rhyming Words',
    ],
    building: [
      'Consonant Blends',
      'Digraphs (th, sh, ch, wh)',
      'Sight Words',
      'Long Vowel Sounds',
      'R-Controlled Vowels',
      'Vowel Teams',
    ],
    advanced: [
      'Diphthongs',
      'Silent Letters',
      'Multisyllabic Words',
      'Word Families',
      'Complex Phonics Patterns',
    ],
  },
  reading_fluency: {
    foundation: [
      'Word-by-Word Reading',
      'Basic Sight Words',
      'Simple Sentences',
    ],
    building: [
      'Reading Speed',
      'Expression & Intonation',
      'Appropriate Pacing',
      'Phrasing',
      'Self-Correction',
      'Punctuation Awareness',
    ],
    advanced: [
      'Prosody',
      'Character Voices',
      'Timed Reading',
      'Smooth Phrasing',
      'Natural Expression',
    ],
  },
  reading_comprehension: {
    foundation: [
      'Picture Clues',
      'Simple Recall',
      'Story Sequence',
    ],
    building: [
      'Main Idea',
      'Supporting Details',
      'Making Predictions',
      'Text Connections',
      'Cause and Effect',
      'Compare/Contrast',
    ],
    advanced: [
      'Inference',
      'Drawing Conclusions',
      'Critical Thinking',
      'Summarization',
      'Theme Identification',
      'Author\'s Purpose',
    ],
  },
  vocabulary_building: {
    foundation: [
      'Common Words',
      'Picture Vocabulary',
      'Category Words',
    ],
    building: [
      'Context Clues',
      'Word Families',
      'Synonyms/Antonyms',
      'Multiple Meanings',
      'Prefixes & Suffixes',
    ],
    advanced: [
      'Academic Vocabulary',
      'Figurative Language',
      'Etymology',
      'Technical Terms',
      'Connotation/Denotation',
    ],
  },
  grammar_syntax: {
    foundation: [
      'Nouns & Verbs',
      'Simple Sentences',
      'Basic Punctuation',
    ],
    building: [
      'Parts of Speech',
      'Subject-Verb Agreement',
      'Tenses (Past/Present/Future)',
      'Pronouns',
      'Adjectives & Adverbs',
      'Sentence Types',
    ],
    advanced: [
      'Complex Sentences',
      'Clause Structure',
      'Active/Passive Voice',
      'Conditional Sentences',
      'Advanced Punctuation',
    ],
  },
  creative_writing: {
    foundation: [
      'Sentence Writing',
      'Simple Descriptions',
      'Story Starters',
    ],
    building: [
      'Paragraph Structure',
      'Story Elements',
      'Descriptive Language',
      'Character Creation',
      'Setting Description',
      'Dialogue Writing',
    ],
    advanced: [
      'Plot Development',
      'Narrative Voice',
      'Show Don\'t Tell',
      'Revision Skills',
      'Genre Writing',
    ],
  },
  pronunciation: {
    foundation: [
      'Individual Sounds',
      'Basic Words',
      'Clear Articulation',
    ],
    building: [
      'Word Stress',
      'Syllable Division',
      'Difficult Sound Pairs',
      'Blending Sounds',
      'Intonation Patterns',
    ],
    advanced: [
      'Connected Speech',
      'Stress in Sentences',
      'Natural Rhythm',
      'Self-Monitoring',
      'Accent Reduction',
    ],
  },
  story_analysis: {
    foundation: [
      'Characters',
      'Setting',
      'Basic Plot',
    ],
    building: [
      'Character Traits',
      'Character Motivation',
      'Problem/Solution',
      'Story Arc',
      'Point of View',
    ],
    advanced: [
      'Theme Analysis',
      'Symbolism',
      'Literary Devices',
      'Author\'s Craft',
      'Critical Analysis',
    ],
  },
};

// =============================================================================
// CONTEXTUAL HIGHLIGHTS BY FOCUS AREA
// =============================================================================
export const HIGHLIGHTS_BY_FOCUS: Record<FocusAreaKey, string[]> = {
  phonics_letter_sounds: [
    'Mastered new digraph sounds',
    'Improved letter-sound recognition',
    'Blending sounds smoothly',
    'Decoded unfamiliar words',
    'Self-corrected pronunciation',
    'Applied phonics rules consistently',
  ],
  reading_fluency: [
    'Reading speed improved',
    'Better expression and intonation',
    'Fewer pauses and hesitations',
    'Self-corrected errors',
    'Smooth phrasing',
    'Appropriate punctuation pauses',
  ],
  reading_comprehension: [
    'Identified main idea correctly',
    'Made accurate predictions',
    'Answered questions accurately',
    'Made text-to-self connections',
    'Understood sequence of events',
    'Drew logical inferences',
  ],
  vocabulary_building: [
    'Learned new words effectively',
    'Used context clues successfully',
    'Understood word families',
    'Applied words in sentences',
    'Recognized synonyms/antonyms',
    'Remembered previously taught words',
  ],
  grammar_syntax: [
    'Subject-verb agreement improved',
    'Punctuation used correctly',
    'Sentence structure improved',
    'Tense consistency maintained',
    'Identified parts of speech',
    'Applied capitalization rules',
  ],
  creative_writing: [
    'Story structure improved',
    'Used descriptive language',
    'Developed characters well',
    'Expressed creative ideas',
    'Organized paragraphs logically',
    'Wrote engaging dialogue',
  ],
  pronunciation: [
    'Clear articulation achieved',
    'Difficult sounds improved',
    'Word stress patterns correct',
    'Intonation more natural',
    'Blending sounds smoothly',
    'Self-monitoring speech',
  ],
  story_analysis: [
    'Identified theme/moral',
    'Analyzed characters deeply',
    'Understood plot structure',
    'Described setting effectively',
    'Identified problem/solution',
    'Understood author\'s purpose',
  ],
};

// =============================================================================
// CONTEXTUAL CHALLENGES BY FOCUS AREA
// =============================================================================
export const CHALLENGES_BY_FOCUS: Record<FocusAreaKey, string[]> = {
  phonics_letter_sounds: [
    'Confusing similar sounds (b/d, p/q)',
    'Struggling with blends',
    'Vowel sound confusion',
    'Difficulty with digraphs',
  ],
  reading_fluency: [
    'Reading too fast/slow',
    'Monotone reading',
    'Frequent pauses',
    'Skipping or adding words',
  ],
  reading_comprehension: [
    'Difficulty recalling details',
    'Struggled with inference',
    'Lost track of story',
    'Trouble summarizing',
  ],
  vocabulary_building: [
    'Limited word recognition',
    'Difficulty with context clues',
    'Forgetting new words',
    'Trouble with word meanings',
  ],
  grammar_syntax: [
    'Tense confusion',
    'Subject-verb errors',
    'Run-on sentences',
    'Punctuation mistakes',
  ],
  creative_writing: [
    'Difficulty starting',
    'Lacking story structure',
    'Limited vocabulary use',
    'Trouble with paragraphs',
  ],
  pronunciation: [
    'Unclear articulation',
    'Mispronouncing words',
    'Stress pattern errors',
    'Speaking too fast/slow',
  ],
  story_analysis: [
    'Difficulty finding theme',
    'Trouble with character traits',
    'Confused about plot',
    'Missed key details',
  ],
};

// =============================================================================
// PROGRESS OPTIONS
// =============================================================================
export interface ProgressOption {
  value: ProgressLevel;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export const PROGRESS_OPTIONS: ProgressOption[] = [
  { value: 'breakthrough', label: 'Breakthrough!', icon: Rocket, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  { value: 'significant_improvement', label: 'Great Progress', icon: TrendingUp, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  { value: 'improved', label: 'Good Progress', icon: Star, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  { value: 'same', label: 'Steady', icon: ArrowRight, color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  { value: 'declined', label: 'Needs Attention', icon: AlertTriangle, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
];

// =============================================================================
// ENGAGEMENT OPTIONS
// =============================================================================
export interface EngagementOption {
  value: EngagementLevel;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const ENGAGEMENT_OPTIONS: EngagementOption[] = [
  { value: 'high', label: 'Highly Engaged', icon: Smile, color: 'text-green-400' },
  { value: 'medium', label: 'Moderately Engaged', icon: Meh, color: 'text-yellow-400' },
  { value: 'low', label: 'Low Engagement', icon: Frown, color: 'text-orange-400' },
];

// =============================================================================
// RATING OPTIONS (1-5 scale)
// =============================================================================
export interface RatingOption {
  value: OverallRating;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const RATING_OPTIONS: RatingOption[] = [
  { value: 1, label: 'Tough', icon: AlertTriangle, color: 'text-red-400' },
  { value: 2, label: 'Challenging', icon: RefreshCw, color: 'text-orange-400' },
  { value: 3, label: 'Okay', icon: ArrowRight, color: 'text-yellow-400' },
  { value: 4, label: 'Good', icon: TrendingUp, color: 'text-green-400' },
  { value: 5, label: 'Excellent', icon: Rocket, color: 'text-[#00ABFF]' },
];

// =============================================================================
// NEXT SESSION RECOMMENDATIONS
// =============================================================================
export interface NextStepRecommendations {
  stayInFocus: string[];
  branchOut: string[];
}

export const RECOMMENDATIONS_BY_PROGRESS: Record<ProgressLevel, NextStepRecommendations> = {
  breakthrough: {
    stayInFocus: ['Increase Difficulty', 'New Pattern/Concept', 'Independent Practice'],
    branchOut: ['Add Fluency Work', 'Start Comprehension', 'Vocabulary Expansion'],
  },
  significant_improvement: {
    stayInFocus: ['Continue Current Level', 'Reinforce with Variety', 'Speed Drills'],
    branchOut: ['Light Fluency Practice', 'Introduce Related Skill'],
  },
  improved: {
    stayInFocus: ['Continue Current Level', 'More Practice', 'Review Weak Areas'],
    branchOut: ['Keep Focus Narrow'],
  },
  same: {
    stayInFocus: ['Review Basics', 'Simplify Approach', 'Different Teaching Method'],
    branchOut: ['Take a Break from Topic'],
  },
  declined: {
    stayInFocus: ['Review Fundamentals', 'Reduce Complexity', 'Confidence Building'],
    branchOut: ['Switch to Easier Topic Temporarily'],
  },
};

// =============================================================================
// HOMEWORK TEMPLATES BY FOCUS
// =============================================================================
export const HOMEWORK_TEMPLATES: Record<FocusAreaKey, string[]> = {
  phonics_letter_sounds: [
    'Practice digraph sounds worksheet',
    'Read 3 pages with target sounds',
    'Letter-sound flashcard review',
    'Phonics game on app',
  ],
  reading_fluency: [
    'Timed reading practice (5 min)',
    'Read aloud to parent',
    'Record and listen to reading',
    'Repeated reading of passage',
  ],
  reading_comprehension: [
    'Answer comprehension questions',
    'Summarize a short story',
    'Make predictions before reading',
    'Draw story sequence',
  ],
  vocabulary_building: [
    'Create vocabulary flashcards',
    'Use new words in sentences',
    'Find words in context',
    'Word family worksheet',
  ],
  grammar_syntax: [
    'Complete grammar worksheet',
    'Identify parts of speech in text',
    'Write sentences using rules',
    'Error correction exercise',
  ],
  creative_writing: [
    'Write a short story',
    'Describe a favorite place',
    'Continue a story starter',
    'Write dialogue between characters',
  ],
  pronunciation: [
    'Practice difficult sounds',
    'Record and self-evaluate',
    'Read tongue twisters',
    'Listen and repeat exercises',
  ],
  story_analysis: [
    'Character analysis worksheet',
    'Identify theme in story',
    'Compare two characters',
    'Write about author\'s purpose',
  ],
};

// =============================================================================
// PARENT UPDATE TYPES
// =============================================================================
export const PARENT_UPDATE_TYPES = [
  { value: 'celebrate', label: 'Celebrate Win', description: 'Share a breakthrough or achievement' },
  { value: 'support', label: 'Need Support', description: 'Request parent involvement at home' },
  { value: 'homework', label: 'Homework Help', description: 'Explain homework assignment' },
  { value: 'concern', label: 'Share Concern', description: 'Discuss an area needing attention' },
] as const;
