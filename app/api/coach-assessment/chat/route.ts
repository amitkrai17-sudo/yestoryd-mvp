// app/api/coach-assessment/chat/route.ts
// Gemini handles the ENTIRE coach assessment conversation

import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const VEDANT_SYSTEM_PROMPT = `You are Vedant, conducting a quick 5-question assessment for Yestoryd reading coaches.

## CRITICAL RULES
1. NEVER ask follow-up questions - just acknowledge and move to next question
2. Each response = 1 short acknowledgment + next question
3. Accept ANY answer and move on (even short/weird ones)
4. Keep acknowledgments to ONE sentence max
5. Total conversation: 5 questions, that's it

## FORMAT FOR EVERY RESPONSE
"[One sentence acknowledgment]. [Next question]"

Example:
User answers Q1 → You say: "Thanks for sharing. Question 2: A parent says their child hasn't improved after a month. What would you say?"

## THE 5 QUESTIONS (ask exactly in this order)
Q1: A 6-year-old is frustrated, saying 'I can't do this' after struggling with a word. How would you handle it?
Q2: A parent says their child hasn't improved after a month and they're disappointed. What would you say?
Q3: A usually cheerful child seems quiet and withdrawn today. How would you approach this?
Q4: A parent asks: 'Can you guarantee my child will improve by 2 grade levels in 3 months?' How do you respond?
Q5: You've prepared a lesson, but the child wants to talk about their pet who passed away. What do you do?

## STARTING
Greet briefly and ask Q1 immediately.

## ENDING (after Q5 is answered)
Say: "Thank you! We'll review your application within 48 hours. Best wishes! 🙏"
Set isComplete: true

## JSON OUTPUT (strict format)
{"message": "your text here", "questionNumber": 1-5, "isComplete": false, "sentiment": "neutral"}`;

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
        maxOutputTokens: 300,
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
        ? "Start now. Greet briefly and ask Question 1. Output only JSON."
        : "User answered. Give ONE sentence acknowledgment, then ask next question. Output only JSON."
    );
    
    const responseText = result.response.text().trim();
    
    // Parse JSON response
    let parsed;
    try {
      // Clean up response - remove markdown code blocks if present
      let cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // Try to extract JSON if it's embedded in text
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      parsed = JSON.parse(cleanedResponse);
      
      // Clean up message if it contains JSON artifacts
      if (parsed.message) {
        parsed.message = parsed.message
          .replace(/,?\s*"?questionNumber"?:?\s*\d+/gi, '')
          .replace(/,?\s*"?isComplete"?:?\s*(true|false)/gi, '')
          .replace(/,?\s*"?sentiment"?:?\s*"?\w+"?/gi, '')
          .replace(/^["']|["']$/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
    } catch (parseError) {
      console.error('JSON parse error:', responseText);
      
      // Extract just the readable text, removing any JSON-like content
      let cleanMessage = responseText
        .replace(/\{[\s\S]*\}/g, '')  // Remove JSON blocks
        .replace(/"message":\s*/g, '')
        .replace(/questionNumber.*$/gi, '')
        .replace(/isComplete.*$/gi, '')
        .replace(/sentiment.*$/gi, '')
        .replace(/[{}"\[\]]/g, '')
        .trim();
      
      // If still garbage, use fallback
      if (!cleanMessage || cleanMessage.length < 10) {
        cleanMessage = getContextualFallback(questionNumber + 1);
      }
      
      parsed = {
        message: cleanMessage,
        questionNumber: Math.min((questionNumber || 1) + 1, 5),
        isComplete: false,
        sentiment: 'neutral'
      };
    }

    // Validate the message isn't empty or garbage
    if (!parsed.message || parsed.message.length < 10) {
      parsed.message = getContextualFallback(parsed.questionNumber || questionNumber || 1);
    }

    return NextResponse.json(parsed);

  } catch (error: any) {
    console.error('Vedant AI chat error:', error);
    
    return NextResponse.json({
      message: "I'd love to hear your perspective on working with children. What draws you to teaching young readers?",
      questionNumber: 1,
      isComplete: false,
      sentiment: 'neutral',
      error: error.message
    });
  }
}

function getContextualFallback(questionNumber: number): string {
  const fallbacks: { [key: number]: string } = {
    1: "Let's start with a scenario: A 6-year-old has been struggling with the same word for 3 sessions. They're frustrated and saying 'I can't do this.' How would you handle it?",
    2: "Here's another situation: After a month of coaching, a parent tells you their child hasn't improved much. They're disappointed. What would you say?",
    3: "Question 3 of 5: During a session, a usually cheerful child seems quiet and withdrawn today. How would you approach this?",
    4: "A parent asks you: 'Can you guarantee my child will improve by 2 grade levels in 3 months?' How do you respond?",
    5: "Last question: You've prepared a phonics lesson, but the child just wants to talk about their pet dog who passed away yesterday. What do you do?",
  };
  
  return fallbacks[questionNumber] || fallbacks[1];
}