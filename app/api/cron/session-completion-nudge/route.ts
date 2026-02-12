// ============================================================
// FILE: app/api/cron/session-completion-nudge/route.ts
// PURPOSE: Nudge coaches who started a session but haven't
//          completed the companion panel within 45 minutes.
//          Sends WhatsApp via AiSensy.
// RUNS: Every 15 minutes via Vercel cron
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VERIFICATION (same pattern as enrollment-lifecycle cron) ---
function verifyCronAuth(request: NextRequest): { isValid: boolean; source: string } {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { isValid: true, source: 'vercel_cron' };
  }

  const qstashSignature = request.headers.get('upstash-signature');
  if (qstashSignature) {
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    if (currentKey) {
      return { isValid: true, source: 'qstash' };
    }
  }

  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  return { isValid: false, source: 'none' };
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  const auth = verifyCronAuth(request);
  if (!auth.isValid) {
    console.error(JSON.stringify({ requestId, event: 'cron_auth_failed', cron: 'session-completion-nudge' }));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServiceSupabase();

    console.log(JSON.stringify({
      requestId,
      event: 'session_completion_nudge_started',
      source: auth.source,
    }));

    // Find sessions that are in_progress for >45 min and not completed via companion panel
    const fortyFiveMinAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString();

    const { data: staleSessions, error: queryError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, session_number, session_started_at, completion_nudge_sent_at,
        coach_id, child_id,
        coaches (id, name, phone, email),
        children (id, child_name)
      `)
      .eq('status', 'in_progress')
      .eq('companion_panel_completed', false)
      .lt('session_started_at', fortyFiveMinAgo)
      .is('completion_nudge_sent_at', null);

    if (queryError) {
      console.error(JSON.stringify({ requestId, event: 'nudge_query_error', error: queryError.message }));
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!staleSessions || staleSessions.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'no_stale_sessions_found' }));
      return NextResponse.json({ success: true, nudged: 0 });
    }

    let nudged = 0;
    let failed = 0;

    for (const session of staleSessions) {
      const coach = (session as any).coaches;
      const child = (session as any).children;

      if (!coach?.phone) {
        console.log(JSON.stringify({ requestId, event: 'nudge_skip_no_phone', sessionId: session.id }));
        continue;
      }

      const coachFirstName = (coach.name || 'Coach').split(' ')[0];
      const childFirstName = (child?.child_name || 'student').split(' ')[0];

      try {
        const waResult = await sendWhatsAppMessage({
          to: coach.phone,
          templateName: 'session_completion_nudge',
          variables: [
            coachFirstName,
            childFirstName,
            String(session.session_number || ''),
          ],
        });

        // Mark nudge as sent regardless of WA success (prevent spam)
        await supabase
          .from('scheduled_sessions')
          .update({ completion_nudge_sent_at: new Date().toISOString() })
          .eq('id', session.id);

        if (waResult.success) {
          nudged++;
        } else {
          failed++;
          console.error(JSON.stringify({ requestId, event: 'nudge_wa_failed', sessionId: session.id, error: waResult.error }));
        }
      } catch (sendError: any) {
        failed++;
        console.error(JSON.stringify({ requestId, event: 'nudge_send_error', sessionId: session.id, error: sendError.message }));
      }

      // Rate limiting between messages
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'session_completion_nudge_complete',
      duration: `${duration}ms`,
      found: staleSessions.length,
      nudged,
      failed,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      found: staleSessions.length,
      nudged,
      failed,
      duration: `${duration}ms`,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'nudge_cron_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
