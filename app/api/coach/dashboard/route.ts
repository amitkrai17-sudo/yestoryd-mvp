// =============================================================================
// GET /api/coach/dashboard
// Unified dashboard API — single call powers the entire coach dashboard.
// Returns: profile, today's sessions, stats, earnings, how-I-earn, students, pending actions.
// =============================================================================

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/with-api-handler';
import {
  loadPayoutConfig,
  loadCoachGroup,
  getTuitionCoachPercent,
} from '@/lib/config/payout-config';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (_req, { auth, supabase }) => {
  // 1. Get coach + tier
  const { data: coach, error: coachErr } = await supabase
    .from('coaches')
    .select('id, name, email, group_id')
    .eq('email', auth.email!)
    .single();

  if (coachErr || !coach) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  }

  const coachId = coach.id;

  // Load config + tier in parallel
  const [coachGroup, config] = await Promise.all([
    loadCoachGroup(coachId),
    loadPayoutConfig(),
  ]);
  const tierName = coachGroup?.display_name || coachGroup?.name || 'Rising Coach';

  // IST today boundaries
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const todayIST = istNow.toISOString().split('T')[0];
  const monthStart = `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, '0')}-01`;

  // 2. Today's sessions (with child name + tuition data)
  const { data: todaySessions } = await supabase
    .from('scheduled_sessions')
    .select(`
      id, scheduled_time, scheduled_date, session_type, status,
      google_meet_link, child_id, session_number, duration_minutes,
      children!scheduled_sessions_child_id_fkey (child_name)
    `)
    .eq('coach_id', coachId)
    .eq('scheduled_date', todayIST)
    .in('status', ['scheduled', 'in_progress', 'completed'])
    .order('scheduled_time', { ascending: true });

  // Enrich with tuition data for tuition sessions
  const tuitionChildIds = (todaySessions || [])
    .filter(s => s.session_type === 'tuition')
    .map(s => s.child_id)
    .filter(Boolean) as string[];

  let tuitionMap = new Map<string, { rate: number; duration: number; sessionType: string; batchId: string | null }>();
  if (tuitionChildIds.length > 0) {
    const { data: tuitionRows } = await supabase
      .from('tuition_onboarding')
      .select('child_id, session_rate, session_duration_minutes')
      .in('child_id', tuitionChildIds)
      .eq('status', 'parent_completed');

    for (const t of tuitionRows || []) {
      if (!t.child_id) continue;
      tuitionMap.set(t.child_id, {
        rate: t.session_rate / 100,
        duration: t.session_duration_minutes ?? 60,
        sessionType: 'tuition',
        batchId: (t as any).batch_id ?? null,
      });
    }
  }

  const formattedSessions = (todaySessions || []).map(s => {
    const child = Array.isArray(s.children) ? (s.children as any)[0] : s.children;
    const tuition = s.child_id ? tuitionMap.get(s.child_id) : null;
    return {
      id: s.id,
      time: s.scheduled_time,
      sessionType: s.session_type,
      status: s.status,
      meetLink: s.google_meet_link,
      childId: s.child_id,
      childName: child?.child_name || 'Student',
      sessionNumber: s.session_number,
      durationMinutes: tuition?.duration || s.duration_minutes || 45,
      rateRupees: tuition?.rate || null,
      batchId: tuition?.batchId || null,
    };
  });

  // Group batch sessions by batchId for display
  const batchGroups = new Map<string, string[]>();
  for (const s of formattedSessions) {
    if (s.batchId && s.sessionType === 'tuition') {
      const existing = batchGroups.get(s.batchId) || [];
      existing.push(s.childName);
      batchGroups.set(s.batchId, existing);
    }
  }

  // 3. Stats
  const [
    { count: completedThisMonth },
    { count: upcomingCount },
    { data: tuitionStudents },
    { count: coachingStudents },
  ] = await Promise.all([
    supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('status', 'completed')
      .gte('scheduled_date', monthStart),
    supabase
      .from('scheduled_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('status', 'scheduled')
      .gt('scheduled_date', todayIST),
    supabase
      .from('tuition_onboarding')
      .select('child_id')
      .eq('coach_id', coachId)
      .eq('status', 'parent_completed'),
    supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .in('status', ['active', 'pending_start']),
  ]);

  const tuitionStudentCount = new Set((tuitionStudents || []).map(r => r.child_id)).size;
  const sessionsToday = formattedSessions.filter(s => s.status !== 'completed').length;

  // 4. Earnings this month (from coach_payouts — ACTUAL data)
  const { data: earningsRows } = await supabase
    .from('coach_payouts')
    .select('product_type, gross_amount, net_amount')
    .eq('coach_id', coachId)
    .in('status', ['scheduled', 'paid'])
    .gte('scheduled_date', monthStart);

  const earningsByProduct: Record<string, { amount: number; sessions: number }> = {};
  let earningsTotal = 0;
  for (const r of earningsRows || []) {
    const pt = (r as any).product_type || 'coaching';
    if (!earningsByProduct[pt]) earningsByProduct[pt] = { amount: 0, sessions: 0 };
    earningsByProduct[pt].amount += r.net_amount || 0;
    earningsByProduct[pt].sessions += 1;
    earningsTotal += r.net_amount || 0;
  }

  // Next payout date
  const { data: nextPayoutRow } = await supabase
    .from('coach_payouts')
    .select('scheduled_date')
    .eq('coach_id', coachId)
    .eq('status', 'scheduled')
    .gte('scheduled_date', todayIST)
    .order('scheduled_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  // 5. How I earn config
  const tuitionCoachPercent = getTuitionCoachPercent(coachGroup?.name ?? 'rising', config);
  const tuitionLeadPercent = config.tuition_lead_cost_percent;
  const coachingCoachPercent = coachGroup?.coach_cost_percent ?? 50;

  const howIEarn = {
    tuition: {
      coachPercent: tuitionCoachPercent,
      leadPercent: tuitionLeadPercent,
      platformPercent: 100 - tuitionCoachPercent - tuitionLeadPercent,
    },
    coaching: {
      coachPercent: coachingCoachPercent,
      leadPercent: 0,
      platformPercent: 100 - coachingCoachPercent,
    },
    workshop: {
      coachPercent: config.workshop_default_coach_percent,
      leadPercent: 0,
      platformPercent: 100 - config.workshop_default_coach_percent,
    },
    tierName,
  };

  // 6. Active tuition rates
  const { data: rateRows } = await supabase
    .from('tuition_onboarding')
    .select('session_rate, session_duration_minutes, child_name' as any)
    .eq('coach_id', coachId)
    .eq('status', 'parent_completed')
    .order('session_rate' as any, { ascending: true });

  const activeRates = (rateRows || []).map((r: any) => ({
    rateRupees: r.session_rate / 100,
    duration: r.session_duration_minutes ?? 60,
    childName: r.child_name,
    coachShare: Math.round((r.session_rate / 100) * tuitionCoachPercent / 100),
  }));

  // Deduplicate by rate + duration for display
  const uniqueRates = Array.from(
    new Map(activeRates.map(r => [`${r.rateRupees}-${r.duration}`, r])).values()
  );

  // 7. My students (compact)
  const { data: tuitionStudentRows } = await supabase
    .from('tuition_onboarding')
    .select('child_id, child_name, session_rate, session_duration_minutes, sessions_purchased' as any)
    .eq('coach_id', coachId)
    .eq('status', 'parent_completed');

  const { data: coachingEnrollments } = await supabase
    .from('enrollments')
    .select('child_id, sessions_purchased, sessions_completed, children!inner(child_name)')
    .eq('coach_id', coachId)
    .in('status', ['active', 'pending_start']);

  // Get completion counts for tuition students
  const allTuitionChildIds = (tuitionStudentRows || []).map((r: any) => r.child_id).filter(Boolean);
  let tuitionCompletionMap = new Map<string, number>();
  if (allTuitionChildIds.length > 0) {
    const { data: completionRows } = await supabase
      .from('scheduled_sessions')
      .select('child_id')
      .in('child_id', allTuitionChildIds)
      .eq('session_type', 'tuition')
      .eq('status', 'completed');

    for (const r of completionRows || []) {
      if (r.child_id) tuitionCompletionMap.set(r.child_id, (tuitionCompletionMap.get(r.child_id) || 0) + 1);
    }
  }

  const students = [
    ...(tuitionStudentRows || []).map((r: any) => ({
      childId: r.child_id,
      childName: r.child_name,
      product: 'tuition' as const,
      rate: r.session_rate / 100,
      duration: r.session_duration_minutes ?? 60,
      purchased: r.sessions_purchased ?? 0,
      completed: tuitionCompletionMap.get(r.child_id) || 0,
    })),
    ...(coachingEnrollments || []).map((e: any) => {
      const child = Array.isArray(e.children) ? e.children[0] : e.children;
      return {
        childId: e.child_id,
        childName: child?.child_name || 'Student',
        product: 'coaching' as const,
        rate: null,
        duration: null,
        purchased: e.sessions_purchased ?? 0,
        completed: e.sessions_completed ?? 0,
      };
    }),
  ];

  // 8. Pending actions
  const { count: capturesPending } = await supabase
    .from('scheduled_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('status', 'completed')
    .is('capture_id', null);

  return NextResponse.json({
    coach: { name: coach.name, tierName },
    todaySessions: formattedSessions,
    batchGroups: Object.fromEntries(batchGroups),
    stats: {
      sessionsToday,
      completedThisMonth: completedThisMonth || 0,
      upcoming: upcomingCount || 0,
      tuitionStudents: tuitionStudentCount,
      coachingStudents: coachingStudents || 0,
    },
    earnings: {
      total: earningsTotal,
      byProduct: earningsByProduct,
      nextPayoutDate: nextPayoutRow?.scheduled_date || null,
    },
    howIEarn,
    activeRates: uniqueRates,
    students,
    pendingActions: {
      captures: capturesPending || 0,
    },
  });
}, { auth: 'coach' });
