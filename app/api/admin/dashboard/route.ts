import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Get current date info
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    // Fetch all stats in parallel
    const [
      enrollmentsResult,
      childrenResult,
      paymentsResult,
      monthPaymentsResult,
      upcomingSessionsResult,
      completedSessionsResult,
      recentEnrollmentsResult,
    ] = await Promise.all([
      // Total enrollments
      supabase.from('enrollments').select('id', { count: 'exact', head: true }),
      
      // Active children
      supabase.from('children').select('id', { count: 'exact', head: true }),
      
      // Total revenue
      supabase.from('payments').select('amount').eq('status', 'captured'),
      
      // This month revenue
      supabase
        .from('payments')
        .select('amount')
        .eq('status', 'captured')
        .gte('created_at', startOfMonth.toISOString()),
      
      // Upcoming sessions (next 7 days)
      supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled')
        .gte('scheduled_date', now.toISOString().split('T')[0])
        .lte('scheduled_date', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      
      // Completed sessions this month
      supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('scheduled_date', startOfMonth.toISOString().split('T')[0]),
      
      // Recent enrollments with details
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

    // Calculate totals
    const totalRevenue = paymentsResult.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const thisMonthRevenue = monthPaymentsResult.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // Format recent enrollments
    const recentEnrollments = recentEnrollmentsResult.data?.map(enrollment => ({
      id: enrollment.id,
      childName: enrollment.child?.name || 'Unknown',
      parentName: enrollment.parent?.name || 'Unknown',
      parentEmail: enrollment.parent?.email || '',
      amount: enrollment.amount || 0,
      createdAt: enrollment.created_at,
    })) || [];

    return NextResponse.json({
      stats: {
        totalEnrollments: enrollmentsResult.count || 0,
        activeChildren: childrenResult.count || 0,
        totalRevenue,
        thisMonthRevenue,
        upcomingSessions: upcomingSessionsResult.count || 0,
        completedSessions: completedSessionsResult.count || 0,
        conversionRate: 0, // TODO: Calculate from assessments vs enrollments
        assessmentsTaken: 0, // TODO: Add assessments table tracking
      },
      recentEnrollments,
    });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
