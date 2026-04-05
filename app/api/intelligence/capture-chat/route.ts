// ============================================================
// POST /api/intelligence/capture-chat
// Conversational session capture powered by Gemini.
// Streams responses via SSE. Extracts structured data after 4-5 exchanges.
// ============================================================

import { NextRequest } from 'next/server';
import { requireAdminOrCoach } from '@/lib/api-auth';
import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function sseEvent(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error }), { status: 401 });
  }

  try {
    const { messages, childName, childAge, childProfile, activeContinuations, skillCategories, sessionModality } = await request.json();

    // Count coach messages for turn-awareness
    const coachMessageCount = (messages || []).filter((m: any) => m.role === 'user').length;

    // Build continuation context (short form for prompt)
    const prevStruggles = (activeContinuations || []).map((c: any) => c.observation_text).join(', ');

    // Build skill taxonomy
    const skillList = (skillCategories || [])
      .map((sc: any) => `${sc.label}: ${(sc.skills || []).map((s: any) => s.name).join(', ')}`)
      .join('\n');

    const currentQ = coachMessageCount + 1; // Next question number (1-indexed)

    const mustExtract = coachMessageCount >= 5;

    const systemPrompt = `${mustExtract ? 'MANDATORY: Generate the ---CAPTURE_DATA--- JSON block NOW. Do NOT ask another question.\n\n' : ''}You are rAI. Quick session debrief about ${childName || 'the child'} (age ${childAge || 7}). Question ${currentQ} of 7.

QUESTION SEQUENCE (ask NEXT uncovered topic, max 2 sentences per response):
Q1: What skills/topics were covered today?
Q2: How would you rate performance — emerging, developing, proficient, or advanced?
Q3: What went well? Any strengths?${prevStruggles ? ` (Previous struggles: ${prevStruggles})` : ''}
Q4: Any areas they struggled with?
Q5: How engaged were they — low, moderate, high, or exceptional?
Q6: Any homework for home practice?
Q7: Anything else?
After Q7 or "that's it" → generate ---CAPTURE_DATA---.

RULES:
- Max 2 sentences: 1 acknowledgment (under 10 words) + 1 question.
- Short answer ("no", "nothing", "fine") → accept, next question.
- "That's it" or "done" → extract immediately.
- NEVER repeat or rephrase a question already asked.
${mustExtract ? '- YOU MUST EXTRACT NOW WITH WHATEVER YOU HAVE.\n' : ''}
SKILL CATEGORIES: ${skillList || 'Phonics, Fluency, Comprehension, Vocabulary, Grammar'}
CHILD PROFILE: ${childProfile ? JSON.stringify(childProfile).substring(0, 200) : 'None.'}

EXTRACTION FORMAT (append to end of your message when ready):

---CAPTURE_DATA---
{"ready":true,"skills":[{"name":"Phonics","slug":"phonics","rating":"developing"}],"strengths":["observed strength"],"struggles":["observed struggle"],"strengthSummary":"What went well summary","struggleSummary":"Growth areas summary","wordsMastered":["word1"],"wordsStruggled":["word2"],"engagement":"high","homework":"Practice suggestion","continuationUpdates":[]}
---END_CAPTURE---

Before the block, say: "Got it! Let me prepare your report."
Extract what you have. Coach fills gaps on the review form.`;

    console.log(JSON.stringify({ requestId, event: 'capture_chat_start', coachMessageCount, currentQ, messageCount: (messages || []).length }));

    // Build Gemini conversation — MUST include both user AND assistant messages
    const conversationParts: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // System prompt as first user message (Gemini doesn't have system role)
    conversationParts.push({ role: 'user', parts: [{ text: `[SYSTEM]\n${systemPrompt}\n[/SYSTEM]\n\nBegin the debrief.` }] });

    if (!messages || messages.length === 0) {
      // First call — Gemini generates the opening Q1
    } else {
      // Reconstruct the FULL conversation including assistant turns
      // The first assistant message was Q1 (opening)
      conversationParts.push({ role: 'model', parts: [{ text: `Hey! Tell me about ${childName}'s session today — what did you focus on?` }] });

      // Add ALL messages in order — both user AND assistant
      for (const msg of messages) {
        // Skip the first assistant message (we already added the synthetic Q1)
        if (msg === messages[0] && msg.role === 'assistant') continue;

        conversationParts.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Ensure alternating user/model turns (Gemini requirement)
    // If last two parts have same role, merge them
    for (let i = conversationParts.length - 1; i > 0; i--) {
      if (conversationParts[i].role === conversationParts[i - 1].role) {
        conversationParts[i - 1].parts[0].text += '\n' + conversationParts[i].parts[0].text;
        conversationParts.splice(i, 1);
      }
    }

    // Stream response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          try { controller.enqueue(encoder.encode(sseEvent(data))); } catch {}
        };

        try {
          const model = getGenAI().getGenerativeModel({
            model: getGeminiModel('content_generation'),
            generationConfig: { maxOutputTokens: 2000, temperature: mustExtract ? 0.3 : 0.7 },
          });

          // If must extract, inject a forcing message as the last user turn
          if (mustExtract && conversationParts[conversationParts.length - 1]?.role === 'user') {
            conversationParts[conversationParts.length - 1].parts[0].text += '\n\n[Generate the ---CAPTURE_DATA--- block now with all information gathered so far.]';
          }

          const result = await model.generateContentStream({ contents: conversationParts });

          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              send({ type: 'chunk', content: text });
            }
          }

          send({ type: 'done', source: 'capture-chat' });
        } catch (err: any) {
          console.error(JSON.stringify({ requestId, event: 'capture_chat_error', error: err.message }));
          send({ type: 'error', message: 'AI response failed. Please try again.' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Request-Id': requestId,
      },
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'capture_chat_fatal', error: error.message }));
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}
