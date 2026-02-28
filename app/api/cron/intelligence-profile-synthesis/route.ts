// ============================================================
// FILE: app/api/cron/intelligence-profile-synthesis/route.ts
// ============================================================
// Intelligence Profile Synthesis Cron Job
// Runs every 6 hours via QStash to synthesize raw learning
// signals into structured child intelligence profiles via Gemini.
//
// QStash Schedule:
//   cron: "0 */6 * * *"  (Every 6 hours)
//   url: /api/cron/intelligence-profile-synthesis
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';
import { Receiver } from '@upstash/qstash';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiModel } from '@/lib/gemini-config';
import crypto from 'crypto';
import {
  buildSynthesisPrompt,
  parseSynthesisResponse,
  computeSignalSources,
  computeModalityCoverage,
  determinePrimaryModality,
  type SynthesisEvent,
  type SynthesisCapture,
  type SynthesisMicroAssessment,
} from '@/lib/intelligence/synthesis';

export const dynamic = 'force-dynamic';

// ============================================================
// AUTH VERIFICATION
// ============================================================

async function verifyCronAuth(request: NextRequest, body?: string): Promise<{ isValid: boolean; source: string }> {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { isValid: true, source: 'cron_secret' };
  }

  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    try {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
      });
      const isValid = await receiver.verify({ signature, body: body || '' });
      if (isValid) return { isValid: true, source: 'qstash' };
    } catch (e) {
      console.error('QStash verification failed:', e);
    }
  }

  // Dev bypass
  if (process.env.NODE_ENV === 'development') {
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await verifyCronAuth(request);
    if (!auth.isValid) {
      console.error(JSON.stringify({ requestId, event: 'synthesis_auth_failed' }));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'synthesis_started', authSource: auth.source }));

    const supabase = getServiceSupabase();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Find profiles that need synthesis
    const { data: profiles, error: profileError } = await supabase
      .from('child_intelligence_profiles')
      .select('id, child_id, last_synthesized_at, last_any_signal_at')
      .in('freshness_status', ['fresh', 'aging'])
      .or('last_synthesized_at.is.null,last_any_signal_at.gt.last_synthesized_at')
      .limit(50);

    if (profileError) {
      console.error(JSON.stringify({ requestId, event: 'synthesis_query_error', error: profileError.message }));
      return NextResponse.json({ error: 'Failed to query profiles' }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'synthesis_no_profiles' }));
      return NextResponse.json({ success: true, message: 'No profiles need synthesis', processed: 0 });
    }

    console.log(JSON.stringify({ requestId, event: 'synthesis_profiles_found', count: profiles.length }));

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({
      model: getGeminiModel('session_analysis'),
      generationConfig: { maxOutputTokens: 2000, temperature: 0.2 },
    });

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const profile of profiles) {
      try {
        // Fetch child info
        const { data: child } = await supabase
          .from('children')
          .select('child_name, name, age, learning_profile')
          .eq('id', profile.child_id)
          .single();

        if (!child) {
          console.warn(JSON.stringify({ requestId, event: 'synthesis_child_not_found', childId: profile.child_id }));
          skipped++;
          continue;
        }

        const childName = child.child_name || child.name || 'Child';
        const childAge = child.age || 7;

        // Fetch learning events (last 30d)
        const { data: events } = await supabase
          .from('learning_events')
          .select('id, event_type, event_date, event_data, ai_summary, signal_source, signal_confidence, session_modality, created_at')
          .eq('child_id', profile.child_id)
          .gte('event_date', thirtyDaysAgo)
          .order('event_date', { ascending: false })
          .limit(50);

        // Fetch structured captures (last 30d)
        const { data: captures } = await supabase
          .from('structured_capture_responses')
          .select('id, session_date, session_modality, engagement_level, skill_performances, custom_strength_note, custom_struggle_note, intelligence_score, created_at')
          .eq('child_id', profile.child_id)
          .gte('session_date', thirtyDaysAgo.split('T')[0])
          .order('session_date', { ascending: false })
          .limit(20);

        // Fetch micro-assessments (completed, last 30d)
        const { data: microAssessments } = await supabase
          .from('micro_assessments')
          .select('id, fluency_rating, estimated_wpm, comprehension_score, gemini_analysis, completed_at')
          .eq('child_id', profile.child_id)
          .eq('status', 'completed')
          .gte('completed_at', thirtyDaysAgo)
          .order('completed_at', { ascending: false })
          .limit(10);

        const safeEvents = (events || []) as SynthesisEvent[];
        const safeCaptures = (captures || []) as SynthesisCapture[];
        const safeMicro = (microAssessments || []) as SynthesisMicroAssessment[];

        const totalSignals = safeEvents.length + safeCaptures.length + safeMicro.length;
        if (totalSignals < 2) {
          console.log(JSON.stringify({ requestId, event: 'synthesis_skipped_insufficient', childId: profile.child_id, totalSignals }));
          skipped++;
          continue;
        }

        // Build prompt and call Gemini
        const prompt = buildSynthesisPrompt({
          events: safeEvents,
          captures: safeCaptures,
          microAssessments: safeMicro,
          childAge,
          childName,
        });

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const responseText = result.response.text();

        // Parse and validate
        const synthesis = parseSynthesisResponse(responseText);

        // Compute aggregates
        const signalSources = computeSignalSources(safeEvents);
        const modalityCoverage = computeModalityCoverage(safeEvents, safeCaptures);
        const primaryModality = determinePrimaryModality(modalityCoverage);

        // Count events by confidence
        const highCount = safeEvents.filter(e => e.signal_confidence === 'high').length;
        const mediumCount = safeEvents.filter(e => e.signal_confidence === 'medium').length;
        const lowCount = safeEvents.filter(e => e.signal_confidence === 'low').length;

        // Build skill_ratings as Record<string, ProfileSkillRating> for DB
        const skillRatingsMap: Record<string, unknown> = {};
        for (const sr of synthesis.skill_ratings) {
          const key = sr.skill_name.toLowerCase().replace(/\s+/g, '_');
          skillRatingsMap[key] = {
            skillId: key,
            skillName: sr.skill_name,
            rating: sr.rating,
            confidence: sr.confidence,
            signalCount: 1,
            lastObservedAt: new Date().toISOString(),
            trend: sr.trend,
          };
        }

        // Build narrative profile
        const narrativeProfile = {
          summary: synthesis.narrative_summary,
          strengths: synthesis.key_strengths,
          areasForGrowth: synthesis.key_struggles,
          nextSessionFocus: synthesis.recommended_focus.join('; '),
          generatedAt: new Date().toISOString(),
          model: getGeminiModel('session_analysis'),
        };

        const synthesisEventIds = safeEvents.map(e => e.id);

        // UPDATE child_intelligence_profiles
        const { error: updateError } = await supabase
          .from('child_intelligence_profiles')
          .update({
            skill_ratings: skillRatingsMap as unknown as Record<string, never>,
            narrative_profile: narrativeProfile as unknown as Record<string, never>,
            overall_reading_level: synthesis.overall_reading_level,
            overall_confidence: synthesis.overall_confidence,
            engagement_pattern: synthesis.engagement_pattern,
            signal_sources: JSON.parse(JSON.stringify(signalSources)),
            modality_coverage: JSON.parse(JSON.stringify(modalityCoverage)),
            primary_modality: primaryModality,
            total_event_count: totalSignals,
            high_confidence_event_count: highCount,
            medium_confidence_event_count: mediumCount,
            low_confidence_event_count: lowCount,
            synthesis_event_ids: synthesisEventIds,
            synthesis_model: getGeminiModel('session_analysis'),
            last_synthesized_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error(JSON.stringify({ requestId, event: 'synthesis_update_error', childId: profile.child_id, error: updateError.message }));
          errors++;
          continue;
        }

        // BACKWARD COMPAT: Merge into children.learning_profile
        try {
          const existingProfile = (child.learning_profile as Record<string, unknown>) || {};
          const mergedProfile = {
            ...existingProfile,
            summary: synthesis.narrative_summary,
            recommended_focus_next_session: synthesis.recommended_focus.join('; '),
            overall_reading_level: synthesis.overall_reading_level,
            key_strengths: synthesis.key_strengths,
            key_struggles: synthesis.key_struggles,
            last_synthesized_at: new Date().toISOString(),
          };

          await supabase
            .from('children')
            .update({ learning_profile: mergedProfile })
            .eq('id', profile.child_id);
        } catch (mergeErr) {
          // Non-fatal — backward compat write
          console.warn(JSON.stringify({ requestId, event: 'synthesis_merge_warning', childId: profile.child_id, error: (mergeErr as Error).message }));
        }

        processed++;
        console.log(JSON.stringify({
          requestId,
          event: 'synthesis_child_complete',
          childId: profile.child_id,
          skillCount: synthesis.skill_ratings.length,
          confidence: synthesis.overall_confidence,
        }));

      } catch (childErr) {
        console.error(JSON.stringify({
          requestId,
          event: 'synthesis_child_error',
          childId: profile.child_id,
          error: (childErr as Error).message,
        }));
        errors++;
      }
    }

    const latencyMs = Date.now() - startTime;
    const summary = { processed, skipped, errors, totalProfiles: profiles.length, latencyMs };

    // Activity log
    try {
      await supabase.from('activity_log').insert({
        user_email: 'system@yestoryd.com',
        user_type: 'admin',
        action: 'intelligence_profile_synthesis',
        metadata: { requestId, ...summary },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal
    }

    console.log(JSON.stringify({ requestId, event: 'synthesis_complete', ...summary }));

    return NextResponse.json({ success: true, ...summary });

  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    console.error(JSON.stringify({
      requestId,
      event: 'synthesis_fatal_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      latencyMs,
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST delegates to GET (QStash sends POST)
export async function POST(request: NextRequest) {
  return GET(request);
}
