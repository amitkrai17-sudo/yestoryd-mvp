// file: app/api/cron/compute-insights/route.ts
// Weekly cron job to compute admin insights
// Triggered by QStash every Sunday at 11:00 PM IST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify QStash signature (optional but recommended)
const QSTASH_TOKEN = process.env.QSTASH_TOKEN;

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for computation

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting weekly insight computation...');
    
    const results: Record<string, any> = {};
    const errors: string[] = [];
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7); // Valid for 1 week

    // ============================================================
    // INSIGHT 1: AT-RISK CHILDREN
    // Children with low progress or missed sessions
    // ============================================================
    try {
      const { data: atRiskChildren } = await supabase.rpc('get_at_risk_children');
      
      // Fallback if RPC doesn't exist - use direct query
      if (!atRiskChildren) {
        const { data } = await supabase
          .from('children')
          .select(`
            id, child_name, parent_email, status,
            assigned_coach:coaches(name)
          `)
          .in('status', ['enrolled', 'active'])
          .order('created_at', { ascending: true });
        
        // Get children with no sessions in last 14 days
        const { data: recentSessions } = await supabase
          .from('scheduled_sessions')
          .select('child_id')
          .gte('scheduled_date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
          .eq('status', 'completed');
        
        const activeChildIds = new Set(recentSessions?.map(s => s.child_id) || []);
        const atRisk = data?.filter(c => !activeChildIds.has(c.id)) || [];
        
        await saveInsight('at_risk_children', {
          count: atRisk.length,
          children: atRisk.slice(0, 20), // Top 20
          criteria: 'No completed session in last 14 days',
          computed_at: new Date().toISOString()
        }, validUntil);
        
        results.at_risk_children = atRisk.length;
      }
    } catch (e: any) {
      errors.push(`at_risk_children: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 2: TOP PERFORMING COACHES
    // Based on sessions completed, student progress, engagement
    // ============================================================
    try {
      const { data: coaches } = await supabase
        .from('coaches')
        .select('id, name, email')
        .eq('is_active', true);
      
      const coachStats = [];
      
      for (const coach of coaches || []) {
        // Get session stats
        const { data: sessions } = await supabase
          .from('scheduled_sessions')
          .select('id, status')
          .eq('coach_id', coach.id)
          .gte('scheduled_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        
        const completed = sessions?.filter(s => s.status === 'completed').length || 0;
        const total = sessions?.length || 0;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        // Get student count
        const { count: studentCount } = await supabase
          .from('children')
          .select('id', { count: 'exact' })
          .eq('assigned_coach_id', coach.id)
          .in('status', ['enrolled', 'active']);
        
        coachStats.push({
          id: coach.id,
          name: coach.name,
          sessions_completed: completed,
          total_sessions: total,
          completion_rate: completionRate,
          student_count: studentCount || 0,
          score: completed * 10 + completionRate // Simple scoring
        });
      }
      
      // Sort by score descending
      coachStats.sort((a, b) => b.score - a.score);
      
      await saveInsight('top_coaches', {
        coaches: coachStats.slice(0, 10),
        period: 'Last 30 days',
        computed_at: new Date().toISOString()
      }, validUntil);
      
      results.top_coaches = coachStats.length;
    } catch (e: any) {
      errors.push(`top_coaches: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 3: ENROLLMENT CONVERSION RATE
    // Assessed → Enrolled conversion
    // ============================================================
    try {
      const { count: totalAssessed } = await supabase
        .from('children')
        .select('id', { count: 'exact' })
        .not('status', 'is', null);
      
      const { count: enrolled } = await supabase
        .from('children')
        .select('id', { count: 'exact' })
        .in('status', ['enrolled', 'active', 'completed']);
      
      const conversionRate = totalAssessed && totalAssessed > 0 
        ? Math.round(((enrolled || 0) / totalAssessed) * 100) 
        : 0;
      
      // Get weekly breakdown
      const { data: weeklyData } = await supabase
        .from('children')
        .select('status, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      
      await saveInsight('conversion_rate', {
        total_assessed: totalAssessed || 0,
        total_enrolled: enrolled || 0,
        conversion_rate: conversionRate,
        period: 'All time',
        computed_at: new Date().toISOString()
      }, validUntil);
      
      results.conversion_rate = conversionRate;
    } catch (e: any) {
      errors.push(`conversion_rate: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 4: INACTIVE CHILDREN (2+ weeks)
    // ============================================================
    try {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      
      // Get all active children
      const { data: activeChildren } = await supabase
        .from('children')
        .select('id, child_name, parent_email, assigned_coach_id')
        .in('status', ['enrolled', 'active']);
      
      // Get children with recent sessions
      const { data: recentSessions } = await supabase
        .from('scheduled_sessions')
        .select('child_id')
        .gte('scheduled_date', twoWeeksAgo)
        .in('status', ['completed', 'scheduled']);
      
      const activeChildIds = new Set(recentSessions?.map(s => s.child_id) || []);
      const inactive = activeChildren?.filter(c => !activeChildIds.has(c.id)) || [];
      
      await saveInsight('inactive_children', {
        count: inactive.length,
        children: inactive.slice(0, 20),
        criteria: 'No session (completed or scheduled) in last 14 days',
        computed_at: new Date().toISOString()
      }, validUntil);
      
      results.inactive_children = inactive.length;
    } catch (e: any) {
      errors.push(`inactive_children: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 5: REVENUE TRENDS
    // ============================================================
    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      // This month revenue
      const { data: thisMonthPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('created_at', thisMonthStart.toISOString())
        .eq('status', 'captured');
      
      const thisMonthRevenue = thisMonthPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      
      // Last month revenue
      const { data: lastMonthPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', lastMonthEnd.toISOString())
        .eq('status', 'captured');
      
      const lastMonthRevenue = lastMonthPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      
      const growthRate = lastMonthRevenue > 0 
        ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : 0;
      
      await saveInsight('revenue_trends', {
        this_month: thisMonthRevenue,
        last_month: lastMonthRevenue,
        growth_rate: growthRate,
        this_month_name: thisMonthStart.toLocaleString('default', { month: 'long' }),
        last_month_name: lastMonthStart.toLocaleString('default', { month: 'long' }),
        computed_at: new Date().toISOString()
      }, validUntil);
      
      results.revenue_trends = { this_month: thisMonthRevenue, growth: growthRate };
    } catch (e: any) {
      errors.push(`revenue_trends: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 6: COACH WORKLOAD DISTRIBUTION
    // ============================================================
    try {
      const { data: coaches } = await supabase
        .from('coaches')
        .select('id, name')
        .eq('is_active', true);
      
      const workload = [];
      
      for (const coach of coaches || []) {
        const { count: studentCount } = await supabase
          .from('children')
          .select('id', { count: 'exact' })
          .eq('assigned_coach_id', coach.id)
          .in('status', ['enrolled', 'active']);
        
        const { count: upcomingSessions } = await supabase
          .from('scheduled_sessions')
          .select('id', { count: 'exact' })
          .eq('coach_id', coach.id)
          .eq('status', 'scheduled')
          .gte('scheduled_date', new Date().toISOString());
        
        workload.push({
          id: coach.id,
          name: coach.name,
          student_count: studentCount || 0,
          upcoming_sessions: upcomingSessions || 0
        });
      }
      
      // Sort by student count descending
      workload.sort((a, b) => b.student_count - a.student_count);
      
      const totalStudents = workload.reduce((sum, c) => sum + c.student_count, 0);
      const avgPerCoach = workload.length > 0 ? Math.round(totalStudents / workload.length) : 0;
      
      await saveInsight('coach_workload', {
        coaches: workload,
        total_students: totalStudents,
        average_per_coach: avgPerCoach,
        computed_at: new Date().toISOString()
      }, validUntil);
      
      results.coach_workload = workload.length;
    } catch (e: any) {
      errors.push(`coach_workload: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 7: SESSION COMPLETION RATE
    // ============================================================
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: sessions } = await supabase
        .from('scheduled_sessions')
        .select('status')
        .gte('scheduled_date', thirtyDaysAgo)
        .lte('scheduled_date', new Date().toISOString());
      
      const total = sessions?.length || 0;
      const completed = sessions?.filter(s => s.status === 'completed').length || 0;
      const noShow = sessions?.filter(s => s.status === 'no_show').length || 0;
      const cancelled = sessions?.filter(s => s.status === 'cancelled').length || 0;
      
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      await saveInsight('session_completion', {
        total_sessions: total,
        completed: completed,
        no_show: noShow,
        cancelled: cancelled,
        completion_rate: completionRate,
        period: 'Last 30 days',
        computed_at: new Date().toISOString()
      }, validUntil);
      
      results.session_completion = completionRate;
    } catch (e: any) {
      errors.push(`session_completion: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 8: WEEKLY SUMMARY
    // ============================================================
    try {
      await saveInsight('weekly_summary', {
        at_risk_count: results.at_risk_children || 0,
        inactive_count: results.inactive_children || 0,
        conversion_rate: results.conversion_rate || 0,
        session_completion_rate: results.session_completion || 0,
        revenue_this_month: results.revenue_trends?.this_month || 0,
        revenue_growth: results.revenue_trends?.growth || 0,
        total_coaches: results.coach_workload || 0,
        computed_at: new Date().toISOString()
      }, validUntil);
      
      results.weekly_summary = 'computed';
    } catch (e: any) {
      errors.push(`weekly_summary: ${e.message}`);
    }

    // ============================================================
    // RETURN RESULTS
    // ============================================================
    console.log('✅ Insight computation complete:', results);
    
    if (errors.length > 0) {
      console.warn('⚠️ Some insights had errors:', errors);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Weekly insights computed',
      results,
      errors: errors.length > 0 ? errors : undefined,
      computed_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Insight computation failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================
// HELPER: Save insight to database
// ============================================================
async function saveInsight(
  insightType: string, 
  data: any, 
  validUntil: Date
): Promise<void> {
  await supabase
    .from('admin_insights')
    .insert({
      insight_type: insightType,
      insight_data: data,
      valid_until: validUntil.toISOString()
    });
}

// ============================================================
// GET endpoint for manual trigger / testing
// ============================================================
export async function GET(request: NextRequest) {
  // Check for admin auth or secret key
  const authHeader = request.headers.get('authorization');
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  
  if (secret !== process.env.CRON_SECRET && !authHeader?.includes('admin')) {
    return NextResponse.json(
      { error: 'Unauthorized. Use ?secret=YOUR_CRON_SECRET or admin auth' },
      { status: 401 }
    );
  }
  
  // Trigger the POST handler
  return POST(request);
}
