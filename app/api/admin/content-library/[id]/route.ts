// ============================================================
// FILE: app/api/admin/content-library/[id]/route.ts
// PURPOSE: Update or soft-delete a single content item
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { generateEmbedding } from '@/lib/rai/embeddings';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Fields that affect search_text and require re-embedding
const SEARCHABLE_FIELDS = ['title', 'description', 'coach_guidance', 'parent_instruction', 'child_label'];

function composeSearchText(item: Record<string, any>, skillNames: string[]): string {
  const parts: string[] = [];
  if (item.title) parts.push(item.title);
  if (item.content_type) parts.push(`type: ${item.content_type}`);
  if (item.description) parts.push(item.description);
  if (skillNames.length > 0) parts.push(`skills: ${skillNames.join(', ')}`);
  if (item.yrl_level) parts.push(`level: ${item.yrl_level}`);
  if (item.arc_stage) parts.push(`stage: ${item.arc_stage}`);
  if (item.difficulty_level) parts.push(`difficulty: ${item.difficulty_level}`);
  if (item.coach_guidance) parts.push(`coach guidance: ${item.coach_guidance}`);
  if (item.parent_instruction) parts.push(`parent instruction: ${item.parent_instruction}`);
  if (item.child_label) parts.push(item.child_label);
  return parts.join(' ').trim();
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = getServiceSupabase();

    // Fetch existing item
    const { data: existing, error: fetchError } = await supabase
      .from('el_content_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Content item not found' }, { status: 404 });
    }

    // Build update object from allowed fields
    const allowedFields = [
      'title', 'content_type', 'description', 'asset_url', 'asset_format',
      'yrl_level', 'arc_stage', 'difficulty_level', 'coach_guidance',
      'parent_instruction', 'child_label', 'metadata', 'is_active',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Check if searchable fields changed → re-embed
    const existingRecord = existing as Record<string, any>;
    const needsReEmbed = SEARCHABLE_FIELDS.some(f => updates[f] !== undefined && updates[f] !== existingRecord[f]);

    if (needsReEmbed) {
      const merged = { ...existing, ...updates };

      // Fetch skill names for this content
      const { data: tags } = await supabase
        .from('el_content_tags')
        .select('el_skills(name)')
        .eq('content_item_id', id);

      const skillNames = (tags || []).map((t: any) => t.el_skills?.name).filter(Boolean);
      const searchText = composeSearchText(merged, skillNames);
      const embedding = await generateEmbedding(searchText);

      updates.search_text = searchText;
      updates.embedding = JSON.stringify(embedding);
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('el_content_items')
      .update(updates)
      .eq('id', id)
      .select('id, title, content_type, is_active, updated_at')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(JSON.stringify({
      requestId,
      event: 'content_item_updated',
      contentId: id,
      fields: Object.keys(updates),
      reEmbedded: needsReEmbed,
      admin: auth.email,
    }));

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'content_update_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { id } = await params;
    const supabase = getServiceSupabase();

    // Soft delete: set is_active = false
    const { error } = await supabase
      .from('el_content_items')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(JSON.stringify({ requestId, event: 'content_item_deactivated', contentId: id, admin: auth.email }));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'content_delete_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
