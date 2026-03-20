// ============================================================
// FILE: app/api/webhooks/aisensy/feedback/route.ts
// ============================================================
// Handles inbound WhatsApp replies from parents after a
// group_class_parent_feedback_request was sent.
//
// Flow:
//   1. AiSensy delivers inbound message (parent's WhatsApp reply)
//   2. Match phone → recent communication_logs outbound entry
//   3. Extract child_id + session_id from the outbound log
//   4. Send parent's reply to Gemini Flash for signal extraction
//   5. Insert learning_event with embedding
//   6. Log to activity_log
//
// Follows pattern from: webhooks/aisensy/goals/route.ts
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getGenAI } from '@/lib/gemini/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/utils/phone';
import { getGeminiModel } from '@/lib/gemini-config';
import { insertLearningEvent } from '@/lib/rai/learning-events';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

export const dynamic = 'force-dynamic';

const getSupabase = createAdminClient;

/**
 * AiSensy inbound webhook payload (same shape as goals webhook)
 */
interface AiSensyInboundPayload {
  from?: string;
  text?: string;
  messageId?: string;
  timestamp?: string;
  type?: string;
}

interface GeminiFeedbackAnalysis {
  emotional_response: 'enjoyed' | 'neutral' | 'disliked' | 'mixed';
  skills_mentioned: string[];
  activities_mentioned: string[];
  concerns: string[];
  observations: string[];
  summary: string;
}

// ── Gemini analysis ───────────────────────────────────────────

async function analyzeFeedback(
  childName: string,
  className: string,
  parentReply: string,
): Promise<GeminiFeedbackAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const model = getGenAI().getGenerativeModel({
      model: getGeminiModel('classification'),
      generationConfig: { maxOutputTokens: 512, temperature: 0.2 },
    });

    const prompt = `A parent was asked "How did ${childName} find today's ${className}?" They replied:

"${parentReply}"

Extract the following from the parent's reply. Return ONLY valid JSON, no markdown.

{
  "emotional_response": "enjoyed" | "neutral" | "disliked" | "mixed",
  "skills_mentioned": ["list of any reading/learning skills mentioned"],
  "activities_mentioned": ["list of any specific activities or games mentioned"],
  "concerns": ["list of any concerns or negative observations"],
  "observations": ["list of any other notable observations about the child"],
  "summary": "One sentence summary of the parent's feedback"
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseText = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonStr = responseText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

    return JSON.parse(jsonStr) as GeminiFeedbackAnalysis;
  } catch (err) {
    console.error('[feedback-webhook] Gemini analysis failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── POST handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const payload: AiSensyInboundPayload = await request.json();

    console.log(JSON.stringify({ requestId, event: 'feedback_webhook_received', from: payload.from, hasText: !!payload.text }));

    const { from, text } = payload;

    // Always return 200 to AiSensy (prevent retries)
    if (!from || !text) {
      return NextResponse.json({ status: 'ignored', reason: 'missing_fields' });
    }

    const phone = normalizePhone(from);
    if (!phone) {
      return NextResponse.json({ status: 'ignored', reason: 'invalid_phone' });
    }

    const supabase = getSupabase();

    // ── Step 1: Find recent outbound feedback request for this phone ──
    // Look for communication_logs where we sent a group_class_parent_feedback_request
    // to this phone in the last 48 hours
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: outboundLogs } = await supabase
      .from('communication_logs')
      .select('id, recipient_id, recipient_phone, context_data, sent_at')
      .eq('template_code', 'group_class_parent_feedback_request')
      .eq('wa_sent', true)
      .gte('sent_at', cutoff)
      .order('sent_at', { ascending: false })
      .limit(20);

    if (!outboundLogs || outboundLogs.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'no_recent_feedback_request', phone }));
      return NextResponse.json({ status: 'no_match', reason: 'no_recent_outbound' });
    }

    // Match by normalized phone
    const matchedLog = outboundLogs.find(log => {
      if (!log.recipient_phone) return false;
      const logPhone = normalizePhone(log.recipient_phone);
      return logPhone === phone;
    });

    if (!matchedLog) {
      console.log(JSON.stringify({ requestId, event: 'phone_not_matched', phone }));
      return NextResponse.json({ status: 'no_match', reason: 'phone_not_in_recent_logs' });
    }

    // ── Step 2: Extract context from the outbound log ──
    const contextData = matchedLog.context_data as Record<string, unknown> | null;
    const sessionId = contextData?.session_id as string | undefined;
    const childIds = contextData?.child_ids as string[] | undefined;
    const childName = contextData?.child_name as string | undefined;
    const className = contextData?.class_name as string | undefined;
    const parentId = matchedLog.recipient_id;

    if (!sessionId || !childIds?.length) {
      console.log(JSON.stringify({ requestId, event: 'missing_context', logId: matchedLog.id }));
      return NextResponse.json({ status: 'error', reason: 'missing_session_context' });
    }

    // Dedup: check if we already processed feedback for this parent + session
    const { data: existingFeedback } = await supabase
      .from('learning_events')
      .select('id')
      .eq('event_type', 'group_class_parent_feedback')
      .in('child_id', childIds)
      .filter('event_data->>session_id', 'eq', sessionId)
      .limit(1);

    if (existingFeedback && existingFeedback.length > 0) {
      console.log(JSON.stringify({ requestId, event: 'feedback_already_processed', sessionId, parentId }));
      return NextResponse.json({ status: 'duplicate', reason: 'already_processed' });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'feedback_matched',
      sessionId,
      childIds,
      childName,
      className,
    }));

    // ── Step 3: Analyze via Gemini Flash ──
    const resolvedChildName = childName || 'the child';
    const resolvedClassName = className || 'Group Class';
    const analysis = await analyzeFeedback(resolvedChildName, resolvedClassName, text);

    console.log(JSON.stringify({
      requestId,
      event: 'gemini_analysis_complete',
      hasAnalysis: !!analysis,
      emotional_response: analysis?.emotional_response,
    }));

    // ── Step 4: Create learning_event for each child ──
    const today = new Date().toISOString().split('T')[0];
    let eventsCreated = 0;

    for (const childId of childIds) {
      const contentForEmbedding = [
        `${resolvedChildName}'s parent feedback after ${resolvedClassName} on ${today}:`,
        text,
        analysis ? `Analysis: ${analysis.summary}` : '',
        analysis?.emotional_response ? `Emotional response: ${analysis.emotional_response}` : '',
        analysis?.skills_mentioned?.length ? `Skills: ${analysis.skills_mentioned.join(', ')}` : '',
        analysis?.concerns?.length ? `Concerns: ${analysis.concerns.join(', ')}` : '',
      ].filter(Boolean).join(' ');

      const insertResult = await insertLearningEvent({
        childId,
        eventType: 'group_class_parent_feedback',
        eventDate: today,
        eventData: {
          session_id: sessionId,
          parent_id: parentId,
          parent_reply: text,
          class_name: resolvedClassName,
          gemini_analysis: analysis ? JSON.parse(JSON.stringify(analysis)) : null,
          wa_message_id: payload.messageId,
        },
        legacyData: {}, // required field
        contentForEmbedding,
        signalSource: 'parent_whatsapp',
        signalConfidence: analysis ? 'high' : 'medium',
        createdBy: 'system',
        sessionModality: 'group_class',
      });

      if (!insertResult) {
        console.error(JSON.stringify({ requestId, event: 'learning_event_insert_failed', childId }));
      } else {
        eventsCreated++;
      }
    }

    // ── Step 5: Activity log ──
    try {
      await supabase.from('activity_log').insert({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system',
        action: 'group_class_parent_feedback_processed',
        metadata: {
          request_id: requestId,
          session_id: sessionId,
          parent_id: parentId,
          child_ids: childIds,
          parent_reply_length: text.length,
          emotional_response: analysis?.emotional_response,
          events_created: eventsCreated,
        },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(JSON.stringify({ requestId, event: 'activity_log_failed', error: String(err) }));
    }

    console.log(JSON.stringify({
      requestId,
      event: 'feedback_webhook_complete',
      sessionId,
      eventsCreated,
    }));

    return NextResponse.json({
      status: 'success',
      requestId,
      session_id: sessionId,
      events_created: eventsCreated,
      analysis: analysis ? { emotional_response: analysis.emotional_response, summary: analysis.summary } : null,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'feedback_webhook_error', error: message }));
    // Always 200 for webhooks
    return NextResponse.json({ status: 'error', error: message });
  }
}

// AiSensy may send verification GET requests
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Group class feedback webhook active' });
}
