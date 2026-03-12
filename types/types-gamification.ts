// =====================================================
// E-LEARNING GAMIFICATION TYPES
// Add these to your types/database.ts file
// =====================================================

// ==================== GAMIFICATION ====================
export interface ChildGamification {
  id: string;
  child_id: string;
  
  // XP & Levels
  total_xp: number;
  current_level: number;
  
  // Streaks
  current_streak_days: number;
  longest_streak_days: number;
  last_activity_date: string | null;
  
  // Aggregates
  total_videos_completed: number;
  total_quizzes_completed: number;
  total_games_completed: number;
  total_readings_completed: number;
  total_time_minutes: number;
  perfect_quiz_count: number;
  
  // Current position
  current_level_id: string | null;
  current_module_id: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Joined
  xp_level?: XPLevel;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: BadgeCategory;
  criteria_type: string | null;
  criteria_value: number | null;
  criteria_extra: Record<string, any> | null;
  xp_bonus: number;
  is_active: boolean;
  display_order: number;
}

export type BadgeCategory = 'milestone' | 'level' | 'streak' | 'quiz' | 'reading' | 'game' | 'special';

export interface ChildBadge {
  id: string;
  child_id: string;
  badge_id: string;
  earned_at: string;
  
  // Joined
  badge?: BadgeDefinition;
}

export interface XPLevel {
  level: number;
  xp_required: number;
  title: string;
  icon: string | null;
  perks: Record<string, any> | null;
}

// ==================== LEARNING GAMES ====================
export type GameType = 'sound_match' | 'word_builder' | 'fill_blank' | 'rhyme_time' | 'speed_reading' | 'story_sequence';

export interface LearningGame {
  id: string;
  game_type: GameType;
  title: string;
  slug: string | null;
  level_id: string | null;
  module_id: string | null;
  video_id: string | null;
  
  config: GameConfig;
  time_limit_seconds: number | null;
  xp_reward: number;
  xp_per_correct: number;
  passing_score: number;
  
  skill_tags: string[] | null;
  is_active: boolean;
  display_order: number;
  
  created_at: string;
  updated_at: string;
}

// Game config types for different game types
export interface GameConfig {
  rounds?: number;
  sounds?: SoundMatchRound[];
  words?: WordBuilderWord[];
  sentences?: FillBlankSentence[];
  rhymes?: RhymeTimeRound[];
}

export interface SoundMatchRound {
  id: string;
  sound: string;
  audio_url: string;
  correct_answer: string;
  options: {
    id: string;
    word: string;
    image_url: string;
  }[];
}

export interface WordBuilderWord {
  id: string;
  target_word: string;
  image_url: string;
  audio_url?: string;
  letters: string[];
  hint?: string;
}

export interface FillBlankSentence {
  id: string;
  sentence: string;
  blank_position: number;
  correct_answer: string;
  options: string[];
  image_url?: string;
  audio_url?: string;
}

export interface RhymeTimeRound {
  id: string;
  target_word: string;
  target_audio_url?: string;
  correct_rhyme: string;
  options: {
    word: string;
    image_url: string;
    audio_url?: string;
  }[];
}

export interface ChildGameResult {
  id: string;
  child_id: string;
  game_id: string;
  game_type: GameType;
  
  triggered_by: 'auto' | 'coach_assign' | 'coach_broadcast';
  triggered_by_coach_id: string | null;
  
  score: number;
  max_score: number;
  score_percent: number;
  rounds_completed: number;
  rounds_total: number;
  time_taken_seconds: number;
  
  results: GameRoundResult[];
  error_patterns: string[] | null;
  
  xp_earned: number;
  ai_summary: string | null;
  
  created_at: string;
}

export interface GameRoundResult {
  round: number;
  question_id?: string;
  selected: string;
  correct: boolean;
  time_ms: number;
}

// ==================== READING PASSAGES ====================
export interface LearningReadingPassage {
  id: string;
  title: string;
  slug: string | null;
  level_id: string | null;
  module_id: string | null;
  video_id: string | null;
  
  passage_text: string;
  word_count: number | null;
  target_wpm: number | null;
  difficulty: number;
  
  skill_focus: string[] | null;
  xp_reward: number;
  
  is_active: boolean;
  display_order: number;
  
  created_at: string;
}

export interface ChildReadingResult {
  id: string;
  child_id: string;
  passage_id: string | null;
  video_id: string | null;
  
  triggered_by: 'auto' | 'coach_assign' | 'coach_broadcast';
  triggered_by_coach_id: string | null;
  
  audio_url: string | null;
  audio_storage_path: string | null;
  audio_duration_seconds: number | null;
  
  wpm: number | null;
  clarity_score: number | null;
  fluency_score: number | null;
  expression_score: number | null;
  overall_score: number | null;
  
  mispronounced_words: string[] | null;
  hesitation_words: string[] | null;
  skipped_words: string[] | null;
  
  gemini_analysis: Record<string, any> | null;
  ai_summary: string | null;
  
  xp_earned: number;
  
  created_at: string;
}

// ==================== COACH TRIGGERS ====================
export interface CoachTriggeredAssessment {
  id: string;
  coach_id: string;
  
  trigger_type: 'assign' | 'broadcast';
  assessment_type: 'quiz' | 'reading' | 'game';
  assessment_id: string | null;
  
  child_ids: string[] | null;
  broadcast_to_all: boolean;
  
  due_date: string | null;
  message: string | null;
  
  sent_at: string;
  completed_count: number;
  total_count: number | null;
  
  created_at: string;
}

export interface CoachAssignmentStatus {
  id: string;
  assignment_id: string;
  child_id: string;
  
  status: 'pending' | 'started' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  result_id: string | null;
  
  notified_at: string | null;
  reminder_sent: boolean;
}

// ==================== LEADERBOARD ====================
export interface LeaderboardEntry {
  child_id: string;
  child_name: string;
  current_level_id: string | null;
  level_name: string | null;
  total_xp: number;
  gamification_level: number;
  current_streak_days: number;
  total_videos_completed: number;
  level_rank: number;
  percentile: number;
}

// ==================== GAMIFICATION API RESPONSES ====================
export interface GamificationState {
  xp: number;
  level: number;
  levelTitle: string;
  levelIcon: string;
  streak: number;
  longestStreak: number;
  nextLevelXP: number;
  progressToNextLevel: number; // 0-100
  badges: ChildBadge[];
  recentBadges: ChildBadge[]; // Earned in last 7 days
  stats: {
    videosCompleted: number;
    quizzesCompleted: number;
    gamesCompleted: number;
    readingsCompleted: number;
    perfectQuizzes: number;
  };
}

export interface XPAwardResult {
  xpEarned: number;
  totalXP: number;
  newLevel: number;
  levelTitle: string;
  leveledUp: boolean;
  previousLevel: number;
  streakBonus: number;
  currentStreak: number;
  newBadges: BadgeDefinition[];
}

// ==================== EXTENDED VIDEO PROGRESS ====================
// Extends existing child_video_progress
export interface ExtendedVideoProgress {
  id: string;
  child_id: string;
  video_id: string;
  
  // Existing fields
  watch_percentage?: number;
  completion_percentage?: number;
  is_completed: boolean;
  completed_at: string | null;
  last_watched_at: string | null;
  watch_count: number;
  
  // Quiz fields
  quiz_attempted: boolean;
  quiz_score: number | null;
  quiz_passed: boolean;
  quiz_completed_at: string | null;
  
  // Gamification fields (new)
  xp_earned: number;
  quiz_attempts: number;
  best_quiz_score: number;
}
