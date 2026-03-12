// ============================================================
// FILE: app/api/group-classes/waitlist/join/route.ts
// ============================================================
// Add a child to the waitlist for a full group session.
// Returns the waitlist position.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { COMPANY_CONFIG } from '@/lib/config/company-config';

export const dynamic = 'force-dynamic';

const getSupabase = createAdminClient;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, childId, parentId } = body;

    if (!sessionId || !childId || !parentId) {
      return NextResponse.json({ error: 'Missing required fields: sessionId, childId, parentId' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify session exists and is open
    const { data: session } = await supabase
      .from('group_sessions')
      .select('id, title, status, max_participants, current_participants, waitlist_enabled, group_class_types ( name )')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'cancelled' || session.status === 'completed') {
      return NextResponse.json({ error: 'Session is no longer accepting registrations' }, { status: 400 });
    }

    // Check if already registered
    const { data: existingReg } = await supabase
      .from('group_session_participants')
      .select('id')
      .eq('group_session_id', sessionId)
      .eq('child_id', childId)
      .is('cancelled_at', null)
      .limit(1)
      .maybeSingle();

    if (existingReg) {
      return NextResponse.json({ error: 'Child is already registered for this session' }, { status: 400 });
    }

    // Check if already on waitlist
    const { data: existingWaitlist } = await supabase
      .from('group_class_waitlist')
      .select('id, position')
      .eq('group_session_id', sessionId)
      .eq('child_id', childId)
      .eq('status', 'waiting')
      .maybeSingle();

    if (existingWaitlist) {
      return NextResponse.json({
        success: true,
        already_on_waitlist: true,
        waitlist_id: existingWaitlist.id,
        position: existingWaitlist.position,
      });
    }

    // Get next position
    const { count: currentCount } = await supabase
      .from('group_class_waitlist')
      .select('id', { count: 'exact', head: true })
      .eq('group_session_id', sessionId)
      .in('status', ['waiting', 'notified']);

    const position = (currentCount || 0) + 1;

    // Insert waitlist entry
    const { data: entry, error: insertErr } = await supabase
      .from('group_class_waitlist')
      .insert({
        group_session_id: sessionId,
        child_id: childId,
        parent_id: parentId,
        position,
        status: 'waiting',
      })
      .select('id, position')
      .single();

    if (insertErr) {
      console.error('[waitlist-join] Insert failed:', insertErr.message);
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 });
    }

    const classType = Array.isArray(session.group_class_types)
      ? session.group_class_types[0]
      : session.group_class_types;
    const className = classType?.name || session.title || 'Group Class';

    // Activity log
    try {
      await supabase.from('activity_log').insert({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system',
        action: 'group_class_waitlist_joined',
        metadata: {
          session_id: sessionId,
          child_id: childId,
          parent_id: parentId,
          position,
          class_name: className,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      waitlist_id: entry.id,
      position: entry.position,
      class_name: className,
    });
  } catch (error) {
    console.error('[waitlist-join] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
