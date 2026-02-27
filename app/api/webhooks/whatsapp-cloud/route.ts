// file: app/api/webhooks/whatsapp-cloud/route.ts
// Meta WhatsApp Cloud API Webhook Handler
// Uses DB-driven context (no hardcoded facts) + intent classification

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGeminiModel } from '@/lib/gemini-config';
import { sendWhatsAppCloudMessage, markMessageAsRead } from '@/lib/communication/whatsapp-cloud';
import {
  WHATSAPP_PROSPECT_PROMPT,
  classifyProspectIntent,
  buildProspectContext,
  ProspectIntent,
} from '@/lib/rai/prompts/whatsapp-prospect';
import {
  getPricingPlans,
  getFaqItems,
  getSiteSettings,
  findParentByPhone,
} from '@/lib/rai/queries/prospect-queries';

export const dynamic = 'force-dynamic';

// ==================== DEDUP CACHE ====================
const processedMessages = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000;

const phoneLastMessage = new Map<string, number>();
const RATE_LIMIT_MS = 2_000;

setInterval(() => {
  const now = Date.now();
  processedMessages.forEach((ts, key) => {
    if (now - ts > DEDUP_TTL_MS) processedMessages.delete(key);
  });
  phoneLastMessage.forEach((ts, key) => {
    if (now - ts > 60_000) phoneLastMessage.delete(key);
  });
}, 10 * 60 * 1000);

// ==================== ZOD SCHEMAS ====================
const WebhookMessageSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      value: z.object({
        messaging_product: z.literal('whatsapp'),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string(),
        }),
        contacts: z.array(z.object({
          profile: z.object({ name: z.string() }).optional(),
          wa_id: z.string(),
        })).optional(),
        messages: z.array(z.object({
          from: z.string(),
          id: z.string(),
          timestamp: z.string(),
          type: z.string(),
          text: z.object({ body: z.string() }).optional(),
        })).optional(),
        statuses: z.array(z.any()).optional(),
      }),
      field: z.literal('messages'),
    })),
  })),
});

// ==================== GEMINI CLIENT ====================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ==================== WEBHOOK VERIFICATION (GET) ====================
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('[WA-Webhook] Verification request:', { mode, token: token ? '***' : 'missing', challenge });

  const verifyToken = process.env.WHATSAPP_CLOUD_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WA-Webhook] Verification successful');
    return new NextResponse(challenge, { status: 200 });
  }

  console.error('[WA-Webhook] Verification failed');
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ==================== MESSAGE HANDLER (POST) ====================
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const signature = request.headers.get('x-hub-signature-256');
    const rawBody = await request.text();

    if (!verifySignature(rawBody, signature)) {
      console.error('[WA-Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: z.infer<typeof WebhookMessageSchema>;
    try {
      payload = WebhookMessageSchema.parse(JSON.parse(rawBody));
    } catch {
      console.log('[WA-Webhook] Non-message event, acknowledging');
      return NextResponse.json({ status: 'ok' });
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const messages = change.value.messages;
        if (!messages?.length) continue;

        for (const message of messages) {
          await processMessage(message, change.value.contacts?.[0]);
        }
      }
    }

    console.log(`[WA-Webhook] Processed in ${Date.now() - startTime}ms`);
    return NextResponse.json({ status: 'ok' });

  } catch (error) {
    console.error('[WA-Webhook] Unhandled error:', error);
    return NextResponse.json({ status: 'error' });
  }
}

// ==================== PROCESS INDIVIDUAL MESSAGE ====================
async function processMessage(
  message: { from: string; id: string; timestamp: string; type: string; text?: { body: string } },
  contact?: { profile?: { name: string }; wa_id: string }
) {
  const { from: senderPhone, id: messageId, type: messageType, text } = message;

  console.log(`[WA-Webhook] Message from ${senderPhone}: type=${messageType}, id=${messageId}`);

  if (messageType !== 'text' || !text?.body) {
    console.log('[WA-Webhook] Skipping non-text message');
    await sendWhatsAppCloudMessage(
      senderPhone,
      'Hi! I can help you with text messages. Please type your question and I will be happy to assist. 😊'
    );
    return;
  }

  if (processedMessages.has(messageId)) {
    console.log('[WA-Webhook] Duplicate message, skipping:', messageId);
    return;
  }
  processedMessages.set(messageId, Date.now());

  const lastMsg = phoneLastMessage.get(senderPhone);
  if (lastMsg && Date.now() - lastMsg < RATE_LIMIT_MS) {
    console.log('[WA-Webhook] Rate limited:', senderPhone);
    return;
  }
  phoneLastMessage.set(senderPhone, Date.now());

  await markMessageAsRead(messageId);

  const userMessage = text.body.trim();
  const contactName = contact?.profile?.name || 'there';

  try {
    // 1. Look up sender in database
    const parentData = await findParentByPhone(senderPhone);
    const isKnownParent = !!parentData;

    // 2. Classify intent
    const intent = classifyProspectIntent(userMessage);
    console.log(`[WA-Webhook] Intent: ${intent}, known: ${isKnownParent}`);

    // 3. Query DB based on intent
    const dbContext = await queryForIntent(intent);

    // 4. Build dynamic context
    const context = buildProspectContext({
      intent,
      pricing: dbContext.pricing,
      faq: dbContext.faq,
      settings: dbContext.settings,
      parentName: parentData?.parent?.name ?? undefined,
      childName: parentData?.child?.name ?? undefined,
      childAge: parentData?.child?.age ?? undefined,
      enrollmentStatus: parentData?.enrollmentStatus ?? undefined,
    });

    // 5. Call Gemini with tone-only prompt + DB context
    const model = genAI.getGenerativeModel({ model: getGeminiModel('content_generation') });

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{
            text: `${WHATSAPP_PROSPECT_PROMPT}\n\n--- CONTEXT FROM DATABASE ---\n${context}\n\n--- PARENT MESSAGE ---\n${userMessage}`,
          }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.response.text();

    // 6. Parse AI response
    let aiResponse: { reply: string; shouldEscalate: boolean; escalationReason?: string | null };
    try {
      aiResponse = JSON.parse(responseText);
    } catch {
      aiResponse = { reply: responseText, shouldEscalate: false };
    }

    // Force escalate if intent was ESCALATE
    if (intent === 'ESCALATE' && !aiResponse.shouldEscalate) {
      aiResponse.shouldEscalate = true;
      aiResponse.escalationReason = aiResponse.escalationReason || 'Parent requested human assistance';
    }

    if (!aiResponse.reply || typeof aiResponse.reply !== 'string') {
      aiResponse.reply = 'Thank you for reaching out! You can take a free reading assessment at yestoryd.com to get started. Our team will be happy to help!';
    }

    // 7. Send reply
    const sendResult = await sendWhatsAppCloudMessage(senderPhone, aiResponse.reply);

    // 8. Handle escalation
    if (aiResponse.shouldEscalate) {
      const escalationPhone = process.env.ESCALATION_PHONE;
      if (escalationPhone) {
        await sendWhatsAppCloudMessage(
          escalationPhone,
          `🚨 ESCALATION from WhatsApp AI\n\nFrom: ${contactName} (${senderPhone})\nMessage: "${userMessage}"\nIntent: ${intent}\nReason: ${aiResponse.escalationReason || 'Unknown'}\n\nPlease follow up with this parent.`
        );
        console.log('[WA-Webhook] Escalation sent to:', escalationPhone);
      }
    }

    // 9. Log to communication_logs
    await supabaseAdmin.from('communication_logs').insert({
      template_code: 'whatsapp_cloud_ai_reply',
      channel: 'whatsapp_cloud',
      recipient_type: isKnownParent ? 'parent' : 'prospect',
      recipient_name: contactName,
      recipient_contact: senderPhone,
      variables_used: {
        incoming_message: userMessage,
        ai_reply: aiResponse.reply,
        intent,
        should_escalate: aiResponse.shouldEscalate,
        escalation_reason: aiResponse.escalationReason || null,
        message_id: messageId,
        is_known_parent: isKnownParent,
      },
      status: sendResult.success ? 'sent' : 'failed',
      provider_message_id: sendResult.messageId,
      error_message: sendResult.error,
      sent_at: sendResult.success ? new Date().toISOString() : null,
      failed_at: sendResult.success ? null : new Date().toISOString(),
    });

    console.log(`[WA-Webhook] Replied to ${senderPhone}: intent=${intent}, escalate=${aiResponse.shouldEscalate}`);

  } catch (error) {
    console.error('[WA-Webhook] Error processing message:', error);

    await sendWhatsAppCloudMessage(
      senderPhone,
      `Hi ${contactName}! Thanks for reaching out to Yestoryd. Our team will get back to you shortly. In the meantime, you can take a free reading assessment at yestoryd.com 📚`
    );

    await supabaseAdmin.from('communication_logs').insert({
      template_code: 'whatsapp_cloud_ai_error',
      channel: 'whatsapp_cloud',
      recipient_type: 'prospect',
      recipient_name: contactName,
      recipient_contact: senderPhone,
      variables_used: {
        incoming_message: userMessage,
        error: error instanceof Error ? error.message : 'Unknown',
      },
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'AI processing failed',
      failed_at: new Date().toISOString(),
    });
  }
}

// ==================== INTENT-BASED DB QUERIES ====================
async function queryForIntent(intent: ProspectIntent): Promise<{
  pricing?: unknown;
  faq?: unknown;
  settings?: Record<string, string>;
}> {
  try {
    switch (intent) {
      case 'PRICING':
        return {
          pricing: await getPricingPlans(),
          settings: await getSiteSettings(['whatsapp_number', 'guarantee_text', 'assessment_page_url']),
        };

      case 'FAQ':
        return {
          faq: await getFaqItems(),
          settings: await getSiteSettings(['whatsapp_number', 'assessment_page_url']),
        };

      case 'BOOKING':
        return {
          settings: await getSiteSettings([
            'whatsapp_number',
            'discovery_call_duration_mins',
            'assessment_page_url',
            'default_coach_name',
          ]),
        };

      case 'PROGRAM':
        return {
          pricing: await getPricingPlans(),
          settings: await getSiteSettings([
            'session_coaching_duration_mins',
            'session_skill_building_duration_mins',
            'session_checkin_duration_mins',
            'whatsapp_number',
          ]),
        };

      case 'OBJECTION':
        return {
          pricing: await getPricingPlans(),
          faq: await getFaqItems(),
          settings: await getSiteSettings(['guarantee_text', 'whatsapp_number', 'assessment_page_url']),
        };

      case 'ESCALATE':
      case 'SUPPORT':
        return {
          settings: await getSiteSettings(['whatsapp_number', 'escalation_phone']),
        };

      case 'GENERAL':
      default:
        return {
          settings: await getSiteSettings(['whatsapp_number', 'assessment_page_url']),
        };
    }
  } catch (error) {
    console.error('[WA-Webhook] DB query error for intent:', intent, error);
    return {};
  }
}

// ==================== SIGNATURE VERIFICATION ====================
function verifySignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.WHATSAPP_CLOUD_APP_SECRET;

  if (!appSecret) {
    console.warn('[WA-Webhook] WHATSAPP_CLOUD_APP_SECRET not set, skipping signature verification');
    return true;
  }

  if (!signature) {
    console.error('[WA-Webhook] No signature header');
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
