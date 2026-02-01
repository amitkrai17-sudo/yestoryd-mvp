/**
 * Test endpoint for scheduling engine
 * GET /api/test/scheduling - Run tests
 * POST /api/test/scheduling - Simulate enrollment scheduling (dry run)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getPlanSchedule, DEFAULT_PLAN_SCHEDULES } from '@/lib/scheduling/config';

export async function GET() {
  const results: {
    timestamp: string;
    tests: Array<{
      name: string;
      status: 'PASS' | 'FAIL' | 'WARN';
      details: Record<string, unknown>;
    }>;
    overall?: string;
  } = {
    timestamp: new Date().toISOString(),
    tests: [],
  };

  // Test 1: Pricing Plans
  const { data: plans } = await supabaseAdmin
    .from('pricing_plans')
    .select('slug, name, sessions_coaching, sessions_checkin, sessions_skill_building, duration_coaching_mins, duration_checkin_mins, duration_weeks, coaching_week_schedule, checkin_week_schedule')
    .in('slug', ['starter', 'continuation', 'full'])
    .order('duration_weeks');

  const starterPlan = plans?.find(p => p.slug === 'starter');
  const starterValid = starterPlan &&
    starterPlan.sessions_coaching === 2 &&
    starterPlan.sessions_checkin === 1 &&
    starterPlan.duration_checkin_mins === 45;

  results.tests.push({
    name: 'Pricing Plans Configuration',
    status: starterValid ? 'PASS' : 'FAIL',
    details: {
      plans: plans?.map(p => ({
        slug: p.slug,
        coaching: `${p.sessions_coaching} sessions`,
        checkin: `${p.sessions_checkin} sessions`,
        duration_checkin: `${p.duration_checkin_mins} mins`,
        coaching_weeks: p.coaching_week_schedule,
        checkin_weeks: p.checkin_week_schedule,
      })),
    },
  });

  // Test 2: Active Coaches with Rules
  const { data: coaches } = await supabaseAdmin
    .from('coaches')
    .select('id, name, status')
    .eq('status', 'active');

  // Fetch rules for each coach separately
  const coachesWithRulesCount: Array<{ name: string; rules: number }> = [];
  let coachesWithRulesTotal = 0;

  for (const coach of coaches || []) {
    const { data: rules } = await supabaseAdmin
      .from('coach_schedule_rules')
      .select('id')
      .eq('coach_id', coach.id)
      .eq('is_active', true);

    const ruleCount = rules?.length || 0;
    coachesWithRulesCount.push({ name: coach.name, rules: ruleCount });
    if (ruleCount > 0) coachesWithRulesTotal++;
  }

  results.tests.push({
    name: 'Coach Availability Rules',
    status: coachesWithRulesTotal > 0 ? 'PASS' : 'WARN',
    details: {
      totalActiveCoaches: coaches?.length || 0,
      coachesWithRules: coachesWithRulesTotal,
      coaches: coachesWithRulesCount,
    },
  });

  // Test 3: Enrollment Preference Columns
  const { error: prefError } = await supabaseAdmin
    .from('enrollments')
    .select('preference_time_bucket, preference_days')
    .limit(1);

  results.tests.push({
    name: 'Enrollment Preference Columns',
    status: !prefError ? 'PASS' : 'FAIL',
    details: prefError ? { error: prefError.message } : { columns: ['preference_time_bucket', 'preference_days', 'preference_start_type', 'preference_start_date'] },
  });

  // Test 4: Scheduled Sessions slot_match_type
  const { error: matchError } = await supabaseAdmin
    .from('scheduled_sessions')
    .select('slot_match_type')
    .limit(1);

  results.tests.push({
    name: 'Scheduled Sessions slot_match_type',
    status: !matchError ? 'PASS' : 'FAIL',
    details: matchError ? { error: matchError.message } : { column: 'slot_match_type exists' },
  });

  // Test 5: Scheduling Config
  const planSchedule = await getPlanSchedule('starter');

  results.tests.push({
    name: 'Scheduling Config Library',
    status: planSchedule ? 'PASS' : 'FAIL',
    details: planSchedule
      ? {
          slug: planSchedule.slug,
          durationWeeks: planSchedule.durationWeeks,
          coachingCount: planSchedule.coaching.count,
          checkinCount: planSchedule.checkin.count,
        }
      : { error: 'Could not load plan schedule' },
  });

  // Test 6: Default Plan Schedules
  results.tests.push({
    name: 'Default Plan Schedules',
    status: DEFAULT_PLAN_SCHEDULES.starter ? 'PASS' : 'FAIL',
    details: {
      availablePlans: Object.keys(DEFAULT_PLAN_SCHEDULES),
      starterSchedule: DEFAULT_PLAN_SCHEDULES.starter ? {
        coachingWeeks: DEFAULT_PLAN_SCHEDULES.starter.coaching.weekSchedule,
        checkinWeeks: DEFAULT_PLAN_SCHEDULES.starter.checkin.weekSchedule,
      } : null,
    },
  });

  // Overall status
  const allPassed = results.tests.every((t) => t.status === 'PASS');
  const hasWarnings = results.tests.some((t) => t.status === 'WARN');

  results.overall = allPassed ? 'ALL TESTS PASSED' : hasWarnings ? 'PASSED WITH WARNINGS' : 'SOME TESTS FAILED';

  return NextResponse.json(results, { status: 200 });
}

export async function POST(request: Request) {
  // Simulate scheduling without creating real records
  const body = await request.json();
  const { planSlug = 'starter', preferences = {} } = body;

  // Get plan
  const { data: plan } = await supabaseAdmin
    .from('pricing_plans')
    .select('*')
    .eq('slug', planSlug)
    .single();

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  // Get a coach
  const { data: coach } = await supabaseAdmin
    .from('coaches')
    .select('id, name')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (!coach) {
    return NextResponse.json({ error: 'No active coach found' }, { status: 404 });
  }

  // Calculate session dates
  const coachingWeeks = (plan.coaching_week_schedule as number[]) || [1, 2];
  const checkinWeeks = (plan.checkin_week_schedule as number[]) || [4];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 2); // 2 days from now

  const sessions: Array<{
    session_number: number;
    session_type: string;
    week_number: number;
    target_date: string;
    duration_minutes: number;
    status: string;
  }> = [];

  // Coaching sessions
  coachingWeeks.forEach((week: number, idx: number) => {
    const sessionDate = new Date(startDate);
    sessionDate.setDate(sessionDate.getDate() + (week - 1) * 7);

    sessions.push({
      session_number: idx + 1,
      session_type: 'coaching',
      week_number: week,
      target_date: sessionDate.toISOString().split('T')[0],
      duration_minutes: plan.duration_coaching_mins || 45,
      status: 'would_be_scheduled',
    });
  });

  // Check-in sessions
  checkinWeeks.forEach((week: number, idx: number) => {
    const sessionDate = new Date(startDate);
    sessionDate.setDate(sessionDate.getDate() + (week - 1) * 7);

    sessions.push({
      session_number: coachingWeeks.length + idx + 1,
      session_type: 'parent_checkin',
      week_number: week,
      target_date: sessionDate.toISOString().split('T')[0],
      duration_minutes: plan.duration_checkin_mins || 45,
      status: 'would_be_scheduled',
    });
  });

  // Sort by week
  sessions.sort((a, b) => a.week_number - b.week_number);

  return NextResponse.json({
    simulation: true,
    message: 'This is a dry run - no sessions were actually created',
    plan: {
      slug: plan.slug,
      name: plan.name,
      duration_weeks: plan.duration_weeks,
    },
    coach: {
      id: coach.id,
      name: coach.name,
    },
    preferences: {
      time_bucket: preferences.timeBucket || 'evening',
      preferred_days: preferences.preferredDays || [],
      start_type: preferences.startType || 'immediate',
    },
    sessions_to_create: sessions,
    total_sessions: sessions.length,
  });
}
