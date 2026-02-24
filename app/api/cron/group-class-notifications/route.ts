// ============================================================
// FILE: app/api/cron/group-class-notifications/route.ts
// ============================================================
// QStash-verified cron: delivers parent notifications after
// group class insights have been generated.
//
// Enrolled parents → in_app_notification (less intrusive)
// Non-enrolled parents → WhatsApp via AiSensy + Email via Resend
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import { sendEmail } from '@/lib/email/resend-client';
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
      console.error('[group-class-notifications] QStash verification failed:', e);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn('[group-class-notifications] Development mode - skipping signature verification');
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// ─── CTA link based on attendance count ───

function getCtaLink(ctaType: string, childId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';
  switch (ctaType) {
    case 'assessment':
    case 'soft_assessment':
      return `${baseUrl}/assessment`;
    case 'portal':
      return `${baseUrl}/my-child/${childId}`;
    case 'coaching':
      return `${baseUrl}/pricing`;
    default:
      return `${baseUrl}/assessment`;
  }
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

    console.log(JSON.stringify({ requestId, event: 'group_class_notifications_start', sessionId: session_id }));

    // Fetch session with class type
    const { data: session } = await supabase
      .from('group_sessions')
      .select('id, scheduled_date, class_type_id, group_class_types ( name )')
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
      console.log(JSON.stringify({ requestId, event: 'no_participants', sessionId: session_id }));
      return NextResponse.json({ success: true, notifications_sent: 0 });
    }

    let notificationsSent = 0;

    for (const participant of participants) {
      const childId = participant.child_id;
      const parentId = participant.parent_id;
      if (!childId || !parentId) continue;

      try {
        // Fetch micro-insight for this child
        const { data: insightEvent } = await supabase
          .from('learning_events')
          .select('event_data')
          .eq('child_id', childId)
          .eq('event_type', 'group_class_micro_insight')
          .filter('event_data->>session_id', 'eq', session_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const insightData = insightEvent?.event_data as Record<string, unknown> | null;
        const insightText = (insightData?.insight_text as string) || `Your child participated in today's ${className}.`;
        const isEnrolled = insightData?.is_enrolled === true;
        const ctaType = (insightData?.cta_type as string) || 'assessment';

        // Fetch parent + child details
        const { data: parent } = await supabase
          .from('parents')
          .select('id, name, email, phone')
          .eq('id', parentId)
          .single();

        const { data: child } = await supabase
          .from('children')
          .select('id, child_name')
          .eq('id', childId)
          .single();

        if (!parent) continue;

        const parentName = parent.name || 'Parent';
        const childName = child?.child_name || 'your child';

        if (isEnrolled) {
          // ─── Enrolled: in-app notification ───
          try {
            await supabase.from('in_app_notifications').insert({
              user_id: parentId,
              user_type: 'parent',
              title: `${className} — Session Complete`,
              body: insightText,
              notification_type: 'info',
              action_url: `/my-child/${childId}`,
              metadata: { session_id, child_id: childId, type: 'group_class_insight' },
            });
            notificationsSent++;
          } catch (notifErr) {
            console.error(JSON.stringify({ requestId, event: 'in_app_notification_failed', parentId, error: notifErr instanceof Error ? notifErr.message : 'Unknown' }));
          }
        } else {
          // ─── Non-enrolled: WhatsApp + Email ───
          const ctaLink = getCtaLink(ctaType, childId);

          // WhatsApp via AiSensy
          if (parent.phone) {
            try {
              const shortenedInsight = insightText.length > 500 ? insightText.substring(0, 497) + '...' : insightText;
              const waResult = await sendWhatsAppMessage({
                to: parent.phone,
                templateName: 'group_class_micro_insight_nonenrolled',
                variables: [parentName, childName, shortenedInsight, ctaLink],
              });

              await supabase.from('communication_logs').insert({
                template_code: 'group_class_micro_insight_nonenrolled',
                recipient_type: 'parent',
                recipient_id: parentId,
                recipient_phone: parent.phone,
                wa_sent: waResult.success,
                error_message: waResult.error || null,
                context_data: { session_id, child_id: childId, child_name: childName, cta_type: ctaType },
                sent_at: waResult.success ? new Date().toISOString() : null,
              });

              if (waResult.success) notificationsSent++;
            } catch (waErr) {
              console.error(JSON.stringify({ requestId, event: 'wa_insight_failed', parentId, error: waErr instanceof Error ? waErr.message : 'Unknown' }));
            }
          }

          // Email via Resend
          if (parent.email) {
            try {
              const emailResult = await sendEmail({
                to: parent.email,
                subject: `${childName}'s ${className} — Here's what we noticed`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #1a1a2e; margin-bottom: 8px;">Hi ${parentName}!</h2>
                    <p style="color: #555; font-size: 15px; line-height: 1.6;">${insightText}</p>
                    <div style="margin-top: 24px; text-align: center;">
                      <a href="${ctaLink}" style="display: inline-block; background: #6c5ce7; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                        ${ctaType === 'portal' ? `See ${childName}'s Journey` : ctaType === 'coaching' ? 'Explore Coaching' : 'Take Free Assessment'}
                      </a>
                    </div>
                    <p style="color: #999; font-size: 12px; margin-top: 32px;">— Team Yestoryd</p>
                  </div>
                `,
              });

              await supabase.from('communication_logs').insert({
                template_code: 'group_class_micro_insight_email',
                recipient_type: 'parent',
                recipient_id: parentId,
                recipient_email: parent.email,
                email_sent: emailResult.success,
                error_message: emailResult.error || null,
                context_data: { session_id, child_id: childId, child_name: childName, cta_type: ctaType },
                sent_at: emailResult.success ? new Date().toISOString() : null,
              });
            } catch (emailErr) {
              console.error(JSON.stringify({ requestId, event: 'email_insight_failed', parentId, error: emailErr instanceof Error ? emailErr.message : 'Unknown' }));
            }
          }
        }
      } catch (err) {
        console.error(JSON.stringify({ requestId, event: 'notification_child_error', childId, error: err instanceof Error ? err.message : 'Unknown' }));
      }
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'group_class_notifications_done', sessionId: session_id, notificationsSent, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, notifications_sent: notificationsSent });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'group_class_notifications_error', error: message }));
    return NextResponse.json({ success: false, requestId, error: message }, { status: 500 });
  }
}
