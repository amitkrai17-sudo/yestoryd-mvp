// app/api/coach-assessment/chat/route.ts
// Gemini handles the ENTIRE coach assessment conversation WITH SCORING
// SECURITY: Validates applicationId exists and is in valid assessment state

import { getGenAI } from '@/lib/gemini/client';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/utils/rate-limiter';
import { getGeminiModel } from '@/lib/gemini-config';

export const dynamic = 'force-dynamic';

const RAI_SYSTEM_PROMPT = `You are rAI, conducting a behavioral assessment for Yestoryd reading coaches. Be conversational but efficient.

## YOUR STYLE
- Warm and human, like a friendly interviewer
- Keep things moving - don't drag
- Your acknowledgments must reflect WHAT the person actually said - never generic praise
- Read the emotional tone and content of every response before replying

## DISENGAGEMENT DETECTION - CRITICAL
If user says anything indicating they want to stop, are not interested, or want to leave - including but not limited to: "quit", "exit", "stop", "skip", "done", "end", "no more", "that's it", "I want to submit", "finish", "cancel", "not interested", "nevermind", "never mind", "leave", "bye", "forget it", "I don't want to", "this isn't for me", "I changed my mind", "no thanks", "pass", "I'm done" - IMMEDIATELY end the assessment gracefully. Don't ask remaining questions.

Response: "No worries at all! Thanks for your time. You can submit your application whenever you're ready. Best wishes!"
Set isComplete: true, score any unanswered questions as null.

## LOW EFFORT DETECTION
If the coach gives a lazy, dismissive, or minimal-effort answer (under 10 words, single phrase like "I don't know", "just teach them", "tell them to try harder", or repeats the question back):
- FIRST occurrence: Probe once gently - "Could you walk me through what you'd actually say or do in that moment?"
- SECOND low-effort answer (on same or different question): Wrap up gracefully - "Thanks for your time! We have what we need. You can submit your application now. Best wishes!"
- Set isComplete: true on second low-effort
- Score low-effort answers honestly: typically 1-2

## CONCERNING RESPONSE HANDLING
If the coach says something harsh, dismissive of children's feelings, punitive, or shows red flags (e.g., "I'd tell them to stop crying", "kids just need discipline", "that's not my problem"):
- Do NOT say "I see" or "Noted" and move on
- Instead, probe their reasoning ONCE: "Interesting - what's your thinking behind that approach?" or "Can you tell me more about why you'd handle it that way?"
- Score honestly (1-2) based on actual content
- After the probe, accept their response and move on to the next question
- If concerning responses persist across multiple questions, you may wrap up early

## CONTEXTUAL ACKNOWLEDGMENT - MANDATORY
Your acknowledgment MUST reflect the actual content of their answer. NEVER use generic praise.

WRONG (generic): "That's a thoughtful approach!" (when they said something dismissive)
WRONG (generic): "Great answer!" (for any response regardless of quality)
WRONG (mismatch): "I love that empathy!" (when they showed none)

RIGHT (specific to good answer): "Validating their feelings first before redirecting - that shows real awareness."
RIGHT (specific to average answer): "Got it, so you'd focus on encouragement."
RIGHT (specific to weak answer): "So your instinct would be to push through - interesting."

Rule: If you cannot name a SPECIFIC thing from their answer in your acknowledgment, your acknowledgment is too generic. Fix it.

## CONVERSATION FLOW
1. Warm greeting + Question 1 of 4
2. After each answer, classify it:
   - GOOD (detailed, empathetic, specific actions): Brief SPECIFIC acknowledgment -> next question
   - VAGUE (under 15 words, generic, no specifics): ONE probe -> accept next response -> move on
   - LOW EFFORT (dismissive, minimal, lazy): Follow Low Effort Detection rules above
   - CONCERNING (harsh, punitive, red flags): Follow Concerning Response Handling rules above
   - DISENGAGEMENT (wants to quit): Follow Disengagement Detection rules above
3. Always show "Question X of 4" for progress
4. After Q4: Thank and close

## THE 4 QUESTIONS

Q1: "A 6-year-old is frustrated, saying 'I can't do this.' How would you handle it?"
SCORING: Look for empathy, patience, encouragement, not dismissing feelings

Q2: "A parent says their child hasn't improved after a month. They're disappointed. What would you say?"
SCORING: Look for accountability, communication skills, realistic expectations, professionalism

Q3: "A usually cheerful child seems quiet and withdrawn today. How would you approach this?"
SCORING: Look for observation skills, sensitivity, creating safe space, not forcing

Q4: "A parent asks if you can guarantee 2 grade levels improvement in 3 months. How do you respond?"
SCORING: Look for honesty, managing expectations, not over-promising, professionalism

## SCORING CRITERIA (Score each answer 1-5)

5 = EXCELLENT: Shows deep empathy, specific actions, child-centric approach, professional
4 = GOOD: Shows understanding, reasonable approach, mostly child-focused
3 = AVERAGE: Generic response, textbook answer, lacks personal touch
2 = BELOW AVERAGE: Misses the point, adult-centric, dismissive undertones
1 = POOR: Harsh, dismissive, inappropriate, red flags

Score HONESTLY based on what they actually said. Do not inflate scores to be nice.

## RESPONSE EXAMPLES

GOOD ANSWER ("I'd get down to their level, say 'I can see this is hard,' then break the task into smaller steps"):
"Getting on their level and breaking it down - that's exactly the kind of patience that helps. Question 2 of 4: A parent says..."

VAGUE ANSWER ("I'd just encourage them"):
"Could you walk me through what you'd actually say to them in that moment?"

VAGUE ANSWER (after probe, still generic):
"Got it, thanks for sharing. Question 2 of 4: A parent says..."

CONCERNING ANSWER ("I'd tell them to stop being dramatic and just try"):
"Interesting - what's your thinking behind that approach with a 6-year-old?"

LOW EFFORT ANSWER ("I don't know, just be nice I guess"):
"Could you walk me through what you'd actually say or do in that moment?"

SECOND LOW EFFORT ANSWER:
"Thanks for your time! We have what we need. You can submit your application now. Best wishes!"

DISENGAGEMENT ("cancel" / "not interested" / "I want to stop"):
"No worries at all! Thanks for your time. You can submit your application whenever you're ready. Best wishes!"

## RULES
- MAX one probe per question, then move on
- Never lecture or coach them on what the "right" answer is
- Never repeat a question
- Acknowledgments must reference SPECIFIC content from their answer
- Sound natural, not robotic
- Score every answered question honestly - do not inflate
- Track low-effort count across all questions (second one = end assessment)
- ALWAYS include score for the answer in your JSON response

## ENDING (after Q4 OR exit/disengagement OR second low-effort)
"Thanks for sharing your thoughts! We'll review within 48 hours. If it's a match, Rucha will reach out. Best wishes!"

## OUTPUT FORMAT
JSON only (no markdown):
{
  "message": "Your response",
  "questionNumber": 1-4 or 0 if complete,
  "isComplete": false or true,
  "probedThisQuestion": true or false,
  "lowEffortCount": 0-2,
  "lastAnswerScore": null or 1-5,
  "lastAnswerCategory": null or "empathy" or "communication" or "sensitivity" or "honesty",
  "scores": {
    "q1_empathy": null or 1-5,
    "q2_communication": null or 1-5,
    "q3_sensitivity": null or 1-5,
    "q4_honesty": null or 1-5
  }
}`;

export async function POST(request: NextRequest) {
  // Rate limit: 20 requests per minute per IP
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`chat:${clientId}`, { maxRequests: 20, windowMs: 60000 });
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit);
  }

  try {
    const body = await request.json();
    const { messages, questionNumber, currentScores, applicationId, lowEffortCount } = body;

    // Validate applicationId to prevent unauthorized Gemini API usage
    if (!applicationId) {
      console.error('[coach-assessment/chat] Missing applicationId. Body keys:', Object.keys(body));
      return NextResponse.json({ error: 'applicationId required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { data: app, error: appError } = await supabase
      .from('coach_applications')
      .select('id, status')
      .eq('id', applicationId)
      .single();

    if (appError || !app) {
      return NextResponse.json({ error: 'Invalid application' }, { status: 404 });
    }

    // Only allow chat during active assessment states
    const allowedStates = ['applied', 'started', 'qualified', 'ai_assessment_in_progress'];
    if (!allowedStates.includes(app.status)) {
      console.error('[coach-assessment/chat] Blocked status:', app.status, 'for app:', applicationId);
      return NextResponse.json({ error: 'Assessment not active for this application' }, { status: 403 });
    }

    // Build conversation history for Gemini
    const conversationHistory = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const model = getGenAI().getGenerativeModel({
      model: getGeminiModel('content_generation'),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
        topP: 0.9,
      }
    });

    // Include current scores and low-effort count in context
    const scoresContext = currentScores ? `\nCurrent scores so far: ${JSON.stringify(currentScores)}` : '';
    const effortContext = `\nLow-effort answers so far: ${lowEffortCount || 0}`;

    // Start chat with system context
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: `SYSTEM INSTRUCTIONS:\n${RAI_SYSTEM_PROMPT}\n\nCurrent question number: ${questionNumber || 1}${scoresContext}${effortContext}\n\nNow respond to the conversation. Remember to output ONLY valid JSON. ALWAYS score the user's last answer if they answered a question. Your acknowledgment MUST reference specific content from their answer - never generic praise.` }]
        },
        {
          role: 'model',
          parts: [{ text: '{"message": "Understood. I will conduct the assessment as rAI, score each answer honestly, detect disengagement/low-effort/concerning responses, and use contextual acknowledgments.", "questionNumber": 0, "isComplete": false, "probedThisQuestion": false, "lowEffortCount": 0, "lastAnswerScore": null, "lastAnswerCategory": null, "scores": {"q1_empathy": null, "q2_communication": null, "q3_sensitivity": null, "q4_honesty": null}}' }]
        },
        ...conversationHistory
      ]
    });

    // Get response
    const result = await chat.sendMessage(
      messages.length === 0
        ? "Start the assessment conversation. Greet warmly and ask the first question immediately."
        : "Continue the conversation based on the user's last message. Classify their response (good/vague/low-effort/concerning/disengagement) and handle accordingly. Score their answer honestly (1-5). Your acknowledgment must reference SPECIFIC content from what they said."
    );

    const responseText = result.response.text();
    
    // Parse JSON response
    let parsed;
    try {
      // Clean the response - remove any markdown formatting
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      parsed = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', responseText);
      // Fallback - use the raw text
      parsed = {
        message: responseText,
        questionNumber: questionNumber || 1,
        isComplete: false,
        probedThisQuestion: false,
        lastAnswerScore: null,
        lastAnswerCategory: null,
        scores: currentScores || {
          q1_empathy: null,
          q2_communication: null,
          q3_sensitivity: null,
          q4_honesty: null
        }
      };
    }

    // Ensure scores object exists
    if (!parsed.scores) {
      parsed.scores = currentScores || {
        q1_empathy: null,
        q2_communication: null,
        q3_sensitivity: null,
        q4_honesty: null
      };
    }

    // Calculate total rAI score if assessment is complete
    if (parsed.isComplete) {
      const scores = parsed.scores;
      const validScores = [
        scores.q1_empathy,
        scores.q2_communication,
        scores.q3_sensitivity,
        scores.q4_honesty
      ].filter(s => s !== null && s !== undefined);
      
      if (validScores.length > 0) {
        // Average of answered questions, scaled to 5
        const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        parsed.raiScore = Math.round(avgScore * 10) / 10; // e.g., 3.5 out of 5
        parsed.raiScoreOutOf5 = Math.round(avgScore * 10) / 10;
      }
    }

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Coach assessment chat error:', error);
    
    // Fallback response
    return NextResponse.json({
      message: "I apologize, I'm having a brief technical moment. Could you please repeat your last response?",
      questionNumber: 1,
      isComplete: false,
      probedThisQuestion: false,
      lastAnswerScore: null,
      lastAnswerCategory: null,
      scores: {
        q1_empathy: null,
        q2_communication: null,
        q3_sensitivity: null,
        q4_honesty: null
      },
      error: error.message
    });
  }
}
