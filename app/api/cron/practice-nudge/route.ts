// ============================================================
// FILE: app/api/cron/practice-nudge/route.ts
// PURPOSE: Nudge parents with overdue incomplete tasks (48h+)
// SCHEDULE: Daily at 19:00 IST via dispatcher (reading practice happens 19:00–22:00)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendCommunication } from '@/lib/communication';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { getPolicy, logDecision, logSkippedDecision, isNudgeSuppressed } from '@/lib/backops';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // Verify cron auth (QStash signature or admin token)
  const authResult = await verifyCronRequest(request);
  if (!authResult.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Load thresholds from BackOps policy
  const policy = await getPolicy('practice_nudge', {
    high_engagement_skip: 0.8,
    low_engagement_24h: 0.4,
    zero_engagement_coach_alert_min_tasks: 5,
    default_nudge_hours: 48,
    overdue_min_hours: 48,
    overdue_max_days: 7,
    lookback_days: 30,
    max_recent_tasks: 20,
  });
  const p = policy as Record<string, number>;

  try {
    // Find overdue tasks: incomplete, scheduled within the last 7 days through today
    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const { data: overdueTasks } = await supabase
      .from('parent_daily_tasks')
      .select(`
        id, title, child_id, created_at,
        children!parent_daily_tasks_child_id_fkey(
          id, child_name, name, parent_id, parent_phone, parent_email
        )
      `)
      .eq('is_completed', false)
      .lte('task_date', todayStr)
      .gte('task_date', sevenDaysAgoStr)
      .order('child_id');

    if (!overdueTasks || overdueTasks.length === 0) {
      await supabase.from('activity_log').insert({
        action: 'cron_practice_nudge',
        user_email: 'system',
        user_type: 'system',
        metadata: { requestId, nudged: 0, skipped: 0, errors: 0, latencyMs: Date.now() - startTime },
      });
      return NextResponse.json({ success: true, nudged: 0 });
    }

    // Group by parent
    const parentMap = new Map<string, {
      parentId: string;
      parentName: string;
      parentPhone: string | null;
      parentEmail: string | null;
      children: Map<string, { childName: string; tasks: string[] }>;
    }>();

    for (const task of overdueTasks) {
      const child = task.children as any;
      if (!child?.parent_id) continue;

      const parentId = child.parent_id;
      if (!parentMap.has(parentId)) {
        // Get parent name
        const { data: parent } = await supabase
          .from('parents')
          .select('name')
          .eq('id', parentId)
          .single();

        parentMap.set(parentId, {
          parentId,
          parentName: parent?.name || 'Parent',
          parentPhone: child.parent_phone,
          parentEmail: child.parent_email,
          children: new Map(),
        });
      }

      const entry = parentMap.get(parentId)!;
      const childId = child.id;
      const childName = child.child_name || child.name || 'your child';

      if (!entry.children.has(childId)) {
        entry.children.set(childId, { childName, tasks: [] });
      }
      entry.children.get(childId)!.tasks.push(task.title);
    }

    let nudged = 0;
    let skipped = 0;
    let errors = 0;
    let coachAlerts = 0;

    const parentEntries = Array.from(parentMap.entries());
    for (const [, parentData] of parentEntries) {
      try {
        // Calculate parent engagement level from recent completion history
        const childIds = Array.from(parentData.children.keys());
        const { data: recentHistory } = await supabase
          .from('parent_daily_tasks')
          .select('is_completed')
          .in('child_id', childIds)
          .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
          .limit(20);

        const completionRate = recentHistory?.length
          ? recentHistory.filter(t => t.is_completed).length / recentHistory.length
          : 0;

        // Check BackOps override
        const firstChildId = childIds[0];
        if (firstChildId && await isNudgeSuppressed('child', firstChildId)) {
          try { await logSkippedDecision({ source: 'cron:practice-nudge', entity_type: 'child', entity_id: firstChildId, decision: 'send_practice_nudge', reason: { override: 'nudge_suppressed' } as Json }); } catch {}
          skipped++;
          continue;
        }

        // Adaptive nudge thresholds based on engagement (from BackOps policy)
        let nudgeThresholdHours = p.default_nudge_hours || 48;
        if (completionRate >= (p.high_engagement_skip || 0.8)) {
          // High engagement — skip nudge, they'll do it
          try { await logSkippedDecision({ source: 'cron:practice-nudge', entity_type: 'parent', entity_id: parentData.parentId, decision: 'send_practice_nudge', reason: { engagement: completionRate, threshold: p.high_engagement_skip, branch: 'high_engagement_skip' } as Json }); } catch {}
          skipped++;
          continue;
        } else if (completionRate > 0 && completionRate < (p.low_engagement_24h || 0.4)) {
          // Low engagement — nudge earlier at 24h
          nudgeThresholdHours = 24;
        } else if (completionRate === 0 && recentHistory && recentHistory.length >= (p.zero_engagement_coach_alert_min_tasks || 5)) {
          // Zero engagement with 5+ tasks — alert coach instead
          const childEntries = Array.from(parentData.children.entries());
          for (const [childId, childData] of childEntries) {
            // Find the child's coach
            const { data: childRow } = await supabase
              .from('children')
              .select('assigned_coach_id')
              .eq('id', childId)
              .maybeSingle();
            if (childRow?.assigned_coach_id) {
              const { data: coach } = await supabase
                .from('coaches')
                .select('user_id')
                .eq('id', childRow.assigned_coach_id)
                .maybeSingle();
              if (coach?.user_id) {
                await supabase.from('activity_log').insert({
                  action: 'engagement_alert_disengaged_parent',
                  user_email: 'system',
                  user_type: 'system',
                  metadata: {
                    coachId: childRow.assigned_coach_id,
                    coachUserId: coach.user_id,
                    parentId: parentData.parentId,
                    parentName: parentData.parentName,
                    childName: childData.childName,
                    completionRate: 0,
                    pendingTasks: childData.tasks.length,
                  },
                });
                coachAlerts++;
              }
            }
          }
          skipped++;
          continue;
        }

        // Check if we already nudged within threshold
        const nudgeThresholdDate = new Date(Date.now() - nudgeThresholdHours * 60 * 60 * 1000).toISOString();
        const { count: recentNudge } = await supabase
          .from('communication_logs')
          .select('*', { count: 'exact', head: true })
          .eq('template_code', 'parent_practice_nudge_v3')
          .eq('recipient_id', parentData.parentId)
          .gt('created_at', nudgeThresholdDate);

        if (recentNudge && recentNudge > 0) {
          skipped++;
          continue;
        }

        // Build message variables
        const allChildren = Array.from(parentData.children.values());
        const childName = allChildren.map((c: { childName: string; tasks: string[] }) => c.childName).join(' & ');
        const allTasks = allChildren.flatMap((c: { childName: string; tasks: string[] }) => c.tasks);
        const pendingCount = String(allTasks.length);
        const taskList = allTasks.slice(0, 3).join(', ') + (allTasks.length > 3 ? ` +${allTasks.length - 3} more` : '');

        try { await logDecision({ source: 'cron:practice-nudge', entity_type: 'parent', entity_id: parentData.parentId, decision: 'send_practice_nudge', reason: { engagement: completionRate, nudge_threshold_hours: nudgeThresholdHours, pending_count: allTasks.length } as Json, action: 'sendCommunication:parent_practice_nudge_v3', outcome: 'pending' }); } catch {}

        await sendCommunication({
          templateCode: 'parent_practice_nudge_v3',
          recipientType: 'parent',
          recipientId: parentData.parentId,
          recipientPhone: parentData.parentPhone,
          recipientEmail: parentData.parentEmail,
          recipientName: parentData.parentName,
          variables: {
            parent_name: parentData.parentName,
            child_name: childName,
          },
          relatedEntityType: 'practice_nudge',
          triggeredBy: 'system',
          contextType: 'cron_practice_nudge',
        });

        nudged++;
      } catch (err: any) {
        console.error(JSON.stringify({ requestId, event: 'practice_nudge_send_error', parentId: parentData.parentId, error: err.message }));
        errors++;
      }
    }

    const latencyMs = Date.now() - startTime;

    await supabase.from('activity_log').insert({
      action: 'cron_practice_nudge',
      user_email: 'system',
      user_type: 'system',
      metadata: { requestId, nudged, skipped, errors, coachAlerts, totalParents: parentMap.size, latencyMs },
    });

    console.log(JSON.stringify({ requestId, event: 'practice_nudge_complete', nudged, skipped, errors, coachAlerts, latencyMs }));

    return NextResponse.json({ success: true, nudged, skipped, errors, coachAlerts });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'practice_nudge_fatal', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
