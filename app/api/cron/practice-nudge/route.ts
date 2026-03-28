// ============================================================
// FILE: app/api/cron/practice-nudge/route.ts
// PURPOSE: Nudge parents with overdue incomplete tasks (48h+)
// SCHEDULE: Daily at 10:00 AM IST via dispatcher
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendCommunication } from '@/lib/communication';
import { verifyCronRequest } from '@/lib/api/verify-cron';

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

  try {
    // Find overdue tasks: incomplete, created 48h-7d ago, no nudge sent in last 48h
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: overdueTasks } = await supabase
      .from('parent_daily_tasks')
      .select(`
        id, title, child_id, created_at,
        children!parent_daily_tasks_child_id_fkey(
          id, child_name, name, parent_id, parent_phone, parent_email
        )
      `)
      .eq('is_completed', false)
      .lt('created_at', fortyEightHoursAgo)
      .gt('created_at', sevenDaysAgo)
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

        // Adaptive nudge thresholds based on engagement
        let nudgeThresholdHours = 48; // Default: medium engagement
        if (completionRate >= 0.8) {
          // High engagement — skip nudge, they'll do it
          skipped++;
          continue;
        } else if (completionRate > 0 && completionRate < 0.4) {
          // Low engagement — nudge earlier at 24h
          nudgeThresholdHours = 24;
        } else if (completionRate === 0 && recentHistory && recentHistory.length >= 5) {
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
          .eq('template_code', 'practice_nudge')
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

        await sendCommunication({
          templateCode: 'practice_nudge',
          recipientType: 'parent',
          recipientId: parentData.parentId,
          recipientPhone: parentData.parentPhone,
          recipientEmail: parentData.parentEmail,
          recipientName: parentData.parentName,
          variables: {
            parent_name: parentData.parentName,
            child_name: childName,
            pending_count: pendingCount,
            task_list: taskList,
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
