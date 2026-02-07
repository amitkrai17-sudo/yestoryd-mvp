// ============================================================
// FILE: app/api/whatsapp/webhook/route.ts
// ============================================================
// Main WhatsApp Lead Bot Webhook (Meta Cloud API)
// Phone: +91 85912 87997 (ID: 1055529114299828)
//
// GET  → Meta verification challenge
// POST → Receive inbound messages, deduplicate, save, queue for processing
//
// Pattern: Return 200 fast, offload processing to QStash
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from '@upstash/qstash';
import crypto from 'crypto';
import { verifyWebhookSignature } from '@/lib/whatsapp/signature';
import { extractMessages, extractStatuses } from '@/lib/whatsapp/extract';
import type { WebhookPayload, ExtractedMessage, ConversationState } from '@/lib/whatsapp/types';
import { normalizePhone } from '@/lib/utils/phone';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const getQStash = () => process.env.QSTASH_TOKEN
  ? new Client({ token: process.env.QSTASH_TOKEN })
  : null;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.yestoryd.com');

// ============================================================
// GET: Meta Verification Challenge
// ============================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('[WA-LeadBot] Verification request:', { mode, hasToken: !!token, hasChallenge: !!challenge });

  if (mode === 'subscribe' && token === process.env.META_WA_VERIFY_TOKEN) {
    console.log('[WA-LeadBot] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  console.error('[WA-LeadBot] Verification failed');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ============================================================
// POST: Receive Inbound Messages
// ============================================================

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Read raw body for signature verification
    const rawBody = await request.text();

    // 2. Verify X-Hub-Signature-256
    const signature = request.headers.get('x-hub-signature-256');
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error(JSON.stringify({ requestId, event: 'wa_leadbot_invalid_signature' }));
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 3. Parse payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Quick check: is this a WhatsApp webhook?
    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' });
    }

    // 4. Extract messages and statuses
    const messages = extractMessages(payload);
    const statuses = extractStatuses(payload);

    // 5. Handle statuses (update delivery status in DB)
    if (statuses.length > 0) {
      await handleStatuses(statuses, requestId);
    }

    // 6. Process each message
    if (messages.length > 0) {
      await handleMessages(messages, requestId);
    }

    // 7. Return 200 fast
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'wa_leadbot_webhook_complete',
      messages: messages.length,
      statuses: statuses.length,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({ status: 'ok' });

  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'wa_leadbot_webhook_error',
      error: error.message,
    }));

    // Always return 200 to prevent Meta from retrying
    return NextResponse.json({ status: 'error' });
  }
}

// ============================================================
// HANDLE INBOUND MESSAGES
// ============================================================

async function handleMessages(messages: ExtractedMessage[], requestId: string) {
  const supabase = getSupabase();

  for (const msg of messages) {
    const phone = normalizePhone(msg.from);

    // 1. Deduplicate by wa_message_id
    const { data: existing } = await supabase
      .from('wa_lead_messages')
      .select('id')
      .eq('wa_message_id', msg.messageId)
      .maybeSingle();

    if (existing) {
      console.log(JSON.stringify({ requestId, event: 'wa_leadbot_duplicate', messageId: msg.messageId }));
      continue;
    }

    // 2. Get or create conversation
    let conversation = await getOrCreateConversation(supabase, phone, msg, requestId);
    if (!conversation) continue;

    // 3. Save inbound message
    const { error: insertError } = await supabase
      .from('wa_lead_messages')
      .insert({
        conversation_id: conversation.id,
        direction: 'inbound',
        sender_type: 'user',
        content: msg.text || `[${msg.type}]`,
        message_type: msg.type,
        wa_message_id: msg.messageId,
        metadata: {
          contact_name: msg.contactName,
          interactive_id: msg.interactiveId,
          interactive_title: msg.interactiveTitle,
          media_id: msg.mediaId,
          is_reply: msg.isReply,
          reply_to_id: msg.replyToId,
        },
      });

    if (insertError) {
      // Handle unique constraint violation (race condition)
      if (insertError.code === '23505') {
        console.log(JSON.stringify({ requestId, event: 'wa_leadbot_race_dedup', messageId: msg.messageId }));
        continue;
      }
      console.error(JSON.stringify({ requestId, event: 'wa_leadbot_insert_error', error: insertError.message }));
      continue;
    }

    // 4. Update conversation last_message_at
    await supabase
      .from('wa_lead_conversations')
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', conversation.id);

    // 5. Queue for processing via QStash
    const qstash = getQStash();
    if (qstash) {
      try {
        const result = await qstash.publishJSON({
          url: `${APP_URL}/api/whatsapp/process`,
          body: {
            conversationId: conversation.id,
            messageId: msg.messageId,
            phone,
            text: msg.text,
            type: msg.type,
            contactName: msg.contactName,
            interactiveId: msg.interactiveId,
            interactiveTitle: msg.interactiveTitle,
            currentState: conversation.current_state,
            requestId,
          },
          retries: 3,
          delay: 1,
        });

        console.log(JSON.stringify({
          requestId,
          event: 'wa_leadbot_queued',
          qstashMessageId: result.messageId,
          conversationId: conversation.id,
        }));
      } catch (error: any) {
        console.error(JSON.stringify({
          requestId,
          event: 'wa_leadbot_queue_error',
          error: error.message,
        }));
      }
    } else {
      console.warn(JSON.stringify({ requestId, event: 'wa_leadbot_qstash_not_configured' }));
    }
  }
}

// ============================================================
// GET OR CREATE CONVERSATION
// ============================================================

async function getOrCreateConversation(
  supabase: any,
  phone: string,
  msg: ExtractedMessage,
  requestId: string
) {
  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('wa_lead_conversations')
    .select('*')
    .eq('phone_number', phone)
    .maybeSingle();

  if (existing) return existing;

  // Create new conversation
  const { data: conversation, error: convError } = await supabase
    .from('wa_lead_conversations')
    .insert({
      phone_number: phone,
      current_state: 'GREETING' as ConversationState,
      collected_data: {},
      lead_score: 0,
      is_bot_active: true,
      consent_given: false,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (convError) {
    // Handle race condition (another request created it)
    if (convError.code === '23505') {
      const { data: raceConv } = await supabase
        .from('wa_lead_conversations')
        .select('*')
        .eq('phone_number', phone)
        .single();
      return raceConv;
    }
    console.error(JSON.stringify({ requestId, event: 'wa_leadbot_conv_create_error', error: convError.message }));
    return null;
  }

  // Also create lead record
  await supabase
    .from('wa_leads')
    .insert({
      phone_number: phone,
      parent_name: msg.contactName || null,
      source: 'whatsapp_leadbot',
      status: 'new',
      lead_score: 0,
      conversation_id: conversation.id,
    })
    .then(({ error }: { error: any }) => {
      if (error && error.code !== '23505') {
        console.error(JSON.stringify({ requestId, event: 'wa_leadbot_lead_create_error', error: error.message }));
      }
    });

  console.log(JSON.stringify({
    requestId,
    event: 'wa_leadbot_new_conversation',
    conversationId: conversation.id,
    phone,
    contactName: msg.contactName,
  }));

  return conversation;
}

// ============================================================
// HANDLE STATUS UPDATES
// ============================================================

async function handleStatuses(
  statuses: Array<{ messageId: string; status: string; recipientId: string; timestamp: string }>,
  requestId: string
) {
  const supabase = getSupabase();

  for (const status of statuses) {
    // For now, just log status updates (JSONB merge for metadata deferred to Phase 2)
    console.log(JSON.stringify({
      requestId,
      event: 'wa_leadbot_status',
      messageId: status.messageId,
      status: status.status,
    }));
  }
}
