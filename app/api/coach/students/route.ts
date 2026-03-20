// app/api/coach/students/route.ts
// Coach Students API — returns all children assigned to this coach
// Supports both coaching and tuition enrollment types

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrCoach } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase configuration');
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized || !auth.coachId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const coachId = auth.coachId;
    const supabase = getSupabase();

    // 1. Get all enrollments for this coach with child data
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        enrollment_type,
        billing_model,
        session_rate,
        sessions_purchased,
        sessions_remaining,
        sessions_scheduled,
        sessions_completed,
        total_sessions,
        age_band,
        lead_source,
        is_paused,
        session_duration_minutes,
        child_id,
        children (
          id,
          child_name,
          age,
          parent_name,
          parent_phone,
          parent_email,
          latest_assessment_score,
          learning_profile
        )
      `)
      .eq('coach_id', coachId)
      .in('status', ['active', 'pending_start', 'completed', 'paused'])
      .order('created_at', { ascending: false });

    if (enrollError) {
      console.error('[coach-students] Enrollment fetch error:', enrollError.message);
      return NextResponse.json({ error: 'Failed to load students' }, { status: 500 });
    }

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ students: [] });
    }

    // 2. Batch-fetch age_band_config for coaching session totals
    const bandIds = Array.from(
      new Set(enrollments.map(e => e.age_band).filter(Boolean))
    );
    const bandMap = new Map<string, number>();
    if (bandIds.length > 0) {
      const { data: bands } = await supabase
        .from('age_band_config')
        .select('id, sessions_per_season')
        .in('id', bandIds);
      bands?.forEach(b => bandMap.set(b.id, b.sessions_per_season));
    }

    // 3. Get all enrollment IDs for session queries
    const enrollmentIds = enrollments.map(e => e.id);

    // 4. Batch: last completed session per enrollment
    const { data: lastSessions } = await supabase
      .from('scheduled_sessions')
      .select('enrollment_id, scheduled_date, session_title')
      .in('enrollment_id', enrollmentIds)
      .eq('status', 'completed')
      .order('scheduled_date', { ascending: false });

    const lastSessionMap = new Map<string, { date: string; focus: string | null }>();
    for (const s of lastSessions || []) {
      if (s.enrollment_id && !lastSessionMap.has(s.enrollment_id)) {
        lastSessionMap.set(s.enrollment_id, {
          date: s.scheduled_date,
          focus: s.session_title,
        });
      }
    }

    // 5. Batch: next scheduled session per enrollment
    const today = new Date().toISOString().split('T')[0];
    const { data: nextSessions } = await supabase
      .from('scheduled_sessions')
      .select('enrollment_id, scheduled_date, scheduled_time')
      .in('enrollment_id', enrollmentIds)
      .in('status', ['scheduled', 'confirmed'])
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    const nextSessionMap = new Map<string, { date: string; time: string }>();
    for (const s of nextSessions || []) {
      if (s.enrollment_id && !nextSessionMap.has(s.enrollment_id)) {
        nextSessionMap.set(s.enrollment_id, {
          date: s.scheduled_date,
          time: s.scheduled_time,
        });
      }
    }

    // 6. Batch: completed session counts per enrollment
    const { data: completedCounts } = await supabase
      .from('scheduled_sessions')
      .select('enrollment_id')
      .in('enrollment_id', enrollmentIds)
      .eq('status', 'completed');

    const completedMap = new Map<string, number>();
    for (const s of completedCounts || []) {
      if (s.enrollment_id) {
        completedMap.set(s.enrollment_id, (completedMap.get(s.enrollment_id) || 0) + 1);
      }
    }

    // 7. Batch: tuition_onboarding for tuition enrollments
    const tuitionEnrollmentIds = enrollments
      .filter(e => e.enrollment_type === 'tuition')
      .map(e => e.id);

    const onboardingMap = new Map<string, {
      schedule_preference: string | null;
      default_session_mode: string | null;
      session_duration_minutes: number | null;
    }>();

    if (tuitionEnrollmentIds.length > 0) {
      const { data: onboardings } = await supabase
        .from('tuition_onboarding')
        .select('enrollment_id, schedule_preference, default_session_mode, session_duration_minutes')
        .in('enrollment_id', tuitionEnrollmentIds);

      for (const ob of onboardings || []) {
        if (ob.enrollment_id) {
          onboardingMap.set(ob.enrollment_id, {
            schedule_preference: ob.schedule_preference,
            default_session_mode: ob.default_session_mode,
            session_duration_minutes: ob.session_duration_minutes,
          });
        }
      }
    }

    // 8. Build student response
    const students = enrollments
      .map(enrollment => {
        const child = enrollment.children as any;
        if (!child) return null;

        const enrollmentType = enrollment.enrollment_type || 'coaching';
        const isTuition = enrollmentType === 'tuition';

        const sessionsCompleted = completedMap.get(enrollment.id) || 0;
        const ageBand = enrollment.age_band;
        const bandSessions = ageBand ? bandMap.get(ageBand) : undefined;
        const totalSessions = isTuition
          ? (enrollment.sessions_purchased || 0)
          : (enrollment.total_sessions || enrollment.sessions_scheduled || bandSessions || 0);

        const profile = child.learning_profile;
        const lastSession = lastSessionMap.get(enrollment.id);
        const nextSession = nextSessionMap.get(enrollment.id);
        const onboarding = onboardingMap.get(enrollment.id);

        // Derive status
        let displayStatus: string;
        if (enrollment.is_paused) {
          displayStatus = 'paused';
        } else if (enrollment.status === 'pending_start') {
          displayStatus = 'active';
        } else {
          displayStatus = enrollment.status || 'active';
        }

        // For tuition: payment_pending if sessions_remaining === 0 and active
        if (isTuition && (enrollment.sessions_remaining ?? 0) <= 0 && displayStatus === 'active') {
          displayStatus = 'payment_pending';
        }

        return {
          // Child info
          child_id: child.id,
          child_name: child.child_name,
          age: child.age,
          parent_name: child.parent_name,
          parent_phone: child.parent_phone,
          parent_email: child.parent_email,

          // Enrollment info
          enrollment_id: enrollment.id,
          enrollment_type: enrollmentType,
          status: displayStatus,
          age_band: ageBand,
          billing_model: enrollment.billing_model,
          is_coach_lead: enrollment.lead_source === 'coach',

          // Session progress
          sessions_completed: sessionsCompleted,
          total_sessions: totalSessions,

          // Tuition-specific
          session_rate: isTuition ? enrollment.session_rate : null,
          sessions_remaining: isTuition ? (enrollment.sessions_remaining ?? 0) : null,
          sessions_purchased: isTuition ? (enrollment.sessions_purchased ?? 0) : null,
          schedule_preference: isTuition ? (onboarding?.schedule_preference || null) : null,
          default_session_mode: isTuition ? (onboarding?.default_session_mode || 'offline') : null,
          default_duration_minutes: isTuition
            ? (onboarding?.session_duration_minutes || enrollment.session_duration_minutes || 45)
            : null,

          // Coaching-specific
          assessment_score: child.latest_assessment_score,
          focus_areas: profile?.recommended_focus_next_session || null,
          trend: profile?.reading_level?.trend || null,

          // Session dates
          last_session_date: lastSession?.date || null,
          last_session_focus: lastSession?.focus || null,
          next_session_date: nextSession?.date || null,
          next_session_time: nextSession?.time || null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ students });
  } catch (error: any) {
    console.error('[coach-students] Error:', error.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
