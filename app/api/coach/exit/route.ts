// app/api/coach/exit/route.ts
// Coach exit workflow: Preview impact, confirm exit, cancel exit
// Yestoryd - AI-Powered Reading Intelligence Platform

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Minimum notice period (days)
const MIN_EXIT_NOTICE_DAYS = 14;

// ============================================
// GET - Preview exit impact
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const exitDate = searchParams.get('exitDate');

    if (!coachId || !exitDate) {
      return NextResponse.json(
        { error: 'Coach ID and exit date required' },
        { status: 400 }
      );
    }

    // Validate minimum notice
    const exit = new Date(exitDate);
    const now = new Date();
    const daysUntilExit = Math.ceil((exit.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExit < MIN_EXIT_NOTICE_DAYS) {
      return NextResponse.json(
        { error: `Minimum ${MIN_EXIT_NOTICE_DAYS} days notice required` },
        { status: 400 }
      );
    }

    // Get active students
    const { data: activeEnrollments } = await supabase
      .from('enrollments')
      .select(`
        id,
        child_id,
        children (id, name),
        status
      `)
      .eq('coach_id', coachId)
      .eq('status', 'active');

    // Get scheduled sessions after exit date
    const { data: futureSessions } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, scheduled_date')
      .eq('coach_id', coachId)
      .eq('status', 'scheduled')
      .gt('scheduled_date', exitDate);

    // Get sessions count per child
    const childSessionCounts = new Map<string, number>();
    for (const session of futureSessions || []) {
      const count = childSessionCounts.get(session.child_id) || 0;
      childSessionCounts.set(session.child_id, count + 1);
    }

    // Build student list with remaining sessions
    const students = (activeEnrollments || []).map(e => ({
      name: (e.children as any)?.name || 'Unknown',
      remainingSessions: childSessionCounts.get(e.child_id) || 0,
    }));

    // Get pending payouts (if any)
    const { data: pendingPayouts } = await supabase
      .from('coach_payouts')
      .select('amount')
      .eq('coach_id', coachId)
      .eq('status', 'pending');

    const totalPendingPayout = (pendingPayouts || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    return NextResponse.json({
      success: true,
      preview: {
        activeStudents: activeEnrollments?.length || 0,
        scheduledSessions: futureSessions?.length || 0,
        pendingPayouts: totalPendingPayout,
        students,
        daysUntilExit,
      },
    });

  } catch (error: any) {
    console.error('Error getting exit preview:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// POST - Confirm exit
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coachId, exitDate, exitReason, initiatedBy = 'coach' } = body;

    if (!coachId || !exitDate || !exitReason) {
      return NextResponse.json(
        { error: 'Coach ID, exit date, and reason required' },
        { status: 400 }
      );
    }

    // Validate minimum notice
    const exit = new Date(exitDate);
    const now = new Date();
    const daysUntilExit = Math.ceil((exit.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExit < MIN_EXIT_NOTICE_DAYS && initiatedBy === 'coach') {
      return NextResponse.json(
        { error: `Minimum ${MIN_EXIT_NOTICE_DAYS} days notice required` },
        { status: 400 }
      );
    }

    // Check if already exiting
    const { data: existingCoach } = await supabase
      .from('coaches')
      .select('exit_status, name, email')
      .eq('id', coachId)
      .single();

    if (existingCoach?.exit_status === 'pending') {
      return NextResponse.json(
        { error: 'Exit already scheduled' },
        { status: 400 }
      );
    }

    // Update coach with exit info
    const { error: updateError } = await supabase
      .from('coaches')
      .update({
        exit_status: 'pending',
        exit_date: exitDate,
        exit_reason: exitReason,
        exit_initiated_by: initiatedBy,
        is_accepting_new: false, // Stop accepting new students
        updated_at: new Date().toISOString(),
      })
      .eq('id', coachId);

    if (updateError) throw updateError;

    // Get impact stats for notification
    const { data: activeEnrollments } = await supabase
      .from('enrollments')
      .select('id')
      .eq('coach_id', coachId)
      .eq('status', 'active');

    const studentsToReassign = activeEnrollments?.length || 0;

    // TODO: Send notification to admin about coach exit
    // await sendAdminNotification({
    //   type: 'coach_exit',
    //   coachName: existingCoach?.name,
    //   coachEmail: existingCoach?.email,
    //   exitDate,
    //   exitReason,
    //   studentsToReassign,
    // });

    // TODO: Send confirmation to coach
    // await sendCoachNotification({
    //   type: 'exit_confirmed',
    //   email: existingCoach?.email,
    //   exitDate,
    // });

    console.log(`Coach exit scheduled: ${existingCoach?.name} (${coachId}), Last day: ${exitDate}, Reason: ${exitReason}, Students to reassign: ${studentsToReassign}`);

    return NextResponse.json({
      success: true,
      message: 'Exit scheduled successfully',
      data: {
        exitDate,
        exitReason,
        studentsToReassign,
        daysUntilExit,
      },
    });

  } catch (error: any) {
    console.error('Error confirming exit:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// DELETE - Cancel exit
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { coachId } = body;

    if (!coachId) {
      return NextResponse.json({ error: 'Coach ID required' }, { status: 400 });
    }

    // Check if exit is pending
    const { data: coach } = await supabase
      .from('coaches')
      .select('exit_status, name')
      .eq('id', coachId)
      .single();

    if (coach?.exit_status !== 'pending') {
      return NextResponse.json(
        { error: 'No pending exit to cancel' },
        { status: 400 }
      );
    }

    // Clear exit fields
    const { error: updateError } = await supabase
      .from('coaches')
      .update({
        exit_status: null,
        exit_date: null,
        exit_reason: null,
        exit_initiated_by: null,
        is_accepting_new: true, // Resume accepting students
        updated_at: new Date().toISOString(),
      })
      .eq('id', coachId);

    if (updateError) throw updateError;

    console.log(`Coach exit cancelled: ${coach?.name} (${coachId})`);

    return NextResponse.json({
      success: true,
      message: 'Exit cancelled successfully',
    });

  } catch (error: any) {
    console.error('Error cancelling exit:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}