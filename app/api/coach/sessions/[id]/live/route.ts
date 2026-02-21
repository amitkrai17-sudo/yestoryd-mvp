// ============================================================
// FILE: app/api/coach/sessions/[id]/live/route.ts
// PURPOSE: Fetch all data needed for the Coach Companion Panel
//          + PATCH to mark session as in_progress on start
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getServiceSupabase();

    // 1. Get session details
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, child_id, coach_id, enrollment_id,
        session_type, session_number, session_title,
        is_diagnostic, session_template_id, duration_minutes,
        scheduled_date, scheduled_time, status,
        google_meet_link
      `)
      .eq('id', id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.child_id) {
      return NextResponse.json({ error: 'Session has no child assigned' }, { status: 400 });
    }

    // 2. Get child details (including streak columns from migration)
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, age, age_band, parent_name, parent_email, latest_assessment_score, current_streak')
      .eq('id', session.child_id)
      .single();

    // 3. Get enrollment details
    let totalSessions = 9;
    if (session.enrollment_id) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('total_sessions, age_band, session_duration_minutes, season_number')
        .eq('id', session.enrollment_id)
        .single();
      if (enrollment?.total_sessions) totalSessions = enrollment.total_sessions;
    }

    // 4. Get template details if assigned
    let template = null;
    if (session.session_template_id) {
      const { data: t } = await supabase
        .from('session_templates')
        .select(`
          id, template_code, title, description,
          activity_flow, materials_needed, coach_prep_notes,
          parent_involvement, skill_dimensions, difficulty_level,
          duration_minutes, is_diagnostic
        `)
        .eq('id', session.session_template_id)
        .single();
      template = t;
    }

    // 4b. Resolve content_refs → fetch asset details
    // Primary: single query to el_content_items (coach_guidance is directly on the item)
    // Fallback: legacy el_videos/el_worksheets/el_game_content tables
    let resolvedContentMap: Record<number, any[]> = {};
    if (template?.activity_flow && Array.isArray(template.activity_flow)) {
      try {
        // Collect all content_ref IDs
        const allContentIds: string[] = [];
        const refTypes: Record<string, string> = {}; // id → type

        for (const step of template.activity_flow as any[]) {
          if (!step.content_refs || !Array.isArray(step.content_refs)) continue;
          for (const ref of step.content_refs) {
            allContentIds.push(ref.id);
            refTypes[ref.id] = ref.type;
          }
        }

        if (allContentIds.length > 0) {
          // Try el_content_items first
          const { data: contentItems } = await (supabase as any)
            .from('el_content_items')
            .select('id, content_type, title, asset_url, asset_format, thumbnail_url, metadata, coach_guidance')
            .in('id', allContentIds)
            .eq('is_active', true);

          const contentMap = new Map<string, any>((contentItems || []).map((c: any) => [c.id, c]));

          // Check which IDs were NOT found in el_content_items (need legacy fallback)
          const missingIds = allContentIds.filter(id => !contentMap.has(id));

          // Legacy fallback for missing IDs
          if (missingIds.length > 0) {
            const videoIds = missingIds.filter(id => refTypes[id] === 'video');
            const gameIds = missingIds.filter(id => refTypes[id] === 'game');
            const worksheetIds = missingIds.filter(id => refTypes[id] === 'worksheet');

            const [videosRes, gamesRes, worksheetsRes] = await Promise.all([
              videoIds.length > 0
                ? supabase.from('el_videos').select('id, title, thumbnail_url, video_url, duration_seconds, skill_id').in('id', videoIds)
                : { data: [] },
              gameIds.length > 0
                ? supabase.from('el_game_content').select('id, title, skill_id').in('id', gameIds)
                : { data: [] },
              worksheetIds.length > 0
                ? supabase.from('el_worksheets').select('id, title, thumbnail_url, asset_url, asset_format, unit_id').in('id', worksheetIds)
                : { data: [] },
            ]);

            // Fetch coach_guidance from el_learning_units for legacy content
            const skillIds = [
              ...(videosRes.data || []).map((v: any) => v.skill_id),
              ...(gamesRes.data || []).map((g: any) => g.skill_id),
            ].filter(Boolean);
            const unitIds = (worksheetsRes.data || []).map((w: any) => w.unit_id).filter(Boolean);

            let guidanceBySkill = new Map<string, any>();
            let guidanceByUnit = new Map<string, any>();

            if (skillIds.length > 0) {
              const { data: units } = await supabase
                .from('el_learning_units')
                .select('skill_id, coach_guidance')
                .in('skill_id', Array.from(new Set(skillIds)))
                .not('coach_guidance', 'is', null)
                .limit(20);
              for (const u of units || []) {
                if (u.skill_id) guidanceBySkill.set(u.skill_id, u.coach_guidance);
              }
            }
            if (unitIds.length > 0) {
              const { data: units } = await supabase
                .from('el_learning_units')
                .select('id, coach_guidance')
                .in('id', Array.from(new Set(unitIds)))
                .not('coach_guidance', 'is', null)
                .limit(20);
              for (const u of units || []) {
                guidanceByUnit.set(u.id, u.coach_guidance);
              }
            }

            // Add legacy items to contentMap in a normalized format
            for (const v of (videosRes.data || []) as any[]) {
              contentMap.set(v.id, {
                id: v.id, content_type: 'video', title: v.title,
                thumbnail_url: v.thumbnail_url, asset_url: v.video_url,
                asset_format: null, duration_seconds: v.duration_seconds,
                coach_guidance: guidanceBySkill.get(v.skill_id) || null,
              });
            }
            for (const g of (gamesRes.data || []) as any[]) {
              contentMap.set(g.id, {
                id: g.id, content_type: 'game', title: g.title,
                thumbnail_url: null, asset_url: null,
                asset_format: null, duration_seconds: null,
                coach_guidance: guidanceBySkill.get(g.skill_id) || null,
              });
            }
            for (const w of (worksheetsRes.data || []) as any[]) {
              contentMap.set(w.id, {
                id: w.id, content_type: 'worksheet', title: w.title,
                thumbnail_url: w.thumbnail_url, asset_url: w.asset_url,
                asset_format: w.asset_format, duration_seconds: null,
                coach_guidance: guidanceByUnit.get(w.unit_id) || null,
              });
            }
          }

          // Resolve per activity step — response shape stays identical
          (template.activity_flow as any[]).forEach((step: any, index: number) => {
            if (!step.content_refs || !Array.isArray(step.content_refs)) return;
            const resolved = step.content_refs.map((ref: any) => {
              const item = contentMap.get(ref.id);
              if (!item) return null;
              return {
                type: ref.type, id: ref.id, label: ref.label,
                title: item.title,
                thumbnail_url: item.thumbnail_url || null,
                asset_url: item.asset_url || null,
                asset_format: item.asset_format || null,
                duration_seconds: item.metadata?.duration_seconds || null,
                coach_guidance: item.coach_guidance || null,
              };
            }).filter(Boolean);

            if (resolved.length > 0) {
              resolvedContentMap[index] = resolved;
            }
          });
        }
      } catch (contentError: any) {
        console.error(JSON.stringify({ requestId, event: 'content_resolution_error', error: contentError.message }));
        // Non-fatal — panel works without resolved content
      }
    }

    // 5. Get last 3 learning events for context
    const { data: recentEvents } = await supabase
      .from('learning_events')
      .select('id, event_type, event_data, ai_summary, created_at')
      .eq('child_id', session.child_id)
      .in('event_type', ['session', 'diagnostic_assessment', 'session_companion_log'])
      .order('created_at', { ascending: false })
      .limit(3);

    // 6. Get parent daily tasks for this week (graceful — table may not exist yet)
    let parentTasks = null;
    try {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];

      const { data: tasks } = await supabase
        .from('parent_daily_tasks')
        .select('id, is_completed')
        .eq('child_id', session.child_id)
        .gte('task_date', weekStartStr);

      if (tasks) {
        parentTasks = {
          completed: tasks.filter((t: any) => t.is_completed).length,
          total: tasks.length,
          streak: child?.current_streak || 0,
        };
      }
    } catch {
      // Table may not exist yet — that's fine
    }

    // 7. Get recent struggle flags for this child (Change 7: Smart Focus Today)
    let recentStruggles: { activity_name: string; session_number: number | null; coach_note: string | null }[] = [];
    try {
      const { data: struggles } = await supabase
        .from('learning_events')
        .select('event_data, created_at')
        .eq('child_id', session.child_id)
        .eq('event_type', 'activity_struggle_flag')
        .order('created_at', { ascending: false })
        .limit(5);

      if (struggles) {
        recentStruggles = struggles.map((s: any) => ({
          activity_name: s.event_data?.activity_name || 'Unknown activity',
          session_number: s.event_data?.session_number || null,
          coach_note: s.event_data?.coach_note || null,
        }));
      }
    } catch {
      // Column or query issue — non-fatal
    }

    // 8. Get coach session streak (Change 8)
    let coachSessionsLogged = 0;
    try {
      if (session.coach_id) {
        const { data: coach } = await supabase
          .from('coaches')
          .select('completed_sessions_with_logs')
          .eq('id', session.coach_id)
          .single();

        if (coach?.completed_sessions_with_logs) {
          coachSessionsLogged = coach.completed_sessions_with_logs;
        }
      }
    } catch {
      // Column may not exist yet — non-fatal
    }

    // 8b. Parent content engagement (practice materials since last session)
    let parentContentEngagement: { materials_assigned: number; materials_viewed: number; completion_rate: number } | null = null;
    try {
      let sinceDate: string | null = null;
      if (session.session_number && session.session_number > 1) {
        const { data: prevSession } = await supabase
          .from('scheduled_sessions')
          .select('scheduled_date')
          .eq('child_id', session.child_id)
          .eq('status', 'completed')
          .lt('session_number', session.session_number)
          .order('session_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        sinceDate = prevSession?.scheduled_date || null;
      }

      let query = supabase
        .from('learning_events')
        .select('event_data')
        .eq('child_id', session.child_id)
        .eq('event_type', 'parent_practice_assigned');

      if (sinceDate) {
        query = query.gte('event_date', sinceDate);
      }

      const { data: practiceEvents } = await query.order('created_at', { ascending: false }).limit(10);

      if (practiceEvents && practiceEvents.length > 0) {
        let totalAssigned = 0;
        let totalViewed = 0;
        for (const evt of practiceEvents) {
          const items = ((evt.event_data as any)?.items || []) as any[];
          totalAssigned += items.length;
          totalViewed += items.filter((i: any) => i.viewed_at).length;
        }
        parentContentEngagement = {
          materials_assigned: totalAssigned,
          materials_viewed: totalViewed,
          completion_rate: totalAssigned > 0 ? Math.round((totalViewed / totalAssigned) * 100) / 100 : 0,
        };
      }
    } catch {
      // Non-fatal
    }

    // 9. Find next scheduled session for this child
    let nextSessionId: string | null = null;
    try {
      const { data: nextSession } = await supabase
        .from('scheduled_sessions')
        .select('id')
        .eq('child_id', session.child_id)
        .eq('status', 'scheduled')
        .gt('session_number', session.session_number || 0)
        .order('session_number', { ascending: true })
        .limit(1)
        .maybeSingle();

      nextSessionId = nextSession?.id || null;
    } catch {
      // Non-fatal
    }

    console.log(JSON.stringify({
      requestId,
      event: 'live_session_data_loaded',
      sessionId: id,
      hasTemplate: !!template,
      activityCount: Array.isArray(template?.activity_flow) ? template.activity_flow.length : 0,
      resolvedContentActivities: Object.keys(resolvedContentMap).length,
      struggleCount: recentStruggles.length,
      coachSessionsLogged,
    }));

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        child_id: session.child_id,
        session_number: session.session_number,
        session_type: session.session_type,
        is_diagnostic: session.is_diagnostic,
        duration_minutes: session.duration_minutes || template?.duration_minutes || 45,
        scheduled_date: session.scheduled_date,
        scheduled_time: session.scheduled_time,
        status: session.status,
        google_meet_link: session.google_meet_link,
        total_sessions: totalSessions,
      },
      child: child ? {
        id: child.id,
        child_name: child.child_name,
        age: child.age,
        age_band: child.age_band,
        parent_name: child.parent_name,
        parent_email: child.parent_email,
        latest_assessment_score: child.latest_assessment_score,
        current_streak: child.current_streak || 0,
      } : null,
      template: template || null,
      resolved_content: resolvedContentMap,
      recent_sessions: (recentEvents || []).map((e: any) => ({
        id: e.id,
        event_type: e.event_type,
        summary: e.ai_summary || null,
        data: e.event_data || null,
        created_at: e.created_at,
      })),
      parent_tasks: parentTasks,
      parent_content_engagement: parentContentEngagement,
      recent_struggles: recentStruggles,
      coach_sessions_logged: coachSessionsLogged,
      next_session_id: nextSessionId,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'live_session_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// PATCH: Mark session as in_progress when coach starts live panel
// Called by LiveSessionPanel on session start / Meet open
// ============================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getServiceSupabase();

    // Only update if currently 'scheduled' — don't overwrite other states
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('id, status')
      .eq('id', id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'scheduled') {
      // Already started or in another state — just acknowledge
      return NextResponse.json({ success: true, status: session.status, already: true });
    }

    const { error: updateError } = await supabase
      .from('scheduled_sessions')
      .update({
        status: 'in_progress',
        session_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error(JSON.stringify({ requestId, event: 'session_start_error', error: updateError.message }));
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'session_started_via_companion',
      sessionId: id,
      coachEmail: auth.email,
    }));

    return NextResponse.json({ success: true, status: 'in_progress' });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'session_start_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
