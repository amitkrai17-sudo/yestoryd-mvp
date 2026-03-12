// ============================================================
// FILE: app/my-child/[childId]/page.tsx
// ============================================================
// Server component for the "My Child" portal.
// Validates HMAC token, fetches data, passes to client.
// Standalone page — no navigation bar or parent portal chrome.
// ============================================================

import { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { decodeMyChildToken } from '@/lib/group-classes/my-child-token';
import { normalizePhone } from '@/lib/utils/phone';
import MyChildPortalClient from './MyChildPortalClient';

export const metadata: Metadata = {
  title: "My Child's Learning Journey | Yestoryd",
  description: 'See your child\'s group class progress, skills explored, and badges earned.',
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function MyChildPage({ params, searchParams }: PageProps) {
  const { childId } = await params;
  const { token } = await searchParams;

  // No token → show phone verification form
  if (!token) {
    return <MyChildPortalClient childId={childId} authState="needs_phone" data={null} token={null} />;
  }

  // Validate token
  const payload = decodeMyChildToken(token);
  if (!payload || payload.child_id !== childId) {
    return <MyChildPortalClient childId={childId} authState="invalid_token" data={null} token={null} />;
  }

  const supabase = createAdminClient();
  const parentPhone = normalizePhone(payload.parent_phone);

  // Fetch child
  const { data: child } = await supabase
    .from('children')
    .select('id, child_name, age, age_band, parent_phone, parent_id, is_enrolled, current_streak')
    .eq('id', childId)
    .single();

  if (!child) {
    return <MyChildPortalClient childId={childId} authState="not_found" data={null} token={null} />;
  }

  // Verify phone
  const childParentPhone = normalizePhone(child.parent_phone || '');
  if (parentPhone && childParentPhone && parentPhone !== childParentPhone) {
    return <MyChildPortalClient childId={childId} authState="invalid_token" data={null} token={null} />;
  }

  // ── Fetch all portal data in parallel ──
  const [
    attendanceResult,
    insightsResult,
    attendedSessionsResult,
    badgesResult,
    gamificationResult,
    upcomingResult,
  ] = await Promise.all([
    // Attendance count
    supabase
      .from('group_session_participants')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', childId)
      .eq('attendance_status', 'present'),

    // Micro-insights (last 20)
    supabase
      .from('learning_events')
      .select('id, event_type, event_date, event_data, created_at')
      .eq('child_id', childId)
      .in('event_type', ['group_class_observation', 'group_class_micro_insight'])
      .order('created_at', { ascending: false })
      .limit(20),

    // Attended sessions for skills + history
    supabase
      .from('group_session_participants')
      .select(`
        group_session_id,
        group_sessions!inner (
          id, scheduled_date, class_type_id,
          group_class_types ( name, icon_emoji, skill_tags )
        )
      `)
      .eq('child_id', childId)
      .eq('attendance_status', 'present')
      .order('registration_date', { ascending: false }),

    // Badges
    supabase
      .from('el_child_badges')
      .select('id, earned_at, earned_context, el_badges ( name, icon, description, rarity )')
      .eq('child_id', childId)
      .order('earned_at', { ascending: false }),

    // Gamification
    supabase
      .from('el_child_gamification')
      .select('group_class_streak, group_class_total_attended, total_xp, current_level')
      .eq('child_id', childId)
      .maybeSingle(),

    // Upcoming open sessions
    supabase
      .from('group_sessions')
      .select(`
        id, title, scheduled_date, scheduled_time, price_inr,
        class_type_id, max_participants, current_participants,
        group_class_types ( name, icon_emoji, description )
      `)
      .eq('status', 'open')
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true })
      .limit(20),
  ]);

  // ── Process skills ──
  const skillCounts: Record<string, number> = {};
  const attendedClassTypeIds = new Set<string>();

  if (attendedSessionsResult.data) {
    for (const p of attendedSessionsResult.data) {
      const gs = Array.isArray(p.group_sessions) ? p.group_sessions[0] : p.group_sessions;
      if (!gs) continue;
      if (gs.class_type_id) attendedClassTypeIds.add(gs.class_type_id);

      const ct = Array.isArray(gs.group_class_types) ? gs.group_class_types[0] : gs.group_class_types;
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

  // ── Process insights ──
  const classHistory = (insightsResult.data || []).map((e) => {
    const data = e.event_data as Record<string, unknown> | null;
    return {
      id: e.id,
      event_type: e.event_type,
      date: e.event_date,
      insight_text: (data?.insight_text as string) || null,
      class_name: (data?.class_name as string) || null,
      session_id: (data?.session_id as string) || null,
      badges_earned: (data?.badges_earned as string[]) || [],
    };
  });

  // ── Process badges ──
  const badges = (badgesResult.data || []).map((b) => {
    const badge = Array.isArray(b.el_badges) ? b.el_badges[0] : b.el_badges;
    return {
      id: b.id,
      name: badge?.name || 'Badge',
      icon: badge?.icon || null,
      description: badge?.description || null,
      rarity: badge?.rarity || null,
      earned_at: b.earned_at,
    };
  });

  // ── Process recommended classes ──
  const recommended = (upcomingResult.data || [])
    .filter((s) => {
      if (s.max_participants && s.current_participants && s.current_participants >= s.max_participants) return false;
      return true;
    })
    .sort((a, b) => {
      const aNew = !attendedClassTypeIds.has(a.class_type_id || '');
      const bNew = !attendedClassTypeIds.has(b.class_type_id || '');
      if (aNew !== bNew) return aNew ? -1 : 1;
      return 0;
    })
    .slice(0, 3)
    .map((s) => {
      const ct = Array.isArray(s.group_class_types) ? s.group_class_types[0] : s.group_class_types;
      return {
        session_id: s.id,
        title: ct?.name || s.title || 'Group Class',
        icon: ct?.icon_emoji || null,
        description: ct?.description || null,
        date: s.scheduled_date,
        time: s.scheduled_time,
        price: s.price_inr,
        is_new_type: !attendedClassTypeIds.has(s.class_type_id || ''),
      };
    });

  const gamification = gamificationResult.data;
  const attendanceCount = attendanceResult.count || 0;

  const portalData = {
    child: {
      id: child.id,
      name: child.child_name || 'Your Child',
      age: child.age,
      age_band: child.age_band,
      is_enrolled: child.is_enrolled,
      current_streak: gamification?.group_class_streak || child.current_streak || 0,
      total_classes_attended: attendanceCount,
    },
    class_history: classHistory,
    skills_explored: Object.entries(skillCounts)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count),
    badges,
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
  };

  return (
    <MyChildPortalClient
      childId={childId}
      authState="authenticated"
      data={portalData}
      token={token}
    />
  );
}
