// app/api/enrollment/pause/route.ts
// Parent self-service: Pause and resume program
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rescheduleEvent } from '@/lib/googleCalendar';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configuration
const MAX_PAUSE_DAYS_SINGLE = 30;  // Max days for a single pause
const MAX_PAUSE_DAYS_TOTAL = 45;   // Max total pause days across program
const MIN_NOTICE_HOURS = 48;       // Minimum notice before pause starts

// ============================================
// GET - Get pause status and limits
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enrollmentId = searchParams.get('enrollmentId');

    if (!enrollmentId) {
      return NextResponse.json({ error: 'Enrollment ID required' }, { status: 400 });
    }

    const { data: enrollment, error } = await supabase
      .from('enrollments')
      .select(`
        id, status, is_paused, pause_start_date, pause_end_date, 
        pause_reason, total_pause_days, pause_count, program_end,
        children (name)
      `)
      .eq('id', enrollmentId)
      .single();

    if (error || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const remainingPauseDays = MAX_PAUSE_DAYS_TOTAL - (enrollment.total_pause_days || 0);

    return NextResponse.json({
      success: true,
      data: {
        enrollmentId: enrollment.id,
        childName: (enrollment.children as any)?.name,
        status: enrollment.status,
        isPaused: enrollment.is_paused,
        currentPause: enrollment.is_paused ? {
          startDate: enrollment.pause_start_date,
          endDate: enrollment.pause_end_date,
          reason: enrollment.pause_reason,
        } : null,
        pauseStats: {
          totalPauseDaysUsed: enrollment.total_pause_days || 0,
          remainingPauseDays,
          maxSinglePause: Math.min(MAX_PAUSE_DAYS_SINGLE, remainingPauseDays),
          pauseCount: enrollment.pause_count || 0,
        },
        canPause: !enrollment.is_paused && remainingPauseDays > 0 && enrollment.status === 'active',
        programEndDate: enrollment.program_end,
      },
    });

  } catch (error: any) {
    console.error('Error getting pause status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// POST - Request pause or resume
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      enrollmentId, 
      action,           // 'pause' | 'resume' | 'early_resume'
      pauseStartDate,   // For pause
      pauseEndDate,     // For pause
      pauseReason,      // For pause: 'exams' | 'travel' | 'illness' | 'other'
    } = body;

    if (!enrollmentId || !action) {
      return NextResponse.json(
        { error: 'Enrollment ID and action required' }, 
        { status: 400 }
      );
    }

    // Get current enrollment
    const { data: enrollment, error: fetchError } = await supabase
      .from('enrollments')
      .select(`
        id, status, is_paused, total_pause_days, pause_count, 
        program_end, original_end_date, coach_id,
        pause_start_date, pause_end_date,
        children (id, name),
        parents (id, name, email, phone)
      `)
      .eq('id', enrollmentId)
      .single();

    if (fetchError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const child = enrollment.children as any;
    const parent = enrollment.parents as any;

    // ============================================
    // ACTION: PAUSE
    // ============================================
    if (action === 'pause') {
      // Validate pause request
      const validation = validatePauseRequest(enrollment, pauseStartDate, pauseEndDate);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const pauseDays = Math.ceil(
        (new Date(pauseEndDate).getTime() - new Date(pauseStartDate).getTime()) 
        / (1000 * 60 * 60 * 24)
      );

      // Calculate new end date
      const currentEndDate = new Date(enrollment.program_end);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + pauseDays);

      // Get sessions that will be affected
      const { data: affectedSessions } = await supabase
        .from('scheduled_sessions')
        .select('id, google_event_id, scheduled_date')
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'scheduled')
        .gte('scheduled_date', pauseStartDate)
        .lte('scheduled_date', pauseEndDate);

      // Update enrollment
      const { error: updateError } = await supabase
        .from('enrollments')
        .update({
          is_paused: true,
          pause_start_date: pauseStartDate,
          pause_end_date: pauseEndDate,
          pause_reason: pauseReason,
          original_end_date: enrollment.original_end_date || enrollment.program_end,
          program_end: newEndDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);

      if (updateError) throw updateError;

      // Cancel/reschedule affected calendar events
      const sessionResults = [];
      for (const session of affectedSessions || []) {
        if (session.google_event_id) {
          // Calculate new date after pause ends
          const originalDate = new Date(session.scheduled_date);
          const daysFromPauseStart = Math.ceil(
            (originalDate.getTime() - new Date(pauseStartDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          const newSessionDate = new Date(pauseEndDate);
          newSessionDate.setDate(newSessionDate.getDate() + daysFromPauseStart + 1);

          // Update session in database
          await supabase
            .from('scheduled_sessions')
            .update({
              scheduled_date: newSessionDate.toISOString().split('T')[0],
              status: 'rescheduled_pause',
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.id);

          // Reschedule Google Calendar event
          try {
            await rescheduleEvent(session.google_event_id, newSessionDate, 45);
            sessionResults.push({ id: session.id, success: true });
          } catch (calError) {
            sessionResults.push({ id: session.id, success: false, error: (calError as Error).message });
          }
        }
      }

      // Log event
      await logEnrollmentEvent(enrollmentId, 'pause_requested', {
        start_date: pauseStartDate,
        end_date: pauseEndDate,
        reason: pauseReason,
        pause_days: pauseDays,
        new_end_date: newEndDate.toISOString().split('T')[0],
        affected_sessions: affectedSessions?.length || 0,
      }, 'parent');

      // TODO: Send WhatsApp confirmation
      // await sendWhatsApp(parent.phone, 'pause_confirmed', {...});

      return NextResponse.json({
        success: true,
        message: 'Program paused successfully',
        data: {
          pauseStart: pauseStartDate,
          pauseEnd: pauseEndDate,
          pauseDays,
          newProgramEnd: newEndDate.toISOString().split('T')[0],
          sessionsRescheduled: sessionResults.filter(r => r.success).length,
          sessionsFailed: sessionResults.filter(r => !r.success).length,
        },
      });
    }

    // ============================================
    // ACTION: RESUME (Early Resume)
    // ============================================
    if (action === 'resume' || action === 'early_resume') {
      if (!enrollment.is_paused) {
        return NextResponse.json({ error: 'Enrollment is not paused' }, { status: 400 });
      }

      // Calculate actual pause duration
      const pauseStart = new Date(enrollment.pause_start_date!);
      const actualPauseEnd = new Date(); // Resume today
      const actualPauseDays = Math.ceil(
        (actualPauseEnd.getTime() - pauseStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Recalculate end date based on actual pause duration
      const originalEnd = new Date(enrollment.original_end_date || enrollment.program_end);
      const newEndDate = new Date(originalEnd);
      newEndDate.setDate(newEndDate.getDate() + actualPauseDays);

      // Update enrollment
      const { error: updateError } = await supabase
        .from('enrollments')
        .update({
          is_paused: false,
          status: 'active',
          pause_start_date: null,
          pause_end_date: null,
          total_pause_days: (enrollment.total_pause_days || 0) + actualPauseDays,
          pause_count: (enrollment.pause_count || 0) + 1,
          program_end: newEndDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', enrollmentId);

      if (updateError) throw updateError;

      // Reschedule remaining sessions
      const { data: pendingSessions } = await supabase
        .from('scheduled_sessions')
        .select('id, google_event_id, session_number')
        .eq('enrollment_id', enrollmentId)
        .in('status', ['scheduled', 'rescheduled_pause'])
        .order('session_number', { ascending: true });

      // Reschedule from tomorrow
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);

      for (let i = 0; i < (pendingSessions?.length || 0); i++) {
        const session = pendingSessions![i];
        const newDate = new Date(startDate);
        newDate.setDate(newDate.getDate() + (i * 5)); // 5 days apart

        await supabase
          .from('scheduled_sessions')
          .update({
            scheduled_date: newDate.toISOString().split('T')[0],
            status: 'scheduled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        if (session.google_event_id) {
          try {
            await rescheduleEvent(session.google_event_id, newDate, 45);
          } catch (calError) {
            console.error('Failed to reschedule calendar event:', calError);
          }
        }
      }

      // Log event
      await logEnrollmentEvent(enrollmentId, 'pause_ended', {
        original_pause_end: enrollment.pause_end_date,
        actual_pause_end: actualPauseEnd.toISOString().split('T')[0],
        actual_pause_days: actualPauseDays,
        early_resume: action === 'early_resume',
        new_end_date: newEndDate.toISOString().split('T')[0],
      }, 'parent');

      // TODO: Send WhatsApp notification
      // await sendWhatsApp(parent.phone, 'program_resumed', {...});

      return NextResponse.json({
        success: true,
        message: 'Program resumed successfully',
        data: {
          actualPauseDays,
          newProgramEnd: newEndDate.toISOString().split('T')[0],
          sessionsRescheduled: pendingSessions?.length || 0,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('Error processing pause/resume:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function validatePauseRequest(
  enrollment: any, 
  pauseStartDate: string, 
  pauseEndDate: string
): { valid: boolean; error?: string } {
  
  // Check if already paused
  if (enrollment.is_paused) {
    return { valid: false, error: 'Program is already paused' };
  }

  // Check if active
  if (enrollment.status !== 'active') {
    return { valid: false, error: 'Only active enrollments can be paused' };
  }

  // Validate dates
  if (!pauseStartDate || !pauseEndDate) {
    return { valid: false, error: 'Start and end dates are required' };
  }

  const start = new Date(pauseStartDate);
  const end = new Date(pauseEndDate);
  const now = new Date();

  // Check minimum notice
  const hoursUntilStart = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilStart < MIN_NOTICE_HOURS) {
    return { valid: false, error: `Pause must be requested at least ${MIN_NOTICE_HOURS} hours in advance` };
  }

  // Check date order
  if (end <= start) {
    return { valid: false, error: 'End date must be after start date' };
  }

  // Check pause duration
  const pauseDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (pauseDays > MAX_PAUSE_DAYS_SINGLE) {
    return { valid: false, error: `Maximum pause duration is ${MAX_PAUSE_DAYS_SINGLE} days` };
  }

  // Check total pause days
  const remainingPauseDays = MAX_PAUSE_DAYS_TOTAL - (enrollment.total_pause_days || 0);
  if (pauseDays > remainingPauseDays) {
    return { valid: false, error: `Only ${remainingPauseDays} pause days remaining` };
  }

  return { valid: true };
}

async function logEnrollmentEvent(
  enrollmentId: string, 
  eventType: string, 
  eventData: any, 
  triggeredBy: string = 'system'
) {
  try {
    await supabase.from('enrollment_events').insert({
      enrollment_id: enrollmentId,
      event_type: eventType,
      event_data: eventData,
      triggered_by: triggeredBy,
    });
  } catch (error) {
    console.error('Failed to log enrollment event:', error);
  }
}