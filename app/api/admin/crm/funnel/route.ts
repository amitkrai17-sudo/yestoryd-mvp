// app/api/admin/crm/funnel/route.ts
// Get CRM funnel metrics for admin dashboard

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get funnel metrics using the function we created
    const { data: funnelData, error: funnelError } = await supabase
      .rpc('get_funnel_stats', {
        start_date: startDate.toISOString(),
        end_date: new Date().toISOString(),
      });

    // Get recent leads with status
    const { data: recentLeads, error: leadsError } = await supabase
      .from('discovery_calls')
      .select(`
        id,
        parent_name,
        parent_email,
        child_name,
        child_age,
        assessment_score,
        status,
        assigned_coach_id,
        scheduled_at,
        converted_to_enrollment,
        created_at,
        coach:coaches!assigned_coach_id (
          name
        )
      `)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Get stage breakdown
    const { data: stageBreakdown } = await supabase
      .from('discovery_calls')
      .select('status')
      .gte('created_at', startDate.toISOString());

    const stageCounts = {
      pending: 0,
      scheduled: 0,
      completed: 0,
      no_show: 0,
      enrolled: 0,
    };

    stageBreakdown?.forEach((call: any) => {
      if (call.status in stageCounts) {
        stageCounts[call.status as keyof typeof stageCounts]++;
      }
    });

    // Get coach performance
    const { data: coachPerformance } = await supabase
      .from('discovery_calls')
      .select(`
        assigned_coach_id,
        status,
        converted_to_enrollment,
        coach:coaches!assigned_coach_id (
          name
        )
      `)
      .not('assigned_coach_id', 'is', null)
      .gte('created_at', startDate.toISOString());

    // Aggregate coach performance
    const coachStats: Record<string, any> = {};
    coachPerformance?.forEach((call: any) => {
      const coachId = call.assigned_coach_id;
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

    // Calculate conversion rates for each coach
    Object.values(coachStats).forEach((coach: any) => {
      coach.conversionRate = coach.completed > 0 
        ? Math.round((coach.converted / coach.completed) * 100) 
        : 0;
    });

    return NextResponse.json({
      success: true,
      period: `Last ${days} days`,
      funnel: funnelData?.[0] || {
        assessments: 0,
        calls_booked: 0,
        calls_completed: 0,
        calls_no_show: 0,
        enrolled: 0,
        assessment_to_call_pct: 0,
        call_completion_pct: 0,
        call_to_enrollment_pct: 0,
      },
      stageCounts,
      coachPerformance: Object.values(coachStats),
      recentLeads: recentLeads || [],
    });

  } catch (error) {
    console.error('Error fetching CRM funnel:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
