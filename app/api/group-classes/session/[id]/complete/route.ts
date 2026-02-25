// ============================================================
// FILE: app/api/group-classes/session/[id]/complete/route.ts
// ============================================================
// Session Complete — Full post-session intelligence pipeline
// Accepts ratings, updates session status + participants,
// inserts learning_events, updates gamification, checks badges,
// queues QStash jobs for insights/notifications/feedback.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { generateEmbedding } from '@/lib/rai/embeddings';
import {
  queueGroupClassInsights,
  queueGroupClassNotifications,
  queueGroupClassFeedbackRequest,
} from '@/lib/qstash';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const participantRatingSchema = z.object({
  childId: z.string().uuid(),
  participantId: z.string().uuid(),
  engagement: z.enum(['low', 'medium', 'high']),
  skillTags: z.array(z.string()).default([]),
  note: z.string().max(1000).optional(),
  voiceNoteUrl: z.string().optional(),
});

const completeSessionSchema = z.object({
  ratings: z.array(participantRatingSchema),
  sessionNotes: z.string().max(5000).optional(),
  quickNotes: z.record(z.string(), z.string()).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdminOrCoach();

    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'session_complete_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { id } = await context.params;

    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = completeSessionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { ratings, sessionNotes, quickNotes } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'session_complete_request', email: auth.email, sessionId: id, ratingCount: ratings.length }));

    const supabase = getServiceSupabase();

    // ─── Fetch full session with class type ───
    const { data: session } = await supabase
      .from('group_sessions')
      .select(`
        id, instructor_id, coach_id, status, scheduled_date, blueprint_id,
        class_type_id, duration_minutes,
        group_class_types ( id, name, slug, skill_tags )
      `)
      .eq('id', id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (auth.role !== 'admin') {
      const isAssigned = session.instructor_id === auth.coachId || session.coach_id === auth.coachId;
      if (!isAssigned) {
        return NextResponse.json({ error: 'Not assigned to this session' }, { status: 403 });
      }
    }

    // Extract class type info (handle both array and single object from Supabase join)
    const classTypeRaw = session.group_class_types;
    const classType = Array.isArray(classTypeRaw) ? classTypeRaw[0] : classTypeRaw;
    const classTypeName = classType?.name || 'Group Class';
    const classTypeSlug = classType?.slug || 'unknown';
    const classTypeId = session.class_type_id || classType?.id || null;

    // ─── Update session status to completed ───
    const { error: sessionError } = await supabase
      .from('group_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: sessionNotes || session.status === 'completed' ? undefined : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (sessionError) {
      console.error(JSON.stringify({ requestId, event: 'session_complete_update_error', error: sessionError.message }));
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    // ─── Update each participant with ratings ───
    const engagementToRating: Record<string, number> = { low: 2, medium: 3, high: 5 };
    const now = new Date().toISOString();

    // Fetch child names for learning_events content
    const childIds = ratings.map(r => r.childId);
    const { data: children } = await supabase
      .from('children')
      .select('id, child_name')
      .in('id', childIds);

    const childNameMap = new Map<string, string>();
    for (const child of children || []) {
      childNameMap.set(child.id, child.child_name || 'Unknown');
    }

    for (const rating of ratings) {
      const quickNote = quickNotes?.[rating.childId];
      const combinedNote = [rating.note, quickNote].filter(Boolean).join(' | ');

      await supabase
        .from('group_session_participants')
        .update({
          attendance_status: 'present',
          attendance_marked_at: now,
          attendance_marked_by: auth.coachId || auth.email || 'unknown',
          participation_rating: engagementToRating[rating.engagement] || 3,
          participation_notes: combinedNote || null,
          updated_at: now,
        })
        .eq('id', rating.participantId);
    }

    // ─── (a) Insert learning_events for each rated child ───
    let learningEventsCreated = 0;
    const sessionDate = session.scheduled_date || now;
    const coachId = session.instructor_id || session.coach_id || null;

    for (const rating of ratings) {
      const childName = childNameMap.get(rating.childId) || 'Unknown';
      try {
        const contentForEmbedding = [
          `${childName} attended ${classTypeName} on ${sessionDate}.`,
          `Engagement: ${rating.engagement}.`,
          rating.skillTags.length > 0 ? `Skills observed: ${rating.skillTags.join(', ')}.` : '',
          rating.note ? `Instructor notes: ${rating.note}` : '',
        ].filter(Boolean).join(' ');

        let embedding: number[] | null = null;
        try {
          embedding = await generateEmbedding(contentForEmbedding);
        } catch (embErr) {
          console.error(JSON.stringify({ requestId, event: 'embedding_failed', childId: rating.childId, error: embErr instanceof Error ? embErr.message : 'Unknown' }));
        }

        await supabase.from('learning_events').insert({
          child_id: rating.childId,
          coach_id: coachId,
          event_type: 'group_class_observation',
          event_date: sessionDate,
          event_data: {
            session_id: id,
            class_type_id: classTypeId,
            class_type_name: classTypeName,
            class_type_slug: classTypeSlug,
            engagement_level: rating.engagement,
            skill_tags: rating.skillTags,
            instructor_notes: rating.note || null,
            voice_note_url: rating.voiceNoteUrl || null,
            blueprint_id: session.blueprint_id || null,
          },
          content_for_embedding: contentForEmbedding,
          embedding: embedding ? JSON.stringify(embedding) : null,
        });

        learningEventsCreated++;
      } catch (err) {
        console.error(JSON.stringify({ requestId, event: 'learning_event_insert_failed', childId: rating.childId, error: err instanceof Error ? err.message : 'Unknown' }));
      }
    }

    // ─── (b) Insert verbal observations from quickNotes ───
    if (quickNotes) {
      for (const [childId, noteText] of Object.entries(quickNotes)) {
        if (!noteText || !noteText.trim()) continue;
        // Only insert if the child was rated (avoid stale quickNotes)
        const wasRated = ratings.some(r => r.childId === childId);
        if (!wasRated) continue;

        const childName = childNameMap.get(childId) || 'Unknown';
        try {
          const verbalContent = `${childName} verbal observation in ${classTypeName}: ${noteText}`;

          let embedding: number[] | null = null;
          try {
            embedding = await generateEmbedding(verbalContent);
          } catch (embErr) {
            console.error(JSON.stringify({ requestId, event: 'verbal_embedding_failed', childId, error: embErr instanceof Error ? embErr.message : 'Unknown' }));
          }

          await supabase.from('learning_events').insert({
            child_id: childId,
            coach_id: coachId,
            event_type: 'group_class_verbal',
            event_date: sessionDate,
            event_data: {
              session_id: id,
              class_type_name: classTypeName,
              quick_note: noteText,
            },
            content_for_embedding: verbalContent,
            embedding: embedding ? JSON.stringify(embedding) : null,
          });

          learningEventsCreated++;
        } catch (err) {
          console.error(JSON.stringify({ requestId, event: 'verbal_event_insert_failed', childId, error: err instanceof Error ? err.message : 'Unknown' }));
        }
      }
    }

    // ─── (c) Update gamification ───
    const badgesEarned: Array<{ child_name: string; badge_name: string }> = [];

    for (const rating of ratings) {
      try {
        // Fetch existing gamification row
        const { data: existing } = await supabase
          .from('el_child_gamification')
          .select('group_class_total_attended, group_class_streak, last_group_class_date')
          .eq('child_id', rating.childId)
          .single();

        const prevTotal = existing?.group_class_total_attended || 0;
        const prevStreak = existing?.group_class_streak || 0;
        const lastDate = existing?.last_group_class_date;

        // Calculate streak: if last class within 14 days, increment; else reset to 1
        let newStreak = 1;
        if (lastDate) {
          const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince <= 14) {
            newStreak = prevStreak + 1;
          }
        }

        await supabase
          .from('el_child_gamification')
          .upsert({
            child_id: rating.childId,
            group_class_total_attended: prevTotal + 1,
            group_class_streak: newStreak,
            last_group_class_date: now,
            updated_at: now,
          }, { onConflict: 'child_id' });
      } catch (err) {
        console.error(JSON.stringify({ requestId, event: 'gamification_update_failed', childId: rating.childId, error: err instanceof Error ? err.message : 'Unknown' }));
      }
    }

    // ─── (d) Check badge criteria ───
    const { data: groupBadges } = await supabase
      .from('el_badges')
      .select('id, name, slug, criteria_type, criteria_value, criteria_extra')
      .eq('badge_context', 'group_class')
      .eq('is_active', true);

    if (groupBadges && groupBadges.length > 0) {
      for (const rating of ratings) {
        const childName = childNameMap.get(rating.childId) || 'Unknown';

        // Fetch existing badges for this child to avoid duplicates
        const { data: existingBadges } = await supabase
          .from('el_child_badges')
          .select('badge_id')
          .eq('child_id', rating.childId);

        const earnedBadgeIds = new Set((existingBadges || []).map(b => b.badge_id));

        // Fetch fresh gamification stats
        const { data: gamStats } = await supabase
          .from('el_child_gamification')
          .select('group_class_total_attended, group_class_streak')
          .eq('child_id', rating.childId)
          .single();

        const totalAttended = gamStats?.group_class_total_attended || 0;
        const currentStreak = gamStats?.group_class_streak || 0;

        for (const badge of groupBadges) {
          if (earnedBadgeIds.has(badge.id)) continue;

          let qualified = false;

          try {
            switch (badge.criteria_type) {
              case 'total_attended': {
                // "Super Learner" — e.g. criteria_value = 10
                qualified = totalAttended >= badge.criteria_value;
                break;
              }
              case 'streak': {
                // "Consistency Champion" — e.g. criteria_value = 4
                qualified = currentStreak >= badge.criteria_value;
                break;
              }
              case 'class_type_count': {
                // Class-type-specific — e.g. 3 of same type
                const extra = badge.criteria_extra as { class_type_slug?: string } | null;
                const slug = extra?.class_type_slug;
                if (slug) {
                  // Step 1: Find the class type ID for this slug
                  const { data: targetType } = await supabase
                    .from('group_class_types')
                    .select('id')
                    .eq('slug', slug)
                    .single();

                  if (targetType) {
                    // Step 2: Find all sessions of this class type
                    const { data: matchingSessions } = await supabase
                      .from('group_sessions')
                      .select('id')
                      .eq('class_type_id', targetType.id);

                    if (matchingSessions && matchingSessions.length > 0) {
                      const sessionIds = matchingSessions.map(s => s.id);
                      // Step 3: Count attended sessions for this child
                      const { count: typeCount } = await supabase
                        .from('group_session_participants')
                        .select('id', { count: 'exact', head: true })
                        .eq('child_id', rating.childId)
                        .eq('attendance_status', 'present')
                        .in('group_session_id', sessionIds);

                      qualified = (typeCount || 0) >= badge.criteria_value;
                    }
                  }
                }
                break;
              }
              case 'distinct_types': {
                // "All-Rounder" — attended 1 of each class type
                const { data: attendedSessions } = await supabase
                  .from('group_session_participants')
                  .select('group_session_id')
                  .eq('child_id', rating.childId)
                  .eq('attendance_status', 'present');

                if (attendedSessions && attendedSessions.length > 0) {
                  const sessIds = attendedSessions.map(s => s.group_session_id).filter(Boolean) as string[];
                  const { data: sessionsWithType } = await supabase
                    .from('group_sessions')
                    .select('class_type_id')
                    .in('id', sessIds);

                  const uniqueTypes = new Set((sessionsWithType || []).map(s => s.class_type_id).filter(Boolean));
                  qualified = uniqueTypes.size >= badge.criteria_value;
                }
                break;
              }
              case 'response_count': {
                // "Creative Mind" — 5 written responses
                const { count: responseCount } = await supabase
                  .from('learning_events')
                  .select('id', { count: 'exact', head: true })
                  .eq('child_id', rating.childId)
                  .eq('event_type', 'group_class_response');

                qualified = (responseCount || 0) >= badge.criteria_value;
                break;
              }
              case 'high_engagement_count': {
                // "Voice of the Class" — 5 high engagements
                const { count: highCount } = await supabase
                  .from('group_session_participants')
                  .select('id', { count: 'exact', head: true })
                  .eq('child_id', rating.childId)
                  .gte('participation_rating', 5);

                qualified = (highCount || 0) >= badge.criteria_value;
                break;
              }
            }
          } catch (badgeErr) {
            console.error(JSON.stringify({ requestId, event: 'badge_check_error', childId: rating.childId, badge: badge.slug, error: badgeErr instanceof Error ? badgeErr.message : 'Unknown' }));
          }

          if (qualified) {
            try {
              await supabase.from('el_child_badges').insert({
                child_id: rating.childId,
                badge_id: badge.id,
                earned_at: now,
                earned_context: `group_class_session:${id}`,
              });
              badgesEarned.push({ child_name: childName, badge_name: badge.name });
              console.log(JSON.stringify({ requestId, event: 'badge_earned', childId: rating.childId, badge: badge.name }));
            } catch (insertErr) {
              // Duplicate constraint — badge already earned (race condition safe)
              const errObj = insertErr as { code?: string };
              if (errObj?.code !== '23505') {
                console.error(JSON.stringify({ requestId, event: 'badge_insert_failed', childId: rating.childId, badge: badge.slug, error: insertErr instanceof Error ? insertErr.message : 'Unknown' }));
              }
            }
          }
        }
      }
    }

    // ─── (e) Queue 3 QStash jobs ───
    const ratingsWithNames = ratings.map(r => ({
      childId: r.childId,
      childName: childNameMap.get(r.childId) || 'Unknown',
      engagement: r.engagement,
      skillTags: r.skillTags,
      note: r.note,
    }));

    const newlyEarnedBadgesPayload = badgesEarned.map(b => ({
      child_id: ratings.find(r => childNameMap.get(r.childId) === b.child_name)?.childId || '',
      child_name: b.child_name,
      badge_name: b.badge_name,
    }));

    const [insightsResult, notifResult, feedbackResult] = await Promise.all([
      queueGroupClassInsights({
        session_id: id,
        ratings: ratingsWithNames,
        newly_earned_badges: newlyEarnedBadgesPayload,
        class_type_name: classTypeName,
        session_date: sessionDate,
      }),
      queueGroupClassNotifications({ session_id: id }),
      queueGroupClassFeedbackRequest({ session_id: id }),
    ]);

    const jobsQueued = [insightsResult, notifResult, feedbackResult].filter(r => r.success).length;

    console.log(JSON.stringify({ requestId, event: 'qstash_jobs_queued', jobsQueued, insights: insightsResult.success, notifications: notifResult.success, feedback: feedbackResult.success }));

    // ─── (f) Update blueprint times_used ───
    if (session.blueprint_id) {
      try {
        const { data: blueprint } = await supabase
          .from('group_class_blueprints')
          .select('times_used')
          .eq('id', session.blueprint_id)
          .single();

        await supabase
          .from('group_class_blueprints')
          .update({ times_used: (blueprint?.times_used || 0) + 1, updated_at: now })
          .eq('id', session.blueprint_id);
      } catch (err) {
        console.error(JSON.stringify({ requestId, event: 'blueprint_update_failed', blueprintId: session.blueprint_id, error: err instanceof Error ? err.message : 'Unknown' }));
      }
    }

    // ─── Audit log ───
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: auth.role || 'coach',
      action: 'group_session_completed',
      metadata: {
        request_id: requestId,
        session_id: id,
        participant_count: ratings.length,
        learning_events_created: learningEventsCreated,
        badges_earned: badgesEarned.length,
        qstash_jobs_queued: jobsQueued,
        has_session_notes: !!sessionNotes,
        timestamp: now,
      },
      created_at: now,
    });

    // ─── (g) Response ───
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'session_complete_success', sessionId: id, learningEvents: learningEventsCreated, badges: badgesEarned.length, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      learning_events_created: learningEventsCreated,
      badges_earned: badgesEarned,
      qstash_jobs_queued: jobsQueued,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ requestId, event: 'session_complete_error', error: message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
