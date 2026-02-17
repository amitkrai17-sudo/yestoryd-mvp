// ============================================================
// FILE: app/api/coach/sessions/[id]/parent-summary/route.ts
// PURPOSE: Generate parent-friendly session summary via Gemini
//          and send it via AiSensy WhatsApp
// CALLED BY: QStash (queued from activity-log POST)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendWhatsAppMessage } from '@/lib/communication/aisensy';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const { id: sessionId } = await params;
    const supabase = getServiceSupabase();

    // 1. Get session + child + activity logs
    const { data: session, error: sessionError } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, child_id, session_number, session_type,
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

    // 4. Generate summary via Gemini
    let summary: string;
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const prompt = `You are a warm, encouraging assistant helping parents understand their child's reading coaching session.

CHILD: ${child.child_name}, age ${child.age}
SESSION: #${session.session_number || '—'}
DURATION: ${session.session_timer_seconds ? Math.round(session.session_timer_seconds / 60) + ' minutes' : 'Not recorded'}

ACTIVITIES:
${activitySummary}

RESULTS: ${statusCounts.completed} completed, ${statusCounts.partial} partial, ${statusCounts.struggled} struggled, ${statusCounts.skipped} skipped
${session.coach_notes ? 'COACH NOTES: ' + session.coach_notes : ''}

Write a SHORT (2-3 sentences max) parent-friendly summary of this session for WhatsApp. Be warm, highlight positives, mention any struggles gently as "areas we'll keep working on". Use the child's first name. Do NOT use emojis. Keep it under 300 characters.`;

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
      const result = await model.generateContent(prompt);
      summary = result.response.text().trim();

      if (!summary || summary.length < 20) {
        throw new Error('Invalid AI response');
      }
    } catch (aiError: any) {
      console.warn(JSON.stringify({ requestId, event: 'gemini_fallback', error: aiError.message }));
      // Fallback: simple template
      const firstName = child.child_name.split(' ')[0];
      summary = `${firstName} had a great session today! We covered ${activityLogs.length} activities with ${statusCounts.completed} completed successfully.${statusCounts.struggled > 0 ? ` We'll keep working on ${statusCounts.struggled} area${statusCounts.struggled > 1 ? 's' : ''} that need more practice.` : ''}`;
    }

    // 5. Store summary in learning_events
    await supabase
      .from('learning_events')
      .insert({
        child_id: session.child_id as string, // Already verified not null above
        event_type: 'parent_session_summary',
        event_data: {
          session_id: sessionId,
          session_number: session.session_number,
          summary,
          status_counts: statusCounts,
          sent_to: child.parent_phone,
        },
        ai_summary: summary,
        event_date: new Date().toISOString().split('T')[0],
      });

    // 5b. Extract practice materials from session template content_refs
    let practiceItems: { type: string; id: string; title: string; asset_url: string | null }[] = [];
    try {
      if ((session as any).session_template_id) {
        const { data: tmpl } = await supabase
          .from('session_templates')
          .select('activity_flow')
          .eq('id', (session as any).session_template_id)
          .single();

        if (tmpl?.activity_flow && Array.isArray(tmpl.activity_flow)) {
          const videoIds: string[] = [];
          const worksheetIds: string[] = [];

          for (const step of tmpl.activity_flow as any[]) {
            if (!step.content_refs || !Array.isArray(step.content_refs)) continue;
            for (const ref of step.content_refs) {
              if (ref.type === 'video') videoIds.push(ref.id);
              else if (ref.type === 'worksheet') worksheetIds.push(ref.id);
            }
          }

          const [videosRes, worksheetsRes] = await Promise.all([
            videoIds.length > 0
              ? supabase.from('el_videos').select('id, title, video_url, thumbnail_url').in('id', videoIds)
              : { data: [] },
            worksheetIds.length > 0
              ? supabase.from('el_worksheets').select('id, title, asset_url, thumbnail_url').in('id', worksheetIds)
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
    } catch (contentErr: any) {
      console.warn(JSON.stringify({ requestId, event: 'practice_content_extraction_error', error: contentErr.message }));
    }

    // 5c. Create parent_practice_assigned learning event (if content found)
    if (practiceItems.length > 0) {
      try {
        await supabase
          .from('learning_events')
          .insert({
            child_id: session.child_id,
            event_type: 'parent_practice_assigned',
            event_data: {
              session_id: sessionId,
              session_number: session.session_number,
              items: practiceItems,
              assigned_at: new Date().toISOString(),
            },
            event_date: new Date().toISOString().split('T')[0],
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

    // 6. Send to parent via AiSensy WhatsApp
    const parentFirstName = (child.parent_name || 'Parent').split(' ')[0];
    const childFirstName = child.child_name.split(' ')[0];

    const waResult = await sendWhatsAppMessage({
      to: child.parent_phone,
      templateName: 'session_summary_parent',
      variables: [
        parentFirstName,
        childFirstName,
        String(session.session_number || ''),
        fullSummary,
      ],
    });

    console.log(JSON.stringify({
      requestId,
      event: 'parent_summary_sent',
      sessionId,
      childName: child.child_name,
      whatsappSuccess: waResult.success,
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
      whatsapp_message_id: waResult.messageId || null,
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
      sessionsRemaining = Math.max(0, (enrollment.total_sessions || 9) - sessionsCompleted);
    }
  } catch {
    // Non-fatal
  }

  // 7. Build Gemini prompt
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

  const prompt = `You are rAI, Yestoryd's reading intelligence system. Synthesize a learning profile for this child based on their coaching session history.

CHILD: ${childRow?.child_name || 'Unknown'}, age ${childRow?.age || '?'}, band ${childRow?.age_band || '?'}
SESSION JUST COMPLETED: #${sessionNumber || '?'}
SESSIONS COMPLETED: ${sessionsCompleted}, REMAINING: ${sessionsRemaining}

CURRENT PROFILE (previous synthesis, may be empty):
${JSON.stringify(currentProfile, null, 2)}

THIS SESSION'S DATA:
${sessionEvent ? JSON.stringify(sessionEvent.event_data, null, 2) : 'No event data found'}

RECENT SESSION HISTORY (most recent first):
${historyText || 'No history available'}

ACTIVE STRUGGLE FLAGS:
${struggleText || 'None'}

PARENT TASK COMPLETION RATE: ${taskCompletionRate !== null ? (taskCompletionRate * 100).toFixed(0) + '%' : 'Not available'}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "last_updated": "${new Date().toISOString()}",
  "reading_level": { "current": "Foundation — Early/Mid/Late or Building — Early/Mid/Late or Mastery — Early/Mid/Late", "wpm": null, "trend": "improving" },
  "active_skills": ["skill_tag_1"],
  "mastered_skills": ["skill_tag_1"],
  "struggle_areas": [{ "skill": "skill_tag", "sessions_struggling": 1, "severity": "mild" }],
  "what_works": ["approach 1"],
  "what_doesnt_work": ["approach 1"],
  "personality_notes": "Brief description of child's learning personality and engagement style",
  "parent_engagement": { "level": "high", "task_completion_rate": ${taskCompletionRate !== null ? taskCompletionRate.toFixed(2) : 0} },
  "recommended_focus_next_session": "Specific recommendation for next session focus",
  "sessions_completed": ${sessionsCompleted},
  "sessions_remaining": ${sessionsRemaining}
}

RULES:
- Update the previous profile with new data, don't start from scratch
- Use actual skill tags from el_skills (phonemic_awareness, phonics, fluency, vocabulary, comprehension, etc.)
- Base reading_level.trend on comparing recent sessions to earlier ones
- struggle_areas should consolidate recurring struggles across sessions
- what_works and what_doesnt_work should accumulate across sessions
- personality_notes should evolve with each session (not reset)
- If this is the first session, infer what you can from available data`;

  if (!process.env.GEMINI_API_KEY) {
    console.log(JSON.stringify({ requestId, event: 'learning_profile_skipped', reason: 'no GEMINI_API_KEY' }));
    return;
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const result = await model.generateContent(prompt);
  let responseText = result.response.text().trim();

  // Strip markdown code fences if present
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let profile: any;
  try {
    profile = JSON.parse(responseText);
  } catch (parseError: any) {
    throw new Error(`Gemini returned invalid JSON: ${responseText.substring(0, 200)}`);
  }

  // Validate basic structure
  if (!profile.last_updated || !profile.reading_level) {
    throw new Error('Invalid profile structure from Gemini');
  }

  // 8. Store in children.learning_profile
  const { error: updateError } = await supabase
    .from('children')
    .update({ learning_profile: profile })
    .eq('id', childId);

  if (updateError) {
    throw new Error(`Failed to update learning_profile: ${updateError.message}`);
  }

  console.log(JSON.stringify({
    requestId,
    event: 'learning_profile_updated',
    childId,
    sessionNumber,
    activeSkills: profile.active_skills?.length || 0,
    struggleAreas: profile.struggle_areas?.length || 0,
    trend: profile.reading_level?.trend,
  }));
}
