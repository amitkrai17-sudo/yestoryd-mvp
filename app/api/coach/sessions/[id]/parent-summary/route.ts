// ============================================================
// FILE: app/api/coach/sessions/[id]/parent-summary/route.ts
// PURPOSE: Generate parent-friendly session summary via Gemini
//          and send it via AiSensy WhatsApp
// CALLED BY: QStash (queued from activity-log POST)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { getPricingConfig } from '@/lib/config/pricing-config';
import { sendCommunication } from '@/lib/communication';
import { insertLearningEvent } from '@/lib/rai/learning-events';
import crypto from 'crypto';
import {
  generateParentWhatsAppSummary,
  generateLearningProfileSynthesis,
} from '@/lib/gemini/session-prompts';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const { id: sessionId } = await params;
    const supabase = getServiceSupabase();

    // Parse QStash body for offline context (if present)
    let offlineContext: {
      session_mode?: string;
      voice_note_transcript?: string | null;
      reading_clip_analysis?: Record<string, unknown> | null;
      confidence_level?: string;
      words_struggled?: string[];
      words_mastered?: string[];
    } | null = null;
    try {
      const body = await request.json();
      offlineContext = body.offlineContext || null;
    } catch {
      // QStash may send empty body or non-JSON — that's fine
    }

    // 1. Get session + child + activity logs
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, child_id, session_number, session_type, session_mode,
        coach_notes, session_timer_seconds, session_template_id,
        children (id, child_name, age, parent_name, parent_phone, parent_email)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error(JSON.stringify({ requestId, event: 'parent_summary_session_not_found', sessionId }));
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!session.child_id) {
      console.log(JSON.stringify({ requestId, event: 'parent_summary_skipped', reason: 'no child_id', sessionId }));
      return NextResponse.json({ success: true, skipped: true, reason: 'No child assigned' });
    }

    const child = (session as any).children;
    if (!child?.parent_phone) {
      console.log(JSON.stringify({ requestId, event: 'parent_summary_skipped', reason: 'no parent phone', sessionId }));
      return NextResponse.json({ success: true, skipped: true, reason: 'No parent phone' });
    }

    // 2. Fetch activity logs
    const { data: activityLogs } = await supabase
      .from('session_activity_log')
      .select('activity_name, activity_purpose, status, coach_note, actual_duration_seconds')
      .eq('session_id', sessionId)
      .order('activity_index', { ascending: true });

    if (!activityLogs || activityLogs.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'parent_summary_skipped', reason: 'no activity logs', sessionId }));
      return NextResponse.json({ success: true, skipped: true, reason: 'No activity logs' });
    }

    // 3. Build activity summary for Gemini
    const activitySummary = activityLogs.map((a: any, i: number) => {
      const duration = a.actual_duration_seconds ? `${Math.round(a.actual_duration_seconds / 60)}min` : '';
      return `${i + 1}. ${a.activity_name} (${a.status}${duration ? ', ' + duration : ''})${a.coach_note ? ' — Coach note: ' + a.coach_note : ''}`;
    }).join('\n');

    const statusCounts = {
      completed: activityLogs.filter((a: any) => a.status === 'completed').length,
      partial: activityLogs.filter((a: any) => a.status === 'partial').length,
      struggled: activityLogs.filter((a: any) => a.status === 'struggled').length,
      skipped: activityLogs.filter((a: any) => a.status === 'skipped').length,
    };

    // 4. Generate summary via shared Gemini builder
    const isOffline = session.session_mode === 'offline' || offlineContext?.session_mode === 'offline';
    let summary: string;
    try {
      // Build offline-specific context section
      let offlineSection = '';
      if (isOffline) {
        const parts: string[] = ['SESSION TYPE: In-person (offline) session'];
        if (offlineContext?.voice_note_transcript) {
          parts.push(`COACH VOICE NOTE TRANSCRIPT:\n${offlineContext.voice_note_transcript}`);
        }
        if (offlineContext?.reading_clip_analysis) {
          const ra = offlineContext.reading_clip_analysis;
          parts.push(`READING CLIP ANALYSIS:\nWPM: ${ra.wpm || 'N/A'}, Accuracy: ${ra.accuracy_percent || 'N/A'}%, Fluency: ${ra.fluency_score || 'N/A'}/10\nStrengths: ${(ra.strengths as string[] || []).join(', ')}\nAreas: ${(ra.areas_for_improvement as string[] || []).join(', ')}`);
        }
        if (offlineContext?.words_struggled && (offlineContext.words_struggled as string[]).length > 0) {
          parts.push(`WORDS STRUGGLED: ${(offlineContext.words_struggled as string[]).join(', ')}`);
        }
        if (offlineContext?.words_mastered && (offlineContext.words_mastered as string[]).length > 0) {
          parts.push(`WORDS MASTERED: ${(offlineContext.words_mastered as string[]).join(', ')}`);
        }
        offlineSection = '\n\n' + parts.join('\n\n');
      }

      summary = await generateParentWhatsAppSummary({
        childName: child.child_name,
        childAge: child.age,
        sessionNumber: session.session_number,
        durationMinutes: session.session_timer_seconds ? Math.round(session.session_timer_seconds / 60) : null,
        activitySummary,
        statusCounts,
        coachNotes: session.coach_notes,
        isOffline,
        offlineSection,
      });
    } catch (aiError: any) {
      console.warn(JSON.stringify({ requestId, event: 'gemini_fallback', error: aiError.message }));
      // Fallback: simple template
      const firstName = child.child_name.split(' ')[0];
      const sessionTypeText = isOffline ? 'a wonderful in-person coaching session' : 'a great session';
      summary = `${firstName} had ${sessionTypeText} today! We covered ${activityLogs.length} activities with ${statusCounts.completed} completed successfully.${statusCounts.struggled > 0 ? ` We'll keep working on ${statusCounts.struggled} area${statusCounts.struggled > 1 ? 's' : ''} that need more practice.` : ''}`;
    }

    // 5. Store summary in learning_events
    const summaryContentForEmbedding = `Parent session summary for ${child.child_name}: ${summary}`;

    await insertLearningEvent({
      childId: session.child_id as string,
      eventType: 'parent_session_summary',
      eventData: {
        session_id: sessionId,
        session_number: session.session_number,
        summary,
        status_counts: statusCounts,
        sent_to: child.parent_phone,
      },
      aiSummary: summary,
      contentForEmbedding: summaryContentForEmbedding,
      signalSource: 'coach_form',
      signalConfidence: 'medium',
      eventDate: new Date().toISOString().split('T')[0],
    });

    // 5b. Extract practice materials from session template content_refs
    // Primary: single query to el_content_items; Fallback: legacy tables
    let practiceItems: { type: string; id: string; title: string; asset_url: string | null }[] = [];
    try {
      if ((session as any).session_template_id) {
        const { data: tmpl } = await supabase
          .from('session_templates')
          .select('activity_flow')
          .eq('id', (session as any).session_template_id)
          .single();

        if (tmpl?.activity_flow && Array.isArray(tmpl.activity_flow)) {
          const allIds: string[] = [];
          const refTypes: Record<string, string> = {};

          for (const step of tmpl.activity_flow as any[]) {
            if (!step.content_refs || !Array.isArray(step.content_refs)) continue;
            for (const ref of step.content_refs) {
              if (ref.type === 'video' || ref.type === 'worksheet') {
                allIds.push(ref.id);
                refTypes[ref.id] = ref.type;
              }
            }
          }

          if (allIds.length > 0) {
            // Try el_content_items first
            const { data: items } = await supabase
              .from('el_content_items')
              .select('id, content_type, title, asset_url')
              .in('id', allIds)
              .eq('is_active', true);

            const foundIds = new Set((items || []).map((i: any) => i.id));
            for (const item of items || []) {
              practiceItems.push({
                type: item.content_type,
                id: item.id,
                title: item.title,
                asset_url: item.asset_url,
              });
            }

            // Fallback for IDs not found in el_content_items
            const missingVideoIds = allIds.filter(id => !foundIds.has(id) && refTypes[id] === 'video');
            const missingWorksheetIds = allIds.filter(id => !foundIds.has(id) && refTypes[id] === 'worksheet');

            if (missingVideoIds.length > 0 || missingWorksheetIds.length > 0) {
              const [videosRes, worksheetsRes] = await Promise.all([
                missingVideoIds.length > 0
                  ? supabase.from('el_videos').select('id, title, video_url').in('id', missingVideoIds)
                  : { data: [] },
                missingWorksheetIds.length > 0
                  ? supabase.from('el_worksheets').select('id, title, asset_url').in('id', missingWorksheetIds)
                  : { data: [] },
              ]);

              for (const v of (videosRes.data || []) as any[]) {
                practiceItems.push({ type: 'video', id: v.id, title: v.title, asset_url: v.video_url });
              }
              for (const w of (worksheetsRes.data || []) as any[]) {
                practiceItems.push({ type: 'worksheet', id: w.id, title: w.title, asset_url: w.asset_url });
              }
            }
          }
        }
      }
    } catch (contentErr: any) {
      console.warn(JSON.stringify({ requestId, event: 'practice_content_extraction_error', error: contentErr.message }));
    }

    // 5c. Create parent_practice_assigned learning event (if content found)
    if (practiceItems.length > 0) {
      try {
        const practiceTitles = practiceItems.map(item => `${item.title} (${item.type})`).join(', ');
        const practiceContentForEmbedding = `Practice assigned for ${child.child_name} after session ${session.session_number}: ${practiceTitles}`;

        await insertLearningEvent({
          childId: session.child_id as string,
          eventType: 'parent_practice_assigned',
          eventData: {
            session_id: sessionId,
            session_number: session.session_number,
            items: practiceItems,
            assigned_at: new Date().toISOString(),
          },
          contentForEmbedding: practiceContentForEmbedding,
          signalSource: 'system_generated',
          signalConfidence: 'low',
          eventDate: new Date().toISOString().split('T')[0],
        });
      } catch (evtErr: any) {
        console.warn(JSON.stringify({ requestId, event: 'practice_event_creation_error', error: evtErr.message }));
      }
    }

    // 5d. Append practice materials section to summary for WhatsApp
    let fullSummary = summary;
    if (practiceItems.length > 0) {
      const materialLines = practiceItems.map(
        (item) => `- ${item.title} (${item.type === 'video' ? 'Video' : 'Worksheet'})`
      );
      fullSummary += `\n\nPractice Materials:\n${materialLines.join('\n')}`;
    }

    // 6. Build template variables for both WhatsApp + email
    const parentFirstName = (child.parent_name || 'Parent').split(' ')[0];
    const childFirstName = child.child_name.split(' ')[0];

    // Derive topic from completed activity names
    const completedActivities = activityLogs
      .filter((a: any) => a.status === 'completed' || a.status === 'partial')
      .map((a: any) => a.activity_name);
    const topic = completedActivities.length > 0
      ? completedActivities.slice(0, 3).join(', ')
      : 'Reading skills practice';

    // Derive highlight from best-performing activities
    const highlightActivity = activityLogs.find((a: any) => a.status === 'completed' && a.coach_note);
    const highlight = highlightActivity?.coach_note
      ? highlightActivity.coach_note
      : statusCounts.completed > 0
        ? `Completed ${statusCounts.completed} of ${activityLogs.length} activities successfully`
        : 'Showed great effort throughout the session';

    // Derive homework from practice items or default
    const homework = practiceItems.length > 0
      ? practiceItems.map((item: any) => item.title).slice(0, 3).join(', ')
      : 'Keep reading daily!';

    // Derive new_words from activity purposes or default
    const vocabActivities = activityLogs
      .filter((a: any) => a.activity_purpose && /vocab|word|sight|phonics/i.test(a.activity_purpose))
      .map((a: any) => a.activity_name);
    const newWords = vocabActivities.length > 0
      ? vocabActivities.join(', ')
      : 'Various reading skills';

    // Send via communication engine (handles both WhatsApp + email)
    const commResult = await sendCommunication({
      templateCode: 'session_summary_parent',
      recipientType: 'parent',
      recipientPhone: child.parent_phone,
      recipientEmail: child.parent_email || null,
      recipientName: child.parent_name || null,
      variables: {
        parent_name: parentFirstName,
        child_name: childFirstName,
        session_number: String(session.session_number || ''),
        summary: fullSummary,
        topic,
        new_words: newWords,
        highlight,
        homework,
      },
      relatedEntityType: 'session',
      relatedEntityId: sessionId,
    });

    const waResult = commResult.results.find(r => r.channel === 'whatsapp') || { success: false };

    console.log(JSON.stringify({
      requestId,
      event: 'parent_summary_sent',
      sessionId,
      childName: child.child_name,
      whatsappSuccess: waResult.success,
      emailSuccess: commResult.results.find(r => r.channel === 'email')?.success || false,
      summaryLength: summary.length,
    }));

    // 7. Update child learning profile via Gemini synthesis (non-blocking)
    try {
      await synthesizeLearningProfile(supabase, session.child_id, sessionId, session.session_number, requestId);
    } catch (profileError: any) {
      // Non-fatal — parent summary already sent, profile update is best-effort
      console.error(JSON.stringify({ requestId, event: 'learning_profile_error', error: profileError.message }));
    }

    return NextResponse.json({
      success: true,
      summary,
      practice_items_assigned: practiceItems.length,
      whatsapp_sent: waResult.success,
      whatsapp_message_id: ('messageId' in waResult ? waResult.messageId : null) || null,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'parent_summary_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// Learning Profile Synthesis
// Runs AFTER parent summary is generated and sent.
// Fetches session data + history → Gemini → children.learning_profile
// ============================================================

async function synthesizeLearningProfile(
  supabase: ReturnType<typeof getServiceSupabase>,
  childId: string,
  sessionId: string,
  sessionNumber: number | null,
  requestId: string,
) {
  // 1. Fetch child details + current learning_profile
  const { data: childRow } = await supabase
    .from('children')
    .select('child_name, age, age_band')
    .eq('id', childId)
    .single();

  // Fetch learning_profile separately (column may not exist until migration applied)
  let currentProfile: Record<string, any> = {};
  try {
    const { data: profileRow } = await supabase
      .from('children')
      .select('learning_profile')
      .eq('id', childId)
      .single();
    currentProfile = (profileRow?.learning_profile as Record<string, any>) || {};
  } catch {
    // Column doesn't exist yet — use empty profile
  }

  // 2. Fetch this session's merged learning_event
  const { data: sessionEvent } = await supabase
    .from('learning_events')
    .select('event_type, event_data, ai_summary')
    .eq('child_id', childId)
    .in('event_type', ['session', 'session_companion_log'])
    .filter('event_data->>session_id', 'eq', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Fetch last 5 learning_events for this child
  const { data: recentEvents } = await supabase
    .from('learning_events')
    .select('event_type, event_data, ai_summary, created_at')
    .eq('child_id', childId)
    .in('event_type', ['session', 'diagnostic_assessment', 'session_companion_log'])
    .order('created_at', { ascending: false })
    .limit(5);

  // 4. Fetch active struggle flags
  const { data: struggleFlags } = await supabase
    .from('learning_events')
    .select('event_data, created_at')
    .eq('child_id', childId)
    .eq('event_type', 'activity_struggle_flag')
    .order('created_at', { ascending: false })
    .limit(10);

  // 5. Fetch parent_daily_tasks completion rate (if table exists)
  let taskCompletionRate: number | null = null;
  try {
    const { data: tasks } = await supabase
      .from('parent_daily_tasks')
      .select('id, is_completed')
      .eq('child_id', childId);

    if (tasks && tasks.length > 0) {
      const completed = tasks.filter((t: any) => t.is_completed).length;
      taskCompletionRate = completed / tasks.length;
    }
  } catch {
    // Table may not exist yet — that's fine
  }

  // 6. Fetch enrollment info for sessions_remaining
  let sessionsCompleted = 0;
  let sessionsRemaining = 0;
  try {
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id, total_sessions, status')
      .eq('child_id', childId)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (enrollment) {
      const { count } = await supabase
        .from('scheduled_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('enrollment_id', enrollment.id)
        .eq('status', 'completed');

      sessionsCompleted = count || 0;
      const pricingConfig = await getPricingConfig();
      const bandSessions = pricingConfig.ageBands.find(b => b.id === (childRow?.age_band || 'building'))?.sessionsPerSeason;
      sessionsRemaining = Math.max(0, (enrollment.total_sessions || bandSessions || 0) - sessionsCompleted);
    }
  } catch {
    // Non-fatal
  }

  // 7. Build context for Gemini profile synthesis
  const historyText = (recentEvents || []).map((e: any, i: number) => {
    const d = e.event_data || {};
    return `Event ${i + 1} (${e.event_type}, ${new Date(e.created_at).toLocaleDateString()}):
  Focus: ${d.focus_area || 'N/A'}, Progress: ${d.progress_rating || 'N/A'}
  Skills: ${(d.skills_worked_on || []).join(', ') || 'N/A'}
  Highlights: ${(d.highlights || []).join(', ') || 'N/A'}
  Challenges: ${(d.challenges || []).join(', ') || 'N/A'}
  Engagement: ${d.engagement_level || 'N/A'}
  ${d.status_counts ? `Activities: ${d.status_counts.completed || 0} completed, ${d.status_counts.partial || 0} partial, ${d.status_counts.struggled || 0} struggled, ${d.status_counts.skipped || 0} skipped` : ''}
  ${d.coach_notes ? `Coach notes: ${d.coach_notes}` : ''}
  ${e.ai_summary ? `Summary: ${e.ai_summary}` : ''}`;
  }).join('\n\n');

  const struggleText = (struggleFlags || []).map((s: any) => {
    const d = s.event_data || {};
    return `- ${d.activity_name || 'Unknown'} (session ${d.session_number || '?'}): ${d.coach_note || 'no note'}`;
  }).join('\n');

  if (!process.env.GEMINI_API_KEY) {
    console.log(JSON.stringify({ requestId, event: 'learning_profile_skipped', reason: 'no GEMINI_API_KEY' }));
    return;
  }

  const profile = await generateLearningProfileSynthesis({
    childName: childRow?.child_name || 'Unknown',
    childAge: childRow?.age || null,
    ageBand: childRow?.age_band || null,
    sessionNumber,
    sessionsCompleted,
    sessionsRemaining,
    currentProfile,
    sessionEventData: (sessionEvent?.event_data as Record<string, unknown>) || null,
    historyText,
    struggleText,
    taskCompletionRate,
  });

  // 8. Store in children.learning_profile
  const { error: updateError } = await supabase
    .from('children')
    .update({ learning_profile: profile as unknown as import('@/lib/database.types').Json })
    .eq('id', childId);

  if (updateError) {
    throw new Error(`Failed to update learning_profile: ${updateError.message}`);
  }

  const profileAny = profile as Record<string, any>;
  console.log(JSON.stringify({
    requestId,
    event: 'learning_profile_updated',
    childId,
    sessionNumber,
    activeSkills: profileAny.active_skills?.length || 0,
    struggleAreas: profileAny.struggle_areas?.length || 0,
    trend: profileAny.reading_level?.trend,
  }));
}
