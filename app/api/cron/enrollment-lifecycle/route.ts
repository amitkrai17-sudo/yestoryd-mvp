// file: app/api/cron/enrollment-lifecycle/route.ts
// UPDATED: Now includes 24hr coach session reminders
// Runs daily at 5:30 AM IST (0 0 * * * UTC)
// Handles: Delayed starts, pause endings, coach unavailability, AND session reminders

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const qstashSignature = request.headers.get('upstash-signature');
  
  if (qstashSignature) return true;
  if (authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    delayedStarts: { processed: 0, errors: [] as string[] },
    pauseEndings: { processed: 0, errors: [] as string[] },
    coachUnavailability: { processed: 0, errors: [] as string[] },
    coachReminders24h: { sent: 0, failed: 0, errors: [] as string[] },
    completionAlerts: { sent: 0, errors: [] as string[] },
  };

  try {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    const todayStr = nowIST.toISOString().split('T')[0];
    
    // Calculate tomorrow for 24hr reminders
    const tomorrow = new Date(nowIST);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // ========================================
    // TASK 1: Process Delayed Starts
    // ========================================
    console.log('📅 Processing delayed starts...');
    const { data: delayedEnrollments, error: delayedError } = await supabase
      .from('enrollments')
      .select('*')
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

          // Log event
          await supabase.from('enrollment_events').insert({
            enrollment_id: enrollment.id,
            event_type: 'started',
            event_data: { triggered_by: 'cron', requested_start_date: enrollment.requested_start_date },
          });

          results.delayedStarts.processed++;
        } catch (e: any) {
          results.delayedStarts.errors.push(`${enrollment.id}: ${e.message}`);
        }
      }
    }

    // ========================================
    // TASK 2: Process Pause Endings
    // ========================================
    console.log('⏸️ Processing pause endings...');
    const { data: pausedEnrollments, error: pauseError } = await supabase
      .from('enrollments')
      .select('*')
      .eq('is_paused', true)
      .lte('pause_end_date', todayStr);

    if (pauseError) {
      results.pauseEndings.errors.push(pauseError.message);
    } else if (pausedEnrollments) {
      for (const enrollment of pausedEnrollments) {
        try {
          // Calculate extended end date
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

          // Log event
          await supabase.from('enrollment_events').insert({
            enrollment_id: enrollment.id,
            event_type: 'resumed',
            event_data: { 
              pause_days: pauseDays,
              extended_end_date: currentEnd.toISOString().split('T')[0],
              triggered_by: 'cron',
            },
          });

          results.pauseEndings.processed++;
        } catch (e: any) {
          results.pauseEndings.errors.push(`${enrollment.id}: ${e.message}`);
        }
      }
    }

    // ========================================
    // TASK 3: Coach Unavailability Check
    // ========================================
    console.log('👩‍🏫 Checking coach unavailability...');
    const { data: unavailabilities, error: unavailError } = await supabase
      .from('coach_availability')
      .select('*')
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
    // TASK 4: 24-HOUR COACH SESSION REMINDERS (NEW!)
    // ========================================
    console.log('📱 Sending 24hr coach reminders...');
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
        children (
          id,
          name,
          child_name
        ),
        coaches (
          id,
          name,
          phone,
          email
        )
      `)
      .eq('scheduled_date', tomorrowStr)
      .eq('status', 'scheduled')
      .or('coach_reminder_24h_sent.is.null,coach_reminder_24h_sent.eq.false');

    if (sessions24hError) {
      results.coachReminders24h.errors.push(sessions24hError.message);
    } else if (sessions24h && sessions24h.length > 0) {
      console.log(`📅 Found ${sessions24h.length} sessions for 24h reminders`);

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
          // Send WhatsApp via AiSensy
          const waResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: process.env.AISENSY_API_KEY,
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

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // ========================================
    // TASK 5: Completion Alerts (Risk Detection)
    // ========================================
    console.log('🚨 Checking completion risks...');
    const sevenDaysFromNow = new Date(nowIST);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

    // Find at-risk enrollments (ending soon with incomplete sessions)
    const { data: atRiskEnrollments, error: riskError } = await supabase
      .from('enrollments')
      .select(`
        id,
        child_id,
        coach_id,
        program_end_date,
        children (name, parent_email),
        coaches (name, email)
      `)
      .eq('status', 'active')
      .lte('program_end_date', sevenDaysStr)
      .gte('program_end_date', todayStr);

    if (!riskError && atRiskEnrollments) {
      for (const enrollment of atRiskEnrollments) {
        // Count completed sessions
        const { count } = await supabase
          .from('scheduled_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('enrollment_id', enrollment.id)
          .eq('status', 'completed');

        if ((count || 0) < 9) {
          // Log alert (admin will see in dashboard)
          try {
            await supabase.from('admin_alerts').insert({
              alert_type: 'completion_at_risk',
              severity: 'high',
              title: `${(enrollment.children as any)?.name} - Program ending soon`,
              message: `Only ${count}/9 sessions completed. Program ends ${enrollment.program_end_date}`,
              context_data: {
                enrollment_id: enrollment.id,
                sessions_completed: count,
                program_end_date: enrollment.program_end_date,
              },
            });
          } catch {
            // Ignore if table doesn't exist
          }

          results.completionAlerts.sent++;
        }
      }
    }

    // ========================================
    // LOG SUMMARY
    // ========================================
    console.log('📊 Enrollment lifecycle cron complete:', {
      delayedStarts: results.delayedStarts.processed,
      pauseEndings: results.pauseEndings.processed,
      coachUnavailability: results.coachUnavailability.processed,
      coachReminders24h: `${results.coachReminders24h.sent} sent, ${results.coachReminders24h.failed} failed`,
      completionAlerts: results.completionAlerts.sent,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });

  } catch (error: any) {
    console.error('❌ Enrollment lifecycle cron error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
