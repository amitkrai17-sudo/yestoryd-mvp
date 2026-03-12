// ============================================================
// FILE: app/api/artifacts/[childId]/[artifactId]/route.ts
// ============================================================
// GET: Full artifact details with signed URLs.
// Auth: requireAuth() — parent sees own children, coach sees coached children.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { getArtifactSignedUrls } from '@/lib/storage/artifact-storage';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string; artifactId: string }> },
) {
  const requestId = crypto.randomUUID();
  const { childId, artifactId } = await params;

  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServiceSupabase();

    // Verify child access
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, parent_id, parent_email')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    let hasAccess = child.parent_email === auth.email;
    if (!hasAccess) {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', auth.email ?? '')
        .maybeSingle();
      if (parent && child.parent_id === parent.id) hasAccess = true;
    }
    if (!hasAccess) {
      const { data: coach } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', auth.email ?? '')
        .maybeSingle();
      if (coach) hasAccess = true;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Fetch artifact
    const { data: artifactRaw, error } = await (supabase
      .from('child_artifacts' as any)
      .select('*')
      .eq('id', artifactId)
      .eq('child_id', childId)
      .single() as any);

    const artifact = artifactRaw as any;

    if (error || !artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    // Generate signed URLs (1 hour)
    let urls = { originalUrl: null as string | null, processedUrl: null as string | null, thumbnailUrl: null as string | null };
    if (artifact.original_uri !== '__typed_text__') {
      urls = await getArtifactSignedUrls({
        original_uri: artifact.original_uri,
        processed_uri: artifact.processed_uri,
        thumbnail_uri: artifact.thumbnail_uri,
      });
    }

    // Parse analysis for structured response
    const analysis = artifact.analysis_result as any;

    return NextResponse.json({
      success: true,
      artifact: {
        id: artifact.id,
        child_id: artifact.child_id,
        artifact_type: artifact.artifact_type,
        title: artifact.title,
        description: artifact.description,
        uploaded_by: artifact.uploaded_by,
        upload_context: artifact.upload_context,
        mime_type: artifact.mime_type,
        file_size_bytes: artifact.file_size_bytes,
        image_width: artifact.image_width,
        image_height: artifact.image_height,
        // Storage URLs
        original_url: urls.originalUrl,
        processed_url: urls.processedUrl,
        thumbnail_url: urls.thumbnailUrl,
        // For typed text
        typed_text: artifact.original_uri === '__typed_text__' ? artifact.parent_note : null,
        // Analysis
        analysis_status: artifact.analysis_status,
        analysis_model: artifact.analysis_model,
        analyzed_at: artifact.analyzed_at,
        analysis: analysis ? {
          content_type: analysis.content_type,
          skills_demonstrated: analysis.skills_demonstrated,
          specific_observations: analysis.specific_observations,
          error_patterns: analysis.error_patterns,
          age_appropriate: analysis.age_appropriate,
          child_feedback: analysis.child_feedback,
          parent_summary: analysis.parent_summary,
          readability_score: analysis.readability_score,
          quality_issues: analysis.quality_issues,
        } : null,
        // Feedback
        coach_feedback: artifact.coach_feedback,
        coach_feedback_at: artifact.coach_feedback_at,
        parent_note: artifact.original_uri !== '__typed_text__' ? artifact.parent_note : null,
        // Revision
        revision_of: artifact.revision_of,
        revision_number: artifact.revision_number,
        // Status
        status: artifact.status,
        created_at: artifact.created_at,
        updated_at: artifact.updated_at,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'artifact_detail_error', error: error instanceof Error ? error.message : 'Unknown' }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
