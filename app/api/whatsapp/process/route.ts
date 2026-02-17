// ============================================================
// FILE: app/api/whatsapp/process/route.ts
// ============================================================
// QStash Consumer - Process inbound WhatsApp Lead Bot messages
// Called by QStash after webhook saves the message
//
// Full Pipeline:
// 1. Verify auth (QStash signature / internal key / dev bypass)
// 2. Fetch conversation from DB (with collected_data)
// 3. Check is_bot_active (skip if human handoff)
// 4. Classify intent (Tier 0 regex → Tier 1 Gemini)
// 5. Route to handler
// 6. Save outbound message + update conversation state
// 7. Mark incoming as read (blue ticks)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { markAsRead } from '@/lib/whatsapp/cloud-api';
import { classifyIntent } from '@/lib/whatsapp/intent';
import type { ClassificationResult } from '@/lib/whatsapp/intent';
import type { ConversationState, WaLeadConversation } from '@/lib/whatsapp/types';
import { handleGreeting } from '@/lib/whatsapp/handlers/greeting';
import { handleFaq } from '@/lib/whatsapp/handlers/faq';
import { handleQualification } from '@/lib/whatsapp/handlers/qualification';
import { handleAssessmentCta } from '@/lib/whatsapp/handlers/assessment-cta';
import { handleBooking } from '@/lib/whatsapp/handlers/booking';
import { handleEscalate } from '@/lib/whatsapp/handlers/escalate';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION ---
const getSupabase = createAdminClient;

const getReceiver = () => new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

// --- TYPES ---
interface ProcessPayload {
  conversationId: string;
  messageId: string;
  phone: string;
  text: string | null;
  type: string;
  contactName: string;
  interactiveId: string | null;
  interactiveTitle: string | null;
  currentState: ConversationState;
  requestId: string;
}

// --- VERIFICATION ---
async function verifyAuth(request: NextRequest, body: string): Promise<{ isValid: boolean; source: string }> {
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = getReceiver();
      const isValid = await receiver.verify({ signature, body });
      if (isValid) return { isValid: true, source: 'qstash' };
    } catch (e) {
      console.error('[WA-LeadBot] QStash verification failed:', e);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn('[WA-LeadBot] Development mode - skipping signature verification');
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// --- SAVE BOT MESSAGE ---
async function saveBotMessage(
  conversationId: string,
  content: string,
  messageType: string,
  metadata: Record<string, unknown>
) {
  const supabase = getSupabase();
  await supabase.from('wa_lead_messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    sender_type: 'bot',
    content,
    message_type: messageType,
    metadata: metadata as any,
  });
}

// --- UPDATE CONVERSATION STATE ---
async function updateConversation(
  conversationId: string,
  nextState: ConversationState,
  collectedData: Record<string, unknown>,
  leadScore?: number
) {
  const supabase = getSupabase();
  const update: Record<string, unknown> = {
    current_state: nextState,
    collected_data: collectedData,
    updated_at: new Date().toISOString(),
  };
  if (leadScore !== undefined) {
    update.lead_score = leadScore;
  }
  await supabase
    .from('wa_lead_conversations')
    .update(update)
    .eq('id', conversationId);
}

// --- UPDATE/CREATE LEAD RECORD ---
async function upsertLead(
  phone: string,
  conversationId: string,
  collectedData: Record<string, unknown>,
  leadScore: number,
  status?: string
) {
  const supabase = getSupabase();
  const leadData: Record<string, unknown> = {
    phone_number: phone,
    conversation_id: conversationId,
    lead_score: leadScore,
    updated_at: new Date().toISOString(),
  };
  if (collectedData.child_name) leadData.child_name = collectedData.child_name;
  if (collectedData.child_age) leadData.child_age = collectedData.child_age;
  if (collectedData.reading_concerns) leadData.reading_concerns = collectedData.reading_concerns;
  if (collectedData.city) leadData.city = collectedData.city;
  if (collectedData.school) leadData.school = collectedData.school;
  if (collectedData.contact_name) leadData.parent_name = collectedData.contact_name;
  if (status) leadData.status = status;

  const { error } = await supabase
    .from('wa_leads')
    .upsert(leadData as any, { onConflict: 'phone_number' });

  if (error && error.code !== '23505') {
    console.error('[WA-LeadBot] Lead upsert error:', error);
  }
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Read body & verify auth
    const rawBody = await request.text();
    const auth = await verifyAuth(request, rawBody);
    if (!auth.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    const payload: ProcessPayload = JSON.parse(rawBody);
    const {
      conversationId, messageId, phone, text, contactName,
      interactiveId, interactiveTitle, currentState, requestId,
    } = payload;

    console.log(JSON.stringify({
      requestId,
      event: 'wa_leadbot_process_start',
      conversationId,
      state: currentState,
      text: text?.slice(0, 50),
      interactiveId,
    }));

    // 3. Mark as read (blue ticks) — fire and forget
    markAsRead(messageId).catch(() => {});

    // 4. Fetch latest conversation from DB (state may have changed since queued)
    const supabase = getSupabase();
    const { data: conversation } = await supabase
      .from('wa_lead_conversations')
      .select('*')
      .eq('id', conversationId)
      .single<WaLeadConversation>();

    if (!conversation) {
      console.error(JSON.stringify({ requestId, event: 'wa_leadbot_conversation_not_found', conversationId }));
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const liveState = conversation.current_state;
    const collectedData = (conversation.collected_data || {}) as Record<string, unknown>;
    const leadScore = conversation.lead_score || 0;

    // 5. Check is_bot_active (human handoff mode)
    if (!conversation.is_bot_active) {
      console.log(JSON.stringify({ requestId, event: 'wa_leadbot_human_handoff_skip', conversationId }));
      return NextResponse.json({ status: 'skipped', reason: 'human_handoff' });
    }

    // 6. Classify intent (Tier 0 → Tier 1)
    const classification: ClassificationResult = await classifyIntent(
      text, interactiveId, liveState, collectedData
    );

    console.log(JSON.stringify({
      requestId,
      event: 'wa_leadbot_intent',
      intent: classification.intent,
      tier: classification.tier,
      confidence: classification.confidence,
      state: liveState,
    }));

    // 7. Merge entities from classification into collected data
    const mergedData = { ...collectedData };
    if (classification.entities) {
      for (const [key, value] of Object.entries(classification.entities)) {
        if (value && !mergedData[key]) {
          mergedData[key] = value;
        }
      }
    }
    if (contactName && !mergedData.contact_name) {
      mergedData.contact_name = contactName;
    }

    // 8. Route to handler based on intent + state
    let response: string;
    let nextState: ConversationState = liveState;
    let newLeadScore = leadScore;
    let messageType = 'text';

    const intent = classification.intent;

    // --- Priority overrides: ESCALATE and BOOKING work from any state ---
    if (intent === 'ESCALATE') {
      const result = await handleEscalate(phone, conversationId, mergedData, newLeadScore);
      response = result.response;
      nextState = result.nextState;
      // Escalate handler updates DB directly, skip normal update
      await saveBotMessage(conversationId, response, 'text', {
        intent, tier: classification.tier, state_transition: `${liveState} → ${nextState}`,
      });
      await upsertLead(phone, conversationId, mergedData, newLeadScore, 'qualifying');

      const duration = Date.now() - startTime;
      console.log(JSON.stringify({ requestId, event: 'wa_leadbot_process_complete', intent, nextState, duration: `${duration}ms` }));
      return NextResponse.json({ status: 'processed', intent, nextState });
    }

    if (intent === 'BOOKING') {
      const result = await handleBooking(phone, mergedData);
      response = result.response;
      nextState = result.nextState;
      messageType = 'buttons';
      await upsertLead(phone, conversationId, mergedData, newLeadScore, 'discovery_booked');
    }

    // --- State-based routing ---
    else if (liveState === 'GREETING') {
      const result = await handleGreeting(phone, contactName);
      response = result.response;
      nextState = result.nextState;
      messageType = 'buttons';
      mergedData.contact_name = contactName;
    }

    else if (intent === 'ASSESSMENT_CTA') {
      const result = await handleAssessmentCta(phone, mergedData);
      response = result.response;
      nextState = result.nextState;
      messageType = 'buttons';
      await upsertLead(phone, conversationId, mergedData, newLeadScore, 'qualified');
    }

    else if (intent === 'FAQ') {
      const result = await handleFaq(phone, text || interactiveTitle || 'pricing', mergedData);
      response = result.response;
      // Stay in current state after FAQ (don't change flow)
    }

    else if (liveState === 'QUALIFYING' || intent === 'QUALIFICATION') {
      const result = await handleQualification(phone, text || '', mergedData, classification.entities);
      response = result.response;
      nextState = result.nextState;
      newLeadScore = result.leadScore;
      messageType = result.allCollected ? 'buttons' : 'text';

      // Merge extracted data
      for (const [key, value] of Object.entries(result.extracted)) {
        if (value) mergedData[key] = value;
      }

      const leadStatus = result.allCollected ? 'qualified' : 'qualifying';
      await upsertLead(phone, conversationId, mergedData, newLeadScore, leadStatus);
    }

    // --- Default: any unhandled state+intent combo ---
    else {
      // GENERAL intent or unmatched — re-offer options
      const result = await handleAssessmentCta(phone, mergedData);
      response = result.response;
      nextState = result.nextState;
      messageType = 'buttons';
    }

    // 9. Save bot message & update conversation state
    await saveBotMessage(conversationId, response, messageType, {
      intent,
      tier: classification.tier,
      confidence: classification.confidence,
      state_transition: `${liveState} → ${nextState}`,
    });

    await updateConversation(conversationId, nextState, mergedData, newLeadScore);

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'wa_leadbot_process_complete',
      conversationId,
      intent,
      tier: classification.tier,
      stateTransition: `${liveState} → ${nextState}`,
      leadScore: newLeadScore,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({ status: 'processed', intent, nextState });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({
      event: 'wa_leadbot_process_error',
      error: message,
    }));
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
