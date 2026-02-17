// ============================================================
// ADMIN SHADOW MODE API
// File: app/api/admin/shadow/route.ts
// GET - Get coach dashboard data (shadow view)
// POST - Log shadow action
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// =====================================================
// GET - Get coach dashboard data (shadow view)
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coach_id');
    const view = searchParams.get('view') || 'dashboard'; // dashboard, sessions, students, chat

    if (!coachId) {
      return NextResponse.json({ error: 'coach_id is required' }, { status: 400 });
    }

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(coachId)) {
      return NextResponse.json({ error: 'Invalid coach_id format' }, { status: 400 });
    }

    // Log shadow action
    await logShadowAction(auth, 'view_dashboard', 'coach', coachId, { view });

    // Get coach profile
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    let responseData: any = {
      coach,
      view,
    };

    // Fetch view-specific data
    switch (view) {
      case 'dashboard':
        responseData = {
          ...responseData,
          ...(await getCoachDashboardData(coachId)),
        };
        break;

      case 'sessions':
        responseData = {
          ...responseData,
          ...(await getCoachSessionsData(coachId)),
        };
        break;

      case 'students':
        responseData = {
          ...responseData,
          ...(await getCoachStudentsData(coachId)),
        };
        break;

      case 'chat':
        responseData = {
          ...responseData,
          ...(await getCoachChatData(coachId)),
        };
        break;

      case 'earnings':
        responseData = {
          ...responseData,
          ...(await getCoachEarningsData(coachId)),
        };
        break;
    }

    return NextResponse.json({
      success: true,
      shadow_mode: true,
      ...responseData,
    });

  } catch (error) {
    console.error('Shadow mode GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================
// POST - Log shadow action or perform admin action
// =====================================================
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action, target_type, target_id, details } = body;

    if (!action || !target_type || !target_id) {
      return NextResponse.json({ 
        error: 'action, target_type, and target_id are required' 
      }, { status: 400 });
    }

    // Validate action type
    const allowedActions = [
      'view_dashboard', 'view_chat', 'view_session', 'view_student',
      'verify_skill', 'unverify_skill', 'flag_message', 'unflag_message',
      'add_note', 'send_notification'
    ];

    if (!allowedActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
    }

    // Perform the action
    let result: any = { logged: true };

    switch (action) {
      case 'verify_skill':
        result = await verifyCoachSkills(auth, target_id, details?.skills || []);
        break;

      case 'unverify_skill':
        result = await unverifyCoachSkills(target_id);
        break;

      case 'flag_message':
        result = await flagMessage(auth, target_id, details?.reason || '');
        break;

      case 'unflag_message':
        result = await unflagMessage(target_id);
        break;

      case 'add_note':
        result = await addAdminNote(target_type, target_id, details?.note || '');
        break;
    }

    // Log the action
    await logShadowAction(auth, action, target_type, target_id, details);

    return NextResponse.json({
      success: true,
      action,
      result,
    });

  } catch (error) {
    console.error('Shadow mode POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================
// Helper: Log shadow action to audit log
// =====================================================
async function logShadowAction(
  auth: { userId?: string; email?: string },
  actionType: string,
  targetType: string,
  targetId: string,
  details?: any
): Promise<void> {
  try {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Get target name for easier viewing
    let targetName = '';
    try {
      if (targetType === 'coach') {
        const { data } = await supabase.from('coaches').select('name').eq('id', targetId).single();
        targetName = data?.name || '';
      } else if (targetType === 'child') {
        const { data } = await supabase.from('children').select('child_name').eq('id', targetId).single();
        targetName = data?.child_name || '';
      }
    } catch (e) {
      // Ignore name lookup errors
    }

    await supabase.from('admin_audit_log').insert({
      admin_id: auth.userId || 'unknown',
      admin_email: auth.email,
      action_type: actionType,
      action_category: 'shadow',
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      details,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (error) {
    console.error('Error logging shadow action:', error);
    // Don't throw - logging failure shouldn't break the main action
  }
}

// =====================================================
// Helper: Get coach dashboard data
// =====================================================
async function getCoachDashboardData(coachId: string) {
  // Get session stats
  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('status, scheduled_date')
    .eq('coach_id', coachId);

  const stats = {
    total_sessions: sessions?.length || 0,
    completed: sessions?.filter(s => s.status === 'completed').length || 0,
    upcoming: sessions?.filter(s => s.status === 'scheduled').length || 0,
    no_shows: sessions?.filter(s => s.status === 'no_show').length || 0,
    cancelled: sessions?.filter(s => s.status === 'cancelled').length || 0,
  };

  // Get student count
  const { count: studentCount } = await supabase
    .from('children')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_coach_id', coachId)
    .eq('status', 'enrolled');

  // Get recent activity
  const { data: recentActivity } = await supabase
    .from('scheduled_sessions')
    .select(`
      id,
      session_number,
      scheduled_date,
      status,
      children (child_name)
    `)
    .eq('coach_id', coachId)
    .order('scheduled_date', { ascending: false })
    .limit(10);

  return {
    stats,
    student_count: studentCount || 0,
    recent_activity: recentActivity || [],
  };
}

// =====================================================
// Helper: Get coach sessions data
// =====================================================
async function getCoachSessionsData(coachId: string) {
  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select(`
      *,
      children (
        id,
        child_name,
        age,
        parent_name
      )
    `)
    .eq('coach_id', coachId)
    .order('scheduled_date', { ascending: false })
    .limit(50);

  return { sessions: sessions || [] };
}

// =====================================================
// Helper: Get coach students data
// =====================================================
async function getCoachStudentsData(coachId: string) {
  const { data: students } = await supabase
    .from('children')
    .select(`
      *,
      parents (
        id,
        name,
        email,
        phone
      )
    `)
    .eq('assigned_coach_id', coachId)
    .eq('status', 'enrolled')
    .order('child_name');

  return { students: students || [] };
}

// =====================================================
// Helper: Get coach chat data
// =====================================================
async function getCoachChatData(coachId: string) {
  // Get coach's assigned children
  const { data: children } = await supabase
    .from('children')
    .select('id, child_name')
    .eq('assigned_coach_id', coachId)
    .eq('status', 'enrolled');

  if (!children || children.length === 0) {
    return { conversations: [] };
  }

  const childIds = children.map(c => c.id);

  // Get recent messages for each child
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .in('child_id', childIds)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(100);

  // Group by child
  const conversations = children.map(child => ({
    child_id: child.id,
    child_name: child.child_name,
    messages: (messages || []).filter(m => m.child_id === child.id).slice(0, 20),
    unread_count: (messages || []).filter(m => m.child_id === child.id && !m.is_read).length,
    flagged_count: (messages || []).filter(m => m.child_id === child.id && m.is_flagged).length,
  }));

  return { conversations };
}

// =====================================================
// Helper: Get coach earnings data
// =====================================================
async function getCoachEarningsData(coachId: string) {
  const { data: payouts } = await supabase
    .from('coach_payouts')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
    .limit(12);

  const { data: revenue } = await supabase
    .from('enrollment_revenue')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    payouts: payouts || [],
    revenue: revenue || [],
  };
}

// =====================================================
// Helper: Verify coach skills
// =====================================================
async function verifyCoachSkills(
  auth: { userId?: string },
  coachId: string,
  skills: string[]
) {
  const { data, error } = await supabase
    .from('coaches')
    .update({
      verified_at: new Date().toISOString(),
      verified_by: auth.userId,
    })
    .eq('id', coachId)
    .select()
    .single();

  if (error) throw error;
  return { verified: true, coach: data };
}

// =====================================================
// Helper: Unverify coach skills
// =====================================================
async function unverifyCoachSkills(coachId: string) {
  const { data, error } = await supabase
    .from('coaches')
    .update({
      verified_at: null,
      verified_by: null,
    })
    .eq('id', coachId)
    .select()
    .single();

  if (error) throw error;
  return { unverified: true, coach: data };
}

// =====================================================
// Helper: Flag message
// =====================================================
async function flagMessage(
  auth: { userId?: string },
  messageId: string,
  reason: string
) {
  const { data, error } = await supabase
    .from('messages')
    .update({
      is_flagged: true,
      flagged_by: auth.userId,
      flagged_reason: reason,
      flagged_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .select()
    .single();

  if (error) throw error;
  return { flagged: true, message: data };
}

// =====================================================
// Helper: Unflag message
// =====================================================
async function unflagMessage(messageId: string) {
  const { data, error } = await supabase
    .from('messages')
    .update({
      is_flagged: false,
      flagged_by: null,
      flagged_reason: null,
      flagged_at: null,
    })
    .eq('id', messageId)
    .select()
    .single();

  if (error) throw error;
  return { unflagged: true, message: data };
}

// =====================================================
// Helper: Add admin note
// =====================================================
async function addAdminNote(
  targetType: string,
  targetId: string,
  note: string
) {
  // Store in appropriate table based on target type
  if (targetType === 'coach') {
    const { data: coach } = await supabase
      .from('coaches')
      .select('notes')
      .eq('id', targetId)
      .single();

    const existingNotes = coach?.notes || '';
    const timestamp = new Date().toISOString().split('T')[0];
    const newNote = `[${timestamp}] ${note}`;
    const updatedNotes = existingNotes ? `${existingNotes}\n${newNote}` : newNote;

    await supabase
      .from('coaches')
      .update({ notes: updatedNotes })
      .eq('id', targetId);
  }

  return { note_added: true };
}
