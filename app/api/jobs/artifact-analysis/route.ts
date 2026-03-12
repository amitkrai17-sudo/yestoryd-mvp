// ============================================================
// FILE: app/api/jobs/artifact-analysis/route.ts
// ============================================================
// Background Job: Artifact Analysis (QStash consumer)
// Pipeline:
//   1. Fetch artifact + child details
//   2. Quality gate (readability check for images)
//   3. Main Gemini analysis (image or text)
//   4. Store results + map skills
//   5. Create learning_event with embedding
//   6. Notify parent (+ coach if homework)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGenAI } from '@/lib/gemini/client';
import { getArtifactSignedUrl } from '@/lib/storage/artifact-storage';
import { generateEmbedding } from '@/lib/rai/embeddings';
import {
  buildQualityGatePrompt,
  buildImageAnalysisPrompt,
  buildTextAnalysisPrompt,
  buildArtifactEmbeddingContent,
  type ArtifactAnalysisResult,
  type ArtifactQualityResult,
} from '@/lib/gemini/artifact-prompts';
import { loadArtifactConfig } from '@/lib/config/artifact-config';
import { COMPANY_CONFIG } from '@/lib/config/company-config';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const getSupabase = createAdminClient;

// child_artifacts table is not in generated DB types — define interface locally
interface ChildArtifact {
  id: string;
  child_id: string;
  session_id: string | null;
  artifact_type: string;
  original_uri: string;
  processed_uri: string | null;
  mime_type: string | null;
  description: string | null;
  parent_note: string | null;
  upload_context: string | null;
  analysis_status: string | null;
  analysis_model: string | null;
  analysis_result: Record<string, unknown> | null;
  analysis_error: string | null;
  analyzed_at: string | null;
  coach_feedback: string | null;
  created_at: string;
}

/** Helper for child_artifacts table (not in generated types) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function childArtifacts(supabase: ReturnType<typeof createAdminClient>): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.from('child_artifacts' as any);
}

// ── QStash Signature Verification ──

async function verifyAuth(
  request: NextRequest,
  body: string,
): Promise<{ isValid: boolean; source: string }> {
  // Internal API key (admin testing)
  const internalKey = request.headers.get('x-internal-api-key');
  if (process.env.INTERNAL_API_KEY && internalKey === process.env.INTERNAL_API_KEY) {
    return { isValid: true, source: 'internal' };
  }

  // QStash signature (production)
  const signature = request.headers.get('upstash-signature');
  if (signature && process.env.QSTASH_CURRENT_SIGNING_KEY) {
    const keysToTry = [
      process.env.QSTASH_CURRENT_SIGNING_KEY,
      process.env.QSTASH_NEXT_SIGNING_KEY,
    ].filter(Boolean) as string[];

    for (const key of keysToTry) {
      try {
        const [timestamp, providedSig] = signature.split('.');
        const timestampMs = parseInt(timestamp) * 1000;
        if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) continue;

        const expected = crypto
          .createHmac('sha256', key)
          .update(`${timestamp}.${body}`)
          .digest('base64');

        if (providedSig === expected) return { isValid: true, source: 'qstash' };
      } catch {
        continue;
      }
    }
  }

  // Dev bypass
  if (process.env.NODE_ENV === 'development') {
    return { isValid: true, source: 'dev_bypass' };
  }

  return { isValid: false, source: 'none' };
}

// ── JSON Parser ──

function parseGeminiJSON<T>(text: string): T {
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  return JSON.parse(cleaned);
}

// ── Fetch image as base64 ──

async function fetchImageBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// ── POST Handler ──

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // Read body as text for signature verification
  const bodyText = await request.text();
  const authResult = await verifyAuth(request, bodyText);

  if (!authResult.isValid) {
    console.error(JSON.stringify({ requestId, event: 'artifact_analysis_auth_failed' }));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: { artifact_id: string; requestId?: string };
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { artifact_id } = payload;
  if (!artifact_id) {
    return NextResponse.json({ error: 'artifact_id required' }, { status: 400 });
  }

  const supabase = getSupabase();

  try {
    console.log(JSON.stringify({ requestId, event: 'artifact_analysis_start', artifactId: artifact_id }));

    // ── 1. Fetch artifact + child ──

    const { data: artifactRaw } = await childArtifacts(supabase)
      .select('*')
      .eq('id', artifact_id)
      .single();

    const artifact = artifactRaw as unknown as ChildArtifact | null;

    if (!artifact) {
      console.error(JSON.stringify({ requestId, event: 'artifact_not_found', artifactId: artifact_id }));
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    if (artifact.analysis_status === 'completed') {
      return NextResponse.json({ success: true, message: 'Already analyzed' });
    }

    // Mark as processing
    await childArtifacts(supabase)
      .update({ analysis_status: 'processing' })
      .eq('id', artifact_id);

    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, name, age, age_band, parent_id')
      .eq('id', artifact.child_id)
      .single();

    const childName = child?.child_name || child?.name || 'Student';
    const childAge = child?.age || null;
    const ageBand = child?.age_band || null;

    // Load config
    let config;
    try {
      config = await loadArtifactConfig();
    } catch {
      config = { artifact_analysis_model: 'gemini-2.5-flash' };
    }

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: config.artifact_analysis_model || 'gemini-2.5-flash',
    });

    const isTypedText = artifact.original_uri === '__typed_text__';
    const isImage = !isTypedText && artifact.mime_type?.startsWith('image/');

    // ── 2. Quality Gate (images only) ──

    let imageBase64: string | null = null;
    let imageMime: string = artifact.mime_type || 'image/jpeg';
    let readabilityScore = 1.0;
    let qualityIssues: string[] = [];
    let lowConfidence = false;

    if (isImage) {
      // Get the processed image (or original if no processed version)
      const imageUri = artifact.processed_uri || artifact.original_uri;
      const signedUrl = await getArtifactSignedUrl(imageUri);

      if (!signedUrl) {
        await childArtifacts(supabase).update({
          analysis_status: 'failed',
          analysis_error: 'Could not access image from storage',
        }).eq('id', artifact_id);
        return NextResponse.json({ error: 'Image not accessible' }, { status: 500 });
      }

      imageBase64 = await fetchImageBase64(signedUrl);
      // Use webp for processed, original mime for original
      imageMime = artifact.processed_uri ? 'image/webp' : (artifact.mime_type || 'image/jpeg');

      // Quality gate
      try {
        const qualityPrompt = buildQualityGatePrompt();
        const qualityResult = await model.generateContent([
          { text: qualityPrompt },
          { inlineData: { mimeType: imageMime, data: imageBase64 } },
        ]);

        const qualityText = qualityResult.response.text();
        const quality = parseGeminiJSON<ArtifactQualityResult>(qualityText);

        readabilityScore = quality.readability_score;
        qualityIssues = quality.issues || [];

        console.log(JSON.stringify({
          requestId,
          event: 'quality_gate_result',
          readabilityScore,
          issues: qualityIssues,
        }));

        // Unreadable — stop analysis
        if (readabilityScore < 0.3) {
          await childArtifacts(supabase).update({
            analysis_status: 'unreadable',
            analysis_result: { readability_score: readabilityScore, issues: qualityIssues },
            analyzed_at: new Date().toISOString(),
          }).eq('id', artifact_id);

          // Notify parent
          if (child?.parent_id) {
            await supabase.from('in_app_notifications').insert({
              user_id: child.parent_id,
              user_type: 'parent',
              title: 'Upload needs a retake',
              body: `The photo of ${childName}'s work is too blurry to analyze. Please try again with better lighting and a clearer angle.`,
              notification_type: 'warning',
              action_url: '/parent/dashboard',
              metadata: { artifact_id, type: 'artifact_unreadable' },
            });
          }

          console.log(JSON.stringify({ requestId, event: 'artifact_unreadable', readabilityScore }));
          return NextResponse.json({ success: true, status: 'unreadable', readabilityScore });
        }

        lowConfidence = readabilityScore < 0.6;
      } catch (qErr) {
        console.error(JSON.stringify({
          requestId,
          event: 'quality_gate_error',
          error: qErr instanceof Error ? qErr.message : 'Unknown',
        }));
        // Proceed without quality gate on error
      }
    }

    // ── 3. Main Analysis ──

    let analysis: ArtifactAnalysisResult;

    try {
      if (isTypedText) {
        // Text analysis — no image needed
        const typedText = artifact.parent_note || '';
        const textPrompt = buildTextAnalysisPrompt({
          childName,
          childAge,
          ageBand,
          assignmentDescription: artifact.description,
          typedText,
        });

        const textResult = await model.generateContent([{ text: textPrompt }]);
        analysis = parseGeminiJSON<ArtifactAnalysisResult>(textResult.response.text());
      } else if (isImage && imageBase64) {
        // Image analysis
        const imagePrompt = buildImageAnalysisPrompt({
          childName,
          childAge,
          ageBand,
          assignmentDescription: artifact.description,
          lowConfidence,
        });

        const imageResult = await model.generateContent([
          { text: imagePrompt },
          { inlineData: { mimeType: imageMime, data: imageBase64 } },
        ]);

        analysis = parseGeminiJSON<ArtifactAnalysisResult>(imageResult.response.text());
      } else {
        // PDF or unsupported — skip analysis
        await childArtifacts(supabase).update({
          analysis_status: 'skipped',
          analysis_error: 'PDF analysis not yet supported',
          analyzed_at: new Date().toISOString(),
        }).eq('id', artifact_id);

        return NextResponse.json({ success: true, status: 'skipped' });
      }
    } catch (analysisErr) {
      const errMsg = analysisErr instanceof Error ? analysisErr.message : 'Unknown';
      console.error(JSON.stringify({ requestId, event: 'artifact_analysis_failed', error: errMsg }));

      await childArtifacts(supabase).update({
        analysis_status: 'failed',
        analysis_error: errMsg,
        analyzed_at: new Date().toISOString(),
      }).eq('id', artifact_id);

      return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }

    // ── 4. Map skills to el_skills ──

    let skillTagIds: string[] = [];
    if (analysis.skills_demonstrated.length > 0) {
      const { data: allSkills } = await supabase
        .from('el_skills')
        .select('id, name, skill_tag');

      if (allSkills && allSkills.length > 0) {
        const skillMap = new Map<string, string>();
        for (const s of allSkills) {
          skillMap.set(s.name.toLowerCase(), s.id);
          if (s.skill_tag) skillMap.set(s.skill_tag.toLowerCase(), s.id);
        }

        for (const skillName of analysis.skills_demonstrated) {
          const id = skillMap.get(skillName.toLowerCase());
          if (id) skillTagIds.push(id);
        }
      }
    }

    // ── 5. Store results ──

    const analysisResult = {
      ...analysis,
      readability_score: readabilityScore,
      quality_issues: qualityIssues,
      low_confidence: lowConfidence,
    };

    await childArtifacts(supabase).update({
      analysis_status: 'completed',
      analysis_model: config.artifact_analysis_model || 'gemini-2.5-flash',
      analysis_result: JSON.parse(JSON.stringify(analysisResult)),
      analysis_error: null,
      analyzed_at: new Date().toISOString(),
      coach_feedback: null, // Available for coach to add later
    }).eq('id', artifact_id);

    // ── 6. Create learning event with embedding ──

    let learningEventId: string | null = null;
    try {
      const embeddingContent = buildArtifactEmbeddingContent({
        childName,
        artifactType: artifact.artifact_type,
        contentType: analysis.content_type,
        skills: analysis.skills_demonstrated,
        observations: analysis.specific_observations,
        parentSummary: analysis.parent_summary,
        assignmentDescription: artifact.description,
      });

      const embedding = await generateEmbedding(embeddingContent);

      const { data: leEvent } = await supabase
        .from('learning_events')
        .insert({
          child_id: artifact.child_id,
          session_id: artifact.session_id || null,
          event_type: 'child_artifact',
          event_subtype: analysis.content_type,
          event_data: JSON.parse(JSON.stringify({
            artifact_id,
            artifact_type: artifact.artifact_type,
            content_type: analysis.content_type,
            skills_demonstrated: analysis.skills_demonstrated,
            observations_count: analysis.specific_observations.length,
            error_patterns: analysis.error_patterns,
            age_appropriate: analysis.age_appropriate,
            readability_score: readabilityScore,
            source_type: artifact.upload_context,
          })),
          ai_summary: analysis.parent_summary,
          content_for_embedding: embeddingContent,
          embedding: JSON.stringify(embedding),
        })
        .select('id')
        .single();

      learningEventId = leEvent?.id || null;

      console.log(JSON.stringify({
        requestId,
        event: 'learning_event_created',
        learningEventId,
      }));
    } catch (embErr) {
      console.error(JSON.stringify({
        requestId,
        event: 'learning_event_error',
        error: embErr instanceof Error ? embErr.message : 'Unknown',
      }));
      // Non-critical — analysis result is still saved
    }

    // ── 7. Notifications ──

    // Parent notification
    if (child?.parent_id) {
      try {
        const feedbackPreview = analysis.child_feedback.substring(0, 100);
        await supabase.from('in_app_notifications').insert({
          user_id: child.parent_id,
          user_type: 'parent',
          title: `${childName}'s work analyzed!`,
          body: feedbackPreview + (analysis.child_feedback.length > 100 ? '...' : ''),
          notification_type: 'success',
          action_url: `/parent/dashboard`,
          metadata: {
            artifact_id,
            type: 'artifact_analysis_complete',
            content_type: analysis.content_type,
            skills_count: analysis.skills_demonstrated.length,
          },
        });
      } catch {
        // Non-critical
      }
    }

    // Coach notification for homework submissions
    if (artifact.upload_context === 'session_homework' && artifact.session_id) {
      try {
        const { data: session } = await supabase
          .from('scheduled_sessions')
          .select('coach_id')
          .eq('id', artifact.session_id)
          .single();

        if (session?.coach_id) {
          await supabase.from('in_app_notifications').insert({
            user_id: session.coach_id,
            user_type: 'coach',
            title: `${childName} submitted homework`,
            body: `${analysis.parent_summary}`,
            notification_type: 'info',
            action_url: `/coach/sessions/${artifact.session_id}`,
            metadata: {
              artifact_id,
              child_id: artifact.child_id,
              type: 'homework_submission',
            },
          });
        }
      } catch {
        // Non-critical
      }
    }

    // Flag concerning patterns for coach review
    const needsWorkCount = analysis.specific_observations.filter(
      o => o.quality === 'needs_work'
    ).length;

    if (needsWorkCount >= 3 || analysis.age_appropriate === 'below') {
      try {
        // Find active enrollment coach
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('coach_id')
          .eq('child_id', artifact.child_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (enrollment?.coach_id) {
          await supabase.from('in_app_notifications').insert({
            user_id: enrollment.coach_id,
            user_type: 'coach',
            title: `Review needed: ${childName}'s work`,
            body: `AI analysis flagged ${needsWorkCount} areas needing work${analysis.age_appropriate === 'below' ? ' (below age expectations)' : ''}.`,
            notification_type: 'warning',
            action_url: `/coach/dashboard`,
            metadata: {
              artifact_id,
              child_id: artifact.child_id,
              type: 'artifact_concern_flag',
              needs_work_count: needsWorkCount,
              age_appropriate: analysis.age_appropriate,
            },
          });
        }
      } catch {
        // Non-critical
      }
    }

    // ── Activity log ──
    try {
      await supabase.from('activity_log').insert({
        user_email: COMPANY_CONFIG.supportEmail,
        user_type: 'system',
        action: 'artifact_analyzed',
        metadata: {
          request_id: requestId,
          artifact_id,
          child_id: artifact.child_id,
          content_type: analysis.content_type,
          skills_count: analysis.skills_demonstrated.length,
          readability_score: readabilityScore,
          age_appropriate: analysis.age_appropriate,
          learning_event_id: learningEventId,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-critical
    }

    console.log(JSON.stringify({
      requestId,
      event: 'artifact_analysis_complete',
      artifactId: artifact_id,
      contentType: analysis.content_type,
      skillsCount: analysis.skills_demonstrated.length,
      readabilityScore,
      learningEventId,
    }));

    return NextResponse.json({
      success: true,
      artifact_id,
      content_type: analysis.content_type,
      skills_count: analysis.skills_demonstrated.length,
      readability_score: readabilityScore,
      learning_event_id: learningEventId,
    });

  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'artifact_analysis_error',
      artifactId: artifact_id,
      error: error instanceof Error ? error.message : 'Unknown',
    }));

    // Mark as failed
    try {
      await childArtifacts(supabase).update({
        analysis_status: 'failed',
        analysis_error: error instanceof Error ? error.message : 'Unknown error',
      }).eq('id', artifact_id);
    } catch {
      // Can't recover
    }

    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
