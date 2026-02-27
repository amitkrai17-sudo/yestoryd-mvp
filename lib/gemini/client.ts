/**
 * Gemini AI Client
 * Handles all AI-powered analysis using Google Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiModel } from '@/lib/gemini-config';

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
 * Get age-appropriate assessment guidance
 */
function getAgeGuidance(age: number): string {
  if (age <= 5) {
    return `
      STRICTNESS: NEUTRAL/ENCOURAGING
      - Focus on effort over perfection
      - Allow developmental speech patterns
      - Celebrate attempts and partial success
      - Minimum score 5 if 60%+ completed
      - Feedback should be warm and encouraging
    `;
  }
  if (age <= 8) {
    return `
      STRICTNESS: BALANCED
      - Balance encouragement with constructive feedback
      - Expect reasonable fluency
      - Allow some hesitations
      - Minimum score 5 if 70%+ completed
    `;
  }
  if (age <= 11) {
    return `
      STRICTNESS: MODERATELY STRICT
      - Expect good fluency and clear pronunciation
      - Assess comprehension indicators
      - Note pacing and expression
      - Minimum score 6 if 75%+ completed
    `;
  }
  return `
    STRICTNESS: STRICT
    - Expect excellent fluency, expression, comprehension
    - Strict about pronunciation and completion
    - High scores (8+) reserved for exceptional reading
    - Assess sophisticated reading skills
  `;
}

/**
 * Analyze a reading assessment using Gemini
 */
export async function analyzeReading(
  childName: string,
  age: number,
  passage: string,
  audioBase64: string
): Promise<AssessmentResult> {
  const model = genAI.getGenerativeModel({ model: getGeminiModel('reading_level') });

  const ageGuidance = getAgeGuidance(age);

  const prompt = `
You are an expert reading coach analyzing a child's reading performance.

CHILD INFORMATION:
- Name: ${childName}
- Age: ${age} years old

PASSAGE TO READ:
"${passage}"

AUDIO RECORDING: [attached audio file]

AGE-APPROPRIATE ASSESSMENT GUIDELINES:
${ageGuidance}

ANALYZE THE RECORDING AND PROVIDE:

1. OVERALL SCORE (1-10)
   Consider: age-appropriate expectations, effort, completion, accuracy

2. WORDS PER MINUTE (WPM)
   Count words in passage and estimate reading speed

3. FLUENCY RATING
   - Poor: Very choppy, word-by-word reading, many long pauses
   - Fair: Some fluency but frequent hesitations
   - Good: Smooth reading with natural pauses
   - Excellent: Expressive reading with perfect pacing

4. PRONUNCIATION
   - Poor: Many significant errors affecting understanding
   - Fair: Some errors but mostly understandable
   - Good: Clear and mostly correct
   - Excellent: Very clear and accurate

5. STRENGTHS (list 3-5 specific positive points)
   What did the child do well?

6. AREAS FOR IMPROVEMENT (list 3-5 specific points)
   What needs work? Be constructive and age-appropriate.

7. RECOMMENDED NEXT STEPS (list 3-5 actionable items)
   Specific exercises or practice recommendations

8. SUMMARY (150-200 words)
   Overall assessment with encouragement

IMPORTANT:
- Be encouraging but honest
- Focus on growth and improvement
- Adjust expectations for the child's age
- Provide actionable feedback

OUTPUT FORMAT: Return ONLY valid JSON, no markdown formatting:
{
  "score": <number 1-10>,
  "wpm": <number>,
  "fluency": "<Poor|Fair|Good|Excellent>",
  "pronunciation": "<Poor|Fair|Good|Excellent>",
  "strengths": ["<strength1>", "<strength2>", ...],
  "improvements": ["<area1>", "<area2>", ...],
  "nextSteps": ["<step1>", "<step2>", ...],
  "summary": "<summary text>"
}
`;

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
    let cleanedText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse JSON
    const analysis: AssessmentResult = JSON.parse(cleanedText);

    // Validate and ensure required fields
    return {
      score: Math.min(10, Math.max(1, analysis.score)),
      wpm: Math.max(0, analysis.wpm),
      fluency: analysis.fluency || 'Fair',
      pronunciation: analysis.pronunciation || 'Fair',
      strengths: analysis.strengths || ['Completed the reading'],
      improvements: analysis.improvements || ['Practice daily'],
      nextSteps: analysis.nextSteps || ['Read for 10 minutes each day'],
      summary: analysis.summary || 'Thank you for completing the assessment.',
    };
  } catch (error) {
    console.error('Gemini analysis error:', error);
    
    // Return fallback response if analysis fails
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
