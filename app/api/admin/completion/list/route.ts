// ============================================================
// FILE: app/api/admin/completion/list/route.ts
// ============================================================
// HARDENED VERSION - List Enrollments with Completion Status
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ⚠️ CRITICAL FIX: Original had NO AUTHENTICATION!
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'completion_list_auth_failed', error: auth.error }));
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'completion_list_request', adminEmail: auth.email }));

    const supabase = getServiceSupabase();
    const today = new Date();

    // Get all enrollments
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        program_start,
        program_end,
        completed_at,
        certificate_number,
        nps_score,
        nps_submitted_at,
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
      .in('status', ['active', 'pending_start', 'completed', 'paused'])
      .order('program_end', { ascending: true });

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'completion_list_db_error', error: error.message }));
      return NextResponse.json({ success: false, error: 'Failed to fetch enrollments' }, { status: 500 });
    }

    // Enrich each enrollment with session data and risk calculation
    const enrichedEnrollments = await Promise.all(
      (enrollments || []).map(async (enrollment) => {
        // Count completed sessions
        const { count: sessionsCompleted } = await supabase
          .from('scheduled_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('child_id', enrollment.child_id)
          .eq('status', 'completed');

        // Get last session date
        const { data: lastSession } = await supabase
          .from('scheduled_sessions')
          .select('completed_at, session_date')
          .eq('child_id', enrollment.child_id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        // Check for assessments
        const { data: assessments } = await supabase
          .from('assessment_results')
          .select('id, assessment_type, created_at')
          .eq('child_id', enrollment.child_id);

        // Check for initial assessment in children table
        const { data: childData } = await supabase
          .from('children')
          .select('id')
          .eq('id', enrollment.child_id)
          .maybeSingle();

        const hasInitialAssessment = (assessments?.some(a => !a.assessment_type || a.assessment_type === 'initial')) || !!childData;
        const hasFinalAssessment = assessments?.some(a => a.assessment_type === 'final') || false;

        // Check if final assessment was sent
        const { data: finalAssessmentEvent } = await supabase
          .from('enrollment_events')
          .select('id')
          .eq('enrollment_id', enrollment.id)
          .eq('event_type', 'final_assessment_sent')
          .limit(1)
          .maybeSingle();

        const finalAssessmentSent = !!finalAssessmentEvent;

        // Calculate days and risk
        const programEnd = new Date(enrollment.program_end);
        const daysRemaining = Math.ceil((programEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const lastSessionDate = lastSession?.completed_at || lastSession?.session_date || null;
        const daysSinceLastSession = lastSessionDate
          ? Math.ceil((today.getTime() - new Date(lastSessionDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const completed = sessionsCompleted || 0;

        // Calculate risk level
        let riskLevel = 'active';
        if (enrollment.status === 'completed') {
          riskLevel = 'completed';
        } else if (enrollment.status === 'paused') {
          riskLevel = 'paused';
        } else if (completed >= 9) {
          riskLevel = 'ready';
        } else if (daysRemaining < 0) {
          riskLevel = 'overdue';
        } else if (daysRemaining <= 7) {
          riskLevel = 'at_risk';
        } else if (daysSinceLastSession !== null && daysSinceLastSession >= 14) {
          riskLevel = 'inactive';
        } else if (completed >= 6) {
          riskLevel = 'on_track';
        }

        // Get parent info (prefer parents table, fallback to children table)
        const parentName = (enrollment.parents as any)?.name ||
                          (enrollment.children as any)?.parent_name ||
                          'Unknown';
        const parentEmail = (enrollment.parents as any)?.email ||
                           (enrollment.children as any)?.parent_email ||
                           '';
        const parentPhone = (enrollment.parents as any)?.phone ||
                           (enrollment.children as any)?.parent_phone ||
                           '';

        return {
          id: enrollment.id,
          childName: (enrollment.children as any)?.name || (enrollment.children as any)?.child_name || 'Unknown',
          parentName,
          parentEmail,
          parentPhone,
          coachName: (enrollment.coaches as any)?.name || 'Unassigned',
          coachEmail: (enrollment.coaches as any)?.email || '',
          status: enrollment.status,
          riskLevel,
          programStart: enrollment.program_start,
          programEnd: enrollment.program_end,
          daysRemaining,
          sessionsCompleted: completed,
          sessionsTotal: 9,
          lastSessionDate,
          daysSinceLastSession,
          hasInitialAssessment,
          hasFinalAssessment,
          finalAssessmentSent,
          npsSubmitted: !!enrollment.nps_submitted_at,
          npsScore: enrollment.nps_score,
          certificateNumber: enrollment.certificate_number,
          completedAt: enrollment.completed_at,
        };
      })
    );

    // Update risk levels in database (batch update)
    const riskUpdates = enrichedEnrollments
      .filter(e => e.status !== 'completed')
      .map(e => ({ id: e.id, risk_level: e.riskLevel }));

    if (riskUpdates.length > 0) {
      for (const update of riskUpdates) {
        await supabase
          .from('enrollments')
          .update({ risk_level: update.risk_level, updated_at: new Date().toISOString() })
          .eq('id', update.id);
      }
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'completion_list_success', count: enrichedEnrollments.length, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      enrollments: enrichedEnrollments,
      summary: {
        total: enrichedEnrollments.length,
        overdue: enrichedEnrollments.filter(e => e.riskLevel === 'overdue').length,
        atRisk: enrichedEnrollments.filter(e => e.riskLevel === 'at_risk').length,
        inactive: enrichedEnrollments.filter(e => e.riskLevel === 'inactive').length,
        ready: enrichedEnrollments.filter(e => e.riskLevel === 'ready').length,
        onTrack: enrichedEnrollments.filter(e => e.riskLevel === 'on_track').length,
        completed: enrichedEnrollments.filter(e => e.riskLevel === 'completed').length,
      },
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'completion_list_error', error: error.message }));
    return NextResponse.json({ success: false, error: error.message, requestId }, { status: 500 });
  }
}
