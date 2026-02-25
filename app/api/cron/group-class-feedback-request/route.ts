// ============================================================
// FILE: app/api/cron/group-class-feedback-request/route.ts
// ============================================================
// QStash-verified cron: sends parent feedback request 2 hours
// after group class session completion.
// "How did [child_name] find today's [class_name]?"
//
// TODO: webhook handler for when parent replies
// (Gemini extracts signal → learning_event)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const getSupabase = createAdminClient;

const getReceiver = () => new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

const payloadSchema = z.object({
  session_id: z.string().uuid(),
});

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
      console.error('[group-class-feedback-request] QStash verification failed:', e);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn('[group-class-feedback-request] Development mode - skipping signature verification');
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const body = await request.text();
    const auth = await verifyAuth(request, body);

    if (!auth.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let parsed: z.infer<typeof payloadSchema>;
    try {
      parsed = payloadSchema.parse(JSON.parse(body));
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { session_id } = parsed;
    const supabase = getSupabase();

    console.log(JSON.stringify({ requestId, event: 'group_class_feedback_request_start', sessionId: session_id }));

    // Fetch session with class type
    const { data: session } = await supabase
      .from('group_sessions')
      .select('id, scheduled_date, group_class_types ( name )')
      .eq('id', session_id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const classTypeRaw = session.group_class_types;
    const classType = Array.isArray(classTypeRaw) ? classTypeRaw[0] : classTypeRaw;
    const className = classType?.name || 'Group Class';

    // Fetch all present participants with parent info
    const { data: participants } = await supabase
      .from('group_session_participants')
      .select('child_id, parent_id')
      .eq('group_session_id', session_id)
      .eq('attendance_status', 'present');

    if (!participants || participants.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'no_participants_for_feedback', sessionId: session_id }));
      return NextResponse.json({ success: true, feedback_requests_sent: 0 });
    }

    // Deduplicate by parent_id (one parent may have multiple children in same session)
    const parentChildMap = new Map<string, string[]>();
    for (const p of participants) {
      if (!p.parent_id || !p.child_id) continue;
      const existing = parentChildMap.get(p.parent_id) || [];
      existing.push(p.child_id);
      parentChildMap.set(p.parent_id, existing);
    }

    let feedbackRequestsSent = 0;

    for (const [parentId, childIds] of Array.from(parentChildMap.entries())) {
      try {
        // Fetch parent info
        const { data: parent } = await supabase
          .from('parents')
          .select('id, name, phone')
          .eq('id', parentId)
          .single();

        if (!parent || !parent.phone) continue;

        // Fetch first child name (for template)
        const { data: child } = await supabase
          .from('children')
          .select('child_name')
          .eq('id', childIds[0])
          .single();

        const parentName = parent.name || 'Parent';
        const childName = child?.child_name || 'your child';

        // Send WhatsApp via AiSensy
        const waResult = await sendWhatsAppMessage({
          to: parent.phone,
          templateName: 'group_class_parent_feedback_request',
          variables: [parentName, childName, className],
        });

        // Log in communication_logs
        await supabase.from('communication_logs').insert({
          template_code: 'group_class_parent_feedback_request',
          recipient_type: 'parent',
          recipient_id: parentId,
          recipient_phone: parent.phone,
          wa_sent: waResult.success,
          error_message: waResult.error || null,
          context_data: {
            session_id,
            child_ids: childIds,
            child_name: childName,
            class_name: className,
            type: 'group_class_feedback_request',
          },
          sent_at: waResult.success ? new Date().toISOString() : null,
        });

        if (waResult.success) feedbackRequestsSent++;

        // TODO: webhook handler for when parent replies
        // When parent replies to this WhatsApp message, the reply will come through
        // the AiSensy webhook. A handler should:
        // 1. Match the reply to this session via conversation context
        // 2. Use Gemini to extract sentiment/signal from parent's reply
        // 3. Insert a learning_event with event_type: 'group_class_parent_feedback'
        // 4. Store the raw reply and Gemini's analysis

      } catch (err) {
        console.error(JSON.stringify({ requestId, event: 'feedback_request_failed', parentId, error: err instanceof Error ? err.message : 'Unknown' }));
      }
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'group_class_feedback_request_done', sessionId: session_id, feedbackRequestsSent, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, feedback_requests_sent: feedbackRequestsSent });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'group_class_feedback_request_error', error: message }));
    return NextResponse.json({ success: false, requestId, error: message }, { status: 500 });
  }
}
