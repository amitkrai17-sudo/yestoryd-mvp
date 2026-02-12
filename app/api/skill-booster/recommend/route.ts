// ============================================================
// FILE: app/api/skill-booster/recommend/route.ts
// PURPOSE: Coach recommends Skill Booster session for a child
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Service client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Auth client for token verification
const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // 1. Get Bearer token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // 2. Verify the token and get user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 3. Check if user is a coach
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, email')
      .eq('email', user.email)
      .single();

    if (coachError || !coach) {
      return NextResponse.json({ error: 'Not authorized as coach' }, { status: 403 });
    }

    // 4. Parse request body
    const { childId, enrollmentId, focusArea, coachNotes } = await request.json();

    // 5. Validate required fields
    if (!childId || !enrollmentId || !focusArea) {
      return NextResponse.json({ error: 'Missing required fields: childId, enrollmentId, focusArea' }, { status: 400 });
    }

    // 6. Check enrollment exists and has remaining Skill Booster slots
    // Note: DB columns still use 'remedial' naming for backwards compatibility
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, coach_id, remedial_sessions_used, remedial_sessions_max, child_id, session_duration_minutes')
      .eq('id', enrollmentId)
      .eq('status', 'active')
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Active enrollment not found' }, { status: 404 });
    }

    // 7. Verify coach is assigned to this enrollment
    if (enrollment.coach_id !== coach.id) {
      return NextResponse.json({ error: 'Not authorized for this child' }, { status: 403 });
    }

    // 8. Check Skill Booster slots remaining
    const used = enrollment.remedial_sessions_used || 0;
    const max = enrollment.remedial_sessions_max || 3;

    if (used >= max) {
      return NextResponse.json({
        error: 'Maximum Skill Booster sessions reached for this enrollment'
      }, { status: 400 });
    }

    // 9. Check no pending Skill Booster already exists
    const { data: existingPending } = await supabase
      .from('scheduled_sessions')
      .select('id')
      .eq('enrollment_id', enrollmentId)
      .eq('session_type', 'remedial') // DB still uses 'remedial' type
      .in('status', ['pending_booking', 'scheduled'])
      .limit(1);

    if (existingPending && existingPending.length > 0) {
      return NextResponse.json({
        error: 'A Skill Booster session is already pending or scheduled'
      }, { status: 400 });
    }

    // 10. Create Skill Booster session in scheduled_sessions
    const today = new Date();
    const { data: newSession, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .insert({
        child_id: childId,
        coach_id: coach.id,
        enrollment_id: enrollmentId,
        session_type: 'remedial', // DB still uses 'remedial' type
        status: 'pending_booking',
        scheduled_date: today.toISOString().split('T')[0], // Placeholder
        scheduled_time: '00:00:00', // Placeholder
        duration_minutes: enrollment.session_duration_minutes || 45,
        focus_area: focusArea,
        coach_notes: coachNotes || null,
        remedial_trigger_source: 'coach_manual',
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Failed to create Skill Booster session:', sessionError);
      return NextResponse.json({ error: 'Failed to create session: ' + sessionError.message }, { status: 500 });
    }

    // 11. Increment sessions used counter
    const { error: updateError } = await supabase
      .from('enrollments')
      .update({
        remedial_sessions_used: used + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', enrollmentId);

    if (updateError) {
      console.error('Failed to update enrollment:', updateError);
    }

    // 12. Get child and parent details for notification
    const { data: childData } = await supabase
      .from('children')
      .select('child_name, name, parent_email, parent_phone')
      .eq('id', childId)
      .single();

    // 13. Log success
    console.log(`[Skill Booster] Coach ${coach.name} recommended session for child ${childId}, focus: ${focusArea}`);

    // 14. TODO: Trigger WhatsApp/Email notification to parent
    // This would call your communication API

    return NextResponse.json({
      success: true,
      sessionId: newSession.id,
      message: 'Skill Booster session recommended successfully',
      remainingSlots: max - (used + 1),
      bookingLink: `${process.env.NEXT_PUBLIC_APP_URL || 'https://yestoryd.com'}/parent/book-skill-booster/${newSession.id}`
    });

  } catch (error: any) {
    console.error('Skill Booster recommend error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 });
  }
}
