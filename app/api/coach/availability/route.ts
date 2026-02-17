// app/api/coach/availability/route.ts
// Coach self-service: Manage availability and time off
// Yestoryd - AI-Powered Reading Intelligence Platform

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();
// Configuration
const MIN_NOTICE_DAYS = 7;           // Minimum notice for planned absence
const MIN_NOTICE_DAYS_EMERGENCY = 1; // Emergency minimum
const MAX_ABSENCE_DAYS = 30;         // Max absence before permanent reassignment

// ============================================
// GET - Get coach availability and upcoming absences
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
      return NextResponse.json({ error: 'Coach ID required' }, { status: 400 });
    }

    // Get coach details
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email, max_students, current_students, is_available')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    // Get upcoming unavailabilities
    const { data: unavailabilities } = await supabase
      .from('coach_availability')
      .select('*')
      .eq('coach_id', coachId)
      .in('status', ['upcoming', 'active'])
      .order('start_date', { ascending: true });

    // Get active students
    const { data: activeStudents } = await supabase
      .from('enrollments')
      .select(`
        id, status,
        children (id, name)
      `)
      .eq('coach_id', coachId)
      .eq('status', 'active')
      .eq('is_paused', false);

    // Get upcoming sessions
    const { data: upcomingSessions } = await supabase
      .from('scheduled_sessions')
      .select('id, scheduled_date, session_type, children (name)')
      .eq('coach_id', coachId)
      .eq('status', 'scheduled')
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true })
      .limit(10);

    return NextResponse.json({
      success: true,
      data: {
        coach: {
          id: coach.id,
          name: coach.name,
          email: coach.email,
          isAvailable: coach.is_available,
          capacity: {
            max: coach.max_students,
            current: coach.current_students,
            available: (coach.max_students || 30) - (coach.current_students || 0),
          },
        },
        unavailabilities: unavailabilities || [],
        activeStudents: (activeStudents || []).map(e => ({
          enrollmentId: e.id,
          childName: (e.children as any)?.name,
        })),
        upcomingSessions: (upcomingSessions || []).map(s => ({
          id: s.id,
          date: s.scheduled_date,
          type: s.session_type,
          childName: (s.children as any)?.name,
        })),
      },
    });

  } catch (error: any) {
    console.error('Error getting coach availability:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// POST - Create new unavailability
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      coachId,
      type = 'unavailable',    // 'unavailable', 'reduced_capacity', 'vacation'
      startDate,
      endDate,
      reason,                   // 'vacation', 'medical', 'personal', 'training', 'emergency'
      notifyParents = true,
      backupCoachId = null,
    } = body;

    // Validate required fields
    if (!coachId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Coach ID, start date, and end date are required' },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (end <= start) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    const daysUntilStart = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const absenceDuration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Check minimum notice (except for emergencies)
    const isEmergency = reason === 'emergency' || reason === 'medical';
    const minNotice = isEmergency ? MIN_NOTICE_DAYS_EMERGENCY : MIN_NOTICE_DAYS;

    if (daysUntilStart < minNotice) {
      return NextResponse.json(
        { error: `Minimum ${minNotice} days notice required${isEmergency ? ' for emergencies' : ''}` },
        { status: 400 }
      );
    }

    // Get affected sessions and students
    const { data: affectedSessions } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, enrollment_id, scheduled_date,
        children (id, name),
        enrollments (id, parent_id, parents (id, name, email, phone))
      `)
      .eq('coach_id', coachId)
      .eq('status', 'scheduled')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate);

    const affectedCount = affectedSessions?.length || 0;

    // Determine resolution strategy
    let resolutionType: string;
    let warningMessage: string | null = null;

    if (absenceDuration <= 7) {
      resolutionType = 'reschedule';
      warningMessage = `${affectedCount} sessions will be rescheduled after your return`;
    } else if (absenceDuration <= 21) {
      resolutionType = 'backup_needed';
      if (backupCoachId) {
        resolutionType = 'backup_assigned';
        warningMessage = `${affectedCount} sessions will be handled by backup coach`;
      } else {
        warningMessage = `${affectedCount} sessions need backup coach assignment`;
      }
    } else {
      resolutionType = 'reassignment_needed';
      warningMessage = `Long absence (${absenceDuration} days) - students may be permanently reassigned`;
    }

    // Create unavailability record
    const { data: unavailability, error: insertError } = await supabase
      .from('coach_availability')
      .insert({
        coach_id: coachId,
        type,
        start_date: startDate,
        end_date: endDate,
        reason,
        notify_parents: notifyParents,
        backup_coach_id: backupCoachId,
        status: 'upcoming',
        resolution_type: resolutionType,
        affected_sessions: affectedCount,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // If backup coach provided, notify them
    if (backupCoachId) {
      // TODO: Send notification to backup coach
    }

    // If notify parents, queue notifications
    if (notifyParents && affectedCount > 0) {
      // Get unique parents
      const parentIds = new Set(
        affectedSessions?.map(s => (s.enrollments as any)?.parent_id).filter(Boolean)
      );

      // TODO: Queue WhatsApp notifications
      // for (const parentId of parentIds) {
      //   await sendWhatsApp(phone, 'coach_unavailable', {...});
      // }
    }

    // Get unique affected student names
    const affectedStudentNames = Array.from(
      new Set(affectedSessions?.map(s => (s.children as any)?.name).filter(Boolean))
    );

    return NextResponse.json({
      success: true,
      message: 'Unavailability recorded successfully',
      data: {
        unavailabilityId: unavailability.id,
        startDate,
        endDate,
        duration: absenceDuration,
        resolutionType,
        affectedSessions: affectedCount,
        warning: warningMessage,
        affectedStudents: affectedStudentNames,
      },
    });

  } catch (error: any) {
    console.error('Error creating unavailability:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// PUT - Update existing unavailability
// ============================================
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { unavailabilityId, ...updates } = body;

    if (!unavailabilityId) {
      return NextResponse.json({ error: 'Unavailability ID required' }, { status: 400 });
    }

    // Only allow updating upcoming unavailabilities
    const { data: existing } = await supabase
      .from('coach_availability')
      .select('status')
      .eq('id', unavailabilityId)
      .single();

    if (existing?.status !== 'upcoming') {
      return NextResponse.json(
        { error: 'Can only modify upcoming unavailabilities' },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from('coach_availability')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', unavailabilityId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Unavailability updated',
      data: updated,
    });

  } catch (error: any) {
    console.error('Error updating unavailability:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// DELETE - Cancel unavailability
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unavailabilityId = searchParams.get('id');

    if (!unavailabilityId) {
      return NextResponse.json({ error: 'Unavailability ID required' }, { status: 400 });
    }

    // Only allow canceling upcoming unavailabilities
    const { data: existing } = await supabase
      .from('coach_availability')
      .select('status')
      .eq('id', unavailabilityId)
      .single();

    if (existing?.status !== 'upcoming') {
      return NextResponse.json(
        { error: 'Can only cancel upcoming unavailabilities' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('coach_availability')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', unavailabilityId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Unavailability cancelled',
    });

  } catch (error: any) {
    console.error('Error cancelling unavailability:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// PATCH - Get impact preview before creating
// ============================================
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { coachId, startDate, endDate } = body;

    if (!coachId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Coach ID, start date, and end date required' },
        { status: 400 }
      );
    }

    // Get affected sessions
    const { data: affectedSessions } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, scheduled_date, session_type,
        children (id, name),
        enrollments (id, parent_id)
      `)
      .eq('coach_id', coachId)
      .eq('status', 'scheduled')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate);

    const duration = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Group by child
    const childrenAffected = new Map();
    for (const session of affectedSessions || []) {
      const childName = (session.children as any)?.name || 'Unknown';
      if (!childrenAffected.has(childName)) {
        childrenAffected.set(childName, { sessions: 0 });
      }
      childrenAffected.get(childName).sessions++;
    }

    // Determine resolution
    let resolution: string;
    let recommendation: string;

    if (duration <= 7) {
      resolution = 'Sessions will be automatically rescheduled';
      recommendation = 'Short absence - sessions will move to after your return';
    } else if (duration <= 21) {
      resolution = 'Backup coach assignment recommended';
      recommendation = 'Medium absence - assign a backup coach to cover sessions';
    } else {
      resolution = 'Students may need permanent reassignment';
      recommendation = 'Long absence - consider permanently reassigning students';
    }

    // Convert Map to array
    const studentsArray = Array.from(childrenAffected.entries()).map(([name, data]) => ({
      name,
      sessions: (data as any).sessions,
    }));

    return NextResponse.json({
      success: true,
      preview: {
        duration,
        sessionsAffected: affectedSessions?.length || 0,
        studentsAffected: childrenAffected.size,
        students: studentsArray,
        resolution,
        recommendation,
      },
    });

  } catch (error: any) {
    console.error('Error getting impact preview:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}