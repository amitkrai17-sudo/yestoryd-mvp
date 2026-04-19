// app/api/webhooks/aisensy/catch-all/route.ts
// AiSensy inbound catch-all: when a parent replies on 8976 and neither goals
// nor feedback webhooks matched, redirect them to the Lead Bot (8591) with a
// short auto-reply. Rate-limited to 1 reply per phone per 24h to prevent loops.

import { NextRequest, NextResponse } from 'next/server';
import { sendNotification } from '@/lib/communication/notify';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/utils/phone';

export const dynamic = 'force-dynamic';

const AUTO_REPLY_TEMPLATE = 'parent_auto_reply_redirect_v3';
const AUTO_REPLY_COOLDOWN_HOURS = 24;

interface AiSensyInboundPayload {
  from?: string;
  text?: string;
  messageId?: string;
  timestamp?: string;
  type?: string;
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const payload: AiSensyInboundPayload = await request.json();
    const { from, text } = payload;

    if (!from || !text) {
      return NextResponse.json({ status: 'ignored', reason: 'missing_fields' });
    }

    const phone = normalizePhone(from);
    if (!phone) {
      return NextResponse.json({ status: 'ignored', reason: 'invalid_phone' });
    }

    const supabase = createAdminClient();

    // Rate limit: one auto-reply per phone per 24h
    const cutoff = new Date(Date.now() - AUTO_REPLY_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('communication_logs')
      .select('id')
      .eq('template_code', 'parent_auto_reply_redirect_v3')
      .eq('recipient_contact', phone)
      .gte('sent_at', cutoff)
      .limit(1);

    if (recent && recent.length > 0) {
      console.log(JSON.stringify({ requestId, event: 'auto_reply_rate_limited', phone }));
      return NextResponse.json({ status: 'rate_limited' });
    }

    const result = await sendNotification(
      AUTO_REPLY_TEMPLATE,
      phone,
      {},
      {
        triggeredBy: 'system',
        contextType: 'auto_reply',
      },
    );

    console.log(JSON.stringify({
      requestId,
      event: 'auto_reply_sent',
      phone,
      success: result.success,
    }));

    return NextResponse.json({ status: result.success ? 'sent' : 'failed' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'catch_all_error', error: message }));
    return NextResponse.json({ status: 'error', error: message });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'AiSensy catch-all webhook active' });
}
