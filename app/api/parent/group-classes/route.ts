// ============================================================
// FILE: app/api/parent/group-classes/route.ts
// ============================================================
// Parent Group Classes API — returns upcoming & past sessions,
// micro-insights, gamification stats, and earned badges.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get parent record
    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('email', auth.email ?? '')
      .maybeSingle();

    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    // Get parent's children
    const { data: children } = await supabase
      .from('children')
      .select('id, child_name, age')
      .eq('parent_id', parent.id);

    if (!children || children.length === 0) {
      return NextResponse.json({
        upcoming: [],
        past: [],
        stats: { total_attended: 0, current_streak: 0, badges_earned: 0 },
        badges: [],
      });
    }

    const childIds = children.map(c => c.id);
    const childNameMap = new Map(children.map(c => [c.id, c.child_name || 'Unknown']));
    const today = new Date().toISOString().split('T')[0];

    // Optional child_id filter
    const { searchParams } = new URL(request.url);
    const filterChildId = searchParams.get('child_id');
    const targetChildIds = filterChildId && childIds.includes(filterChildId)
      ? [filterChildId]
      : childIds;

    // Fetch all registrations for parent's children
    const { data: registrations } = await supabase
      .from('group_session_participants')
      .select(`
        id, child_id, attendance_status, participation_rating, participation_notes,
        is_enrolled_free,
        group_sessions (
          id, title, scheduled_date, scheduled_time, status,
          google_meet_link, duration_minutes, blueprint_id,
          class_type_id,
          group_class_types ( id, name, slug, icon_emoji, color_hex )
        )
      `)
      .in('child_id', targetChildIds)
      .not('attendance_status', 'eq', 'cancelled')
      .order('created_at', { ascending: false });

    if (!registrations) {
      return NextResponse.json({
        upcoming: [],
        past: [],
        stats: { total_attended: 0, current_streak: 0, badges_earned: 0 },
        badges: [],
      });
    }

    // Separate into upcoming and past
    interface UpcomingSession {
      registration_id: string;
      session_id: string;
      child_id: string;
      child_name: string;
      title: string;
      scheduled_date: string;
      scheduled_time: string;
      duration_minutes: number;
      google_meet_link: string | null;
      class_type_name: string;
      class_type_slug: string;
      icon_emoji: string | null;
      color_hex: string | null;
      is_enrolled_free: boolean;
      has_blueprint: boolean;
    }

    interface PastSession {
      registration_id: string;
      session_id: string;
      child_id: string;
      child_name: string;
      title: string;
      scheduled_date: string;
      scheduled_time: string;
      class_type_name: string;
      class_type_slug: string;
      icon_emoji: string | null;
      color_hex: string | null;
      attendance_status: string | null;
      participation_rating: number | null;
      micro_insight: string | null;
      badges_earned: string[];
    }

    const upcoming: UpcomingSession[] = [];
    const past: PastSession[] = [];
    const pastSessionIds: string[] = [];

    for (const reg of registrations) {
      const session = reg.group_sessions as Record<string, unknown> | null;
      if (!session) continue;

      const classTypeRaw = session.group_class_types;
      const classType = (Array.isArray(classTypeRaw) ? classTypeRaw[0] : classTypeRaw) as Record<string, unknown> | null;

      const sessionDate = session.scheduled_date as string;
      const sessionStatus = session.status as string;
      const sessionId = session.id as string;
      const childName = childNameMap.get(reg.child_id || '') || 'Unknown';

      const isPast = sessionDate < today || sessionStatus === 'completed';
      const isUpcoming = !isPast && (reg.attendance_status === 'confirmed' || reg.attendance_status === 'registered');

      if (isUpcoming) {
        upcoming.push({
          registration_id: reg.id,
          session_id: sessionId,
          child_id: reg.child_id || '',
          child_name: childName,
          title: (session.title as string) || (classType?.name as string) || 'Group Class',
          scheduled_date: sessionDate,
          scheduled_time: (session.scheduled_time as string) || '',
          duration_minutes: (session.duration_minutes as number) || 45,
          google_meet_link: (session.google_meet_link as string) || null,
          class_type_name: (classType?.name as string) || 'Group Class',
          class_type_slug: (classType?.slug as string) || 'unknown',
          icon_emoji: (classType?.icon_emoji as string) || null,
          color_hex: (classType?.color_hex as string) || null,
          is_enrolled_free: reg.is_enrolled_free || false,
          has_blueprint: !!(session.blueprint_id),
        });
      } else if (isPast && reg.attendance_status === 'present') {
        pastSessionIds.push(sessionId);
        past.push({
          registration_id: reg.id,
          session_id: sessionId,
          child_id: reg.child_id || '',
          child_name: childName,
          title: (session.title as string) || (classType?.name as string) || 'Group Class',
          scheduled_date: sessionDate,
          scheduled_time: (session.scheduled_time as string) || '',
          class_type_name: (classType?.name as string) || 'Group Class',
          class_type_slug: (classType?.slug as string) || 'unknown',
          icon_emoji: (classType?.icon_emoji as string) || null,
          color_hex: (classType?.color_hex as string) || null,
          attendance_status: reg.attendance_status,
          participation_rating: reg.participation_rating,
          micro_insight: null,
          badges_earned: [],
        });
      }
    }

    // Sort upcoming by date ASC, past by date DESC
    upcoming.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    past.sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

    // Fetch micro-insights for past sessions
    if (past.length > 0) {
      const { data: insights } = await supabase
        .from('learning_events')
        .select('child_id, event_data')
        .in('child_id', targetChildIds)
        .eq('event_type', 'group_class_micro_insight')
        .order('created_at', { ascending: false });

      if (insights) {
        for (const pastSession of past) {
          const matchingInsight = insights.find(i => {
            const data = i.event_data as Record<string, unknown> | null;
            return i.child_id === pastSession.child_id && data?.session_id === pastSession.session_id;
          });
          if (matchingInsight) {
            const data = matchingInsight.event_data as Record<string, unknown>;
            pastSession.micro_insight = (data.insight_text as string) || null;
            const badges = data.badges_earned as string[] | undefined;
            pastSession.badges_earned = badges || [];
          }
        }
      }
    }

    // Limit past to 10
    const pastLimited = past.slice(0, 10);

    // Fetch gamification stats (aggregate across all children)
    let totalAttended = 0;
    let maxStreak = 0;

    for (const childId of targetChildIds) {
      const { data: gam } = await supabase
        .from('el_child_gamification')
        .select('group_class_total_attended, group_class_streak')
        .eq('child_id', childId)
        .maybeSingle();

      if (gam) {
        totalAttended += gam.group_class_total_attended || 0;
        if ((gam.group_class_streak || 0) > maxStreak) {
          maxStreak = gam.group_class_streak || 0;
        }
      }
    }

    // Fetch earned badges
    const { data: earnedBadges } = await supabase
      .from('el_child_badges')
      .select('id, earned_at, badge:el_badges ( name, icon, slug, description )')
      .in('child_id', targetChildIds)
      .order('earned_at', { ascending: false });

    // Filter to group_class badges
    const groupBadges = (earnedBadges || []).filter(b => {
      const badge = b.badge as Record<string, unknown> | null;
      return badge !== null;
    }).map(b => {
      const badge = b.badge as Record<string, unknown>;
      return {
        id: b.id,
        name: (badge.name as string) || '',
        icon: (badge.icon as string) || '',
        slug: (badge.slug as string) || '',
        description: (badge.description as string) || '',
        earned_at: b.earned_at,
      };
    });

    return NextResponse.json({
      upcoming,
      past: pastLimited,
      stats: {
        total_attended: totalAttended,
        current_streak: maxStreak,
        badges_earned: groupBadges.length,
      },
      badges: groupBadges,
    });

  } catch (error: unknown) {
    console.error('[parent/group-classes] Error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
