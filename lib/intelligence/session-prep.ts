// ============================================================
// Session Prep Generator
// Pulls child's recent learning_events + skill gaps → Gemini
// generates focus points + activities for the next session.
// Stores in scheduled_sessions.session_prep_data JSONB.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getGenAI } from '@/lib/gemini/client';
import { getGeminiModel } from '@/lib/gemini-config';
import { safeParseGeminiJSON } from '@/lib/gemini/safe-parse';

interface SessionPrepData {
  focusPoints: string[];
  suggestedActivities: string[];
  childContext: string;
  generatedAt: string;
}

/**
 * Generate session prep for the child's next upcoming session.
 * Called by the post-capture orchestrator after a capture is confirmed.
 */
export async function generateSessionPrep(
  childId: string,
  coachId: string,
  captureId: string
): Promise<void> {
  const supabase = createAdminClient();

  // 1. Find the next upcoming session for this child + coach
  const today = new Date().toISOString().split('T')[0];
  const { data: nextSession } = await supabase
    .from('scheduled_sessions')
    .select('id, scheduled_date, session_template_id')
    .eq('child_id', childId)
    .eq('coach_id', coachId)
    .gte('scheduled_date', today)
    .in('status', ['scheduled', 'confirmed', 'rescheduled'])
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextSession) return; // No upcoming session

  // 2. Get child info + last 3 learning_events
  const [childResult, eventsResult, captureResult] = await Promise.all([
    supabase
      .from('children')
      .select('child_name, name, age')
      .eq('id', childId)
      .single(),
    supabase
      .from('learning_events')
      .select('event_type, event_data, ai_summary, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('structured_capture_responses')
      .select('skills_covered, skill_performances, custom_struggle_note, engagement_level')
      .eq('id', captureId)
      .single(),
  ]);

  const childName = childResult.data?.child_name || childResult.data?.name || 'Child';
  const childAge = childResult.data?.age || 7;
  const recentEvents = eventsResult.data || [];
  const lastCapture = captureResult.data;

  // 3. Build context string from recent events
  const eventSummaries = recentEvents.map((e, i) => {
    const data = e.event_data as Record<string, any> | null;
    const skills = data?.skillsCovered || data?.skills_worked_on || [];
    const engagement = data?.engagementLevel || data?.engagement_level || 'unknown';
    return `Session ${i + 1}: Skills: ${Array.isArray(skills) ? skills.join(', ') : 'unknown'}. Engagement: ${engagement}. ${e.ai_summary ? `Summary: ${e.ai_summary.substring(0, 100)}` : ''}`;
  }).join('\n');

  const struggles = lastCapture?.custom_struggle_note || 'None noted';
  const lastEngagement = lastCapture?.engagement_level || 'moderate';

  // 4. Generate prep via Gemini
  const prompt = `You are a reading coach assistant for Yestoryd.

CHILD: ${childName}, age ${childAge}

RECENT SESSIONS:
${eventSummaries || 'No recent session data available.'}

LAST SESSION STRUGGLES: ${struggles}
LAST ENGAGEMENT LEVEL: ${lastEngagement}

Generate a session prep brief for the coach's next session with this child.

OUTPUT REQUIREMENTS:
- focusPoints: Exactly 3-4 short bullet points (1 sentence each). What to focus on based on recent progress and struggles.
- suggestedActivities: Exactly 2-3 short activity suggestions (1 sentence each). Concrete, actionable, age-appropriate.
- childContext: 1 sentence summary of where the child is right now.

Return ONLY valid JSON, no markdown, no preamble. Exact schema:
{"focusPoints":["..."],"suggestedActivities":["..."],"childContext":"..."}`;

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: getGeminiModel('formatting') });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    });

    const text = result.response.text();
    const parsed = safeParseGeminiJSON<{
      focusPoints?: string[];
      suggestedActivities?: string[];
      childContext?: string;
    }>(text);

    if (!parsed) {
      console.error('[session-prep] JSON parse failed:', text.substring(0, 200));
      return;
    }

    const prepData: SessionPrepData = {
      focusPoints: parsed.focusPoints || [],
      suggestedActivities: parsed.suggestedActivities || [],
      childContext: parsed.childContext || '',
      generatedAt: new Date().toISOString(),
    };

    // 5. Store on the next session
    await supabase
      .from('scheduled_sessions')
      .update({ session_prep_data: prepData as any })
      .eq('id', nextSession.id);

    console.log(`[session-prep] Generated for session ${nextSession.id}: ${prepData.focusPoints.length} focus points`);
  } catch (err) {
    console.error('[session-prep] Generation failed:', (err as Error).message);
  }
}
