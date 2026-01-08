// =============================================================================
// YESTORYD E-LEARNING V2: TYPE DEFINITIONS
// =============================================================================

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ SKILLS & SUB-SKILLS                                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: 'phonics' | 'fluency' | 'comprehension' | 'vocabulary';
  level: 1 | 2 | 3;
  display_order: number;
  icon_emoji: string;
  color_hex: string;
  is_active: boolean;
}

export interface SubSkill {
  id: string;
  skill_id: string;
  name: string;
  slug: string;
  description: string | null;
  keywords: string[];
  display_order: number;
  is_active: boolean;
  skill?: Skill;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ CONTENT POOLS                                                             ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface WordItem {
  word: string;
  phonetic?: string;
  audio_url?: string;
  image_url?: string;
  type?: string; // e.g., "voiced", "voiceless"
  definition?: string;
}

export interface SentenceItem {
  sentence: string;
  words: string[];
  audio_url?: string;
  image_url?: string;
}

export interface StoryItem {
  title: string;
  images: { url: string; order: number; caption?: string }[];
}

export type PoolContent = WordItem[] | SentenceItem[] | StoryItem[];

export interface ContentPool {
  id: string;
  sub_skill_id: string | null;
  name: string;
  slug: string;
  pool_type: 'words' | 'sentences' | 'images' | 'audio' | 'stories' | 'rhymes';
  difficulty: 'easy' | 'medium' | 'hard';
  content: PoolContent;
  item_count: number;
  is_active: boolean;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ GAME ENGINES                                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export type GameEngineSlug = 
  | 'word-match' 
  | 'phonics-pop' 
  | 'sentence-builder' 
  | 'story-sequence' 
  | 'rhyme-time';

export interface GameEngineConfigSchema {
  [key: string]: {
    type: 'number' | 'string' | 'boolean';
    default: number | string | boolean;
    min?: number;
    max?: number;
    options?: string[];
    optional?: boolean;
  };
}

export interface GameEngine {
  id: string;
  name: string;
  slug: GameEngineSlug;
  description: string | null;
  component_name: string;
  config_schema: GameEngineConfigSchema;
  base_xp_reward: number;
  perfect_bonus_xp: number;
  supported_pool_types: string[];
  icon_emoji: string;
  preview_image_url: string | null;
  estimated_minutes: number;
  is_active: boolean;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ UNITS (LEARNING EXPERIENCES)                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface UnitSequenceItem {
  order: number;
  type: 'video' | 'game' | 'quiz' | 'voice-practice';
  title: string;
  xp_reward: number;
  
  // For videos
  video_id?: string;
  
  // For games
  game_engine_slug?: GameEngineSlug;
  content_pool_id?: string;
  config?: Record<string, any>;
  
  // For quizzes
  quiz_id?: string;
  passing_score?: number;
}

export interface Unit {
  id: string;
  sub_skill_id: string;
  name: string;
  slug: string;
  quest_title: string | null;
  description: string | null;
  sequence: UnitSequenceItem[];
  total_xp_reward: number;
  estimated_minutes: number;
  activity_count: number;
  difficulty: 'easy' | 'medium' | 'hard';
  min_age: number;
  max_age: number;
  level: 1 | 2 | 3;
  icon_emoji: string;
  thumbnail_url: string | null;
  color_hex: string;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  tags: string[];
  is_featured: boolean;
  display_order: number;
  
  // Joined data
  sub_skill?: SubSkill;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ CHILD PROGRESS                                                            ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface StepProgress {
  step: number;
  type: 'video' | 'game' | 'quiz' | 'voice-practice';
  completed: boolean;
  completed_at?: string;
  score?: number;
  xp_earned?: number;
  time_taken_seconds?: number;
}

export interface UnitProgress {
  id: string;
  child_id: string;
  unit_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  current_step: number;
  completion_percentage: number;
  step_progress: StepProgress[];
  total_xp_earned: number;
  best_score: number;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string;
  
  // Spaced repetition
  next_review_at: string | null;
  review_count: number;
  ease_factor: number;
  interval_days: number;
  
  // Joined data
  unit?: Unit;
}

export interface GameProgress {
  id: string;
  child_id: string;
  unit_id: string | null;
  game_engine_slug: GameEngineSlug;
  content_pool_id: string | null;
  score: number;
  max_score: number;
  percentage: number;
  correct_items: number;
  total_items: number;
  time_taken_seconds: number | null;
  mistakes: { item: string; wrong_answer: string; correct_answer: string }[];
  xp_earned: number;
  is_perfect: boolean;
  played_at: string;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ DAILY GOALS                                                               ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface DailyGoal {
  id: string;
  child_id: string;
  goal_date: string;
  target_activities: number;
  target_minutes: number;
  completed_activities: number;
  completed_minutes: number;
  is_achieved: boolean;
  achieved_at: string | null;
  xp_bonus: number;
  treasure_claimed: boolean;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ RAI RECOMMENDATIONS                                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface RAIRecommendation {
  units: Unit[];
  focus: {
    area: string;
    reason: string;
    source: string;
  };
  reviewDue: Unit[];
  totalXP: number;
  estimatedMinutes: number;
}

export interface RAIRecommendationLog {
  id: string;
  child_id: string;
  recommended_units: string[];
  focus_area: string | null;
  focus_reason: string | null;
  focus_source: string | null;
  gemini_response: any;
  user_selected_unit: string | null;
  was_override: boolean;
  override_topic: string | null;
  created_at: string;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ SESSION API RESPONSE (Single API for everything)                          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface ELearningSession {
  child: {
    id: string;
    name: string;
    displayName: string;
    age: number;
    level: number;
  };
  
  // Today's focus (from rAI)
  todaysFocus: {
    unit: Unit;
    reason: string;
    source: string;
  } | null;
  
  // Queue of activities for today
  queue: {
    unit: Unit;
    progress: UnitProgress | null;
    isUnlocked: boolean;
    isReview: boolean;
  }[];
  
  // Units due for review (spaced repetition)
  reviewDue: Unit[];
  
  // Daily goal progress
  dailyGoal: {
    target: number;
    completed: number;
    isAchieved: boolean;
    xpBonus: number;
  };
  
  // Gamification
  gamification: {
    totalXP: number;
    level: number;
    levelTitle: string;
    xpToNextLevel: number;
    coins: number;
    streak: number;
    todayCompleted: number;
  };
  
  // Stats
  stats: {
    videosWatched: number;
    gamesPlayed: number;
    quizzesCompleted: number;
    perfectScores: number;
  };
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ GAME COMPONENT PROPS                                                      ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export interface BaseGameProps {
  contentPool: ContentPool;
  config?: Record<string, any>;
  onComplete: (result: GameResult) => void;
  onQuit?: () => void;
  childAge?: number;
  audioEnabled?: boolean;
}

export interface GameResult {
  score: number;
  maxScore: number;
  correctItems: number;
  totalItems: number;
  timeTakenSeconds: number;
  mistakes: { item: string; wrongAnswer: string; correctAnswer: string }[];
  isPerfect: boolean;
}

// Word Match specific
export interface WordMatchConfig {
  items_per_round?: number;
  match_type?: 'image' | 'audio' | 'definition';
  show_hints?: boolean;
  audio_enabled?: boolean;
}

// Phonics Pop specific
export interface PhonicsPopConfig {
  bubbles_per_round?: number;
  speed?: 'slow' | 'medium' | 'fast';
  lives?: number;
}

// Sentence Builder specific
export interface SentenceBuilderConfig {
  sentences_per_round?: number;
  show_punctuation?: boolean;
  audio_sentence?: boolean;
}

// Story Sequence specific
export interface StorySequenceConfig {
  images_per_story?: number;
  stories_per_round?: number;
}

// Rhyme Time specific
export interface RhymeTimeConfig {
  pairs_per_round?: number;
  show_images?: boolean;
  time_limit_seconds?: number;
}

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ UI COMPONENT TYPES                                                        ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

export type UnitCardStatus = 
  | 'not_started' 
  | 'in_progress' 
  | 'completed' 
  | 'review_due' 
  | 'locked';

export interface UnitCardData {
  unit: Unit;
  status: UnitCardStatus;
  progress?: UnitProgress;
  isUnlocked: boolean;
  isReview?: boolean;
}

export interface CelebrationEvent {
  type: 'xp' | 'level_up' | 'badge' | 'streak' | 'perfect' | 'daily_goal';
  value?: number;
  badge?: { name: string; icon: string };
  message?: string;
}

// Gamification types
export interface XPLevel {
  level: number;
  name: string;
  title: string;
  xp_required: number;
  minXP: number;
  maxXP: number;
  icon: string;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  xp_bonus: number;
}

export interface ChildBadge {
  id: string;
  badge_slug: string;
  badge_name: string;
  badge_icon: string;
  earned_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  childId: string;
  childName: string;
  avatarEmoji: string;
  totalXP: number;
  level: number;
}



