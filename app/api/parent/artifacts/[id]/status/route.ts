// ============================================================
// FILE: app/api/parent/artifacts/[id]/status/route.ts
// PURPOSE: Poll endpoint for Gemini Vision analysis status.
// Called by PhotoUploadModal every 3s until status = completed/failed.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getServiceSupabase();

    // Fetch artifact + child ownership data in one shot
    const { data: artifact } = await supabase
      .from('child_artifacts')
      .select(`
        id,
        child_id,
        analysis_status,
        analysis_result,
        analyzed_at,
        children!child_artifacts_child_id_fkey(id, parent_id, parent_email)
      `)
      .eq('id', id)
      .single();

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    // Verify parent owns the artifact's child (same pattern as upload route)
    const child = artifact.children as unknown as {
      id: string;
      parent_id: string | null;
      parent_email: string | null;
    } | null;

    if (!child) {
      return NextResponse.json({ error: 'Artifact has no associated child' }, { status: 404 });
    }

    if (child.parent_email !== auth.email) {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', auth.email ?? '')
        .maybeSingle();

      if (!parent || child.parent_id !== parent.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    const analysisResult = artifact.analysis_result as {
      completeness?: string;
      effort_level?: string;
      handwriting_quality?: string;
      content_summary?: string;
      word_count_estimate?: number;
      observations?: string[];
    } | null;

    return NextResponse.json({
      analysis_status: artifact.analysis_status,
      analyzed_at: artifact.analyzed_at,
      ...(artifact.analysis_status === 'completed' && analysisResult
        ? {
            completeness: analysisResult.completeness || null,
            effort_level: analysisResult.effort_level || null,
            handwriting_quality: analysisResult.handwriting_quality || null,
            content_summary: analysisResult.content_summary || null,
            observations: Array.isArray(analysisResult.observations)
              ? analysisResult.observations
              : [],
          }
        : {}),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[artifacts/status] fatal:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
