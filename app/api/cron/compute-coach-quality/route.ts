// ============================================================
// FILE: app/api/cron/compute-coach-quality/route.ts
// PURPOSE: Monthly quality metrics per coach → coach_quality_log
// SCHEDULE: 1st of each month at 6:00 AM IST (00:30 UTC)
// PHILOSOPHY: Inform, don't punish. Context matters.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import crypto from 'crypto';
import { verifyCronRequest } from '@/lib/api/verify-cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;


// ── Main ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await verifyCronRequest(request);
    if (!auth.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'coach_quality_cron_started', source: auth.source }));

    const supabase = createAdminClient();

    // Calculate previous month date range
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const monthStart = new Date(prevYear, prevMonth, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthDate = monthStart.toISOString().split('T')[0]; // YYYY-MM-DD (1st of month)

    // 3 months ago for re-enrollment tracking
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    // Get all active coaches
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('id, name')
      .eq('is_active', true);

    if (coachError) throw coachError;
    if (!coaches || coaches.length === 0) {
      return NextResponse.json({ success: true, message: 'No active coaches', requestId });
    }

    let coachesProcessed = 0;
    const nudges: Array<{ coachId: string; type: string; details: Record<string, unknown> }> = [];

    for (const coach of coaches) {
      try {
        // ── a. avg_nps (from nps_responses.coach_rating) ──
        const { data: npsData } = await supabase
          .from('nps_responses')
          .select('coach_rating')
          .eq('coach_id', coach.id)
          .gte('created_at', monthStart.toISOString())
          .lt('created_at', monthEnd.toISOString())
          .not('coach_rating', 'is', null);

        const npsRatings = (npsData || []).map(r => Number(r.coach_rating)).filter(n => !isNaN(n) && n > 0);
        const avgNps = npsRatings.length > 0
          ? Math.round((npsRatings.reduce((a, b) => a + b, 0) / npsRatings.length) * 100) / 100
          : null;

        // ── b. session_completion_rate ──
        const { count: completedCount } = await supabase
          .from('scheduled_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', coach.id)
          .eq('status', 'completed')
          .gte('completed_at', monthStart.toISOString())
          .lt('completed_at', monthEnd.toISOString());

        const { count: totalSessionCount } = await supabase
          .from('scheduled_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', coach.id)
          .gte('scheduled_date', monthStart.toISOString().split('T')[0])
          .lt('scheduled_date', monthEnd.toISOString().split('T')[0])
          .in('status', ['completed', 'missed', 'cancelled', 'no_show']);

        const completed = completedCount || 0;
        const totalSessions = totalSessionCount || 0;
        const sessionCompletionRate = totalSessions > 0
          ? Math.round((completed / totalSessions) * 10000) / 100
          : null;

        // ── c. report_submission_rate (feedback_submitted_at is not null) ──
        const { count: sessionsWithFeedback } = await supabase
          .from('scheduled_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', coach.id)
          .eq('status', 'completed')
          .gte('completed_at', monthStart.toISOString())
          .lt('completed_at', monthEnd.toISOString())
          .not('feedback_submitted_at', 'is', null);

        const reportSubmissionRate = completed > 0
          ? Math.round(((sessionsWithFeedback || 0) / completed) * 10000) / 100
          : null;

        const missingReports = completed - (sessionsWithFeedback || 0);

        // ── d. re_enrollment_rate ──
        const { data: completedEnrollments } = await supabase
          .from('enrollments')
          .select('child_id')
          .eq('coach_id', coach.id)
          .eq('status', 'completed')
          .gte('updated_at', threeMonthsAgo.toISOString())
          .lt('updated_at', monthEnd.toISOString());

        const completedChildIds = Array.from(new Set((completedEnrollments || []).map(e => e.child_id)));
        let reEnrollmentRate: number | null = null;

        if (completedChildIds.length > 0) {
          const { count: reEnrolledCount } = await supabase
            .from('enrollments')
            .select('id', { count: 'exact', head: true })
            .in('child_id', completedChildIds)
            .in('status', ['active', 'pending_start'])
            .gte('created_at', threeMonthsAgo.toISOString());

          reEnrollmentRate = Math.round(((reEnrolledCount || 0) / completedChildIds.length) * 10000) / 100;
        }

        // ── e. intelligence_score (structured capture responses count) ──
        const { count: captureCount } = await supabase
          .from('structured_capture_responses')
          .select('id', { count: 'exact', head: true })
          .eq('coach_id', coach.id)
          .gte('submitted_at', monthStart.toISOString())
          .lt('submitted_at', monthEnd.toISOString());

        const intelligenceScore = captureCount || 0;

        // ── f. active_children ──
        const { count: activeChildrenCount } = await supabase
          .from('enrollments')
          .select('child_id', { count: 'exact', head: true })
          .eq('coach_id', coach.id)
          .eq('status', 'active');

        const activeChildren = activeChildrenCount || 0;

        // ── g. platform_hours (sum of session durations in completed sessions) ──
        const { data: sessionDurations } = await supabase
          .from('scheduled_sessions')
          .select('duration_minutes')
          .eq('coach_id', coach.id)
          .eq('status', 'completed')
          .gte('completed_at', monthStart.toISOString())
          .lt('completed_at', monthEnd.toISOString());

        const totalMinutes = (sessionDurations || []).reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);
        const platformHours = Math.round((totalMinutes / 60) * 100) / 100;

        // ── h. referral_count ──
        const { count: referralCount } = await supabase
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('lead_source_coach_id', coach.id)
          .gte('created_at', monthStart.toISOString())
          .lt('created_at', monthEnd.toISOString());

        // ── UPSERT into coach_quality_log ──
        await supabase.from('coach_quality_log').upsert({
          coach_id: coach.id,
          month: monthDate,
          avg_nps: avgNps,
          session_completion_rate: sessionCompletionRate,
          report_submission_rate: reportSubmissionRate,
          re_enrollment_rate: reEnrollmentRate,
          intelligence_score: intelligenceScore,
          active_children: activeChildren,
          platform_hours: platformHours,
          referral_count: referralCount || 0,
          computed_at: new Date().toISOString(),
        }, { onConflict: 'coach_id,month' });

        // ── Compute composite quality_score (weighted) ──
        // Normalize: nps is 1-5 → 0-1, others are 0-100 → 0-1
        const npsNorm = avgNps ? (avgNps - 1) / 4 : 0.5; // default neutral
        const completionNorm = (sessionCompletionRate || 0) / 100;
        const reEnrollNorm = (reEnrollmentRate || 0) / 100;
        const reportNorm = (reportSubmissionRate || 0) / 100;

        const qualityScore = Math.round(
          (0.3 * npsNorm + 0.3 * completionNorm + 0.2 * reEnrollNorm + 0.2 * reportNorm) * 100
        ) / 100;

        await supabase.from('coaches').update({
          quality_score: qualityScore,
          intelligence_score: intelligenceScore,
          updated_at: new Date().toISOString(),
        }).eq('id', coach.id);

        coachesProcessed++;

        // ── Quality nudges (inform, don't punish) ──

        // NPS < 4.0 nudge
        if (avgNps !== null && avgNps < 4.0) {
          nudges.push({
            coachId: coach.id,
            type: 'quality_nudge',
            details: { avg_nps: avgNps, threshold: 4.0, coach_name: coach.name },
          });

          // Check for 2 consecutive months below 3.5
          if (avgNps < 3.5) {
            const prevPrevMonth = prevMonth === 0 ? 11 : prevMonth - 1;
            const prevPrevYear = prevMonth === 0 ? prevYear - 1 : prevYear;
            const prevPrevMonthDate = new Date(prevPrevYear, prevPrevMonth, 1).toISOString().split('T')[0];

            const { data: prevLog } = await supabase
              .from('coach_quality_log')
              .select('avg_nps')
              .eq('coach_id', coach.id)
              .eq('month', prevPrevMonthDate)
              .single();

            if (prevLog && prevLog.avg_nps !== null && Number(prevLog.avg_nps) < 3.5) {
              nudges.push({
                coachId: coach.id,
                type: 'quality_alert_admin',
                details: {
                  avg_nps: avgNps,
                  prev_month_nps: Number(prevLog.avg_nps),
                  months_below: 2,
                  action: 'admin_conversation_needed',
                  coach_name: coach.name,
                },
              });
            }
          }
        }

        // Missing reports flag
        if (reportSubmissionRate !== null && reportSubmissionRate < 100 && missingReports > 0) {
          nudges.push({
            coachId: coach.id,
            type: 'missing_reports_flag',
            details: {
              submission_rate: reportSubmissionRate,
              sessions_missing_reports: missingReports,
              coach_name: coach.name,
            },
          });
        }

      } catch (coachErr) {
        console.error(JSON.stringify({
          requestId,
          event: 'coach_quality_compute_error',
          coachId: coach.id,
          error: (coachErr as Error).message,
        }));
        // Continue with next coach
      }
    }

    // ── Featured Coach badge (top 3 by composite score) ──
    try {
      const { data: allQuality } = await supabase
        .from('coach_quality_log')
        .select('coach_id, avg_nps, session_completion_rate, re_enrollment_rate, intelligence_score, referral_count')
        .eq('month', monthDate);

      if (allQuality && allQuality.length >= 3) {
        const maxInt = Math.max(...allQuality.map(d => d.intelligence_score || 0));
        const maxRef = Math.max(...allQuality.map(d => d.referral_count || 0));

        const withScore = allQuality.map(d => ({
          coach_id: d.coach_id,
          score: (Number(d.avg_nps) || 0) / 5.0 * 30
            + (Number(d.session_completion_rate) || 0) / 100 * 20
            + (Number(d.re_enrollment_rate) || 0) / 100 * 20
            + (maxInt > 0 ? (d.intelligence_score || 0) / maxInt * 15 : 0)
            + (maxRef > 0 ? (d.referral_count || 0) / maxRef * 15 : 0),
        }));

        withScore.sort((a, b) => b.score - a.score);
        const top3Ids = withScore.slice(0, 3).map(d => d.coach_id);

        // featured_until = end of next month
        const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);

        // Clear previous featured coaches
        await supabase
          .from('coaches')
          .update({ featured_until: null, updated_at: new Date().toISOString() })
          .not('featured_until', 'is', null);

        // Set new featured coaches
        await supabase
          .from('coaches')
          .update({ featured_until: nextMonthEnd.toISOString(), updated_at: new Date().toISOString() })
          .in('id', top3Ids);
      }
    } catch (featuredErr) {
      console.error(JSON.stringify({
        requestId,
        event: 'featured_badge_update_error',
        error: (featuredErr as Error).message,
      }));
    }

    // ── Insert nudge activity_logs in batch ──
    if (nudges.length > 0) {
      const nudgeLogs = nudges.map(n => ({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system' as const,
        action: n.type,
        metadata: {
          request_id: requestId,
          coach_id: n.coachId,
          month: monthDate,
          ...n.details,
        },
        created_at: new Date().toISOString(),
      }));

      await supabase.from('activity_log').insert(nudgeLogs);
    }

    // ── Summary log ──
    await supabase.from('activity_log').insert({
      user_email: COMPANY_CONFIG.supportEmail,
      user_type: 'system',
      action: 'coach_quality_computed',
      metadata: {
        request_id: requestId,
        month: monthDate,
        coaches_processed: coachesProcessed,
        nudges_generated: nudges.length,
        source: auth.source,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'coach_quality_cron_complete',
      coachesProcessed,
      nudges: nudges.length,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      month: monthDate,
      coachesProcessed,
      nudgesGenerated: nudges.length,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'coach_quality_cron_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// Support POST for manual admin triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
