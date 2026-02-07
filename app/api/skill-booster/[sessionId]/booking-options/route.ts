// ============================================================
// API: Get Booking Options for Remedial Session
// Location: /app/api/remedial/[sessionId]/booking-options/route.ts
// VERSION: FIXED v2 - Correct column names for coaches table
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadCoachConfig } from '@/lib/config/loader';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // 1. Get the remedial session
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id,
        child_id,
        coach_id,
        session_type,
        status,
        focus_area,
        coach_notes
      `)
      .eq('id', sessionId)
      .eq('session_type', 'remedial')
      .eq('status', 'pending_booking')
      .single();

    if (sessionError || !session) {
      console.error('Session not found:', sessionError);
      return NextResponse.json(
        { error: 'Remedial session not found or not available for booking' },
        { status: 404 }
      );
    }

    // 2. Get coach - FIXED: No calendar_id column, use correct status check
    let coach = null;

    if (session.coach_id) {
      // Try to get coach directly from session
      const { data: sessionCoach, error: coachError } = await supabase
        .from('coaches')
        .select('id, name, email, phone, photo_url, status, is_active')
        .eq('id', session.coach_id)
        .single();

      if (coachError) {
        console.error('Coach fetch error:', coachError);
      }

      // Check if coach is active (either status='active' OR is_active=true)
      if (sessionCoach && (sessionCoach.status === 'active' || sessionCoach.is_active === true)) {
        coach = sessionCoach;
      }
    }

    // Fallback: Get coach from enrollment
    if (!coach && session.child_id) {
      const { data: enrollment, error: enrollError } = await supabase
        .from('enrollments')
        .select('coach_id')
        .eq('child_id', session.child_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (enrollment?.coach_id) {
        const { data: enrollmentCoach } = await supabase
          .from('coaches')
          .select('id, name, email, phone, photo_url, status, is_active')
          .eq('id', enrollment.coach_id)
          .single();

        if (enrollmentCoach && (enrollmentCoach.status === 'active' || enrollmentCoach.is_active === true)) {
          coach = enrollmentCoach;

          // Update the session with the correct coach_id
          await supabase
            .from('scheduled_sessions')
            .update({ coach_id: coach.id })
            .eq('id', sessionId);
        }
      }
    }

    // Final fallback: Use default coach (from config)
    if (!coach) {
      const coachConfig = await loadCoachConfig();
      const { data: ruchaCoach } = await supabase
        .from('coaches')
        .select('id, name, email, phone, photo_url, status, is_active')
        .eq('id', coachConfig.defaultCoachId)
        .single();

      if (ruchaCoach) {
        coach = ruchaCoach;

        // Update the session with Rucha's coach_id
        await supabase
          .from('scheduled_sessions')
          .update({ coach_id: coach.id })
          .eq('id', sessionId);
      }
    }

    if (!coach) {
      console.error('No coach found for session:', sessionId);
      return NextResponse.json(
        { error: 'No coach available for this session' },
        { status: 404 }
      );
    }

    // 3. Get child info
    const { data: child } = await supabase
      .from('children')
      .select('id, name, child_name')
      .eq('id', session.child_id)
      .single();

    // 4. Get available slots from scheduling API (respects coach availability)
    let availableSlots: { date: string; time: string; datetime: string }[] = [];

    try {
      // Use internal fetch to scheduling/slots API
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      const slotsResponse = await fetch(
        `${baseUrl}/api/scheduling/slots?coachId=${coach.id}&days=7&sessionType=coaching`,
        { cache: 'no-store' }
      );

      if (slotsResponse.ok) {
        const slotsData = await slotsResponse.json();
        if (slotsData.success && slotsData.slots) {
          availableSlots = slotsData.slots
            .filter((s: any) => s.available)
            .map((s: any) => ({
              date: s.date,
              time: s.time,
              datetime: s.datetime,
            }));
        }
      }
    } catch (slotsErr) {
      console.error('Failed to fetch slots from API, using fallback:', slotsErr);
    }

    // Fallback: Generate default slots if API fails
    if (availableSlots.length === 0) {
      const now = new Date();
      for (let day = 1; day <= 7; day++) {
        const date = new Date(now);
        date.setDate(date.getDate() + day);
        if (date.getDay() === 0) continue; // Skip Sunday
        const dateStr = date.toISOString().split('T')[0];
        for (const hour of [9, 10, 11, 14, 15, 16, 17]) {
          const slotDate = new Date(date);
          slotDate.setHours(hour, 0, 0, 0);
          availableSlots.push({
            date: dateStr,
            time: `${hour.toString().padStart(2, '0')}:00`,
            datetime: slotDate.toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      session: {
        id: session.id,
        focus_area: session.focus_area,
        coach_notes: session.coach_notes,
      },
      coach: {
        id: coach.id,
        name: coach.name,
        photo_url: coach.photo_url,
      },
      child: {
        id: child?.id,
        name: child?.child_name || child?.name || 'Your Child',
      },
      availableSlots,
    });

  } catch (error: any) {
    console.error('Booking options API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking options' },
      { status: 500 }
    );
  }
}