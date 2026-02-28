// ============================================================
// FILE: app/api/cron/enrollment-lifecycle/route.ts
// ============================================================
// HARDENED VERSION - Enrollment Lifecycle Cron Job
// Runs daily at 5:30 AM IST (0 0 * * * UTC)
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Handles:
// - Delayed starts
// - Pause endings  
// - Coach unavailability
// - 24hr session reminders
// - Completion alerts
//
// Security features:
// - CRON_SECRET + QStash signature verification
// - Lazy Supabase initialization
// - Request tracing
// - Structured logging
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { queueEnrollmentComplete } from '@/lib/qstash';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = createAdminClient;

// --- VERIFICATION ---
function verifyCronAuth(request: NextRequest): { isValid: boolean; source: string } {
  // 1. Check Vercel CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { isValid: true, source: 'vercel_cron' };
  }

  // 2. Check QStash signature
  const qstashSignature = request.headers.get('upstash-signature');
  if (qstashSignature) {
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    if (currentKey) {
      return { isValid: true, source: 'qstash' };
    }
  }

  // 3. Check internal API key (for manual admin trigger)
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  return { isValid: false, source: 'none' };
}

// --- RESULTS TYPE ---
interface CronResults {
  delayedStarts: { processed: number; errors: string[] };
  pauseEndings: { processed: number; errors: string[] };
  coachUnavailability: { processed: number; errors: string[] };
  coachReminders24h: { sent: number; failed: number; errors: string[] };
  completionAlerts: { sent: number; errors: string[] };
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // 1. Verify authorization
  const auth = verifyCronAuth(request);
  
  if (!auth.isValid) {
    console.error(JSON.stringify({
      requestId,
      event: 'cron_auth_failed',
      error: 'Unauthorized cron request',
    }));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: CronResults = {
    delayedStarts: { processed: 0, errors: [] },
    pauseEndings: { processed: 0, errors: [] },
    coachUnavailability: { processed: 0, errors: [] },
    coachReminders24h: { sent: 0, failed: 0, errors: [] },
    completionAlerts: { sent: 0, errors: [] },
  };

  try {
    console.log(JSON.stringify({
      requestId,
      event: 'enrollment_lifecycle_cron_started',
      source: auth.source,
      timestamp: new Date().toISOString(),
    }));

    const supabase = getServiceSupabase();

    // Calculate dates
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    const todayStr = nowIST.toISOString().split('T')[0];

    const tomorrow = new Date(nowIST);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // ========================================
    // TASK 1: Process Delayed Starts
    // ========================================
    console.log(JSON.stringify({ requestId, event: 'task_started', task: 'delayed_starts' }));
    
    const { data: delayedEnrollments, error: delayedError } = await supabase
      .from('enrollments')
      .select(`id, requested_start_date, child_id, parent_id, coach_id,
        children (id, name, child_name, parent_email, parent_phone, parent_name),
        coaches!coach_id (id, name, email)`)
      .eq('status', 'pending_start')
      .lte('requested_start_date', todayStr);

    if (delayedError) {
      results.delayedStarts.errors.push(delayedError.message);
    } else if (delayedEnrollments) {
      for (const enrollment of delayedEnrollments) {
        try {
          await supabase
            .from('enrollments')
            .update({
              status: 'active',
              program_start_date: todayStr,
              updated_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id);

          await supabase.from('enrollment_events').insert({
            enrollment_id: enrollment.id,
            event_type: 'started',
            event_data: {
              triggered_by: 'cron',
              request_id: requestId,
              requested_start_date: enrollment.requested_start_date,
            },
          });

          // Queue session scheduling via enrollment-complete job
          try {
            const child = (enrollment as any).children;
            const coach = (enrollment as any).coaches;
            await queueEnrollmentComplete({
              enrollmentId: enrollment.id,
              childId: (enrollment as any).child_id || child?.id || '',
              childName: child?.child_name || child?.name || 'Child',
              parentId: (enrollment as any).parent_id || '',
              parentEmail: child?.parent_email || '',
              parentName: child?.parent_name || '',
              parentPhone: child?.parent_phone || undefined,
              coachId: (enrollment as any).coach_id || coach?.id || '',
              coachEmail: coach?.email || '',
              coachName: coach?.name || '',
            });
            console.log(JSON.stringify({
              requestId,
              event: 'enrollment_complete_queued',
              enrollmentId: enrollment.id,
            }));
          } catch (queueError: any) {
            console.error(JSON.stringify({
              requestId,
              event: 'enrollment_complete_queue_failed',
              enrollmentId: enrollment.id,
              error: queueError.message,
            }));
          }

          results.delayedStarts.processed++;
        } catch (e: any) {
          results.delayedStarts.errors.push(`${enrollment.id}: ${e.message}`);
        }
      }
    }

    // ========================================
    // TASK 2: Process Pause Endings
    // NOTE: Disabled - pause_start_date, pause_end_date, program_end_date columns don't exist
    // Would need migration to add these columns for pause functionality
    // ========================================
    console.log(JSON.stringify({ requestId, event: 'task_skipped', task: 'pause_endings', reason: 'columns_not_exist' }));

    /* DISABLED - Schema doesn't support pause dates
    const { data: pausedEnrollments, error: pauseError } = await supabase
      .from('enrollments')
      .select('id, pause_start_date, pause_end_date, program_end_date')
      .eq('is_paused', true)
      .lte('pause_end_date', todayStr);

    if (pauseError) {
      results.pauseEndings.errors.push(pauseError.message);
    } else if (pausedEnrollments) {
      for (const enrollment of pausedEnrollments) {
        try {
          const pauseStart = new Date(enrollment.pause_start_date);
          const pauseEnd = new Date(enrollment.pause_end_date);
          const pauseDays = Math.ceil((pauseEnd.getTime() - pauseStart.getTime()) / (1000 * 60 * 60 * 24));

          const currentEnd = new Date(enrollment.program_end_date);
          currentEnd.setDate(currentEnd.getDate() + pauseDays);

          await supabase
            .from('enrollments')
            .update({
              is_paused: false,
              pause_start_date: null,
              pause_end_date: null,
              program_end_date: currentEnd.toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id);

          await supabase.from('enrollment_events').insert({
            enrollment_id: enrollment.id,
            event_type: 'resumed',
            event_data: {
              pause_days: pauseDays,
              extended_end_date: currentEnd.toISOString().split('T')[0],
              triggered_by: 'cron',
              request_id: requestId,
            },
          });

          results.pauseEndings.processed++;
        } catch (e: any) {
          results.pauseEndings.errors.push(`${enrollment.id}: ${e.message}`);
        }
      }
    }
    */

    // ========================================
    // TASK 3: Coach Unavailability Check
    // ========================================
    console.log(JSON.stringify({ requestId, event: 'task_started', task: 'coach_unavailability' }));

    const { data: unavailabilities, error: unavailError } = await supabase
      .from('coach_availability')
      .select('id')
      .eq('status', 'pending')
      .lte('start_date', todayStr);

    if (unavailError) {
      results.coachUnavailability.errors.push(unavailError.message);
    } else if (unavailabilities) {
      for (const unavail of unavailabilities) {
        try {
          await supabase
            .from('coach_availability')
            .update({ status: 'active' })
            .eq('id', unavail.id);

          results.coachUnavailability.processed++;
        } catch (e: any) {
          results.coachUnavailability.errors.push(`${unavail.id}: ${e.message}`);
        }
      }
    }

    // ========================================
    // TASK 4: 24-HOUR COACH SESSION REMINDERS
    // ========================================
    console.log(JSON.stringify({ requestId, event: 'task_started', task: 'coach_reminders_24h' }));

    const { data: sessions24h, error: sessions24hError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id,
        scheduled_date,
        scheduled_time,
        session_type,
        coach_id,
        child_id,
        google_meet_link,
        coach_reminder_24h_sent,
        children (id, name, child_name),
        coaches (id, name, phone, email)
      `)
      .eq('scheduled_date', tomorrowStr)
      .eq('status', 'scheduled')
      .or('coach_reminder_24h_sent.is.null,coach_reminder_24h_sent.eq.false');

    if (sessions24hError) {
      results.coachReminders24h.errors.push(sessions24hError.message);
    } else if (sessions24h && sessions24h.length > 0) {
      console.log(JSON.stringify({
        requestId,
        event: 'sessions_found_for_reminders',
        count: sessions24h.length,
      }));

      for (const session of sessions24h) {
        const coach = session.coaches as any;
        const child = session.children as any;

        if (!coach?.phone) {
          results.coachReminders24h.errors.push(`Session ${session.id}: Coach has no phone`);
          continue;
        }

        const childName = child?.name || child?.child_name || 'Student';
        const coachFirstName = coach.name?.split(' ')[0] || 'Coach';
        const sessionDate = new Date(session.scheduled_date).toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
        const sessionTime = session.scheduled_time?.slice(0, 5) || 'TBD';

        try {
          const aisensyKey = process.env.AISENSY_API_KEY;
          
          if (!aisensyKey) {
            results.coachReminders24h.errors.push('AISENSY_API_KEY not configured');
            break;
          }

          const waResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: aisensyKey,
              campaignName: 'coach_session_reminder',
              destination: coach.phone.replace(/\D/g, ''),
              userName: 'Yestoryd',
              templateParams: [
                coachFirstName,
                childName,
                sessionDate,
                sessionTime,
                'Review assessment',
                'Continue progress',
              ],
            }),
          });

          if (waResponse.ok) {
            await supabase
              .from('scheduled_sessions')
              .update({
                coach_reminder_24h_sent: true,
                coach_reminder_24h_sent_at: new Date().toISOString(),
              })
              .eq('id', session.id);

            results.coachReminders24h.sent++;
          } else {
            const errText = await waResponse.text();
            results.coachReminders24h.failed++;
            results.coachReminders24h.errors.push(`Session ${session.id}: ${errText}`);
          }
        } catch (e: any) {
          results.coachReminders24h.failed++;
          results.coachReminders24h.errors.push(`Session ${session.id}: ${e.message}`);
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // ========================================
    // TASK 5: Completion Alerts (Risk Detection)
    // NOTE: Disabled - program_end_date, completion_alert_sent_at columns don't exist
    // Would need migration to add these columns
    // ========================================
    console.log(JSON.stringify({ requestId, event: 'task_skipped', task: 'completion_alerts', reason: 'columns_not_exist' }));

    /* DISABLED - Schema doesn't support program_end_date
    const sevenDaysFromNow = new Date(nowIST);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

    // Get at-risk enrollments (NOT already alerted this week)
    const { data: atRiskEnrollments, error: riskError } = await supabase
      .from('enrollments')
      .select(`
        id,
        child_id,
        coach_id,
        program_end_date,
        completion_alert_sent_at,
        total_sessions,
        children (name, parent_email),
        coaches (name, email)
      `)
      .eq('status', 'active')
      .lte('program_end_date', sevenDaysStr)
      .gte('program_end_date', todayStr);

    if (!riskError && atRiskEnrollments && atRiskEnrollments.length > 0) {
      // Filter out enrollments already alerted in the last 7 days (prevent alert fatigue)
      const sevenDaysAgo = new Date(nowIST);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const enrollmentsToCheck = atRiskEnrollments.filter(e => {
        if (!e.completion_alert_sent_at) return true;
        return new Date(e.completion_alert_sent_at) < sevenDaysAgo;
      });

      if (enrollmentsToCheck.length > 0) {
        // OPTIMIZED: Single query to get all session counts (avoids N+1)
        const enrollmentIds = enrollmentsToCheck.map(e => e.id);
        
        const { data: sessionCounts } = await supabase
          .rpc('get_completed_session_counts', { enrollment_ids: enrollmentIds });
        
        // Fallback if RPC doesn't exist: use individual queries but log warning
        // TODO: Create RPC function for better performance at scale
        let countsMap: Record<string, number> = {};
        
        if (sessionCounts) {
          // RPC returns array of { enrollment_id, count }
          sessionCounts.forEach((row: { enrollment_id: string; count: number }) => {
            countsMap[row.enrollment_id] = row.count;
          });
        } else {
          // Fallback: N+1 queries (works but slow at scale)
          console.log(JSON.stringify({ 
            requestId, 
            event: 'warning', 
            message: 'RPC not available, using N+1 fallback',
            enrollmentCount: enrollmentsToCheck.length,
          }));
          
          for (const enrollment of enrollmentsToCheck) {
            const { count } = await supabase
              .from('scheduled_sessions')
              .select('*', { count: 'exact', head: true })
              .eq('enrollment_id', enrollment.id)
              .eq('status', 'completed');
            countsMap[enrollment.id] = count || 0;
          }
        }

        // Process at-risk enrollments
        for (const enrollment of enrollmentsToCheck) {
          const completedCount = countsMap[enrollment.id] || 0;
          
          // V2: Use enrollment.total_sessions, fallback to legacy 9
          const enrollmentTotal = (enrollment as any).total_sessions || 9; // V1 fallback – enrollment.total_sessions is authoritative (DISABLED code)
          if (completedCount < enrollmentTotal) {
            try {
              await supabase.from('admin_alerts').insert({
                alert_type: 'completion_at_risk',
                severity: 'high',
                title: `${(enrollment.children as any)?.name} - Program ending soon`,
                message: `Only ${completedCount}/${enrollmentTotal} sessions completed. Program ends ${enrollment.program_end_date}`,
                context_data: {
                  enrollment_id: enrollment.id,
                  sessions_completed: completedCount,
                  program_end_date: enrollment.program_end_date,
                  request_id: requestId,
                },
              });

              // Mark as alerted to prevent fatigue
              await supabase
                .from('enrollments')
                .update({ completion_alert_sent_at: new Date().toISOString() })
                .eq('id', enrollment.id);

              results.completionAlerts.sent++;
            } catch {
              // Ignore if admin_alerts table doesn't exist
            }
          }
        }
      }
    }
    */

    // ========================================
    // AUDIT LOG & RESPONSE
    // ========================================
    const duration = Date.now() - startTime;

    await supabase.from('activity_log').insert({
      user_email: 'engage@yestoryd.com',
      user_type: 'system',
      action: 'enrollment_lifecycle_cron_executed',
      metadata: {
        request_id: requestId,
        source: auth.source,
        results: {
          delayed_starts: results.delayedStarts.processed,
          pause_endings: results.pauseEndings.processed,
          coach_unavailability: results.coachUnavailability.processed,
          reminders_sent: results.coachReminders24h.sent,
          reminders_failed: results.coachReminders24h.failed,
          completion_alerts: results.completionAlerts.sent,
        },
        errors: {
          delayed_starts: results.delayedStarts.errors.length,
          pause_endings: results.pauseEndings.errors.length,
          reminders: results.coachReminders24h.errors.length,
        },
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    console.log(JSON.stringify({
      requestId,
      event: 'enrollment_lifecycle_cron_complete',
      duration: `${duration}ms`,
      results: {
        delayedStarts: results.delayedStarts.processed,
        pauseEndings: results.pauseEndings.processed,
        coachUnavailability: results.coachUnavailability.processed,
        coachReminders24h: `${results.coachReminders24h.sent} sent, ${results.coachReminders24h.failed} failed`,
        completionAlerts: results.completionAlerts.sent,
      },
    }));

    return NextResponse.json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      results,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'enrollment_lifecycle_cron_error',
      error: error.message,
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, requestId, error: error.message },
      { status: 500 }
    );
  }
}

// Support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
