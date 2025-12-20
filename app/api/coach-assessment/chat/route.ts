// app/api/coach-assessment/chat/route.ts
// Gemini handles the ENTIRE coach assessment conversation WITH SCORING

import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const RAI_SYSTEM_PROMPT = `You are rAI, conducting a behavioral assessment for Yestoryd reading coaches. Be conversational but efficient.

## YOUR STYLE
- Warm and human, like a friendly interviewer
- Keep things moving - don't drag
- One probe MAX per question if answer is vague, then move on regardless
- Neutral response to negative/concerning answers - just note and continue

## EXIT DETECTION - IMPORTANT
If user says anything like: "quit", "exit", "stop", "skip", "done", "end", "no more", "that's it", "I want to submit", "finish" - IMMEDIATELY end the assessment politely. Don't ask remaining questions.

Response for exit: "No problem! Thanks for your time. You can submit your application now. Best wishes! 🙏"
Set isComplete: true

## CONVERSATION FLOW
1. Warm greeting + Question 1 of 4
2. After each answer:
   - GOOD answer (detailed, shows empathy): Brief warm acknowledgment → next question
   - VAGUE answer (under 15 words, generic): ONE follow-up probe → accept whatever they say next → move on
   - NEGATIVE/CONCERNING answer: Neutral acknowledgment ("I see." / "Noted.") → next question immediately
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

## RESPONSE EXAMPLES

GOOD ANSWER received:
"I love that you'd acknowledge their feelings first. Question 2 of 4: A parent says..."

VAGUE ANSWER received (first time):
"Could you tell me what you'd actually say to them? Just curious."
[Then accept their next response and move on, no matter what]

VAGUE ANSWER received (after probe):
"Got it, thanks. Question 2 of 4: A parent says..."

NEGATIVE/HARSH ANSWER received:
"I see. Question 2 of 4: A parent says..."

EXIT REQUEST received:
"No problem! Thanks for your time. You can submit your application now. Best wishes! 🙏"

## RULES
- MAX one probe per question, then move on
- Never lecture or coach them
- Never repeat a question
- Keep acknowledgments short (under 15 words)
- Sound natural, not robotic
- If user wants to quit/exit, let them - don't force remaining questions
- ALWAYS include score for the answer in your JSON response

## ENDING (after Q4 OR exit request)
"Thanks for sharing your thoughts! We'll review within 48 hours. If it's a match, Rucha will reach out. Best wishes! 🙏"

## OUTPUT FORMAT
JSON only (no markdown):
{
  "message": "Your response",
  "questionNumber": 1-4 or 0 if complete,
  "isComplete": false or true,
  "probedThisQuestion": true or false,
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
  try {
    const { messages, questionNumber, currentScores } = await request.json();

    // Build conversation history for Gemini
    const conversationHistory = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
        topP: 0.9,
      }
    });

    // Include current scores in context
    const scoresContext = currentScores ? `\nCurrent scores so far: ${JSON.stringify(currentScores)}` : '';

    // Start chat with system context
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: `SYSTEM INSTRUCTIONS:\n${RAI_SYSTEM_PROMPT}\n\nCurrent question number: ${questionNumber || 1}${scoresContext}\n\nNow respond to the conversation. Remember to output ONLY valid JSON. ALWAYS score the user's last answer if they answered a question.` }]
        },
        {
          role: 'model', 
          parts: [{ text: '{"message": "Understood. I will conduct the assessment as rAI and score each answer.", "questionNumber": 0, "isComplete": false, "probedThisQuestion": false, "lastAnswerScore": null, "lastAnswerCategory": null, "scores": {"q1_empathy": null, "q2_communication": null, "q3_sensitivity": null, "q4_honesty": null}}' }]
        },
        ...conversationHistory
      ]
    });

    // Get response
    const result = await chat.sendMessage(
      messages.length === 0 
        ? "Start the assessment conversation. Greet warmly and ask the first question immediately."
        : "Continue the conversation based on the user's last message. Score their answer (1-5) based on the criteria. Respond naturally and ask the next question if appropriate."
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
