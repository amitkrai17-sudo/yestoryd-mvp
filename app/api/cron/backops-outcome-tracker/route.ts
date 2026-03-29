// ============================================================
// FILE: app/api/cron/backops-outcome-tracker/route.ts
// PURPOSE: Feedback loop — checks if actions achieved desired outcomes
// SCHEDULE: Every 30 min via dispatcher
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { logOpsEvent } from '@/lib/backops';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

// ── Outcome Rules ───────────────────────────────────────────

interface OutcomeRule {
  action_pattern: RegExp;
  min_wait_hours: number;
  max_wait_hours: number;
  checker: (supabase: ReturnType<typeof createAdminClient>, entityType: string | null, entityId: string | null, actionTime: string) => Promise<boolean>;
}

const OUTCOME_RULES: OutcomeRule[] = [
  {
    action_pattern: /practice_nudge/,
    min_wait_hours: 6,
    max_wait_hours: 48,
    checker: async (supabase, _entityType, entityId, actionTime) => {
      if (!entityId) return false;
      const { data } = await supabase
        .from('parent_daily_tasks')
        .select('id')
        .eq('child_id', entityId)
        .eq('is_completed', true)
        .gt('completed_at', actionTime)
        .limit(1);
      return (data && data.length > 0) || false;
    },
  },
  {
    action_pattern: /session_reminder|coach_reminder|session_completion_nudge/,
    min_wait_hours: 2,
    max_wait_hours: 6,
    checker: async (supabase, entityType, entityId, _actionTime) => {
      if (!entityId) return false;
      if (entityType === 'session') {
        const { data } = await supabase
          .from('scheduled_sessions')
          .select('status')
          .eq('id', entityId)
          .single();
        return data?.status === 'completed';
      }
      return false;
    },
  },
  {
    action_pattern: /tuition_onboarding/,
    min_wait_hours: 12,
    max_wait_hours: 168,
    checker: async (supabase, _entityType, entityId, actionTime) => {
      if (!entityId) return false;
      const { data } = await supabase
        .from('tuition_onboarding')
        .select('parent_form_completed_at')
        .eq('id', entityId)
        .not('parent_form_completed_at', 'is', null)
        .limit(1);
      if (!data || data.length === 0) return false;
      const completedAt = data[0].parent_form_completed_at;
      return !!completedAt && completedAt > actionTime;
    },
  },
  {
    action_pattern: /discovery_followup|re_enrollment/,
    min_wait_hours: 24,
    max_wait_hours: 168,
    checker: async (supabase, _entityType, entityId, actionTime) => {
      if (!entityId) return false;
      const { data: discovery } = await supabase
        .from('discovery_calls')
        .select('id')
        .eq('child_id', entityId)
        .gt('created_at', actionTime)
        .limit(1);
      if (discovery && discovery.length > 0) return true;

      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('child_id', entityId)
        .gt('created_at', actionTime)
        .limit(1);
      return (enrollment && enrollment.length > 0) || false;
    },
  },
];

// ── Handler ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createAdminClient();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let checked = 0;
  let resolved = 0;
  let expired = 0;
  let errors = 0;

  try {
    // Find pending actions within 7-day window
    const { data: pending } = await supabase
      .from('ops_events')
      .select('id, event_type, source, entity_type, entity_id, action_taken, created_at')
      .eq('action_outcome', 'pending')
      .is('outcome_verified_at', null)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true })
      .limit(100);

    if (!pending || pending.length === 0) {
      await logOpsEvent({
        event_type: 'cron_run',
        source: 'cron:backops-outcome-tracker',
        severity: 'info',
        metadata: { checked: 0, resolved: 0, expired: 0, duration_ms: Date.now() - startTime } as Json,
      });
      return NextResponse.json({ success: true, checked: 0, resolved: 0, expired: 0 });
    }

    for (const event of pending) {
      const actionTaken = event.action_taken || event.source || '';
      const rule = OUTCOME_RULES.find(r => r.action_pattern.test(actionTaken));

      if (!rule) continue; // No rule for this action type — skip

      const eventAge = (now.getTime() - new Date(event.created_at!).getTime()) / (60 * 60 * 1000);

      // Too early to check
      if (eventAge < rule.min_wait_hours) continue;

      checked++;

      // Past max wait — mark as expired/failed
      if (eventAge > rule.max_wait_hours) {
        try {
          await supabase
            .from('ops_events')
            .update({ action_outcome: 'expired', outcome_verified_at: now.toISOString() })
            .eq('id', event.id);
          expired++;
        } catch { errors++; }
        continue;
      }

      // Check outcome
      try {
        const success = await rule.checker(supabase, event.entity_type, event.entity_id, event.created_at!);

        if (success) {
          await supabase
            .from('ops_events')
            .update({ action_outcome: 'success', outcome_verified_at: now.toISOString(), resolved_by: 'auto' })
            .eq('id', event.id);
          resolved++;
        }
        // If not success and not expired, leave as pending for next check
      } catch (err) {
        console.error('[OutcomeTracker] Checker error:', event.id, err instanceof Error ? err.message : err);
        errors++;
      }
    }

    const duration = Date.now() - startTime;

    await logOpsEvent({
      event_type: 'cron_run',
      source: 'cron:backops-outcome-tracker',
      severity: errors > 0 ? 'warning' : 'info',
      metadata: { checked, resolved, expired, errors, total_pending: pending.length, duration_ms: duration } as Json,
    });

    return NextResponse.json({ success: true, checked, resolved, expired, errors, duration_ms: duration });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown';
    try { await logOpsEvent({ event_type: 'cron_failure', source: 'cron:backops-outcome-tracker', severity: 'error', metadata: { error: errMsg } as Json }); } catch {}
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}

export const POST = GET;
