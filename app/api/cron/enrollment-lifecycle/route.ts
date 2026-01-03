// app/api/cron/enrollment-lifecycle/route.ts
// Cron job for automated enrollment lifecycle management
// Handles: delayed starts, pause endings, coach unavailability, COMPLETION ALERTS
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

interface CompletionAlert {
  id: string;
  childName: string;
  parentName: string;
  parentEmail: string;
  coachName: string;
  sessionsCompleted: number;
  programEnd: string;
  daysRemaining: number;
  riskLevel: string;
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
    // 6. COMPLETION MANAGEMENT & ALERTS (NEW)
    // ============================================
    const completionResults = await runCompletionAlerts();
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
          resolutionType = 'reschedule';
        } else if (unavailDays <= 21) {
          resolutionType = 'backup_assigned';
          const backupCoachId = unavail.backup_coach_id || await getBackupCoach(unavail.coach_id);

          if (backupCoachId) {
            await supabase
              .from('scheduled_sessions')
              .update({
                coach_id: backupCoachId,
                updated_at: new Date().toISOString(),
              })
              .in('id', (affectedSessions || []).map(s => s.id));
          }
        } else {
          resolutionType = 'permanent_reassign';
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

        await supabase
          .from('coach_availability')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', unavail.id);

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

        console.log(`📢 Sending start reminder: ${child?.name}`);

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
// TASK 6: COMPLETION ALERTS & RISK MANAGEMENT (NEW)
// ============================================
async function runCompletionAlerts(): Promise<LifecycleResult[]> {
  const results: LifecycleResult[] = [];
  const today = new Date();

  try {
    console.log('📊 Running completion alerts...');

    // Get all active enrollments
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        program_start,
        program_end,
        risk_level,
        child_id,
        parent_id,
        coach_id,
        children!child_id (
          id,
          name,
          child_name,
          parent_email,
          parent_name,
          parent_phone
        ),
        parents!parent_id (
          id,
          name,
          email,
          phone
        ),
        coaches!coach_id (
          id,
          name,
          email
        )
      `)
      .in('status', ['active', 'pending_start'])
      .order('program_end', { ascending: true });

    if (error) throw error;

    const alerts: {
      overdue: CompletionAlert[];
      atRisk: CompletionAlert[];
      inactive: CompletionAlert[];
      ready: CompletionAlert[];
    } = {
      overdue: [],
      atRisk: [],
      inactive: [],
      ready: [],
    };

    // Process each enrollment
    for (const enrollment of enrollments || []) {
      try {
        // Count completed sessions
        const { count: sessionsCompleted } = await supabase
          .from('scheduled_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('child_id', enrollment.child_id)
          .eq('status', 'completed');

        // Get last session date
        const { data: lastSession } = await supabase
          .from('scheduled_sessions')
          .select('completed_at')
          .eq('child_id', enrollment.child_id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .single();

        const completed = sessionsCompleted || 0;
        const programEnd = new Date(enrollment.program_end);
        const daysRemaining = Math.ceil((programEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const lastSessionDate = lastSession?.completed_at ? new Date(lastSession.completed_at) : null;
        const daysSinceLastSession = lastSessionDate
          ? Math.ceil((today.getTime() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const childName = (enrollment.children as any)?.name || (enrollment.children as any)?.child_name || 'Unknown';
        const parentName = (enrollment.parents as any)?.name || (enrollment.children as any)?.parent_name || 'Parent';
        const parentEmail = (enrollment.parents as any)?.email || (enrollment.children as any)?.parent_email || '';
        const coachName = (enrollment.coaches as any)?.name || 'Unassigned';

        const alertData: CompletionAlert = {
          id: enrollment.id,
          childName,
          parentName,
          parentEmail,
          coachName,
          sessionsCompleted: completed,
          programEnd: enrollment.program_end,
          daysRemaining,
          riskLevel: 'on_track',
        };

        // Determine risk level
        let newRiskLevel = 'active';

        if (completed >= 9) {
          newRiskLevel = 'ready';
          alerts.ready.push({ ...alertData, riskLevel: 'ready' });
        } else if (daysRemaining < 0) {
          newRiskLevel = 'overdue';
          alerts.overdue.push({ ...alertData, riskLevel: 'overdue' });
        } else if (daysRemaining <= 7) {
          newRiskLevel = 'at_risk';
          alerts.atRisk.push({ ...alertData, riskLevel: 'at_risk' });
        } else if (daysSinceLastSession && daysSinceLastSession >= 14) {
          newRiskLevel = 'inactive';
          alerts.inactive.push({ ...alertData, riskLevel: 'inactive' });
        } else if (completed >= 6) {
          newRiskLevel = 'on_track';
        }

        // Update risk level in database if changed
        if (newRiskLevel !== enrollment.risk_level) {
          await supabase
            .from('enrollments')
            .update({
              risk_level: newRiskLevel,
              updated_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id);

          results.push({
            action: 'risk_level_updated',
            enrollmentId: enrollment.id,
            childName,
            success: true,
            details: { oldRisk: enrollment.risk_level, newRisk: newRiskLevel },
          });
        }

      } catch (err: any) {
        results.push({
          action: 'risk_check',
          enrollmentId: enrollment.id,
          childName: 'Unknown',
          success: false,
          error: err.message,
        });
      }
    }

    // Send admin alert if there are issues
    const hasAlerts = alerts.overdue.length > 0 || alerts.atRisk.length > 0 || alerts.inactive.length > 0;

    if (hasAlerts) {
      await sendCompletionAdminAlert(alerts);
      results.push({
        action: 'admin_alert_sent',
        enrollmentId: 'batch',
        childName: `${alerts.overdue.length} overdue, ${alerts.atRisk.length} at risk, ${alerts.inactive.length} inactive`,
        success: true,
      });
    }

    // Send parent reminders for "ready" enrollments waiting on final assessment
    for (const readyEnrollment of alerts.ready) {
      const reminded = await checkAndSendFinalAssessmentReminder(readyEnrollment);
      if (reminded) {
        results.push({
          action: 'final_assessment_reminder',
          enrollmentId: readyEnrollment.id,
          childName: readyEnrollment.childName,
          success: true,
        });
      }
    }

    console.log(`📊 Completion alerts: ${alerts.overdue.length} overdue, ${alerts.atRisk.length} at risk, ${alerts.inactive.length} inactive, ${alerts.ready.length} ready`);

  } catch (error: any) {
    console.error('Error in runCompletionAlerts:', error);
    results.push({
      action: 'completion_alerts',
      enrollmentId: 'batch',
      childName: 'Error',
      success: false,
      error: error.message,
    });
  }

  return results;
}

// Send consolidated alert to admin
async function sendCompletionAdminAlert(alerts: {
  overdue: CompletionAlert[];
  atRisk: CompletionAlert[];
  inactive: CompletionAlert[];
  ready: CompletionAlert[];
}) {
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const overdueList = alerts.overdue.map(a =>
      `• ${a.childName} (${a.sessionsCompleted}/9 sessions, ${Math.abs(a.daysRemaining)} days overdue)`
    ).join('\n');

    const atRiskList = alerts.atRisk.map(a =>
      `• ${a.childName} (${a.sessionsCompleted}/9 sessions, ${a.daysRemaining} days left)`
    ).join('\n');

    const inactiveList = alerts.inactive.map(a =>
      `• ${a.childName} (${a.sessionsCompleted}/9 sessions, Coach: ${a.coachName})`
    ).join('\n');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1F2937;">📊 Daily Completion Alerts</h2>
        <p style="color: #6B7280;">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        
        ${alerts.overdue.length > 0 ? `
          <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <h3 style="color: #DC2626; margin: 0 0 10px;">🔴 Overdue (${alerts.overdue.length})</h3>
            <pre style="margin: 0; font-family: inherit; white-space: pre-wrap;">${overdueList}</pre>
          </div>
        ` : ''}
        
        ${alerts.atRisk.length > 0 ? `
          <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <h3 style="color: #D97706; margin: 0 0 10px;">🟠 At Risk - Ending Soon (${alerts.atRisk.length})</h3>
            <pre style="margin: 0; font-family: inherit; white-space: pre-wrap;">${atRiskList}</pre>
          </div>
        ` : ''}
        
        ${alerts.inactive.length > 0 ? `
          <div style="background: #FEF9C3; border-left: 4px solid #EAB308; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <h3 style="color: #CA8A04; margin: 0 0 10px;">🟡 Inactive 14+ Days (${alerts.inactive.length})</h3>
            <pre style="margin: 0; font-family: inherit; white-space: pre-wrap;">${inactiveList}</pre>
          </div>
        ` : ''}
        
        ${alerts.ready.length > 0 ? `
          <div style="background: #DBEAFE; border-left: 4px solid #3B82F6; padding: 15px; margin: 15px 0; border-radius: 4px;">
            <h3 style="color: #2563EB; margin: 0 0 10px;">🔵 Ready to Complete (${alerts.ready.length})</h3>
            <p style="margin: 0;">These children have completed 9 sessions and are ready for program completion.</p>
          </div>
        ` : ''}
        
        <div style="margin-top: 20px; padding: 15px; background: #F3F4F6; border-radius: 8px;">
          <a href="https://www.yestoryd.com/admin/completion" 
             style="display: inline-block; background: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Open Completion Dashboard
          </a>
        </div>
      </div>
    `;

    await sgMail.send({
      to: ['rucha.rai@yestoryd.com', 'amitkrai17@gmail.com'],
      from: { email: 'engage@yestoryd.com', name: 'Yestoryd System' },
      subject: `⚠️ Completion Alerts: ${alerts.overdue.length} Overdue, ${alerts.atRisk.length} At Risk`,
      html: emailHtml,
    });

    console.log('✅ Admin alert email sent');
  } catch (error) {
    console.error('Admin alert email error:', error);
  }
}

// Check if final assessment reminder needed
async function checkAndSendFinalAssessmentReminder(enrollment: CompletionAlert): Promise<boolean> {
  try {
    // Check if final assessment was sent
    const { data: assessmentEvent } = await supabase
      .from('enrollment_events')
      .select('created_at')
      .eq('enrollment_id', enrollment.id)
      .eq('event_type', 'final_assessment_sent')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!assessmentEvent) return false;

    // Check if final assessment was submitted
    const { data: finalAssessment } = await supabase
      .from('assessment_results')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .eq('assessment_type', 'final')
      .single();

    if (finalAssessment) return false;

    // Check if reminder already sent in last 3 days
    const { data: reminderEvent } = await supabase
      .from('enrollment_events')
      .select('created_at')
      .eq('enrollment_id', enrollment.id)
      .eq('event_type', 'final_assessment_reminder')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (reminderEvent) {
      const daysSinceReminder = Math.ceil(
        (new Date().getTime() - new Date(reminderEvent.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceReminder < 3) return false;
    }

    // Check if original email was sent 3+ days ago
    const daysSinceSent = Math.ceil(
      (new Date().getTime() - new Date(assessmentEvent.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceSent < 3) return false;

    if (!enrollment.parentEmail) return false;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yestoryd.com';
    const assessmentLink = `${baseUrl}/assessment?type=final&enrollment=${enrollment.id}`;

    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    await sgMail.send({
      to: enrollment.parentEmail,
      from: { email: 'engage@yestoryd.com', name: 'Yestoryd' },
      subject: `⏰ Reminder: ${enrollment.childName}'s Final Assessment Awaiting`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1F2937;">Quick Reminder! 📖</h2>
          <p>Hi ${enrollment.parentName},</p>
          <p>${enrollment.childName}'s final reading assessment is still pending. It only takes 5 minutes!</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${assessmentLink}" 
               style="background: linear-gradient(to right, #FF0099, #7B008B); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Complete Final Assessment
            </a>
          </div>
          <p style="color: #6B7280; font-size: 14px;">Once completed, you'll receive ${enrollment.childName}'s certificate and progress report!</p>
          <p>Best,<br>Team Yestoryd</p>
        </div>
      `,
    });

    // Log reminder sent
    await supabase.from('enrollment_events').insert({
      enrollment_id: enrollment.id,
      event_type: 'final_assessment_reminder',
      event_data: { sent_to: enrollment.parentEmail, sent_at: new Date().toISOString() },
      triggered_by: 'cron',
    });

    console.log(`✅ Final assessment reminder sent to ${enrollment.parentEmail}`);
    return true;
  } catch (error) {
    console.error('Reminder send error:', error);
    return false;
  }
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
  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .eq('status', 'scheduled')
    .order('scheduled_date', { ascending: true });

  if (!sessions || sessions.length === 0) return;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1);

  for (let i = 0; i < sessions.length; i++) {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + (i * 5));

    await supabase
      .from('scheduled_sessions')
      .update({
        scheduled_date: newDate.toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessions[i].id);
  }
}
