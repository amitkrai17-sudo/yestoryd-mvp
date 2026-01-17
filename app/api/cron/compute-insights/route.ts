// ============================================================
// FILE: app/api/cron/compute-insights/route.ts
// ============================================================
// HARDENED VERSION - Weekly Admin Insights Computation
// Triggered by QStash every Sunday at 11:00 PM IST
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - QStash signature verification
// - CRON_SECRET + Internal API key (NO query params!)
// - Lazy Supabase initialization
// - Request tracing
//
// Performance features:
// - Batched queries (fixed N+1 issues)
// - Parallel Promise.all where possible
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/api-auth';
import { Receiver } from '@upstash/qstash';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- VERIFICATION ---
async function verifyCronAuth(request: NextRequest, body?: string): Promise<{ isValid: boolean; source: string }> {
  // 1. Check CRON_SECRET (header only, NOT query param!)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { isValid: true, source: 'cron_secret' };
  }

  // 2. Check internal API key
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // 3. Check QStash signature
  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
      });

      const isValid = await receiver.verify({
        signature,
        body: body || '',
      });

      if (isValid) {
        return { isValid: true, source: 'qstash' };
      }
    } catch (e) {
      console.error('QStash verification failed:', e);
    }
  }

  return { isValid: false, source: 'none' };
}

// --- HELPER: Save insight ---
async function saveInsight(
  supabase: ReturnType<typeof getSupabase>,
  insightType: string,
  data: any,
  validUntil: Date
): Promise<void> {
  await supabase.from('admin_insights').insert({
    insight_type: insightType,
    insight_data: data,
    valid_until: validUntil.toISOString(),
  });
}

// --- MAIN PROCESSOR ---
async function computeInsights(requestId: string, source: string) {
  const startTime = Date.now();
  const results: Record<string, any> = {};
  const errors: string[] = [];

  try {
    const supabase = getServiceSupabase();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    console.log(JSON.stringify({
      requestId,
      event: 'compute_insights_started',
      source,
    }));

    // Pre-fetch common data to avoid N+1
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // ============================================================
    // BATCH FETCH: Get all coaches and their stats in parallel
    // FIXED: Was N+1 (2-3 queries per coach in loop)
    //
    // ⚠️ SCALING TODO (when >10,000 students):
    // Current approach fetches all sessions/children into memory.
    // At scale (100K rows), this could cause OOM crashes.
    // 
    // Future fix: Push aggregation to database with SQL Views or RPC:
    //   SELECT coach_id, COUNT(*) as session_count 
    //   FROM scheduled_sessions 
    //   WHERE scheduled_date >= NOW() - INTERVAL '30 days'
    //   GROUP BY coach_id;
    //
    // For now (<10K students), in-memory approach is fine and easier to debug.
    // ============================================================
    const [
      coachesResult,
      allSessionsResult,
      childrenResult,
      paymentsThisMonthResult,
      paymentsLastMonthResult,
    ] = await Promise.all([
      supabase.from('coaches').select('id, name, email').eq('is_active', true),
      supabase.from('scheduled_sessions')
        .select('id, status, coach_id, child_id, scheduled_date')
        .gte('scheduled_date', thirtyDaysAgo),
      supabase.from('children')
        .select('id, child_name, parent_email, status, coach_id, created_at'),
      supabase.from('payments')
        .select('amount, created_at')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .eq('status', 'captured'),
      supabase.from('payments')
        .select('amount, created_at')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString())
        .lt('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .eq('status', 'captured'),
    ]);

    const coaches = coachesResult.data || [];
    const allSessions = allSessionsResult.data || [];
    const allChildren = childrenResult.data || [];
    const paymentsThisMonth = paymentsThisMonthResult.data || [];
    const paymentsLastMonth = paymentsLastMonthResult.data || [];

    // Build lookup maps for O(1) access
    const sessionsByCoach = new Map<string, typeof allSessions>();
    const childrenByCoach = new Map<string, typeof allChildren>();
    const recentSessionChildIds = new Set<string>();

    for (const session of allSessions) {
      // Group by coach
      if (!sessionsByCoach.has(session.coach_id)) {
        sessionsByCoach.set(session.coach_id, []);
      }
      sessionsByCoach.get(session.coach_id)!.push(session);

      // Track children with recent sessions
      if (session.status === 'completed' && new Date(session.scheduled_date) >= new Date(fourteenDaysAgo)) {
        recentSessionChildIds.add(session.child_id);
      }
    }

    for (const child of allChildren) {
      if (child.coach_id) {
        if (!childrenByCoach.has(child.coach_id)) {
          childrenByCoach.set(child.coach_id, []);
        }
        childrenByCoach.get(child.coach_id)!.push(child);
      }
    }

    // ============================================================
    // INSIGHT 1: AT-RISK CHILDREN
    // ============================================================
    try {
      const activeChildren = allChildren.filter(c => 
        ['enrolled', 'active'].includes(c.status || '')
      );
      const atRisk = activeChildren.filter(c => !recentSessionChildIds.has(c.id));

      await saveInsight(supabase, 'at_risk_children', {
        count: atRisk.length,
        children: atRisk.slice(0, 20),
        criteria: 'No completed session in last 14 days',
        computed_at: new Date().toISOString(),
      }, validUntil);

      results.at_risk_children = atRisk.length;
    } catch (e: any) {
      errors.push(`at_risk_children: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 2: TOP PERFORMING COACHES (FIXED N+1)
    // ============================================================
    try {
      const coachStats = coaches.map(coach => {
        const coachSessions = sessionsByCoach.get(coach.id) || [];
        const completed = coachSessions.filter(s => s.status === 'completed').length;
        const total = coachSessions.length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const coachChildren = childrenByCoach.get(coach.id) || [];
        const activeStudents = coachChildren.filter(c => 
          ['enrolled', 'active'].includes(c.status || '')
        ).length;

        return {
          id: coach.id,
          name: coach.name,
          sessions_completed: completed,
          total_sessions: total,
          completion_rate: completionRate,
          student_count: activeStudents,
          score: completed * 10 + completionRate,
        };
      });

      coachStats.sort((a, b) => b.score - a.score);

      await saveInsight(supabase, 'top_coaches', {
        coaches: coachStats.slice(0, 10),
        period: 'Last 30 days',
        computed_at: new Date().toISOString(),
      }, validUntil);

      results.top_coaches = coachStats.length;
    } catch (e: any) {
      errors.push(`top_coaches: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 3: ENROLLMENT CONVERSION RATE
    // ============================================================
    try {
      const totalAssessed = allChildren.filter(c => c.status).length;
      const enrolled = allChildren.filter(c => 
        ['enrolled', 'active', 'completed'].includes(c.status || '')
      ).length;

      const conversionRate = totalAssessed > 0
        ? Math.round((enrolled / totalAssessed) * 100)
        : 0;

      await saveInsight(supabase, 'conversion_rate', {
        total_assessed: totalAssessed,
        total_enrolled: enrolled,
        conversion_rate: conversionRate,
        period: 'All time',
        computed_at: new Date().toISOString(),
      }, validUntil);

      results.conversion_rate = conversionRate;
    } catch (e: any) {
      errors.push(`conversion_rate: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 4: INACTIVE CHILDREN
    // ============================================================
    try {
      const activeChildren = allChildren.filter(c => 
        ['enrolled', 'active'].includes(c.status || '')
      );

      // Get children with ANY recent session (completed or scheduled)
      const childrenWithRecentActivity = new Set<string>();
      for (const session of allSessions) {
        if (new Date(session.scheduled_date) >= new Date(fourteenDaysAgo)) {
          if (['completed', 'scheduled'].includes(session.status)) {
            childrenWithRecentActivity.add(session.child_id);
          }
        }
      }

      const inactive = activeChildren.filter(c => !childrenWithRecentActivity.has(c.id));

      await saveInsight(supabase, 'inactive_children', {
        count: inactive.length,
        children: inactive.slice(0, 20),
        criteria: 'No session (completed or scheduled) in last 14 days',
        computed_at: new Date().toISOString(),
      }, validUntil);

      results.inactive_children = inactive.length;
    } catch (e: any) {
      errors.push(`inactive_children: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 5: REVENUE TRENDS
    // ============================================================
    try {
      const thisMonthRevenue = paymentsThisMonth.reduce((sum, p) => sum + (p.amount || 0), 0);
      const lastMonthRevenue = paymentsLastMonth.reduce((sum, p) => sum + (p.amount || 0), 0);

      const growthRate = lastMonthRevenue > 0
        ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : 0;

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      await saveInsight(supabase, 'revenue_trends', {
        this_month: thisMonthRevenue,
        last_month: lastMonthRevenue,
        growth_rate: growthRate,
        this_month_name: thisMonthStart.toLocaleString('default', { month: 'long' }),
        last_month_name: lastMonthStart.toLocaleString('default', { month: 'long' }),
        computed_at: new Date().toISOString(),
      }, validUntil);

      results.revenue_trends = { this_month: thisMonthRevenue, growth: growthRate };
    } catch (e: any) {
      errors.push(`revenue_trends: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 6: COACH WORKLOAD DISTRIBUTION (FIXED N+1)
    // ============================================================
    try {
      // Get upcoming sessions count per coach
      const upcomingSessionsByCoach = new Map<string, number>();
      for (const session of allSessions) {
        if (session.status === 'scheduled' && new Date(session.scheduled_date) >= new Date()) {
          upcomingSessionsByCoach.set(
            session.coach_id,
            (upcomingSessionsByCoach.get(session.coach_id) || 0) + 1
          );
        }
      }

      const workload = coaches.map(coach => {
        const coachChildren = childrenByCoach.get(coach.id) || [];
        const activeStudents = coachChildren.filter(c => 
          ['enrolled', 'active'].includes(c.status || '')
        ).length;

        return {
          id: coach.id,
          name: coach.name,
          student_count: activeStudents,
          upcoming_sessions: upcomingSessionsByCoach.get(coach.id) || 0,
        };
      });

      workload.sort((a, b) => b.student_count - a.student_count);

      const totalStudents = workload.reduce((sum, c) => sum + c.student_count, 0);
      const avgPerCoach = workload.length > 0 ? Math.round(totalStudents / workload.length) : 0;

      await saveInsight(supabase, 'coach_workload', {
        coaches: workload,
        total_students: totalStudents,
        average_per_coach: avgPerCoach,
        computed_at: new Date().toISOString(),
      }, validUntil);

      results.coach_workload = workload.length;
    } catch (e: any) {
      errors.push(`coach_workload: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 7: SESSION COMPLETION RATE
    // ============================================================
    try {
      const pastSessions = allSessions.filter(s => 
        new Date(s.scheduled_date) <= new Date()
      );

      const total = pastSessions.length;
      const completed = pastSessions.filter(s => s.status === 'completed').length;
      const noShow = pastSessions.filter(s => s.status === 'no_show').length;
      const cancelled = pastSessions.filter(s => s.status === 'cancelled').length;

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      await saveInsight(supabase, 'session_completion', {
        total_sessions: total,
        completed,
        no_show: noShow,
        cancelled,
        completion_rate: completionRate,
        period: 'Last 30 days',
        computed_at: new Date().toISOString(),
      }, validUntil);

      results.session_completion = completionRate;
    } catch (e: any) {
      errors.push(`session_completion: ${e.message}`);
    }

    // ============================================================
    // INSIGHT 8: WEEKLY SUMMARY
    // ============================================================
    try {
      await saveInsight(supabase, 'weekly_summary', {
        at_risk_count: results.at_risk_children || 0,
        inactive_count: results.inactive_children || 0,
        conversion_rate: results.conversion_rate || 0,
        session_completion_rate: results.session_completion || 0,
        revenue_this_month: results.revenue_trends?.this_month || 0,
        revenue_growth: results.revenue_trends?.growth || 0,
        total_coaches: results.coach_workload || 0,
        computed_at: new Date().toISOString(),
      }, validUntil);

      results.weekly_summary = 'computed';
    } catch (e: any) {
      errors.push(`weekly_summary: ${e.message}`);
    }

    // ============================================================
    // AUDIT LOG & RESPONSE
    // ============================================================
    await supabase.from('activity_log').insert({
      user_email: 'system@yestoryd.com',
      action: 'compute_insights_executed',
      details: {
        request_id: requestId,
        source,
        results,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'compute_insights_complete',
      duration: `${duration}ms`,
      insights_computed: Object.keys(results).length,
      errors_count: errors.length,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      message: 'Weekly insights computed',
      results,
      errors: errors.length > 0 ? errors : undefined,
      computed_at: new Date().toISOString(),
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'compute_insights_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, requestId, error: error.message },
      { status: 500 }
    );
  }
}

// --- HANDLERS ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const body = await request.text();
  const auth = await verifyCronAuth(request, body);

  if (!auth.isValid) {
    console.error(JSON.stringify({
      requestId,
      event: 'auth_failed',
      error: 'Unauthorized',
    }));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return computeInsights(requestId, auth.source);
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  // SECURITY: Check header auth only, NOT query params (visible in logs!)
  const auth = await verifyCronAuth(request);

  if (!auth.isValid) {
    console.error(JSON.stringify({
      requestId,
      event: 'auth_failed',
      error: 'Unauthorized. Use Authorization header.',
    }));
    return NextResponse.json(
      { error: 'Unauthorized. Use Authorization: Bearer <CRON_SECRET> header' },
      { status: 401 }
    );
  }

  return computeInsights(requestId, auth.source);
}