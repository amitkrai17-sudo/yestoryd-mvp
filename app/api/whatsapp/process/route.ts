// ============================================================
// FILE: app/api/whatsapp/process/route.ts
// ============================================================
// QStash Consumer - Process inbound WhatsApp Lead Bot messages
// Called by QStash after webhook saves the message
//
// Phase 1 Stub:
// - GREETING → Send welcome with 3 buttons
// - Any other state → Send placeholder with assessment link
// - Always mark incoming message as read (blue ticks)
//
// Security: QStash signature verification
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendText, sendButtons, markAsRead } from '@/lib/whatsapp/cloud-api';
import type { ConversationState } from '@/lib/whatsapp/types';

// --- CONFIGURATION ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  // 1. Internal API key (for testing)
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // 2. QStash signature (production)
  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = getReceiver();
      const isValid = await receiver.verify({ signature, body });
      if (isValid) {
        return { isValid: true, source: 'qstash' };
      }
    } catch (e) {
      console.error('[WA-LeadBot] QStash verification failed:', e);
    }
  }

  // 3. Development bypass
  if (process.env.NODE_ENV === 'development') {
    console.warn('[WA-LeadBot] Development mode - skipping signature verification');
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// --- MAIN HANDLER ---
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Read body
    const rawBody = await request.text();

    // 2. Verify auth
    const auth = await verifyAuth(request, rawBody);
    if (!auth.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse payload
    const payload: ProcessPayload = JSON.parse(rawBody);
    const { conversationId, messageId, phone, text, contactName, interactiveId, currentState, requestId } = payload;

    console.log(JSON.stringify({
      requestId,
      event: 'wa_leadbot_process_start',
      conversationId,
      state: currentState,
      text: text?.slice(0, 50),
    }));

    // 4. Mark as read (blue ticks)
    await markAsRead(messageId);

    // 5. Route by conversation state
    const supabase = getSupabase();

    if (currentState === 'GREETING') {
      // ============================================================
      // GREETING → Send welcome with 3 buttons
      // ============================================================
      const firstName = contactName?.split(' ')[0] || 'there';

      await sendButtons(
        phone,
        `Hi ${firstName}! Welcome to Yestoryd - India's #1 AI-powered reading program for children aged 4-12.\n\nHow can we help you today?`,
        [
          { id: 'btn_check_reading', title: 'Check my child\'s reading' },
          { id: 'btn_pricing', title: 'See pricing' },
          { id: 'btn_talk_team', title: 'Talk to our team' },
        ],
        { footer: 'Powered by Yestoryd AI' }
      );

      // Save bot reply
      await supabase.from('wa_lead_messages').insert({
        conversation_id: conversationId,
        direction: 'outbound',
        sender_type: 'bot',
        content: `Welcome message sent to ${firstName}`,
        message_type: 'buttons',
        metadata: { state_transition: 'GREETING → QUALIFYING' },
      });

      // Update state
      await supabase
        .from('wa_lead_conversations')
        .update({
          current_state: 'QUALIFYING' as ConversationState,
          collected_data: { contact_name: contactName },
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

    } else {
      // ============================================================
      // ALL OTHER STATES → Placeholder with assessment link
      // ============================================================

      // Check if user tapped a button
      let responseText: string;

      if (interactiveId === 'btn_check_reading') {
        responseText = `Great choice! Take our free 3-minute AI reading assessment to understand your child's reading level:\n\nhttps://www.yestoryd.com/assessment\n\nIt's completely free and gives you a detailed report instantly.`;
      } else if (interactiveId === 'btn_pricing') {
        responseText = `Our programs start at just ₹4,999/month for personalized 1-on-1 coaching.\n\nTake the free assessment first, and we'll recommend the best plan for your child:\nhttps://www.yestoryd.com/assessment\n\nOr reply "talk" to speak with our team.`;
      } else if (interactiveId === 'btn_talk_team') {
        responseText = `We'd love to help! Our reading coaches are available for a free 15-minute discovery call.\n\nBook your slot here:\nhttps://www.yestoryd.com/book-call\n\nOr just tell us your child's name and age, and we'll reach out!`;
      } else {
        responseText = `Thanks for your message! Here are some quick options:\n\n📊 Free Reading Assessment: https://www.yestoryd.com/assessment\n📞 Book a Free Call: https://www.yestoryd.com/book-call\n\nOr reply "talk" to connect with our team.`;
      }

      await sendText(phone, responseText);

      // Save bot reply
      await supabase.from('wa_lead_messages').insert({
        conversation_id: conversationId,
        direction: 'outbound',
        sender_type: 'bot',
        content: responseText,
        message_type: 'text',
        metadata: { interactive_id: interactiveId, state: currentState },
      });
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'wa_leadbot_process_complete',
      conversationId,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({ status: 'processed' });

  } catch (error: any) {
    console.error(JSON.stringify({
      event: 'wa_leadbot_process_error',
      error: error.message,
    }));
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
