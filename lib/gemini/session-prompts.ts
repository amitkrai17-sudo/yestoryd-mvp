// ============================================================
// FILE: lib/gemini/session-prompts.ts
// PURPOSE: Shared Gemini prompt builders for session-related AI tasks
//   - buildCaptureSummaryPrompt: SCF Review card summary generation
//   - generateParentWhatsAppSummary: activity-based parent summary
//   - generateLearningProfileSynthesis: child learning profile from history
//   - analyzeSessionTranscript: transcript → structured session analysis
//   - generateAssessmentAISummary: enrolled assessment → parent summary
// ============================================================

import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';
import { getCategorySlugs } from '@/lib/config/skill-categories';

// ============================================================
// SCF Capture Summary (Review Card)
// ============================================================

export interface CaptureSummaryInput {
  childName: string;
  childAge: number;
  skills: { name: string; rating: string }[];
  strengthObservations: string[];
  struggleObservations: string[];
  wordsMastered: string[];
  wordsStruggled: string[];
  voiceSegments: { skills?: string; strengths?: string; struggles?: string; homework?: string } | null;
  engagementLevel: string | null;
}

export function buildCaptureSummaryPrompt(input: CaptureSummaryInput): string {
  const child = input.childName || 'the child';
  const age = input.childAge || 7;
  const skillsList = (input.skills || []).map(s => `${s.name} (${s.rating})`).join(', ') || 'Not specified';
  const strengths = (input.strengthObservations || []).join('; ') || 'None selected';
  const struggles = (input.struggleObservations || []).join('; ') || 'None selected';
  const mastered = (input.wordsMastered || []).join(', ') || 'None';
  const struggled = (input.wordsStruggled || []).join(', ') || 'None';
  const engagement = input.engagementLevel || 'Not rated';

  let voiceNotes = '';
  if (input.voiceSegments) {
    const v = input.voiceSegments;
    voiceNotes = `\nCoach voice notes:\n- Skills: ${v.skills || ''}\n- Strengths: ${v.strengths || ''}\n- Struggles: ${v.struggles || ''}\n- Practice: ${v.homework || ''}`;
  }

  return `You are a reading coach assistant for Yestoryd.

CHILD: ${child}, age ${age}

SESSION DATA:
Skills worked on: ${skillsList}
Strength observations: ${strengths}
Struggle observations: ${struggles}
Words mastered: ${mastered}
Words struggled: ${struggled}${voiceNotes}
Engagement: ${engagement}

OUTPUT REQUIREMENTS:
- strengthSummary: Exactly 2 sentences. What went well — reference specific observations and words.
- growthSummary: Exactly 2 sentences. Areas for development — actionable, not generic.
- homeworkSuggestion: Exactly 1 sentence. A specific 10-15 minute practice activity using the child's struggled words or weak skills. Parent-friendly language.
- Use ${child}'s name naturally. Reference actual data, never fabricate.
- If session data is sparse, use 1 sentence per field instead.

Return ONLY valid JSON, no markdown, no preamble. Exact schema:
{"strengthSummary":"...","growthSummary":"...","homeworkSuggestion":"..."}`;
}

// ============================================================
// Parent WhatsApp Session Summary
// ============================================================

interface ParentSummaryInput {
  childName: string;
  childAge: number;
  sessionNumber: number | null;
  durationMinutes: number | null;
  activitySummary: string;
  statusCounts: {
    completed: number;
    partial: number;
    struggled: number;
    skipped: number;
  };
  coachNotes?: string | null;
  isOffline: boolean;
  offlineSection?: string;
}

/**
 * Generate a short, warm WhatsApp-friendly parent summary from session activity data.
 * Used by parent-summary route after session completion.
 */
export async function generateParentWhatsAppSummary(
  input: ParentSummaryInput
): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: getGeminiModel('feedback_generation') });

  const prompt = `You are a warm, encouraging assistant helping parents understand their child's reading coaching session.

CHILD: ${input.childName}, age ${input.childAge}
SESSION: #${input.sessionNumber || '—'}
DURATION: ${input.durationMinutes ? input.durationMinutes + ' minutes' : 'Not recorded'}

ACTIVITIES:
${input.activitySummary}

RESULTS: ${input.statusCounts.completed} completed, ${input.statusCounts.partial} partial, ${input.statusCounts.struggled} struggled, ${input.statusCounts.skipped} skipped
${input.coachNotes ? 'COACH NOTES: ' + input.coachNotes : ''}${input.offlineSection || ''}

Write a SHORT (2-3 sentences max) parent-friendly summary of this session for WhatsApp. Be warm, highlight positives, mention any struggles gently as "areas we'll keep working on". Use the child's first name. Do NOT use emojis. Keep it under 300 characters.${input.isOffline ? ' Mention that the session was conducted in person.' : ''}`;

  const result = await model.generateContent(prompt);
  const summary = result.response.text().trim();

  if (!summary || summary.length < 20) {
    throw new Error('Invalid AI response');
  }

  return summary;
}

// ============================================================
// Learning Profile Synthesis
// ============================================================

interface LearningProfileInput {
  childName: string;
  childAge: number | null;
  ageBand: string | null;
  sessionNumber: number | null;
  sessionsCompleted: number;
  sessionsRemaining: number;
  currentProfile: Record<string, unknown>;
  sessionEventData: Record<string, unknown> | null;
  historyText: string;
  struggleText: string;
  taskCompletionRate: number | null;
}

/**
 * Synthesize/update a child's learning profile from session history via Gemini.
 * Returns parsed JSON profile object.
 */
export async function generateLearningProfileSynthesis(
  input: LearningProfileInput
): Promise<Record<string, unknown>> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: getGeminiModel('feedback_generation') });

  const prompt = `You are rAI, Yestoryd's reading intelligence system. Synthesize a learning profile for this child based on their coaching session history.

CHILD: ${input.childName}, age ${input.childAge || '?'}, band ${input.ageBand || '?'}
SESSION JUST COMPLETED: #${input.sessionNumber || '?'}
SESSIONS COMPLETED: ${input.sessionsCompleted}, REMAINING: ${input.sessionsRemaining}

CURRENT PROFILE (previous synthesis, may be empty):
${JSON.stringify(input.currentProfile, null, 2)}

THIS SESSION'S DATA:
${input.sessionEventData ? JSON.stringify(input.sessionEventData, null, 2) : 'No event data found'}

RECENT SESSION HISTORY (most recent first):
${input.historyText || 'No history available'}

ACTIVE STRUGGLE FLAGS:
${input.struggleText || 'None'}

PARENT TASK COMPLETION RATE: ${input.taskCompletionRate !== null ? (input.taskCompletionRate * 100).toFixed(0) + '%' : 'Not available'}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "last_updated": "${new Date().toISOString()}",
  "reading_level": { "current": "Foundation — Early/Mid/Late or Building — Early/Mid/Late or Mastery — Early/Mid/Late", "wpm": null, "trend": "improving" },
  "active_skills": ["skill_tag_1"],
  "mastered_skills": ["skill_tag_1"],
  "struggle_areas": [{ "skill": "skill_tag", "sessions_struggling": 1, "severity": "mild" }],
  "what_works": ["approach 1"],
  "what_doesnt_work": ["approach 1"],
  "personality_notes": "Brief description of child's learning personality and engagement style",
  "parent_engagement": { "level": "high", "task_completion_rate": ${input.taskCompletionRate !== null ? input.taskCompletionRate.toFixed(2) : 0} },
  "recommended_focus_next_session": "Specific recommendation for next session focus",
  "sessions_completed": ${input.sessionsCompleted},
  "sessions_remaining": ${input.sessionsRemaining}
}

RULES:
- Update the previous profile with new data, don't start from scratch
- Use actual skill tags from el_skills (phonemic_awareness, phonics, fluency, vocabulary, comprehension, etc.)
- Base reading_level.trend on comparing recent sessions to earlier ones
- struggle_areas should consolidate recurring struggles across sessions
- what_works and what_doesnt_work should accumulate across sessions
- personality_notes should evolve with each session (not reset)
- If this is the first session, infer what you can from available data`;

  const result = await model.generateContent(prompt);
  let responseText = result.response.text().trim();

  // Strip markdown code fences if present
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const profile = JSON.parse(responseText);

  // Validate basic structure
  if (!profile.last_updated || !profile.reading_level) {
    throw new Error('Invalid profile structure from Gemini');
  }

  return profile;
}

// ============================================================
// Session Transcript Analysis
// ============================================================

export interface PerChildObservation {
  strengths: string[];
  struggles: string[];
  notable_moments: string[];
}

export interface SessionAnalysis {
  session_type?: string;
  child_name?: string | null;
  focus_area?: string;
  skills_worked_on?: string[];
  progress_rating?: string;
  engagement_level?: string;
  confidence_level?: number;
  breakthrough_moment?: string | null;
  concerns_noted?: string | null;
  homework_assigned?: boolean;
  homework_topic?: string | null;
  homework_description?: string | null;
  next_session_focus?: string | null;
  coach_talk_ratio?: number;
  child_reading_samples?: string[];
  key_observations?: string[];
  flagged_for_attention?: boolean;
  flag_reason?: string | null;
  safety_flag?: boolean;
  safety_reason?: string | null;
  sentiment_score?: number;
  summary?: string;
  parent_summary?: string;
  /** Per-child observations for batch/group sessions */
  per_child_observations?: Record<string, PerChildObservation>;
}

/** Batch context passed to transcript analysis for group sessions */
export interface BatchContext {
  batchId: string;
  childNames: string[];
  batchSize: number;
}

/**
 * Analyze a session transcript via Gemini and return structured analysis.
 * Uses dynamic focus_area enum from skill_categories table.
 */
export async function analyzeSessionTranscript(
  transcript: string,
  childContext: {
    name: string;
    age: number;
    score: number | null;
    sessionsCompleted: number;
    recentSessions: string;
  } | null,
  childName: string,
  batchContext?: BatchContext,
): Promise<SessionAnalysis> {
  const genAI = getGenAI();

  // Dynamic slugs from skill_categories table
  const slugs = await getCategorySlugs();
  const focusAreaEnum = slugs.join('|');

  const isBatch = batchContext && batchContext.batchSize > 1;

  const batchSection = isBatch ? `
SESSION TYPE: Group tuition session with ${batchContext.batchSize} children: ${batchContext.childNames.join(', ')}.

BATCH ANALYSIS RULES:
- Attribute observations to specific children by name where speaker identification is clear from the conversation.
- The coach may address children by name — use these cues for attribution.
- When attribution is uncertain, classify the observation as "group_level" rather than guessing.
- Do not invent observations. If you cannot clearly identify which child is speaking or being discussed, classify as group_level.
- Note any child-specific interactions, questions asked, struggles mentioned, or praise given.
` : '';

  const perChildSchema = isBatch ? `,
  "per_child_observations": {
    ${batchContext.childNames.map(n => `"${n}": { "strengths": ["..."], "struggles": ["..."], "notable_moments": ["..."] }`).join(',\n    ')},
    "group_level": { "strengths": ["..."], "struggles": ["..."], "notable_moments": ["..."] }
  }` : '';

  const prompt = `You are an AI assistant for Yestoryd, a reading coaching platform for children aged 4-12 in India.

TASK: Analyze this ${isBatch ? 'group tuition' : 'coaching'} session transcript and generate TWO outputs:
1. COACH_ANALYSIS: Detailed analysis for internal use
2. PARENT_SUMMARY: A warm, encouraging 2-3 sentence summary for parents
${batchSection}
${childContext ? `CHILD CONTEXT:
- Name: ${childContext.name}
- Age: ${childContext.age}
- Current Score: ${childContext.score}/10
- Sessions Completed: ${childContext.sessionsCompleted}
${childContext.recentSessions ? `Recent Sessions:\n${childContext.recentSessions}` : ''}` : ''}

TRANSCRIPT (Speaker-labeled):
${transcript.substring(0, 15000)}

Generate a JSON response with this structure:
{
  "session_type": "${isBatch ? 'tuition' : 'coaching'}",
  "child_name": "${childName}",
  "focus_area": "${focusAreaEnum}",
  "skills_worked_on": ["skill codes"],
  "progress_rating": "declined|same|improved|significant_improvement",
  "engagement_level": "low|medium|high",
  "confidence_level": 1-5,
  "breakthrough_moment": "string or null",
  "concerns_noted": "string or null",
  "homework_assigned": true|false,
  "homework_topic": "string or null",
  "homework_description": "string or null",
  "next_session_focus": "string or null",
  "coach_talk_ratio": 0-100,
  "child_reading_samples": ["phrases child read"],
  "key_observations": ["observation 1", "observation 2"],
  "flagged_for_attention": false,
  "flag_reason": null,
  "safety_flag": false,
  "safety_reason": null,
  "sentiment_score": 0.7,
  "summary": "2-3 sentence technical summary for coach records",
  "parent_summary": "2-3 sentence warm, encouraging summary for parents"${perChildSchema}
}

SAFETY: Set "safety_flag": true only for genuine signs of distress, anxiety, fear, or concerning mentions about home/school.

Respond ONLY with valid JSON. No markdown, no backticks.`;

  const model = genAI.getGenerativeModel({ model: getGeminiModel('session_analysis') });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2000,
    },
  });

  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as SessionAnalysis;
  }

  throw new Error('Gemini returned no valid JSON in transcript analysis');
}

// ============================================================
// Assessment AI Summary (for enrolled assessments)
// ============================================================

interface AssessmentSummaryInput {
  childName: string;
  score: number;
  wpm: number;
  fluency: string;
  pronunciation: string;
  completeness: number;
  errors: string[];
  feedback: string;
}

/**
 * Generate an encouraging 1-2 sentence AI summary for a reading assessment.
 * Used by enrolled assessment route for parent-facing summaries.
 */
export async function generateAssessmentAISummary(
  input: AssessmentSummaryInput
): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: getGeminiModel('assessment_analysis') });

  const prompt = `Summarize this reading assessment in 1-2 encouraging sentences for a parent:
Child: ${input.childName}
Score: ${input.score}/10
Reading Speed: ${input.wpm} WPM
Fluency: ${input.fluency}
Pronunciation: ${input.pronunciation}
Completeness: ${input.completeness}%
Errors: ${input.errors?.length || 0} words
Feedback: ${input.feedback}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
