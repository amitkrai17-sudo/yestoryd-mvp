// ============================================================
// Cron: Session Start In-App Notification
// Runs every 15 min via dispatcher. Finds sessions starting in
// the next 15 min and inserts in_app_notifications for coaches.
// Coach sees: "Session with Ira Rai starting — Open Session Notes"
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/api/verify-cron';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyCronRequest(request);
  if (!auth.isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // IST offset: UTC+5:30
    const now = new Date();
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const in15 = new Date(istNow.getTime() + 15 * 60 * 1000);

    const todayIST = istNow.toISOString().split('T')[0];
    const nowTimeIST = istNow.toTimeString().substring(0, 5); // HH:MM
    const in15TimeIST = in15.toTimeString().substring(0, 5);

    // Find sessions starting in the next 15 minutes
    const { data: sessions } = await supabase
      .from('scheduled_sessions')
      .select('id, child_id, coach_id, scheduled_time, children(child_name), coaches(user_id)')
      .eq('scheduled_date', todayIST)
      .gte('scheduled_time', nowTimeIST)
      .lt('scheduled_time', in15TimeIST)
      .in('status', ['scheduled', 'confirmed', 'rescheduled']);

    if (!sessions?.length) {
      return NextResponse.json({ success: true, notified: 0 });
    }

    let notified = 0;

    for (const session of sessions) {
      const child = session.children as any;
      const coach = session.coaches as any;
      if (!coach?.user_id) continue;

      // Check if notification already sent for this session
      const { data: existing } = await supabase
        .from('in_app_notifications')
        .select('id')
        .eq('metadata->>session_id', session.id)
        .eq('notification_type', 'action')
        .limit(1)
        .maybeSingle();

      if (existing) continue;

      const childName = child?.child_name || 'Child';

      await supabase
        .from('in_app_notifications')
        .insert({
          user_id: coach.user_id,
          user_type: 'coach',
          title: `Session with ${childName} starting`,
          body: 'Open Session Notes to capture observations during the session.',
          notification_type: 'action',
          action_url: `/coach/sessions?openNotes=${session.id}`,
          metadata: { session_id: session.id, child_id: session.child_id },
        });

      notified++;
    }

    return NextResponse.json({ success: true, notified });
  } catch (err) {
    console.error('[session-start-notify] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
