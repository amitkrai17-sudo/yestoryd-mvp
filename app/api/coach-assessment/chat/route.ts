// app/api/coach-assessment/chat/route.ts
// Gemini handles the ENTIRE coach assessment conversation

import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const VEDANT_SYSTEM_PROMPT = `You are Vedant, conducting a behavioral assessment for Yestoryd reading coaches. Be conversational but efficient.

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

Q2: "A parent says their child hasn't improved after a month. They're disappointed. What would you say?"

Q3: "A usually cheerful child seems quiet and withdrawn today. How would you approach this?"

Q4: "A parent asks if you can guarantee 2 grade levels improvement in 3 months. How do you respond?"

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

## ENDING (after Q4 OR exit request)
"Thanks for sharing your thoughts! We'll review within 48 hours. If it's a match, Rucha will reach out. Best wishes! 🙏"

## OUTPUT FORMAT
JSON only (no markdown):
{
  "message": "Your response",
  "questionNumber": 1-4 or 0 if complete,
  "isComplete": false or true,
  "probedThisQuestion": true or false
}`;

export async function POST(request: NextRequest) {
  try {
    const { messages, questionNumber } = await request.json();

    // Build conversation history for Gemini
    const conversationHistory = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 400,
        topP: 0.9,
      }
    });

    // Start chat with system context
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: `SYSTEM INSTRUCTIONS:\n${VEDANT_SYSTEM_PROMPT}\n\nCurrent question number: ${questionNumber || 1}\n\nNow respond to the conversation. Remember to output ONLY valid JSON.` }]
        },
        {
          role: 'model', 
          parts: [{ text: '{"message": "Understood. I will conduct the assessment as Vedant.", "questionNumber": 0, "isComplete": false, "sentiment": "neutral"}' }]
        },
        ...conversationHistory
      ]
    });

    // Get response
    const result = await chat.sendMessage(
      messages.length === 0 
        ? "Start the assessment conversation. Greet warmly and ask the first question immediately."
        : "Continue the conversation based on the user's last message. Respond naturally and ask the next question if appropriate."
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
        sentiment: 'neutral'
      };
    }

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Coach assessment chat error:', error);
    
    // Fallback response
    return NextResponse.json({
      message: "I apologize, I'm having a brief technical moment. Could you please repeat your last response?",
      questionNumber: 1,
      isComplete: false,
      sentiment: 'neutral',
      error: error.message
    });
  }
}