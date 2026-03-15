// ============================================================
// FILE: app/api/admin/tuition/stats/route.ts
// PURPOSE: Quick stats for admin tuition dashboard.
// ============================================================

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (_req, { supabase }) => {
  // Active tuition students
  const { count: activeCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('enrollment_type', 'tuition')
    .in('status', ['active', 'payment_pending']);

  // Paused students
  const { count: pausedCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('enrollment_type', 'tuition')
    .eq('status', 'tuition_paused');

  // Low balance (sessions_remaining <= 2 and > 0)
  const { count: lowBalanceCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('enrollment_type', 'tuition')
    .eq('status', 'active')
    .lte('sessions_remaining', 2)
    .gt('sessions_remaining', 0);

  // Sessions completed this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count: sessionsThisMonth } = await supabase
    .from('tuition_session_ledger')
    .select('*', { count: 'exact', head: true })
    .eq('reason', 'session_completed')
    .gte('created_at', monthStart);

  // Pending onboardings
  const { count: pendingOnboardings } = await supabase
    .from('tuition_onboarding')
    .select('*', { count: 'exact', head: true })
    .in('status', ['draft', 'parent_pending']);

  return NextResponse.json({
    activeStudents: activeCount || 0,
    pausedStudents: pausedCount || 0,
    lowBalance: lowBalanceCount || 0,
    sessionsThisMonth: sessionsThisMonth || 0,
    pendingOnboardings: pendingOnboardings || 0,
  });
}, { auth: 'admin' });
