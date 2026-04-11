// ============================================================
// Recall Enrichment — Enhance existing SCF capture with transcript data
// Called by process-session when coach has already filed a capture.
// ============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { insertLearningEvent } from '@/lib/rai/learning-events';

interface EnrichmentData {
  transcriptUrl?: string;
  audioUrl?: string;
  integrityScore: number;
  notableQuotes: string[];
}

/**
 * Enrich an existing coach-confirmed capture with Recall transcript data.
 * - Stores enrichment metadata (transcript, audio, integrity score)
 * - Boosts intelligence score if integrity passes
 * - Flags to admin if integrity is low
 * - Creates recall_enrichment learning_event
 */
export async function enrichExistingCapture(
  captureId: string,
  childId: string,
  coachId: string,
  sessionId: string,
  data: EnrichmentData
) {
  const supabase = createAdminClient();

  // 1. Store enrichment metadata on capture
  await supabase
    .from('structured_capture_responses')
    .update({
      recall_enrichment: {
        transcript_url: data.transcriptUrl || null,
        audio_url: data.audioUrl || null,
        integrity_score: data.integrityScore,
        notable_quotes: data.notableQuotes,
        enriched_at: new Date().toISOString(),
      },
    })
    .eq('id', captureId);

  // 2. Boost intelligence score if integrity passes (>70)
  if (data.integrityScore > 70) {
    const { data: capture } = await supabase
      .from('structured_capture_responses')
      .select('intelligence_score')
      .eq('id', captureId)
      .single();

    if (capture) {
      const boost = Math.floor(data.integrityScore / 10);
      const boosted = Math.min(100, (capture.intelligence_score || 0) + boost);
      await supabase
        .from('structured_capture_responses')
        .update({ intelligence_score: boosted })
        .eq('id', captureId);
    }
  }

  // 3. Flag admin if integrity is LOW (<50)
  if (data.integrityScore < 50) {
    // Find admin user_id
    const { data: admin } = await supabase
      .from('coaches')
      .select('user_id')
      .eq('email', 'amitkrai17@gmail.com')
      .maybeSingle();

    if (admin?.user_id) {
      await supabase
        .from('in_app_notifications')
        .insert({
          user_id: admin.user_id,
          user_type: 'admin',
          title: 'Session integrity concern',
          body: `Recall transcript doesn't match SCF capture (integrity: ${data.integrityScore}%). Review needed.`,
          notification_type: 'warning',
          action_url: `/admin/crm`,
          metadata: { capture_id: captureId, session_id: sessionId, integrity_score: data.integrityScore },
        });
    }
  }

  // 4. Create enrichment learning_event
  await insertLearningEvent({
    childId,
    coachId,
    sessionId,
    eventType: 'recall_enrichment' as any, // Added to CHECK constraint in migration
    eventSubtype: 'transcript_enrichment',
    signalConfidence: 'high',
    signalSource: 'transcript_analysis',
    eventData: {
      capture_id: captureId,
      integrity_score: data.integrityScore,
      notable_quotes: data.notableQuotes,
      has_transcript: !!data.transcriptUrl,
      has_audio: !!data.audioUrl,
    },
    contentForEmbedding: data.notableQuotes.length > 0
      ? `Session recording enrichment. Notable quotes: ${data.notableQuotes.join(' | ')}`
      : 'Session recording enrichment — transcript analyzed for integrity.',
  });
}

/**
 * Store Recall analysis as pre-fill for SCF when coach hasn't filed yet.
 * Coach sees this when they open SCF — loaded by useCapture.ts.
 */
export async function createRecallPreFill(
  sessionId: string,
  data: {
    suggestedSkills: string[];
    suggestedEngagement: string;
    strengthSummary: string;
    struggleSummary: string;
    transcriptUrl?: string;
    audioUrl?: string;
    parentSummary?: string;
  }
) {
  const supabase = createAdminClient();

  await supabase
    .from('scheduled_sessions')
    .update({
      recall_prefill_data: {
        suggested_skills: data.suggestedSkills,
        suggested_engagement: data.suggestedEngagement,
        strength_summary: data.strengthSummary,
        struggle_summary: data.struggleSummary,
        transcript_url: data.transcriptUrl || null,
        audio_url: data.audioUrl || null,
        parent_summary: data.parentSummary || null,
        created_at: new Date().toISOString(),
      },
    })
    .eq('id', sessionId);
}

/**
 * Simple integrity check: compare Recall transcript skills vs SCF capture skills.
 * Returns 0-100 score based on overlap.
 */
export function computeIntegrityScore(
  transcriptSkills: string[],
  captureSkills: string[],
  transcriptEngagement: string,
  captureEngagement: string
): number {
  if (transcriptSkills.length === 0 && captureSkills.length === 0) return 80;

  const tArr = transcriptSkills.map(s => s.toLowerCase());
  const cArr = captureSkills.map(s => s.toLowerCase());
  const tSet = new Set(tArr);

  // Skill overlap
  let overlap = 0;
  for (const s of cArr) {
    if (tSet.has(s)) overlap++;
  }
  const maxSkills = Math.max(tArr.length, cArr.length, 1);
  const skillScore = (overlap / maxSkills) * 70;

  // Engagement match
  const engagementMatch = transcriptEngagement.toLowerCase() === captureEngagement.toLowerCase() ? 30 : 15;

  return Math.round(skillScore + engagementMatch);
}
