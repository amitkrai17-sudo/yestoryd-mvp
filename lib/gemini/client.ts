/**
 * Gemini AI Client
 * Handles all AI-powered analysis using Google Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiModel } from '@/lib/gemini-config';
import { buildFullAssessmentPrompt, type FullAssessmentResult } from '@/lib/gemini/assessment-prompts';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Assessment analysis result
 */
export interface AssessmentResult {
  score: number;
  wpm: number;
  fluency: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  pronunciation: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  summary: string;
}

/**
 * Analyze a reading assessment using Gemini (shared standardized prompt)
 */
export async function analyzeReading(
  childName: string,
  age: number,
  passage: string,
  audioBase64: string
): Promise<AssessmentResult> {
  const model = genAI.getGenerativeModel({ model: getGeminiModel('reading_level') });

  const prompt = buildFullAssessmentPrompt({
    childName,
    childAge: age,
    passage,
    wordCount: passage.split(' ').length,
  });

  try {
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: 'audio/webm',
          data: audioBase64,
        },
      },
    ]);

    const responseText = result.response.text();

    // Clean up response (remove markdown if present)
    const cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse JSON — full schema, then map to AssessmentResult interface
    const full: FullAssessmentResult = JSON.parse(cleanedText);

    const clarityScore = Math.min(10, Math.max(1, full.clarity_score || 5));
    const fluencyScore = Math.min(10, Math.max(1, full.fluency_score || 5));
    const speedScore = Math.min(10, Math.max(1, full.speed_score || 5));
    const overallScore = Math.round((clarityScore * 0.35) + (fluencyScore * 0.40) + (speedScore * 0.25));

    const toRating = (score: number): 'Poor' | 'Fair' | 'Good' | 'Excellent' =>
      score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : score >= 4 ? 'Fair' : 'Poor';

    const nextSteps: string[] = [];
    if (full.practice_recommendations) {
      if (full.practice_recommendations.phonics_focus) nextSteps.push(full.practice_recommendations.phonics_focus);
      if (full.practice_recommendations.suggested_activity) nextSteps.push(full.practice_recommendations.suggested_activity);
      if (full.practice_recommendations.daily_words?.length) nextSteps.push(`Practice these words daily: ${full.practice_recommendations.daily_words.join(', ')}`);
    }

    return {
      score: overallScore,
      wpm: Math.max(0, full.wpm || 0),
      fluency: toRating(fluencyScore),
      pronunciation: toRating(clarityScore),
      strengths: full.strengths || ['Completed the reading'],
      improvements: full.areas_to_improve || ['Practice daily'],
      nextSteps: nextSteps.length ? nextSteps : ['Read for 10 minutes each day'],
      summary: full.feedback || 'Thank you for completing the assessment.',
    };
  } catch (error) {
    console.error('Gemini analysis error:', error);

    return {
      score: 5,
      wpm: 50,
      fluency: 'Fair',
      pronunciation: 'Fair',
      strengths: [
        'Completed the reading assessment',
        'Showed effort in attempting the passage',
        'Participated in the activity',
      ],
      improvements: [
        'Practice reading aloud daily',
        'Focus on reading smoothly',
        'Work on word recognition',
      ],
      nextSteps: [
        'Read aloud for 10-15 minutes each day',
        'Practice with age-appropriate books',
        'Record yourself and listen back',
      ],
      summary: `${childName} completed the reading assessment. We recommend scheduling a coaching session to get personalized feedback and a customized learning plan.`,
    };
  }
}

/**
 * Generate session notes from recording
 */
export async function generateSessionNotes(
  childName: string,
  age: number,
  sessionNumber: number,
  previousSessions: string,
  recordingBase64: string
): Promise<{
  summary: string;
  actionItems: string[];
  parentQuestions: string[];
  challenges: string[];
  recommendations: string[];
  progressNotes: string;
}> {
  const model = genAI.getGenerativeModel({ model: getGeminiModel('content_generation') });

  const prompt = `
You are analyzing a coaching session recording between a reading coach and a parent.

CHILD: ${childName}, Age ${age}
SESSION NUMBER: ${sessionNumber}
PREVIOUS SESSION CONTEXT: ${previousSessions}

RECORDING: [attached audio/video file]

EXTRACT AND SUMMARIZE:

1. SESSION SUMMARY (200 words)
   What was discussed? Key moments?

2. ACTION ITEMS (list of specific tasks for parent/child)

3. PARENT'S QUESTIONS (list questions asked by parent)

4. CHILD'S CHALLENGES IDENTIFIED (specific reading issues)

5. RECOMMENDED EXERCISES (specific practice activities)

6. PROGRESS NOTES (comparison with previous sessions if available)

OUTPUT FORMAT: JSON only
{
  "summary": "<session summary>",
  "actionItems": ["<item1>", "<item2>", ...],
  "parentQuestions": ["<question1>", "<question2>", ...],
  "challenges": ["<challenge1>", "<challenge2>", ...],
  "recommendations": ["<rec1>", "<rec2>", ...],
  "progressNotes": "<progress observations>"
}
`;

  try {
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: 'audio/webm',
          data: recordingBase64,
        },
      },
    ]);

    const responseText = result.response.text();
    const cleanedText = responseText.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Session notes generation error:', error);
    throw error;
  }
}

/**
 * Progress Pulse report result
 */
export interface ProgressPulseResult {
  overall_progress: 'emerging' | 'developing' | 'proficient' | 'advanced';
  confidence_trend: 'rising' | 'steady' | 'needs_attention';
  headline: string;
  parent_summary: string;
  strengths: string[];
  focus_areas: string[];
  home_activities: string[];
  coach_notes: string;
  milestone_reached?: string;
}

/**
 * Generate a Progress Pulse report from session data
 */
export async function generateProgressPulse(
  childName: string,
  age: number,
  sessionsSummary: string,
  completedCount: number,
  pulseNumber: number
): Promise<ProgressPulseResult> {
  const model = genAI.getGenerativeModel({ model: getGeminiModel('feedback_generation') });

  const prompt = `
You are a warm, knowledgeable reading coach generating a progress report for a parent.

CHILD: ${childName}, Age ${age}
SESSIONS COMPLETED: ${completedCount}
PROGRESS REPORT #: ${pulseNumber}

SESSION DATA FROM RECENT SESSIONS:
${sessionsSummary}

Generate a Progress Pulse report. Be warm, specific, and encouraging while being honest about areas that need work.

GUIDELINES:
- Use the child's name naturally
- Reference specific skills and activities from the sessions
- Make home activities practical and fun (5-10 minutes each)
- Be age-appropriate in language and expectations
- Celebrate progress, no matter how small
- If there are challenges, frame them positively as growth opportunities

OUTPUT FORMAT: Return ONLY valid JSON, no markdown formatting:
{
  "overall_progress": "<emerging|developing|proficient|advanced>",
  "confidence_trend": "<rising|steady|needs_attention>",
  "headline": "<One compelling sentence about the child's progress, e.g. 'Arjun is reading with more expression and confidence!'>",
  "parent_summary": "<3-4 sentences summarizing progress for the parent. Warm, specific, encouraging.>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "focus_areas": ["<area needing attention 1>", "<area needing attention 2>"],
  "home_activities": ["<fun 5-10 min activity 1>", "<fun 5-10 min activity 2>", "<fun 5-10 min activity 3>"],
  "coach_notes": "<Brief professional note about what the coach plans to focus on next>",
  "milestone_reached": "<Optional: specific milestone if achieved, e.g. 'Can read 3-letter words independently'. null if none>"
}
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanedText = responseText.replace(/```json\n?|```\n?/g, '').trim();
    const parsed: ProgressPulseResult = JSON.parse(cleanedText);

    // Validate required fields
    return {
      overall_progress: parsed.overall_progress || 'developing',
      confidence_trend: parsed.confidence_trend || 'steady',
      headline: parsed.headline || `${childName} is making progress in reading!`,
      parent_summary: parsed.parent_summary || `${childName} has been working hard in coaching sessions.`,
      strengths: parsed.strengths || ['Consistent effort in sessions'],
      focus_areas: parsed.focus_areas || ['Continue building reading fluency'],
      home_activities: parsed.home_activities || ['Read together for 10 minutes daily'],
      coach_notes: parsed.coach_notes || 'Will continue building on current progress.',
      milestone_reached: parsed.milestone_reached || undefined,
    };
  } catch (error) {
    console.error('[ProgressPulse] Gemini generation error:', error);

    // Fallback response
    return {
      overall_progress: 'developing',
      confidence_trend: 'steady',
      headline: `${childName} is making steady progress in reading!`,
      parent_summary: `${childName} has completed ${completedCount} coaching sessions and is showing consistent effort. The coach is working on building key reading skills appropriate for their age.`,
      strengths: ['Consistent attendance and effort', 'Engaged during sessions'],
      focus_areas: ['Continue building reading confidence'],
      home_activities: [
        'Read aloud together for 10 minutes daily',
        'Practice sight words with flashcards',
        'Let your child choose books they enjoy',
      ],
      coach_notes: 'Will continue building on current progress in upcoming sessions.',
    };
  }
}

/**
 * Generate pre-session agenda
 */
export async function generateAgenda(
  childName: string,
  age: number,
  lastScore: number,
  previousSessionNotes: string,
  pendingActionItems: string[]
): Promise<{
  agenda: string;
  focusAreas: string[];
  preparedQuestions: string[];
}> {
  const model = genAI.getGenerativeModel({ model: getGeminiModel('content_generation') });

  const prompt = `
Generate a personalized 60-minute coaching session agenda.

CHILD: ${childName}, Age ${age}
LAST ASSESSMENT SCORE: ${lastScore}/10
PREVIOUS SESSION NOTES: ${previousSessionNotes}
PENDING ACTION ITEMS: ${JSON.stringify(pendingActionItems)}

CREATE AGENDA:
1. Review & Celebration (10 min) - What improved?
2. Address Challenges (15 min) - Current issues
3. Skill Practice (20 min) - Targeted exercises
4. Action Planning (10 min) - Next steps
5. Q&A (5 min) - Parent questions

OUTPUT FORMAT: JSON only
{
  "agenda": "<formatted agenda text>",
  "focusAreas": ["<area1>", "<area2>", ...],
  "preparedQuestions": ["<q1>", "<q2>", ...]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanedText = responseText.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Agenda generation error:', error);
    throw error;
  }
}
