// ============================================================
// FILE: app/api/artifacts/[childId]/route.ts
// ============================================================
// GET: Paginated list of artifacts for a child.
// Auth: requireAuth() — parent sees own children, coach sees coached children.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  const requestId = crypto.randomUUID();
  const { childId } = await params;

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

    // Check ownership: parent or coach
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
      if (coach) hasAccess = true; // Coaches can see any child's artifacts
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 50);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    const status = searchParams.get('status'); // 'active', 'archived'
    const artifactType = searchParams.get('type'); // 'drawing', 'writing', etc.

    let query: any = supabase
      .from('child_artifacts' as any)
      .select('id, artifact_type, title, thumbnail_uri, mime_type, analysis_status, analysis_result, created_at, upload_context, uploaded_by', { count: 'exact' })
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.eq('status', 'active');
    }

    if (artifactType) {
      query = query.eq('artifact_type', artifactType);
    }

    const { data: artifacts, error, count } = await query as { data: any[] | null; error: any; count: number | null };

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'artifacts_list_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch artifacts' }, { status: 500 });
    }

    // Extract summary fields from analysis_result for list view
    const items = (artifacts || []).map(a => {
      const result = a.analysis_result as any;
      return {
        id: a.id,
        artifact_type: a.artifact_type,
        title: a.title,
        thumbnail_uri: a.thumbnail_uri,
        mime_type: a.mime_type,
        analysis_status: a.analysis_status,
        content_type: result?.content_type || null,
        skills_count: result?.skills_demonstrated?.length || 0,
        child_feedback_preview: result?.child_feedback?.substring(0, 80) || null,
        parent_summary: result?.parent_summary || null,
        upload_context: a.upload_context,
        uploaded_by: a.uploaded_by,
        created_at: a.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      child_id: childId,
      child_name: child.child_name,
      artifacts: items,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error(JSON.stringify({ requestId, event: 'artifacts_list_error', error: error instanceof Error ? error.message : 'Unknown' }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
