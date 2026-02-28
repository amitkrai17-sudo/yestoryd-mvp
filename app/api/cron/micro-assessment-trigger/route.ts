// ============================================================
// GET /api/cron/micro-assessment-trigger
// ============================================================
// Daily cron that checks group_session_participants for children
// who have attended N sessions since their last micro-assessment.
// Creates pending micro_assessment records and logs notifications.
//
// N = uip_micro_assessment_attendance_interval from site_settings
//     (default: 4)
//
// QStash Schedule:
//   cron: "0 6 * * *"  (Daily at 6 AM IST)
//   url: /api/cron/micro-assessment-trigger
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { Receiver } from '@upstash/qstash';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// ============================================================
// Auth (same pattern as other cron routes)
// ============================================================

async function verifyCronAuth(request: NextRequest): Promise<{ isValid: boolean; source: string }> {
  // 1. CRON_SECRET
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { isValid: true, source: 'cron_secret' };
  }

  // 2. Internal API key
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // 3. QStash signature
  const signature = request.headers.get('upstash-signature');
  const body = '';
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
      });
      const isValid = await receiver.verify({ signature, body });
      if (isValid) return { isValid: true, source: 'qstash' };
    } catch {
      // Fall through
    }
  }

  // 4. Dev bypass
  if (process.env.NODE_ENV === 'development') {
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// ============================================================
// Handler
// ============================================================

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await verifyCronAuth(request);
    if (!auth.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'micro_trigger_start', authSource: auth.source }));

    const supabase = getServiceSupabase();

    // ─── Load attendance interval from site_settings ───
    const { data: settingRow } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'uip_micro_assessment_attendance_interval')
      .single();

    const attendanceInterval = settingRow ? parseInt(String(settingRow.value), 10) : 4;
    const interval = isNaN(attendanceInterval) || attendanceInterval < 1 ? 4 : attendanceInterval;

    // ─── Find children who ONLY attend group classes ───
    // These are children with group_session_participants records
    // but no active 1:1 enrollment (or enrollment with status = 'group_only')
    //
    // Strategy: Find all children with recent group attendance,
    // then filter out those with active 1:1 enrollments.

    // Get distinct children who have attended group classes
    const { data: attendedChildren, error: attendErr } = await supabase
      .from('group_session_participants')
      .select('child_id')
      .eq('attendance_status', 'present');

    if (attendErr || !attendedChildren) {
      console.error(JSON.stringify({ requestId, event: 'micro_trigger_query_error', error: attendErr?.message }));
      return NextResponse.json({ success: false, error: 'Failed to query participants' }, { status: 500 });
    }

    // Deduplicate child IDs
    const uniqueChildIds = Array.from(new Set(attendedChildren.map(a => a.child_id).filter((id): id is string => !!id)));

    if (uniqueChildIds.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'micro_trigger_no_children' }));
      return NextResponse.json({ success: true, triggered: 0, message: 'No group class attendees found' });
    }

    // Filter out children with active 1:1 enrollments
    const { data: enrolledChildren } = await supabase
      .from('enrollments')
      .select('child_id')
      .in('child_id', uniqueChildIds)
      .in('status', ['active', 'in_progress']);

    const enrolledChildIds = new Set((enrolledChildren || []).map(e => e.child_id));
    const groupOnlyChildIds = uniqueChildIds.filter(id => !enrolledChildIds.has(id));

    if (groupOnlyChildIds.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'micro_trigger_all_enrolled', totalAttended: uniqueChildIds.length }));
      return NextResponse.json({ success: true, triggered: 0, message: 'All group class attendees have active 1:1 enrollments' });
    }

    // ─── For each group-only child, check attendance since last micro-assessment ───
    let triggered = 0;
    const triggeredChildren: Array<{ childId: string; childName: string; attendanceSinceLast: number }> = [];

    for (const childId of groupOnlyChildIds) {
      try {
        // Get last completed micro-assessment for this child
        const { data: lastMicro } = await supabase
          .from('micro_assessments')
          .select('id, completed_at, created_at')
          .eq('child_id', childId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .single();

        // Count attendance since last micro-assessment (or all time if no prior)
        let attendanceQuery = supabase
          .from('group_session_participants')
          .select('id', { count: 'exact', head: true })
          .eq('child_id', childId)
          .eq('attendance_status', 'present');

        if (lastMicro?.completed_at) {
          attendanceQuery = attendanceQuery.gt('attendance_marked_at', lastMicro.completed_at);
        }

        const { count: attendanceSinceLast } = await attendanceQuery;
        const attendanceCount = attendanceSinceLast || 0;

        if (attendanceCount < interval) continue;

        // Check if there's already a pending micro-assessment
        const { data: pendingMicro } = await supabase
          .from('micro_assessments')
          .select('id')
          .eq('child_id', childId)
          .eq('status', 'pending')
          .limit(1)
          .single();

        if (pendingMicro) continue; // Already has a pending one

        // Fetch child name
        const { data: childRow } = await supabase
          .from('children')
          .select('child_name, age, age_band')
          .eq('id', childId)
          .single();

        const childName = childRow?.child_name || 'Unknown';
        const ageBand = childRow?.age_band;

        // ─── Select an age-appropriate passage ───
        let passageQuery = supabase
          .from('reading_passages')
          .select('id, title')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        // Filter by age band if available
        if (childRow?.age) {
          passageQuery = passageQuery
            .lte('age_min', childRow.age)
            .gte('age_max', childRow.age);
        }

        const { data: passage } = await passageQuery.single();

        // Create pending micro-assessment
        const { error: insertErr } = await supabase
          .from('micro_assessments')
          .insert({
            child_id: childId,
            status: 'pending',
            triggered_by: 'cron',
            attendance_count_at_trigger: attendanceCount,
            passage_id: passage?.id || null,
            group_session_id: null,
          });

        if (insertErr) {
          console.error(JSON.stringify({ requestId, event: 'micro_trigger_insert_error', childId, error: insertErr.message }));
          continue;
        }

        triggered++;
        triggeredChildren.push({ childId, childName, attendanceSinceLast: attendanceCount });

        console.log(JSON.stringify({
          requestId, event: 'micro_assessment_triggered',
          childId, childName, attendanceSinceLast: attendanceCount, interval,
        }));
      } catch (childErr) {
        console.error(JSON.stringify({ requestId, event: 'micro_trigger_child_error', childId, error: childErr instanceof Error ? childErr.message : 'Unknown' }));
      }
    }

    // ─── Audit log ───
    await supabase.from('activity_log').insert({
      user_email: 'system',
      user_type: 'system',
      action: 'micro_assessment_trigger_cron',
      metadata: {
        request_id: requestId,
        interval,
        group_only_children: groupOnlyChildIds.length,
        triggered,
        triggered_children: triggeredChildren,
        duration: `${Date.now() - startTime}ms`,
      },
      created_at: new Date().toISOString(),
    });

    console.log(JSON.stringify({
      requestId, event: 'micro_trigger_complete',
      groupOnlyChildren: groupOnlyChildIds.length,
      triggered,
      duration: `${Date.now() - startTime}ms`,
    }));

    return NextResponse.json({
      success: true,
      triggered,
      interval,
      groupOnlyChildren: groupOnlyChildIds.length,
      triggeredChildren,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'micro_trigger_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
