// ============================================================
// Centralized Gemini Model Configuration
// Two-model strategy: Pro for accuracy-critical, Flash for speed
// ============================================================

export type GeminiTaskType =
  | 'assessment_analysis'    // Pro — accuracy critical
  | 'reading_level'          // Pro — accuracy critical
  | 'feedback_generation'    // Pro — parent-facing quality
  | 'session_analysis'       // Pro — post-session analysis
  | 'content_generation'     // Flash — speed matters
  | 'question_generation'    // Flash — speed matters
  | 'story_summarization'    // Flash — speed matters
  | 'classification'         // Flash — simple routing
  | 'formatting'             // Flash — simple task
  | 'default';               // Flash — fallback

const PRO_TASKS: GeminiTaskType[] = [
  'assessment_analysis',
  'reading_level',
  'feedback_generation',
  'session_analysis',
];

export function getGeminiModel(taskType: GeminiTaskType): string {
  return PRO_TASKS.includes(taskType)
    ? process.env.GEMINI_PRO_MODEL || 'gemini-2.5-pro'
    : process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash';
}
