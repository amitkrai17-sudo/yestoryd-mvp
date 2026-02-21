// ============================================================
// FILE: app/api/admin/content-library/[id]/tags/route.ts
// PURPOSE: Add or remove skill tags on a content item
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { generateEmbedding } from '@/lib/rai/embeddings';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

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

export async function POST(
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
    const { action, skill_id, sub_skill_tag, is_primary } = body;

    if (!action || !skill_id) {
      return NextResponse.json({ error: 'action and skill_id are required' }, { status: 400 });
    }

    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json({ error: 'action must be "add" or "remove"' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Verify content item exists
    const { data: item, error: fetchError } = await supabase
      .from('el_content_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Content item not found' }, { status: 404 });
    }

    if (action === 'add') {
      const { error: insertError } = await supabase
        .from('el_content_tags')
        .insert({
          content_item_id: id,
          skill_id,
          sub_skill_tag: sub_skill_tag || null,
          is_primary: is_primary || false,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          return NextResponse.json({ error: 'This skill tag already exists on this item' }, { status: 409 });
        }
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    } else {
      const { error: deleteError } = await supabase
        .from('el_content_tags')
        .delete()
        .eq('content_item_id', id)
        .eq('skill_id', skill_id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    // Re-compose search_text with updated skill names and re-embed
    const { data: updatedTags } = await supabase
      .from('el_content_tags')
      .select('el_skills(name)')
      .eq('content_item_id', id);

    const skillNames = (updatedTags || []).map((t: any) => t.el_skills?.name).filter(Boolean);
    const searchText = composeSearchText(item, skillNames);
    const embedding = await generateEmbedding(searchText);

    await supabase
      .from('el_content_items')
      .update({
        search_text: searchText,
        embedding: JSON.stringify(embedding),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    console.log(JSON.stringify({
      requestId,
      event: 'content_tag_updated',
      contentId: id,
      action,
      skillId: skill_id,
      admin: auth.email,
    }));

    return NextResponse.json({ success: true, skills: skillNames });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'content_tag_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
