/**
 * Gemini AI Client
 * Handles all AI-powered analysis using Google Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Model configuration
const MODEL_NAME = 'gemini-2.0-flash-exp';

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
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

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
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

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
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

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
