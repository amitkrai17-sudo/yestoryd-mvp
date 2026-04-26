// ============================================================
// FILE: app/api/cron/capture-reminders/route.ts
// PURPOSE: Escalating WhatsApp nudges for unreported sessions
// SCHEDULE: Every 15 min via dispatcher
// Tiers: 15min (gentle), 2hr (reminder), 6hr (urgent), 24hr (final + Gemini draft)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotification } from '@/lib/communication/notify';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import { inferModality } from '@/lib/intelligence/modality';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const NUDGE_TIERS = [
  { key: '15min', minHours: 0.25, maxHours: 0.5 },
  { key: '2hr', minHours: 2, maxHours: 2.5 },
  { key: '6hr', minHours: 6, maxHours: 6.5 },
  { key: '24hr', minHours: 24, maxHours: 24.5 },
] as const;

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let sent = 0;
  let skipped = 0;

  try {
    // Find sessions that ended but have no confirmed capture (past 2 days)
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: unreported } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, coach_id, scheduled_date, scheduled_time, duration_minutes, session_mode, children(child_name), coaches(name, phone, email)')
      .in('status', ['scheduled', 'confirmed', 'in_progress', 'completed'])
      .is('capture_id', null)
      .gte('scheduled_date', twoDaysAgo)
      .lte('scheduled_date', todayStr)
      .neq('status', 'cancelled');

    if (!unreported?.length) {
      return NextResponse.json({ success: true, sent: 0, skipped: 0 });
    }

    for (const session of unreported) {
      // Calculate hours since session end
      const sessionEnd = new Date(`${session.scheduled_date}T${session.scheduled_time}`);
      sessionEnd.setMinutes(sessionEnd.getMinutes() + (session.duration_minutes || 45));

      if (now < sessionEnd) { skipped++; continue; } // Session hasn't ended yet

      const hoursSinceEnd = (now.getTime() - sessionEnd.getTime()) / (1000 * 60 * 60);

      // Find matching nudge tier
      const tier = NUDGE_TIERS.find(t => hoursSinceEnd >= t.minHours && hoursSinceEnd < t.maxHours);
      if (!tier) { skipped++; continue; }

      // Check if this tier was already sent (prevent duplicates)
      const { data: existing } = await supabase
        .from('activity_log')
        .select('id')
        .eq('action', `capture_nudge_${tier.key}`)
        .filter('metadata->>session_id', 'eq', session.id)
        .limit(1)
        .maybeSingle();

      if (existing) { skipped++; continue; }

      const childName = (session.children as any)?.child_name || 'your student';
      const coachPhone = (session.coaches as any)?.phone;

      // Send notification
      if (coachPhone) {
        try {
          await sendNotification(
            'coach_report_deadline_v3',
            coachPhone,
            {
              child_name: childName.split(' ')[0],
            },
            {
              triggeredBy: 'cron',
              contextType: 'capture_reminder',
              contextId: tier.key,
            },
          );
          sent++;
        } catch (err: any) {
          console.error(JSON.stringify({ requestId, event: 'capture_nudge_send_error', tier: tier.key, sessionId: session.id, error: err.message }));
        }
      }

      // Log to prevent duplicates
      await supabase.from('activity_log').insert({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system',
        action: `capture_nudge_${tier.key}`,
        metadata: { session_id: session.id, child_name: childName, tier: tier.key, request_id: requestId },
        created_at: now.toISOString(),
      });

      // At 24hr: create AI draft capture as fallback
      if (tier.key === '24hr') {
        try {
          // Check if a pending capture already exists
          const { data: existingCapture } = await supabase
            .from('structured_capture_responses')
            .select('id')
            .eq('session_id', session.id)
            .limit(1)
            .maybeSingle();

          if (!existingCapture) {
            // INSERT race-safety: the partial UNIQUE index
            // (structured_capture_responses_session_id_auto_filled_unique)
            // throws 23505 if a concurrent run won the race. Treat as benign
            // "another worker already created it" and skip — the winning row
            // is acceptable and the next pre-check will find it.
            const { error: insertErr } = await supabase
              .from('structured_capture_responses')
              .insert({
                session_id: session.id,
                child_id: session.child_id,
                coach_id: session.coach_id,
                session_date: session.scheduled_date,
                session_modality: inferModality({ sessionMode: session.session_mode ?? undefined }),
                capture_method: 'auto_filled',
                ai_prefilled: true,
                coach_confirmed: false,
                engagement_level: 'moderate',
                custom_strength_note: 'Session completed — please review and add your observations.',
                capture_delay_hours: Math.round(hoursSinceEnd * 10) / 10,
                delay_confidence_multiplier: 0.5,
              } as any);

            if (insertErr) {
              if ((insertErr as any).code === '23505') {
                console.warn(JSON.stringify({
                  requestId, event: 'auto_filled_capture_race_lost',
                  sessionId: session.id, source: 'capture_reminders_24hr',
                }));
              } else {
                throw insertErr;
              }
            }

            // Store capture_id on session for UI linkage
            const { data: newCapture } = await supabase
              .from('structured_capture_responses')
              .select('id')
              .eq('session_id', session.id)
              .eq('coach_confirmed', false)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (newCapture) {
              await supabase
                .from('scheduled_sessions')
                .update({ capture_id: newCapture.id })
                .eq('id', session.id);
            }
          }
        } catch (draftErr: any) {
          console.error(JSON.stringify({ requestId, event: 'capture_draft_error', sessionId: session.id, error: draftErr.message }));
        }
      }
    }

    console.log(JSON.stringify({ requestId, event: 'capture_reminders_complete', sent, skipped, total: unreported.length }));
    return NextResponse.json({ success: true, sent, skipped, total: unreported.length });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'capture_reminders_error', error: error.message }));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
