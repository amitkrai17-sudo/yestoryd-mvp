// ============================================================
// FILE: app/api/admin/dashboard/route.ts
// ============================================================
// HARDENED VERSION - Admin Dashboard API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Authenticate - Admin only
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({
        requestId,
        event: 'admin_dashboard_auth_failed',
        error: auth.error,
        attemptedEmail: auth.email,
      }));
      
      return NextResponse.json(
        { error: auth.error },
        { status: auth.email ? 403 : 401 }
      );
    }

    console.log(JSON.stringify({
      requestId,
      event: 'admin_dashboard_request',
      adminEmail: auth.email,
    }));

    const supabase = getServiceSupabase();

    // 2. Get current date info
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 3. Fetch all stats in parallel
    const [
      enrollmentsResult,
      childrenResult,
      paymentsResult,
      monthPaymentsResult,
      upcomingSessionsResult,
      completedSessionsResult,
      recentEnrollmentsResult,
    ] = await Promise.all([
      supabase.from('enrollments').select('id', { count: 'exact', head: true }),
      supabase.from('children').select('id', { count: 'exact', head: true }),
      supabase.from('payments').select('amount').eq('status', 'captured'),
      supabase
        .from('payments')
        .select('amount')
        .eq('status', 'captured')
        .gte('created_at', startOfMonth.toISOString()),
      supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled')
        .gte('scheduled_date', now.toISOString().split('T')[0])
        .lte('scheduled_date', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('scheduled_date', startOfMonth.toISOString().split('T')[0]),
      supabase
        .from('enrollments')
        .select(`
          id,
          amount,
          created_at,
          child:children(name),
          parent:parents(name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    // 4. Calculate totals
    const totalRevenue = paymentsResult.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const thisMonthRevenue = monthPaymentsResult.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // 5. Format recent enrollments
    const recentEnrollments = recentEnrollmentsResult.data?.map((enrollment: any) => {
      const child = Array.isArray(enrollment.child) ? enrollment.child[0] : enrollment.child;
      const parent = Array.isArray(enrollment.parent) ? enrollment.parent[0] : enrollment.parent;

      return {
        id: enrollment.id,
        childName: child?.name || 'Unknown',
        parentName: parent?.name || 'Unknown',
        parentEmail: parent?.email || '',
        amount: enrollment.amount || 0,
        createdAt: enrollment.created_at,
      };
    }) || [];

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'admin_dashboard_success',
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      stats: {
        totalEnrollments: enrollmentsResult.count || 0,
        activeChildren: childrenResult.count || 0,
        totalRevenue,
        thisMonthRevenue,
        upcomingSessions: upcomingSessionsResult.count || 0,
        completedSessions: completedSessionsResult.count || 0,
        conversionRate: 0,
        assessmentsTaken: 0,
      },
      recentEnrollments,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'admin_dashboard_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { error: 'Failed to load dashboard', requestId },
      { status: 500 }
    );
  }
}
