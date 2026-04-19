// ============================================================
// FILE: app/api/cron/tuition-onboarding-nudge/route.ts
// PURPOSE: Nudge parents who haven't completed tuition onboarding
//          form, and expire stale records after 7 days.
// SCHEDULE: Daily at 11:00 AM IST via dispatcher
// ============================================================
// Nudge logic:
//   - 24h after creation → 1st nudge (resend same magic link)
//   - 72h after creation → 2nd nudge
//   - 7d after creation  → expire record, notify admin/coach
//   - Dedup: max 2 nudges per onboarding (checked via communication_logs)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/communication/notify';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { getPolicy, logDecision, logSkippedDecision, isNudgeSuppressed } from '@/lib/backops';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  const authResult = await verifyCronRequest(request);
  if (!authResult.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    // Load windows from BackOps policy
    const toPolicy = await getPolicy('tuition_onboarding_nudge', {
      first_nudge_hours: 24, second_nudge_hours: 72, expire_hours: 168, max_nudges: 2, dedup_hours: 48,
    });
    const tp = toPolicy as Record<string, number>;

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (tp.first_nudge_hours || 24) * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - (tp.expire_hours || 168) * 60 * 60 * 1000).toISOString();

    // ── Phase A: Find parent_pending records 24h–7d old ──────────
    const { data: pendingRecords } = await supabase
      .from('tuition_onboarding')
      .select('id, parent_phone, parent_name_hint, child_name, coach_id, session_rate, sessions_purchased, parent_form_token, created_at')
      .eq('status', 'parent_pending')
      .lt('created_at', twentyFourHoursAgo)
      .gt('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true });

    let nudged = 0;
    let skipped = 0;
    let expired = 0;
    let errors = 0;

    for (const record of pendingRecords || []) {
      try {
        const createdAt = new Date(record.created_at!);
        const ageHours = (now.getTime() - createdAt.getTime()) / (60 * 60 * 1000);

        // Count how many nudges already sent for this onboarding
        const { count: nudgeCount } = await supabase
          .from('communication_logs')
          .select('*', { count: 'exact', head: true })
          .eq('template_code', 'tuition_onboarding_nudge')
          .eq('recipient_phone', `91${record.parent_phone}`)
          .eq('related_entity_id', record.id);

        const alreadySent = nudgeCount || 0;

        // Check BackOps override
        if (await isNudgeSuppressed('tuition', record.id)) {
          try { await logSkippedDecision({ source: 'cron:tuition-onboarding-nudge', entity_type: 'tuition', entity_id: record.id, decision: 'send_tuition_nudge', reason: { override: 'nudge_suppressed' } as Json }); } catch {}
          skipped++;
          continue;
        }

        // Max nudges from policy
        if (alreadySent >= (tp.max_nudges || 2)) {
          skipped++;
          continue;
        }

        // Only nudge at the right windows (from policy):
        // 1st nudge: first_nudge_hours+ (alreadySent === 0)
        // 2nd nudge: second_nudge_hours+ (alreadySent === 1)
        const shouldNudge =
          (alreadySent === 0 && ageHours >= (tp.first_nudge_hours || 24)) ||
          (alreadySent === 1 && ageHours >= (tp.second_nudge_hours || 72));

        if (!shouldNudge) {
          skipped++;
          continue;
        }

        // Check dedup: no nudge to same phone in dedup window (from policy)
        const fortyEightHoursAgo = new Date(now.getTime() - (tp.dedup_hours || 48) * 60 * 60 * 1000).toISOString();
        const { count: recentCount } = await supabase
          .from('communication_logs')
          .select('*', { count: 'exact', head: true })
          .eq('template_code', 'tuition_onboarding_nudge')
          .eq('recipient_phone', `91${record.parent_phone}`)
          .gt('created_at', fortyEightHoursAgo);

        if (recentCount && recentCount > 0) {
          skipped++;
          continue;
        }

        // Fetch coach name for the template
        const { data: coach } = await supabase
          .from('coaches')
          .select('name')
          .eq('id', record.coach_id)
          .single();

        const coachFirstName = (coach?.name || 'Your coach').split(' ')[0];
        const magicLink = `${APP_URL}/tuition/onboard/${record.parent_form_token}`;

        try { await logDecision({ source: 'cron:tuition-onboarding-nudge', entity_type: 'tuition', entity_id: record.id, decision: 'send_tuition_nudge', reason: { age_hours: ageHours, nudge_number: alreadySent + 1 } as Json, action: 'aisensy:parent_tuition_onboarding_v3', outcome: 'pending' }); } catch {}

        // Send the same parent_tuition_onboarding_v3 template (magic link still valid)
        await sendNotification('parent_tuition_onboarding_v3', `91${record.parent_phone}`, {
          coach_first_name: coachFirstName,
          child_name: (record.child_name && !record.child_name.startsWith('Pending')) ? record.child_name : 'your child',
          magic_link: magicLink,
          sessions_purchased: String(record.sessions_purchased),
          rate_rupees: String(Math.round(record.session_rate / 100)),
          coach_first_name_2: coachFirstName,
        });

        // Log to communication_logs
        await supabase.from('communication_logs').insert({
          template_code: 'tuition_onboarding_nudge',
          recipient_type: 'parent',
          recipient_phone: `91${record.parent_phone}`,
          recipient_name: record.parent_name_hint || null,
          channel: 'whatsapp',
          status: 'sent',
          related_entity_type: 'tuition_onboarding',
          related_entity_id: record.id,
          variables: {
            coach_name: coachFirstName,
            child_name: record.child_name,
            magic_link: magicLink,
            nudge_number: alreadySent + 1,
          },
        });

        nudged++;
      } catch (err: any) {
        console.error(JSON.stringify({ requestId, event: 'tuition_nudge_error', recordId: record.id, error: err.message }));
        errors++;
      }
    }

    // ── Phase B: Expire records older than 7 days ──────────────
    const { data: expiredRecords } = await supabase
      .from('tuition_onboarding')
      .select('id, parent_phone, parent_name_hint, child_name, coach_id')
      .eq('status', 'parent_pending')
      .lt('created_at', sevenDaysAgo);

    for (const record of expiredRecords || []) {
      try {
        await supabase
          .from('tuition_onboarding')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', record.id);

        // Notify admin via activity log (no dedicated admin alert template for this)
        await supabase.from('activity_log').insert({
          action: 'tuition_onboarding_expired',
          user_email: 'system',
          user_type: 'system',
          metadata: {
            onboarding_id: record.id,
            child_name: record.child_name,
            parent_phone: record.parent_phone,
            coach_id: record.coach_id,
          },
        });

        expired++;
      } catch (err: any) {
        console.error(JSON.stringify({ requestId, event: 'tuition_expire_error', recordId: record.id, error: err.message }));
        errors++;
      }
    }

    const latencyMs = Date.now() - startTime;

    await supabase.from('activity_log').insert({
      action: 'cron_tuition_onboarding_nudge',
      user_email: 'system',
      user_type: 'system',
      metadata: { requestId, nudged, skipped, expired, errors, latencyMs },
    });

    console.log(JSON.stringify({ requestId, event: 'tuition_onboarding_nudge_complete', nudged, skipped, expired, errors, latencyMs }));

    return NextResponse.json({ success: true, nudged, skipped, expired, errors });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'tuition_onboarding_nudge_fatal', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
