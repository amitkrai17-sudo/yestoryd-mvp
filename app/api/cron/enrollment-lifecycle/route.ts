// app/api/cron/enrollment-lifecycle/route.ts
// Cron job for automated enrollment lifecycle management
// Handles: delayed starts, pause endings, coach unavailability
// Configure in vercel.json: runs daily at 6 AM IST
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { qstash } from '@/lib/qstash';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types
interface LifecycleResult {
  action: string;
  enrollmentId: string;
  childName: string;
  success: boolean;
  error?: string;
  details?: any;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const results: LifecycleResult[] = [];

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting enrollment lifecycle cron...');

    // ============================================
    // 1. ACTIVATE DELAYED ENROLLMENTS
    // ============================================
    const delayedResults = await activateDelayedEnrollments();
    results.push(...delayedResults);

    // ============================================
    // 2. RESUME PAUSED ENROLLMENTS
    // ============================================
    const resumeResults = await resumePausedEnrollments();
    results.push(...resumeResults);

    // ============================================
    // 3. HANDLE COACH UNAVAILABILITY START
    // ============================================
    const unavailabilityResults = await handleCoachUnavailabilityStart();
    results.push(...unavailabilityResults);

    // ============================================
    // 4. HANDLE COACH UNAVAILABILITY END
    // ============================================
    const returnResults = await handleCoachUnavailabilityEnd();
    results.push(...returnResults);

    // ============================================
    // 5. SEND START REMINDERS (3 days before)
    // ============================================
    const reminderResults = await sendStartReminders();
    results.push(...reminderResults);

    // ============================================
    // 6. CHECK PROGRAM COMPLETIONS
    // ============================================
    const completionResults = await checkProgramCompletions();
    results.push(...completionResults);

    const duration = Date.now() - startTime;
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    };

    console.log(`✅ Lifecycle cron completed in ${duration}ms`, summary);

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      summary,
      results,
    });

  } catch (error: any) {
    console.error('❌ Lifecycle cron failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        results 
      },
      { status: 500 }
    );
  }
}

// ============================================
// TASK 1: Activate Delayed Enrollments
// ============================================
async function activateDelayedEnrollments(): Promise<LifecycleResult[]> {
  const results: LifecycleResult[] = [];

  try {
    // Find enrollments that paid but chose to start later
    const { data: pendingStarts, error } = await supabase
      .from('enrollments')
      .select(`
        id, child_id, parent_id, coach_id, requested_start_date,
        children (id, name),
        parents (id, name, email, phone),
        coaches (id, name, email)
      `)
      .eq('status', 'pending_start')
      .lte('requested_start_date', new Date().toISOString().split('T')[0]);

    if (error) throw error;

    for (const enrollment of pendingStarts || []) {
      try {
        const child = enrollment.children as any;
        const parent = enrollment.parents as any;
        const coach = enrollment.coaches as any;

        console.log(`🚀 Activating delayed enrollment: ${child?.name}`);

        // Update enrollment status
        const { error: updateError } = await supabase
          .from('enrollments')
          .update({
            status: 'active',
            actual_start_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id);

        if (updateError) throw updateError;

        // Queue session scheduling job
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yestoryd.com';
        await qstash.publishJSON({
          url: `${appUrl}/api/jobs/enrollment-complete`,
          body: {
            enrollmentId: enrollment.id,
            childId: child?.id,
            childName: child?.name,
            parentId: parent?.id,
            parentEmail: parent?.email,
            parentName: parent?.name,
            parentPhone: parent?.phone,
            coachId: coach?.id,
            coachEmail: coach?.email,
            coachName: coach?.name,
          },
          retries: 3,
        });

        // Log event
        await logEvent(enrollment.id, 'delayed_start_activated', {
          requested_date: enrollment.requested_start_date,
          activated_date: new Date().toISOString().split('T')[0],
        });

        results.push({
          action: 'activate_delayed',
          enrollmentId: enrollment.id,
          childName: child?.name || 'Unknown',
          success: true,
          details: { startDate: enrollment.requested_start_date },
        });

      } catch (err: any) {
        results.push({
          action: 'activate_delayed',
          enrollmentId: enrollment.id,
          childName: (enrollment.children as any)?.name || 'Unknown',
          success: false,
          error: err.message,
        });
      }
    }

  } catch (error: any) {
    console.error('Error in activateDelayedEnrollments:', error);
  }

  return results;
}

// ============================================
// TASK 2: Resume Paused Enrollments
// ============================================
async function resumePausedEnrollments(): Promise<LifecycleResult[]> {
  const results: LifecycleResult[] = [];

  try {
    // Find enrollments whose pause period has ended
    const { data: pausedEnrollments, error } = await supabase
      .from('enrollments')
      .select(`
        id, child_id, parent_id, coach_id, pause_start_date, pause_end_date, 
        sessions_remaining, original_end_date,
        children (id, name),
        parents (id, name, email, phone),
        coaches (id, name, email, is_available)
      `)
      .eq('is_paused', true)
      .lte('pause_end_date', new Date().toISOString().split('T')[0]);

    if (error) throw error;

    for (const enrollment of pausedEnrollments || []) {
      try {
        const child = enrollment.children as any;
        const parent = enrollment.parents as any;
        const coach = enrollment.coaches as any;

        console.log(`▶️ Resuming enrollment: ${child?.name}`);

        // Check if original coach is still available
        let finalCoachId = enrollment.coach_id;
        let coachChanged = false;

        if (!coach?.is_available) {
          // Auto-assign new coach
          const { data: newCoachId } = await supabase.rpc('get_best_available_coach', {
            p_exclude_coach_id: enrollment.coach_id,
          });

          if (newCoachId) {
            finalCoachId = newCoachId;
            coachChanged = true;
          }
        }

        // Calculate pause duration and extend end date
        const pauseDays = Math.ceil(
          (new Date(enrollment.pause_end_date!).getTime() - new Date(enrollment.pause_start_date!).getTime()) 
          / (1000 * 60 * 60 * 24)
        );

        const newEndDate = new Date(enrollment.original_end_date || new Date());
        newEndDate.setDate(newEndDate.getDate() + pauseDays);

        // Update enrollment
        const { error: updateError } = await supabase
          .from('enrollments')
          .update({
            is_paused: false,
            status: 'active',
            pause_start_date: null,
            pause_end_date: null,
            total_pause_days: (enrollment as any).total_pause_days + pauseDays,
            pause_count: ((enrollment as any).pause_count || 0) + 1,
            program_end: newEndDate.toISOString(),
            coach_id: finalCoachId,
            ...(coachChanged && { 
              original_coach_id: enrollment.coach_id,
              coach_assigned_by: 'auto',
            }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id);

        if (updateError) throw updateError;

        // Reschedule remaining sessions
        await rescheduleRemainingSessions(enrollment.id, enrollment.sessions_remaining || 0);

        // Log event
        await logEvent(enrollment.id, 'pause_ended', {
          pause_duration_days: pauseDays,
          coach_changed: coachChanged,
          new_end_date: newEndDate.toISOString().split('T')[0],
        });

        // TODO: Send WhatsApp notification
        // await sendWhatsApp(parent.phone, 'program_resumed', {...});

        results.push({
          action: 'resume_paused',
          enrollmentId: enrollment.id,
          childName: child?.name || 'Unknown',
          success: true,
          details: { pauseDays, coachChanged, newEndDate: newEndDate.toISOString().split('T')[0] },
        });

      } catch (err: any) {
        results.push({
          action: 'resume_paused',
          enrollmentId: enrollment.id,
          childName: (enrollment.children as any)?.name || 'Unknown',
          success: false,
          error: err.message,
        });
      }
    }

  } catch (error: any) {
    console.error('Error in resumePausedEnrollments:', error);
  }

  return results;
}

// ============================================
// TASK 3: Handle Coach Unavailability Start
// ============================================
async function handleCoachUnavailabilityStart(): Promise<LifecycleResult[]> {
  const results: LifecycleResult[] = [];

  try {
    // Find unavailability starting today
    const { data: unavailabilities, error } = await supabase
      .from('coach_availability')
      .select(`
        id, coach_id, type, start_date, end_date, reason, backup_coach_id, notify_parents,
        coaches (id, name, email)
      `)
      .eq('status', 'upcoming')
      .lte('start_date', new Date().toISOString().split('T')[0]);

    if (error) throw error;

    for (const unavail of unavailabilities || []) {
      try {
        const coach = unavail.coaches as any;
        const unavailDays = Math.ceil(
          (new Date(unavail.end_date).getTime() - new Date(unavail.start_date).getTime()) 
          / (1000 * 60 * 60 * 24)
        );

        console.log(`🚫 Processing coach unavailability: ${coach?.name} (${unavailDays} days)`);

        // Find affected sessions
        const { data: affectedSessions } = await supabase
          .from('scheduled_sessions')
          .select('id, enrollment_id, child_id, scheduled_date, google_event_id')
          .eq('coach_id', unavail.coach_id)
          .eq('status', 'scheduled')
          .gte('scheduled_date', unavail.start_date)
          .lte('scheduled_date', unavail.end_date);

        let resolutionType = 'reschedule';
        const affectedCount = affectedSessions?.length || 0;

        // Determine resolution based on duration
        if (unavailDays <= 7) {
          // Short absence: Reschedule sessions
          resolutionType = 'reschedule';
          // Sessions will be rescheduled when coach returns
        } else if (unavailDays <= 21) {
          // Medium absence: Assign backup coach temporarily
          resolutionType = 'backup_assigned';
          const backupCoachId = unavail.backup_coach_id || await getBackupCoach(unavail.coach_id);
          
          if (backupCoachId) {
            // Update affected sessions to backup coach
            await supabase
              .from('scheduled_sessions')
              .update({ 
                coach_id: backupCoachId,
                updated_at: new Date().toISOString(),
              })
              .in('id', (affectedSessions || []).map(s => s.id));
          }
        } else {
          // Long absence: Permanent reassignment
          resolutionType = 'permanent_reassign';
          // This requires more complex handling - notify admin
        }

        // Update unavailability status
        await supabase
          .from('coach_availability')
          .update({
            status: 'active',
            resolution_type: resolutionType,
            affected_sessions: affectedCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', unavail.id);

        results.push({
          action: 'coach_unavailability_start',
          enrollmentId: unavail.id,
          childName: `Coach: ${coach?.name}`,
          success: true,
          details: { 
            duration: unavailDays, 
            resolution: resolutionType, 
            affectedSessions: affectedCount 
          },
        });

      } catch (err: any) {
        results.push({
          action: 'coach_unavailability_start',
          enrollmentId: unavail.id,
          childName: 'Unknown Coach',
          success: false,
          error: err.message,
        });
      }
    }

  } catch (error: any) {
    console.error('Error in handleCoachUnavailabilityStart:', error);
  }

  return results;
}

// ============================================
// TASK 4: Handle Coach Unavailability End
// ============================================
async function handleCoachUnavailabilityEnd(): Promise<LifecycleResult[]> {
  const results: LifecycleResult[] = [];

  try {
    // Find unavailability ending today
    const { data: endingUnavailabilities, error } = await supabase
      .from('coach_availability')
      .select(`
        id, coach_id, resolution_type,
        coaches (id, name, email)
      `)
      .eq('status', 'active')
      .lte('end_date', new Date().toISOString().split('T')[0]);

    if (error) throw error;

    for (const unavail of endingUnavailabilities || []) {
      try {
        const coach = unavail.coaches as any;

        console.log(`✅ Coach returning: ${coach?.name}`);

        // Mark unavailability as completed
        await supabase
          .from('coach_availability')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', unavail.id);

        // If backup was assigned, transfer sessions back
        if (unavail.resolution_type === 'backup_assigned') {
          // Find sessions that were temporarily reassigned
          // and move them back to original coach
          // (This requires tracking original_coach_id on sessions)
        }

        results.push({
          action: 'coach_unavailability_end',
          enrollmentId: unavail.id,
          childName: `Coach: ${coach?.name}`,
          success: true,
        });

      } catch (err: any) {
        results.push({
          action: 'coach_unavailability_end',
          enrollmentId: unavail.id,
          childName: 'Unknown Coach',
          success: false,
          error: err.message,
        });
      }
    }

  } catch (error: any) {
    console.error('Error in handleCoachUnavailabilityEnd:', error);
  }

  return results;
}

// ============================================
// TASK 5: Send Start Reminders
// ============================================
async function sendStartReminders(): Promise<LifecycleResult[]> {
  const results: LifecycleResult[] = [];

  try {
    // Find enrollments starting in 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const targetDate = threeDaysFromNow.toISOString().split('T')[0];

    const { data: upcomingStarts, error } = await supabase
      .from('enrollments')
      .select(`
        id, requested_start_date,
        children (id, name),
        parents (id, name, email, phone),
        coaches (id, name)
      `)
      .eq('status', 'pending_start')
      .eq('requested_start_date', targetDate);

    if (error) throw error;

    for (const enrollment of upcomingStarts || []) {
      try {
        const child = enrollment.children as any;
        const parent = enrollment.parents as any;
        const coach = enrollment.coaches as any;

        console.log(`📢 Sending start reminder: ${child?.name}`);

        // TODO: Send WhatsApp reminder
        // await sendWhatsApp(parent.phone, 'start_reminder_3day', {
        //   childName: child.name,
        //   startDate: enrollment.requested_start_date,
        //   coachName: coach.name,
        // });

        await logEvent(enrollment.id, 'start_reminder_sent', {
          reminder_type: '3_day',
          start_date: enrollment.requested_start_date,
        });

        results.push({
          action: 'send_start_reminder',
          enrollmentId: enrollment.id,
          childName: child?.name || 'Unknown',
          success: true,
        });

      } catch (err: any) {
        results.push({
          action: 'send_start_reminder',
          enrollmentId: enrollment.id,
          childName: (enrollment.children as any)?.name || 'Unknown',
          success: false,
          error: err.message,
        });
      }
    }

  } catch (error: any) {
    console.error('Error in sendStartReminders:', error);
  }

  return results;
}

// ============================================
// TASK 6: Check Program Completions
// ============================================
async function checkProgramCompletions(): Promise<LifecycleResult[]> {
  const results: LifecycleResult[] = [];

  try {
    // Find enrollments with all sessions completed
    const { data: potentialCompletions, error } = await supabase
      .from('enrollments')
      .select(`
        id, sessions_completed, sessions_remaining,
        children (id, name),
        parents (id, name, email)
      `)
      .eq('status', 'active')
      .eq('sessions_remaining', 0);

    if (error) throw error;

    for (const enrollment of potentialCompletions || []) {
      try {
        const child = enrollment.children as any;

        console.log(`🎓 Program completed: ${child?.name}`);

        // Update status
        await supabase
          .from('enrollments')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollment.id);

        await logEvent(enrollment.id, 'program_completed', {
          sessions_completed: enrollment.sessions_completed,
        });

        // TODO: Send completion certificate
        // TODO: Send renewal offer

        results.push({
          action: 'program_completed',
          enrollmentId: enrollment.id,
          childName: child?.name || 'Unknown',
          success: true,
        });

      } catch (err: any) {
        results.push({
          action: 'program_completed',
          enrollmentId: enrollment.id,
          childName: (enrollment.children as any)?.name || 'Unknown',
          success: false,
          error: err.message,
        });
      }
    }

  } catch (error: any) {
    console.error('Error in checkProgramCompletions:', error);
  }

  return results;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function logEvent(enrollmentId: string, eventType: string, eventData: any) {
  try {
    await supabase.from('enrollment_events').insert({
      enrollment_id: enrollmentId,
      event_type: eventType,
      event_data: eventData,
      triggered_by: 'system',
    });
  } catch (error) {
    console.error('Failed to log event:', error);
  }
}

async function getBackupCoach(excludeCoachId: string): Promise<string | null> {
  const { data } = await supabase.rpc('get_best_available_coach', {
    p_exclude_coach_id: excludeCoachId,
  });
  return data;
}

async function rescheduleRemainingSessions(enrollmentId: string, remainingSessions: number) {
  // Get remaining scheduled sessions
  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .eq('status', 'scheduled')
    .order('scheduled_date', { ascending: true });

  if (!sessions || sessions.length === 0) return;

  // Reschedule starting from today
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Start tomorrow

  for (let i = 0; i < sessions.length; i++) {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + (i * 5)); // 5 days apart

    await supabase
      .from('scheduled_sessions')
      .update({
        scheduled_date: newDate.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessions[i].id);

    // TODO: Update Google Calendar event
    // await rescheduleEvent(sessions[i].google_event_id, newDate, sessions[i].duration_minutes);
  }
}
