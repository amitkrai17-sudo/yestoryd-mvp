// =============================================================================
// FILE: types/elearning.ts
// PURPOSE: Type definitions for e-learning system with gamification
// =============================================================================

// ==================== LEARNING CONTENT ====================

export interface LearningLevel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  age_range: string | null;
  icon: string | null;
  color: string | null;
  xp_bonus: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface LearningModule {
  id: string;
  level_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  xp_reward: number;
  display_order: number;
  is_active: boolean;
  is_free: boolean;
  created_at: string;
  
  // Computed/joined fields
  video_count?: number;
  completed_count?: number;
}

export interface LearningVideo {
  id: string;
  module_id: string;
  title: string;
  slug: string;
  description: string | null;
  video_source: 'youtube' | 'bunny' | 'upload';
  video_id: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number;
  xp_reward: number;
  has_quiz: boolean;
  is_free: boolean;
  status: 'draft' | 'review' | 'approved' | 'published';
  display_order: number;
  created_at: string;
  
  // Progress fields (computed)
  is_completed?: boolean;
  quiz_passed?: boolean;
  watch_percentage?: number;
  best_quiz_score?: number;
  xp_earned?: number;
}

export interface VideoQuiz {
  id: string;
  video_id: string;
  question_text: string;
  options: QuizOption[];
  correct_option_id: string;
  explanation: string | null;
  display_order: number;
}

export interface QuizOption {
  id: string;
  text: string;
}

// ==================== GAMIFICATION ====================

export interface ChildGamification {
  id: string;
  child_id: string;
  total_xp: number;
  current_level: number;
  current_streak_days: number;
  longest_streak_days: number;
  last_activity_date: string | null;
  total_videos_completed: number;
  total_quizzes_completed: number;
  total_games_completed: number;
  total_readings_completed: number;
  total_time_minutes: number;
  perfect_quiz_count: number;
  current_level_id: string | null;
  current_module_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface XPLevel {
  level: number;
  xp_required: number;
  title: string;
  icon: string;
  perks: Record<string, any> | null;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  category: string;
  criteria_type: string | null;
  criteria_value: number | null;
  xp_bonus: number;
  is_active: boolean;
  display_order: number;
}

export interface ChildBadge {
  id: string;
  child_id: string;
  badge_id: string;
  earned_at: string;
  badge?: BadgeDefinition;
}

// ==================== PROGRESS ====================

export interface ChildVideoProgress {
  id: string;
  child_id: string;
  video_id: string;
  watch_percentage: number;
  completion_percentage: number;
  is_completed: boolean;
  completed_at: string | null;
  last_watched_at: string | null;
  watch_count: number;
  quiz_attempted: boolean;
  quiz_score: number | null;
  quiz_passed: boolean;
  quiz_completed_at: string | null;
  xp_earned: number;
  quiz_attempts: number;
  best_quiz_score: number;
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

// ==================== API RESPONSES ====================

export interface GamificationAPIResponse {
  gamification: ChildGamification;
  level: {
    current: XPLevel;
    next: XPLevel | null;
    xpProgress: number;
  };
  badges: {
    earned: ChildBadge[];
    unearned: BadgeDefinition[];
  };
  leaderboard?: {
    topTen: LeaderboardEntry[];
    childRank: number | null;
  };
}

export interface XPAwardResult {
  xp_awarded: number;
  total_xp: number;
  new_level: number;
  level_title: string;
  level_up: boolean;
  streak_updated: boolean;
  current_streak: number;
  badges_earned: BadgeDefinition[];
}

export interface QuizSubmitResult {
  score: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  isPerfect: boolean;
  xpAwarded: number;
  isFirstPass: boolean;
  xpResult?: XPAwardResult;
}
