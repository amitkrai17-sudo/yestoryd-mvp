// ============================================================
// FILE: app/api/whatsapp/process/route.ts
// ============================================================
// QStash Consumer - Process inbound WhatsApp Lead Bot messages
// Called by QStash after webhook saves the message
//
// TWO-MODE ROUTING:
// Mode 1: Direct routing (tier0 regex / button clicks / slot selection)
//         → Zero brain cost, deterministic handlers only
// Mode 2: Agent Brain (Gemini-powered decisions for text messages)
//         → loadAgentContext → makeDecision → action→handler
// Fallback: If brain errors → old routing logic (pre-brain if/else chain)
//
// Full Pipeline:
// 1. Verify auth (QStash signature / internal key / dev bypass)
// 2. Fetch conversation from DB (with collected_data)
// 3. Check is_bot_active (skip if human handoff)
// 4. Rate limit check (per-phone, before any AI)
// 5. Classify intent (Tier 0 regex → Tier 1 Gemini)
// 6. Route: Mode 1 (tier0 match) or Mode 2 (brain)
// 7. Post-handler: save message, update conversation, upsert lead
// 8. Mark incoming as read (blue ticks)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { markAsRead, sendText, sendButtons } from '@/lib/whatsapp/cloud-api';
import { checkRateLimit } from '@/lib/whatsapp/rate-limiter';
import { classifyIntent } from '@/lib/whatsapp/intent';
import type { ClassificationResult } from '@/lib/whatsapp/intent';
import type { ConversationState, WaLeadConversation } from '@/lib/whatsapp/types';
import { handleGreeting } from '@/lib/whatsapp/handlers/greeting';
import { handleFaq } from '@/lib/whatsapp/handlers/faq';
import { handleQualification } from '@/lib/whatsapp/handlers/qualification';
import { handleAssessmentCta } from '@/lib/whatsapp/handlers/assessment-cta';
import { handleEscalate, notifyAdmin } from '@/lib/whatsapp/handlers/escalate';
import { handleSlotSelection } from '@/lib/whatsapp/handlers/slot-selection';
import { handleBookingConfirm } from '@/lib/whatsapp/handlers/booking-confirm';
import { handleReschedule } from '@/lib/whatsapp/handlers/reschedule';
import { loadAgentContext } from '@/lib/whatsapp/agent/context-loader';
import { makeDecision } from '@/lib/whatsapp/agent/brain';
import { logDecision } from '@/lib/whatsapp/agent/decision-log';
import { updateLifecycle } from '@/lib/whatsapp/agent/lifecycle';
import type { AgentDecision, AgentContext } from '@/lib/whatsapp/agent/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { summarizeLeadConversation } from '@/lib/rai/pipelines/whatsapp-to-rag';

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

// --- MAP LIFECYCLE STATE → CONVERSATION STATE ---
function mapLifecycleState(
  lifecycleState: string | null,
  current: ConversationState
): ConversationState {
  if (!lifecycleState) return current;
  const map: Record<string, ConversationState> = {
    new: 'GREETING',
    engaging: 'QUALIFYING',
    qualifying: 'QUALIFYING',
    assessed: 'ASSESSMENT_OFFERED',
    qualified: 'DISCOVERY_OFFERED',
    slot_offered: 'SLOT_SELECTION',
    booked: 'BOOKED',
    nurturing: 'NURTURING',
    converting: 'NURTURING',
    enrolled: 'COMPLETED',
    cold: 'COMPLETED',
    escalated: 'ESCALATED',
  };
  return map[lifecycleState] || current;
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

    // 6. Rate limit check (before any AI calls)
    const rateCheck = checkRateLimit(phone);
    if (!rateCheck.allowed) {
      console.log(JSON.stringify({ requestId, event: 'wa_leadbot_rate_limited', conversationId, phone }));
      if (rateCheck.message) {
        await sendText(phone, rateCheck.message);
        await saveBotMessage(conversationId, rateCheck.message, 'text', {
          intent: 'RATE_LIMITED',
          state_transition: `${liveState} → ${liveState}`,
        });
      }
      return NextResponse.json({ status: 'rate_limited' });
    }

    // 7. Classify intent (Tier 0 regex → Tier 1 Gemini)
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

    // Merge entities from classification into collected data
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

    // ============================================================
    // 8. TWO-MODE ROUTING
    // ============================================================
    let response = '';
    let nextState: ConversationState = liveState;
    let newLeadScore = leadScore;
    let messageType = 'text';
    let leadStatus: string | undefined;
    let decision: AgentDecision | null = null;
    let agentContext: AgentContext | null = null;
    let brainUsed = false;

    const intent = classification.intent;
    const isTier0 = classification.tier === 0;

    // ============================================================
    // MODE 1: Direct routing (tier0 regex / button clicks / slot select)
    // Zero brain cost — deterministic handlers only
    // ============================================================

    if (intent === 'SLOT_SELECT' && interactiveId) {
      // Slot selection from WhatsApp interactive list → confirm booking
      const result = await handleBookingConfirm(
        phone, conversationId, mergedData, newLeadScore, interactiveId, supabase
      );
      response = result.response;
      nextState = result.nextState;
      if (result.success) {
        leadStatus = 'discovery_booked';
        summarizeLeadConversation(conversationId, phone).catch(e =>
          console.error('WhatsApp→RAG pipeline failed:', e)
        );
      }
    }

    else if (isTier0 && intent === 'RESCHEDULE') {
      const result = await handleReschedule(phone, conversationId, mergedData, newLeadScore, supabase);
      response = result.response;
      nextState = result.nextState;
      messageType = 'list';
      if (result.cancelledCallId) {
        leadStatus = 'qualified';
      }
    }

    else if (isTier0 && intent === 'ESCALATE') {
      // Try discovery call booking first (instead of immediate escalation)
      const introMsg = `We'd love to connect you with a reading coach! Let me find available times for a free discovery call.`;
      await sendText(phone, introMsg);

      const slotResult = await handleSlotSelection(phone, conversationId, mergedData, newLeadScore, supabase);

      if (!slotResult.escalated) {
        // Slots found — user sees slot list
        response = slotResult.response;
        nextState = slotResult.nextState;
        messageType = 'list';
        leadStatus = 'qualifying';
        // Falls through to post-handler
      } else {
        // No slots — slot handler sent "fully booked" message
        // Deactivate bot + fire admin notification as backup
        await supabase.from('wa_lead_conversations').update({
          is_bot_active: false,
          current_state: 'ESCALATED',
          updated_at: new Date().toISOString(),
        }).eq('id', conversationId);

        notifyAdmin(phone, conversationId, mergedData, newLeadScore, text || undefined).catch(() => {});

        await saveBotMessage(conversationId, slotResult.response, 'text', {
          intent, tier: 0, state_transition: `${liveState} → ESCALATED`, brain_used: false,
          escalate_reason: 'no_slots_available',
        });
        await upsertLead(phone, conversationId, mergedData, newLeadScore, 'escalated');
        const duration = Date.now() - startTime;
        console.log(JSON.stringify({ requestId, event: 'wa_leadbot_process_complete', intent, nextState: 'ESCALATED', mode: 1, duration: `${duration}ms` }));
        return NextResponse.json({ status: 'processed', intent, nextState: 'ESCALATED', mode: 1 });
      }
    }

    else if (isTier0 && intent === 'BOOKING') {
      const result = await handleSlotSelection(
        phone, conversationId, mergedData, newLeadScore, supabase
      );
      response = result.response;
      nextState = result.nextState;
      messageType = 'list';
      leadStatus = 'qualifying';
    }

    else if (isTier0 && intent === 'ASSESSMENT_CTA') {
      const result = await handleAssessmentCta(phone, mergedData);
      response = result.response;
      nextState = result.nextState;
      messageType = 'buttons';
      leadStatus = 'qualified';
    }

    else if (isTier0 && intent === 'FAQ') {
      const result = await handleFaq(phone, text || interactiveTitle || 'pricing', mergedData);
      response = result.response;
      // Stay in current state after FAQ
    }

    else if (isTier0 && intent === 'GREETING') {
      const result = await handleGreeting(phone, contactName);
      response = result.response;
      nextState = result.nextState;
      messageType = 'buttons';
      mergedData.contact_name = contactName;
    }

    // ============================================================
    // MODE 2: Agent Brain (text messages needing intelligence)
    // Gemini-powered decisions with full lead context
    // ============================================================
    else {
      brainUsed = true;

      try {
        const brainMessage = text || interactiveTitle || '';
        const brainMessageType = payload.type || 'text';

        // Load full context for the brain
        agentContext = await loadAgentContext(
          supabase, phone, conversationId, brainMessage, brainMessageType
        );

        if (!agentContext) {
          throw new Error('Agent context load failed');
        }

        // Brain decides
        const brainStart = Date.now();
        decision = await makeDecision(agentContext);
        const brainMs = Date.now() - brainStart;

        console.log(JSON.stringify({
          requestId,
          event: 'wa_leadbot_brain_decision',
          action: decision.action,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          escalate: decision.escalate,
          brainMs,
        }));

        // --- Execute brain action ---

        // ESCALATE: try discovery call booking first, fall back to admin notification
        if (decision.action === 'ESCALATE_HOT' || decision.action === 'ESCALATE_OBJECTION') {
          const introMsg = `We'd love to connect you with a reading coach! Let me find available times for a free discovery call.`;
          await sendText(phone, introMsg);

          const slotResult = await handleSlotSelection(phone, conversationId, mergedData, newLeadScore, supabase);
          const lifecycleId = agentContext.lifecycle?.id;

          if (!slotResult.escalated) {
            // Slots found — user sees slot list, proceed normally (no early return)
            response = slotResult.response;
            nextState = slotResult.nextState;
            messageType = 'list';
            leadStatus = 'qualifying';

            Promise.allSettled([
              logDecision(supabase, decision, agentContext, brainMs),
              lifecycleId ? updateLifecycle(supabase, lifecycleId, decision, agentContext.lifecycle?.current_state) : Promise.resolve(),
            ]).catch(() => {});
          } else {
            // No slots — slot handler sent "fully booked" message
            // Deactivate bot + admin notification as backup
            await supabase.from('wa_lead_conversations').update({
              is_bot_active: false,
              current_state: 'ESCALATED',
              updated_at: new Date().toISOString(),
            }).eq('id', conversationId);

            notifyAdmin(phone, conversationId, mergedData, newLeadScore, decision.escalationReason || text || undefined).catch(() => {});

            Promise.allSettled([
              saveBotMessage(conversationId, slotResult.response, 'text', {
                intent, tier: classification.tier,
                state_transition: `${liveState} → ESCALATED`,
                brain_used: true, brain_action: decision.action, brain_confidence: decision.confidence,
                escalate_reason: 'no_slots_available',
              }),
              logDecision(supabase, decision, agentContext, brainMs),
              lifecycleId ? updateLifecycle(supabase, lifecycleId, decision, agentContext.lifecycle?.current_state) : Promise.resolve(),
              upsertLead(phone, conversationId, mergedData, newLeadScore, 'escalated'),
            ]).catch(() => {});

            const duration = Date.now() - startTime;
            console.log(JSON.stringify({
              requestId, event: 'wa_leadbot_process_complete',
              intent, mode: 2, brainAction: decision.action,
              nextState: 'ESCALATED', duration: `${duration}ms`,
            }));
            return NextResponse.json({
              status: 'processed', intent, nextState: 'ESCALATED',
              mode: 2, brainAction: decision.action,
            });
          }
        }

        // GREETING: send brain's message (with buttons if available)
        if (decision.action === 'GREETING') {
          if (decision.buttons?.length) {
            await sendButtons(phone, decision.responseMessage, decision.buttons);
            messageType = 'buttons';
          } else {
            await sendText(phone, decision.responseMessage);
          }
          response = decision.responseMessage;
          nextState = 'QUALIFYING';
        }

        // FAQ / SHARE_PRICING: brain's message if confident, else handleFaq
        else if (decision.action === 'FAQ' || decision.action === 'SHARE_PRICING') {
          if (decision.responseMessage && decision.confidence > 0.6) {
            await sendText(phone, decision.responseMessage);
            response = decision.responseMessage;
          } else {
            const result = await handleFaq(phone, text || interactiveTitle || 'pricing', mergedData);
            response = result.response;
          }
          // Stay in current state after FAQ
        }

        // RESPOND_QUALIFY: avoid double Gemini when brain is confident
        else if (decision.action === 'RESPOND_QUALIFY') {
          if (decision.responseMessage && decision.confidence > 0.6) {
            // Brain's response is substantive — send directly (skip handleQualification's Gemini)
            await sendText(phone, decision.responseMessage);
            response = decision.responseMessage;
            nextState = mapLifecycleState(decision.stateTransition, liveState);
          } else {
            // Low confidence — let qualification handler do its own Gemini call
            const result = await handleQualification(
              phone, text || '', mergedData, classification.entities || {}
            );
            response = result.response;
            nextState = result.nextState;
            newLeadScore = result.leadScore;
            messageType = result.allCollected ? 'buttons' : 'text';
            for (const [key, value] of Object.entries(result.extracted)) {
              if (value) mergedData[key] = value;
            }
          }
          leadStatus = nextState === 'ASSESSMENT_OFFERED' ? 'qualified' : 'qualifying';
        }

        // SEND_ASSESSMENT: delegate to assessment handler
        else if (decision.action === 'SEND_ASSESSMENT') {
          const result = await handleAssessmentCta(phone, mergedData);
          response = result.response;
          nextState = result.nextState;
          messageType = 'buttons';
          leadStatus = 'qualified';
        }

        // OFFER_DISCOVERY / OFFER_SLOTS / BOOK_DISCOVERY: show real available slots
        else if (
          decision.action === 'OFFER_DISCOVERY' ||
          decision.action === 'OFFER_SLOTS' ||
          decision.action === 'BOOK_DISCOVERY'
        ) {
          const result = await handleSlotSelection(
            phone, conversationId, mergedData, newLeadScore, supabase
          );
          response = result.response;
          nextState = result.nextState;
          messageType = 'list';
          leadStatus = 'qualifying';
        }

        // RESCHEDULE: cancel existing booking and re-offer slots
        else if (decision.action === 'RESCHEDULE') {
          const result = await handleReschedule(
            phone, conversationId, mergedData, newLeadScore, supabase
          );
          response = result.response;
          nextState = result.nextState;
          messageType = 'list';
          if (result.cancelledCallId) {
            leadStatus = 'qualified';
          }
        }

        // ENTER_NURTURE: send brain's message, move to nurturing
        else if (decision.action === 'ENTER_NURTURE') {
          response = decision.responseMessage
            || 'Thanks for chatting! We\'ll follow up with helpful reading tips.';
          await sendText(phone, response);
          nextState = 'NURTURING';
        }

        // SEND_TESTIMONIAL: send brain's message, stay in current state
        else if (decision.action === 'SEND_TESTIMONIAL') {
          response = decision.responseMessage
            || 'Many parents have seen amazing results! Would you like to try our free reading assessment?';
          await sendText(phone, response);
        }

        // CLOSE_COLD: send goodbye, move to completed
        else if (decision.action === 'CLOSE_COLD') {
          response = decision.responseMessage
            || 'Thank you for your time! If you ever need help with reading, we\'re here. Take care!';
          await sendText(phone, response);
          nextState = 'COMPLETED';
        }

        // Unknown action: generic fallback message
        else {
          response = decision.responseMessage
            || 'Thanks for your message! Would you like to try our free reading assessment or book a call?';
          await sendText(phone, response);
        }

        // Merge brain's qualificationExtracted into mergedData
        const qe = decision.qualificationExtracted;
        if (qe.child_name && !mergedData.child_name) mergedData.child_name = qe.child_name;
        if (typeof qe.child_age === 'number' && !mergedData.child_age) mergedData.child_age = qe.child_age;
        if (qe.parent_concerns?.length && !mergedData.reading_concerns) {
          mergedData.reading_concerns = qe.parent_concerns.join('; ');
        }

        // Fire-and-forget: log decision + update lifecycle (parallel, non-blocking)
        const lifecycleId = agentContext.lifecycle?.id;
        Promise.allSettled([
          logDecision(supabase, decision, agentContext, brainMs),
          lifecycleId ? updateLifecycle(supabase, lifecycleId, decision, agentContext.lifecycle?.current_state) : Promise.resolve(),
        ]).catch(() => {});

      } catch (brainError) {
        // ============================================================
        // FALLBACK: Brain errored — fall back to old routing logic
        // ============================================================
        console.error(JSON.stringify({
          requestId,
          event: 'wa_leadbot_brain_fallback',
          error: brainError instanceof Error ? brainError.message : 'Unknown error',
        }));

        brainUsed = false;
        decision = null;

        // --- Priority overrides (mirror original) ---
        if (intent === 'ESCALATE') {
          // Try discovery call booking first
          const introMsg = `We'd love to connect you with a reading coach! Let me find available times for a free discovery call.`;
          await sendText(phone, introMsg);

          const slotResult = await handleSlotSelection(phone, conversationId, mergedData, newLeadScore, supabase);

          if (!slotResult.escalated) {
            response = slotResult.response;
            nextState = slotResult.nextState;
            messageType = 'list';
            leadStatus = 'qualifying';
          } else {
            // No slots — deactivate bot + admin notification
            await supabase.from('wa_lead_conversations').update({
              is_bot_active: false,
              current_state: 'ESCALATED',
              updated_at: new Date().toISOString(),
            }).eq('id', conversationId);

            notifyAdmin(phone, conversationId, mergedData, newLeadScore, text || undefined).catch(() => {});

            await saveBotMessage(conversationId, slotResult.response, 'text', {
              intent, tier: classification.tier,
              state_transition: `${liveState} → ESCALATED`, brain_used: false,
              escalate_reason: 'no_slots_available',
            });
            await upsertLead(phone, conversationId, mergedData, newLeadScore, 'escalated');
            const duration = Date.now() - startTime;
            console.log(JSON.stringify({
              requestId, event: 'wa_leadbot_process_complete',
              intent, nextState: 'ESCALATED', mode: 'fallback', duration: `${duration}ms`,
            }));
            return NextResponse.json({ status: 'processed', intent, nextState: 'ESCALATED', mode: 'fallback' });
          }
        }

        if (intent === 'BOOKING') {
          const result = await handleSlotSelection(
            phone, conversationId, mergedData, newLeadScore, supabase
          );
          response = result.response;
          nextState = result.nextState;
          messageType = 'list';
          leadStatus = 'qualifying';
        }

        // --- State-based routing (mirror original) ---
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
          leadStatus = 'qualified';
        }

        else if (intent === 'FAQ') {
          const result = await handleFaq(phone, text || interactiveTitle || 'pricing', mergedData);
          response = result.response;
        }

        else if (liveState === 'QUALIFYING' || intent === 'QUALIFICATION') {
          const result = await handleQualification(
            phone, text || '', mergedData, classification.entities || {}
          );
          response = result.response;
          nextState = result.nextState;
          newLeadScore = result.leadScore;
          messageType = result.allCollected ? 'buttons' : 'text';
          for (const [key, value] of Object.entries(result.extracted)) {
            if (value) mergedData[key] = value;
          }
          leadStatus = result.allCollected ? 'qualified' : 'qualifying';
        }

        // Default: re-offer options
        else {
          const result = await handleAssessmentCta(phone, mergedData);
          response = result.response;
          nextState = result.nextState;
          messageType = 'buttons';
        }
      }
    }

    // ============================================================
    // 9. Post-handler: save message, update conversation, upsert lead
    // ============================================================
    await saveBotMessage(conversationId, response, messageType, {
      intent,
      tier: classification.tier,
      confidence: classification.confidence,
      state_transition: `${liveState} → ${nextState}`,
      brain_used: brainUsed,
      brain_action: decision?.action || null,
      brain_confidence: decision?.confidence || null,
    });

    await updateConversation(conversationId, nextState, mergedData, newLeadScore);

    if (leadStatus) {
      await upsertLead(phone, conversationId, mergedData, newLeadScore, leadStatus);
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'wa_leadbot_process_complete',
      conversationId,
      intent,
      tier: classification.tier,
      mode: brainUsed ? 2 : 1,
      brainAction: decision?.action || null,
      stateTransition: `${liveState} → ${nextState}`,
      leadScore: newLeadScore,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      status: 'processed', intent, nextState,
      mode: brainUsed ? 2 : 1,
      brainAction: decision?.action || null,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({
      event: 'wa_leadbot_process_error',
      error: message,
    }));
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
