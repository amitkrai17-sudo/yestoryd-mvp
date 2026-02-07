// ============================================================
// FILE: app/api/admin/crm/funnel/route.ts
// ============================================================
// HARDENED VERSION - Admin CRM Funnel API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION ---
const querySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
});

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = querySchema.safeParse({ days: searchParams.get('days') });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const { days } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'crm_funnel_request', adminEmail: auth.email, days }));

    const supabase = getServiceSupabase();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get funnel metrics using RPC function
    const { data: funnelData, error: funnelError } = await supabase
      .rpc('get_funnel_stats', {
        start_date: startDate.toISOString(),
        end_date: new Date().toISOString(),
      });

    if (funnelError) {
      console.log(JSON.stringify({ requestId, event: 'funnel_rpc_error', error: funnelError.message }));
    }

    // Get recent leads
    const { data: recentLeads } = await supabase
      .from('discovery_calls')
      .select(`
        id, parent_name, parent_email, child_name, child_age, assessment_score,
        status, coach_id, scheduled_at, converted_to_enrollment, created_at,
        coach:coaches!coach_id (name)
      `)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Get stage breakdown
    const { data: stageBreakdown } = await supabase
      .from('discovery_calls')
      .select('status')
      .gte('created_at', startDate.toISOString());

    const stageCounts = { pending: 0, scheduled: 0, completed: 0, no_show: 0, enrolled: 0 };
    stageBreakdown?.forEach((call: any) => {
      if (call.status in stageCounts) {
        stageCounts[call.status as keyof typeof stageCounts]++;
      }
    });

    // Get coach performance
    const { data: coachPerformance } = await supabase
      .from('discovery_calls')
      .select(`
        coach_id, status, converted_to_enrollment,
        coach:coaches!coach_id (name)
      `)
      .not('coach_id', 'is', null)
      .gte('created_at', startDate.toISOString());

    const coachStats: Record<string, any> = {};
    coachPerformance?.forEach((call: any) => {
      const coachId = call.coach_id;
      if (!coachStats[coachId]) {
        coachStats[coachId] = {
          coachId,
          coachName: call.coach?.name || 'Unknown',
          totalCalls: 0,
          completed: 0,
          noShow: 0,
          converted: 0,
        };
      }
      coachStats[coachId].totalCalls++;
      if (call.status === 'completed') coachStats[coachId].completed++;
      if (call.status === 'no_show') coachStats[coachId].noShow++;
      if (call.converted_to_enrollment) coachStats[coachId].converted++;
    });

    Object.values(coachStats).forEach((coach: any) => {
      coach.conversionRate = coach.completed > 0 ? Math.round((coach.converted / coach.completed) * 100) : 0;
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'crm_funnel_success', days, recentLeadsCount: recentLeads?.length || 0, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      period: `Last ${days} days`,
      funnel: funnelData?.[0] || {
        assessments: 0, calls_booked: 0, calls_completed: 0, calls_no_show: 0, enrolled: 0,
        assessment_to_call_pct: 0, call_completion_pct: 0, call_to_enrollment_pct: 0,
      },
      stageCounts,
      coachPerformance: Object.values(coachStats),
      recentLeads: recentLeads || [],
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'crm_funnel_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
