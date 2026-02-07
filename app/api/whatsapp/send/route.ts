// ============================================================
// FILE: app/api/whatsapp/send/route.ts
// ============================================================
// Internal Send API for WhatsApp Lead Bot
// Authenticated by service role key or internal API key
//
// Sends messages via Cloud API and saves to wa_lead_messages
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'crypto';
import { sendText, sendButtons, sendList, sendTemplate } from '@/lib/whatsapp/cloud-api';
import type { SendResult } from '@/lib/whatsapp/types';

// --- CONFIGURATION ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- VALIDATION ---
const SendMessageSchema = z.object({
  to: z.string().min(10),
  conversationId: z.string().uuid(),
  senderType: z.enum(['bot', 'agent']),
  type: z.enum(['text', 'buttons', 'list', 'template']),
  body: z.string().min(1).optional(),
  buttons: z.array(z.object({
    id: z.string(),
    title: z.string().max(20),
  })).max(3).optional(),
  buttonText: z.string().max(20).optional(),
  sections: z.array(z.object({
    title: z.string(),
    rows: z.array(z.object({
      id: z.string(),
      title: z.string().max(24),
      description: z.string().max(72).optional(),
    })),
  })).optional(),
  templateName: z.string().optional(),
  templateLanguage: z.string().optional(),
  templateParams: z.array(z.object({
    type: z.literal('text'),
    text: z.string(),
  })).optional(),
  header: z.string().optional(),
  footer: z.string().optional(),
});

// --- AUTH ---
function verifyInternalAuth(request: NextRequest): boolean {
  // Check for internal API key
  const apiKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && apiKey === process.env.INTERNAL_API_KEY) {
    return true;
  }

  // Check for service role key
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return true;
  }

  // Dev bypass
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

// --- HANDLER ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // 1. Verify auth
    if (!verifyInternalAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate
    const body = await request.json();
    const validation = SendMessageSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: validation.error.format() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // 3. Send via Cloud API
    let result: SendResult;
    let messageContent: string;

    switch (data.type) {
      case 'text':
        if (!data.body) {
          return NextResponse.json({ error: 'body is required for text messages' }, { status: 400 });
        }
        result = await sendText(data.to, data.body);
        messageContent = data.body;
        break;

      case 'buttons':
        if (!data.body || !data.buttons?.length) {
          return NextResponse.json({ error: 'body and buttons required' }, { status: 400 });
        }
        result = await sendButtons(data.to, data.body, data.buttons, {
          header: data.header,
          footer: data.footer,
        });
        messageContent = data.body;
        break;

      case 'list':
        if (!data.body || !data.buttonText || !data.sections?.length) {
          return NextResponse.json({ error: 'body, buttonText, and sections required' }, { status: 400 });
        }
        result = await sendList(data.to, data.body, data.buttonText, data.sections, {
          header: data.header,
          footer: data.footer,
        });
        messageContent = data.body;
        break;

      case 'template':
        if (!data.templateName) {
          return NextResponse.json({ error: 'templateName required' }, { status: 400 });
        }
        result = await sendTemplate(data.to, data.templateName, data.templateLanguage, data.templateParams);
        messageContent = `[template: ${data.templateName}]`;
        break;

      default:
        return NextResponse.json({ error: 'Invalid message type' }, { status: 400 });
    }

    // 4. Save outbound message to DB
    if (result.success) {
      const supabase = getSupabase();
      await supabase
        .from('wa_lead_messages')
        .insert({
          conversation_id: data.conversationId,
          direction: 'outbound',
          sender_type: data.senderType,
          content: messageContent,
          message_type: data.type,
          wa_message_id: result.messageId || null,
          metadata: {
            buttons: data.buttons,
            sections: data.sections,
            template_name: data.templateName,
          },
        });

      // Update conversation last_message_at
      await supabase
        .from('wa_lead_conversations')
        .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', data.conversationId);
    }

    console.log(JSON.stringify({
      requestId,
      event: 'wa_leadbot_send',
      to: data.to,
      type: data.type,
      success: result.success,
      messageId: result.messageId,
    }));

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
    });

  } catch (error: any) {
    console.error(JSON.stringify({
      requestId,
      event: 'wa_leadbot_send_error',
      error: error.message,
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
