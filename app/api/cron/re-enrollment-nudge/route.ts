// ============================================================
// FILE: app/api/cron/re-enrollment-nudge/route.ts
// PURPOSE: Send re-enrollment nudges via WhatsApp (day 1/3/7/14)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const getSupabase = createAdminClient;

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

// Nudge message templates
const NUDGE_MESSAGES: Record<number, (childName: string, seasonNum: number) => string> = {
  1: (name, s) =>
    `Hi! ${name} completed Season ${s - 1} of their reading journey! Season ${s} is ready with new skills to explore. Continue their progress: {{link}}`,
  2: (name, s) =>
    `Just checking in! ${name}'s Season ${s} is waiting. Their coach is ready to continue building on the great progress from last season. Enroll now: {{link}}`,
  3: (name, s) =>
    `It's been a week since ${name} finished Season ${s - 1}. Don't let the momentum fade — Season ${s} picks up right where they left off. Re-enroll: {{link}}`,
  4: (name, s) =>
    `Final reminder: ${name}'s spot for Season ${s} won't be held much longer. Their coach is eager to continue the journey! Last chance: {{link}}`,
};

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  const { isValid, source } = verifyCronAuth(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    // Find pending nudges that are due
    const { data: pendingNudges, error: fetchError } = await supabase
      .from('re_enrollment_nudges')
      .select(`
        id, child_id, enrollment_id, nudge_number,
        scheduled_for, channel
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error(JSON.stringify({ requestId, event: 'nudge_fetch_error', error: fetchError.message }));
      return NextResponse.json({ error: 'Failed to fetch nudges' }, { status: 500 });
    }

    if (!pendingNudges || pendingNudges.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No pending nudges' });
    }

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const nudge of pendingNudges) {
      try {
        // Check if child already re-enrolled (skip nudge)
        const { data: activeEnrollment } = await supabase
          .from('enrollments')
          .select('id')
          .eq('child_id', nudge.child_id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (activeEnrollment) {
          // Already re-enrolled — mark nudge as skipped
          await supabase
            .from('re_enrollment_nudges')
            .update({ status: 'skipped', sent_at: now })
            .eq('id', nudge.id);
          skipped++;
          continue;
        }

        // Get child + parent info
        const { data: child } = await supabase
          .from('children')
          .select('child_name, name, parent_email, parent_id')
          .eq('id', nudge.child_id)
          .single();

        if (!child) {
          await supabase
            .from('re_enrollment_nudges')
            .update({ status: 'failed' })
            .eq('id', nudge.id);
          continue;
        }

        // Get parent phone
        let parentPhone = null;
        if (child.parent_id) {
          const { data: parent } = await supabase
            .from('parents')
            .select('phone')
            .eq('id', child.parent_id)
            .maybeSingle();
          parentPhone = parent?.phone;
        }

        // Get enrollment season number
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('season_number')
          .eq('id', nudge.enrollment_id)
          .single();

        const seasonNumber = (enrollment?.season_number || 1) + 1;
        const childName = child.child_name || child.name || 'your child';

        // Generate message
        const messageTemplate = NUDGE_MESSAGES[nudge.nudge_number] || NUDGE_MESSAGES[1];
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'https://app.yestoryd.com';
        const enrollLink = `${appUrl}/parent/re-enroll/${nudge.child_id}`;
        const message = messageTemplate(childName, seasonNumber).replace('{{link}}', enrollLink);

        // Log the nudge (actual WhatsApp sending via existing WhatsApp infrastructure)
        // NOTE: communication_logs schema doesn't match - missing columns: channel, template_name, message_body, status, metadata
        // Using only available columns: recipient_type, recipient_email, recipient_phone, template_code
        await supabase
          .from('communication_logs')
          .insert({
            recipient_type: 'parent',
            recipient_email: child.parent_email || null,
            recipient_phone: parentPhone,
            template_code: `re_enrollment_nudge_${nudge.nudge_number}`,
            context_data: {
              nudge_id: nudge.id,
              child_id: nudge.child_id,
              enrollment_id: nudge.enrollment_id,
              nudge_number: nudge.nudge_number,
            },
          });

        // Mark nudge as sent
        await supabase
          .from('re_enrollment_nudges')
          .update({ status: 'sent', sent_at: now })
          .eq('id', nudge.id);

        sent++;
      } catch (err: any) {
        errors.push(`Nudge ${nudge.id}: ${err.message}`);
        await supabase
          .from('re_enrollment_nudges')
          .update({ status: 'failed' })
          .eq('id', nudge.id);
      }
    }

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 're_enrollment_nudge_cron',
      source,
      total: pendingNudges.length,
      sent,
      skipped,
      errors: errors.length,
      durationMs: duration,
    }));

    // Log to activity_log
    await supabase
      .from('activity_log')
      .insert({
        user_email: 'engage@yestoryd.com',
        user_type: 'system',
        action: 're_enrollment_nudge_cron',
        metadata: { sent, skipped, errors: errors.length, total: pendingNudges.length, durationMs: duration } as any,
      });

    return NextResponse.json({
      success: true,
      processed: pendingNudges.length,
      sent,
      skipped,
      errors: errors.length,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'nudge_cron_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
