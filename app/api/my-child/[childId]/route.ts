// ============================================================
// FILE: app/api/my-child/[childId]/route.ts
// ============================================================
// Data API for the "My Child" portal.
// Auth: HMAC-signed token (query param) OR parent_phone (body).
// Returns child overview, class history, skills, badges,
// upcoming classes, and attendance count for CTA variant.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decodeMyChildToken } from '@/lib/group-classes/my-child-token';
import { normalizePhone } from '@/lib/utils/phone';

export const dynamic = 'force-dynamic';

const getSupabase = createAdminClient;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  const { childId } = await params;
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 401 });
  }

  const payload = decodeMyChildToken(token);
  if (!payload || payload.child_id !== childId) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });
  }

  const supabase = getSupabase();

  // ── Verify child belongs to this parent (by phone) ──
  const parentPhone = normalizePhone(payload.parent_phone);

  const { data: child } = await supabase
    .from('children')
    .select('id, child_name, age, age_band, parent_phone, parent_id, is_enrolled, current_streak, sessions_completed')
    .eq('id', childId)
    .single();

  if (!child) {
    return NextResponse.json({ error: 'Child not found' }, { status: 404 });
  }

  // Verify phone matches
  const childParentPhone = normalizePhone(child.parent_phone || '');
  if (parentPhone && childParentPhone && parentPhone !== childParentPhone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // ── Section 1: Attendance count ──
  const { count: totalClassesAttended } = await supabase
    .from('group_session_participants')
    .select('id', { count: 'exact', head: true })
    .eq('child_id', childId)
    .eq('attendance_status', 'present');

  // ── Section 2: Class history with micro-insights (last 20) ──
  const { data: insights } = await supabase
    .from('learning_events')
    .select('id, event_type, event_date, event_data, created_at')
    .eq('child_id', childId)
    .in('event_type', ['group_class_observation', 'group_class_micro_insight'])
    .order('created_at', { ascending: false })
    .limit(20);

  // ── Section 3: Skills explored ──
  // Get attended sessions → class types → skill_tags
  const { data: attendedSessions } = await supabase
    .from('group_session_participants')
    .select(`
      group_session_id,
      group_sessions!inner (
        id,
        class_type_id,
        group_class_types ( name, icon_emoji, skill_tags )
      )
    `)
    .eq('child_id', childId)
    .eq('attendance_status', 'present')
    .order('registration_date', { ascending: false });

  // Aggregate skill tags
  const skillCounts: Record<string, number> = {};
  const classHistory: Array<{
    session_id: string;
    class_name: string;
    class_icon: string;
    date: string;
  }> = [];

  if (attendedSessions) {
    for (const p of attendedSessions) {
      const gs = Array.isArray(p.group_sessions)
        ? p.group_sessions[0]
        : p.group_sessions;
      if (!gs) continue;

      const ct = Array.isArray(gs.group_class_types)
        ? gs.group_class_types[0]
        : gs.group_class_types;

      const tags = ct?.skill_tags;
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          if (typeof tag === 'string') {
            skillCounts[tag] = (skillCounts[tag] || 0) + 1;
          }
        }
      }
    }
  }

  const skillsExplored = Object.entries(skillCounts)
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count);

  // ── Section 4: Badges earned ──
  const { data: badges } = await supabase
    .from('el_child_badges')
    .select('id, earned_at, earned_context, el_badges ( name, icon, description, rarity )')
    .eq('child_id', childId)
    .order('earned_at', { ascending: false });

  // Gamification stats
  const { data: gamification } = await supabase
    .from('el_child_gamification')
    .select('group_class_streak, group_class_total_attended, total_xp, current_level')
    .eq('child_id', childId)
    .maybeSingle();

  // ── Section 5: Recommended next classes ──
  const today = new Date().toISOString().split('T')[0];

  // Get child's attended class type IDs to deprioritize
  const attendedClassTypeIds = new Set<string>();
  if (attendedSessions) {
    for (const p of attendedSessions) {
      const gs = Array.isArray(p.group_sessions)
        ? p.group_sessions[0]
        : p.group_sessions;
      if (gs?.class_type_id) attendedClassTypeIds.add(gs.class_type_id);
    }
  }

  const childAge = child.age || 0;

  const { data: upcomingSessions } = await supabase
    .from('group_sessions')
    .select(`
      id, title, scheduled_date, scheduled_time, price_inr,
      class_type_id, max_participants, current_participants,
      group_class_types ( name, icon_emoji, description, skill_tags )
    `)
    .eq('status', 'open')
    .gte('scheduled_date', today)
    .order('scheduled_date', { ascending: true })
    .limit(20);

  // Filter by age and prioritize new class types
  const recommended = (upcomingSessions || [])
    .filter((s) => {
      // Capacity check
      if (s.max_participants && s.current_participants && s.current_participants >= s.max_participants) return false;
      return true;
    })
    .sort((a, b) => {
      // Prioritize class types the child hasn't tried
      const aNew = !attendedClassTypeIds.has(a.class_type_id || '');
      const bNew = !attendedClassTypeIds.has(b.class_type_id || '');
      if (aNew !== bNew) return aNew ? -1 : 1;
      return 0; // keep date order
    })
    .slice(0, 3)
    .map((s) => {
      const ct = Array.isArray(s.group_class_types)
        ? s.group_class_types[0]
        : s.group_class_types;
      return {
        session_id: s.id,
        title: ct?.name || s.title || 'Workshop',
        icon: ct?.icon_emoji || null,
        description: ct?.description || null,
        date: s.scheduled_date,
        time: s.scheduled_time,
        price: s.price_inr,
        is_new_type: !attendedClassTypeIds.has(s.class_type_id || ''),
      };
    });

  // ── Build response ──
  const attendanceCount = totalClassesAttended || 0;

  // Format insights with session context
  const classHistoryWithInsights = (insights || []).map((e) => {
    const data = e.event_data as Record<string, unknown> | null;
    return {
      id: e.id,
      event_type: e.event_type,
      date: e.event_date,
      insight_text: (data?.insight_text as string) || null,
      class_name: (data?.class_name as string) || null,
      session_id: (data?.session_id as string) || null,
      badges_earned: (data?.badges_earned as string[]) || [],
      attendance_count: (data?.attendance_count as number) || null,
    };
  });

  return NextResponse.json({
    child: {
      id: child.id,
      name: child.child_name,
      age: child.age,
      age_band: child.age_band,
      is_enrolled: child.is_enrolled,
      current_streak: gamification?.group_class_streak || child.current_streak || 0,
      total_classes_attended: attendanceCount,
    },
    class_history: classHistoryWithInsights,
    skills_explored: skillsExplored,
    badges: (badges || []).map((b) => {
      const badge = Array.isArray(b.el_badges) ? b.el_badges[0] : b.el_badges;
      return {
        id: b.id,
        name: badge?.name || 'Badge',
        icon: badge?.icon || null,
        description: badge?.description || null,
        rarity: badge?.rarity || null,
        earned_at: b.earned_at,
        context: b.earned_context,
      };
    }),
    gamification: gamification
      ? {
          streak: gamification.group_class_streak || 0,
          total_attended: gamification.group_class_total_attended || 0,
          xp: gamification.total_xp || 0,
          level: gamification.current_level || 1,
        }
      : null,
    recommended_classes: recommended,
    attendance_count: attendanceCount,
  });
}
