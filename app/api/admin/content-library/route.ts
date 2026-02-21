// ============================================================
// FILE: app/api/admin/content-library/route.ts
// PURPOSE: List and filter content items for admin browser
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const arcStage = searchParams.get('arc_stage');
    const skillId = searchParams.get('skill_id');
    const yrlLevel = searchParams.get('yrl_level');
    const search = searchParams.get('search');
    const isActive = searchParams.get('is_active');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    const supabase = getServiceSupabase();

    // Use select('*') to avoid column-not-found errors if table schema differs.
    // We strip embedding/search_text from the response (they're large).
    let query = (supabase as any)
      .from('el_content_items')
      .select('*', { count: 'exact' });

    // Filters
    if (type) {
      query = query.eq('content_type', type);
    }
    if (arcStage) {
      query = query.eq('arc_stage', arcStage);
    }
    if (yrlLevel) {
      query = query.eq('yrl_level', yrlLevel);
    }
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      query = query.eq('is_active', isActive === 'true');
    }
    if (search) {
      query = query.ilike('search_text', `%${search}%`);
    }

    // If filtering by skill, we need a subquery via el_content_tags
    if (skillId) {
      try {
        const { data: taggedIds } = await (supabase as any)
          .from('el_content_tags')
          .select('content_item_id')
          .eq('skill_id', skillId);

        if (!taggedIds || taggedIds.length === 0) {
          return NextResponse.json({ items: [], total: 0, page, totalPages: 0 });
        }

        const contentIds = taggedIds.map((t: any) => t.content_item_id);
        query = query.in('id', contentIds);
      } catch (tagErr: any) {
        console.warn('el_content_tags skill filter failed:', tagErr.message);
        // Continue without skill filter
      }
    }

    // Ordering and pagination
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: items, error, count } = await query;

    if (error) {
      console.error('el_content_items query error:', JSON.stringify({
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      }));

      // If table doesn't exist, return empty instead of 500
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({ items: [], total: 0, page, totalPages: 0 });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Strip embedding and search_text from response (large fields)
    const cleanItems = (items || []).map((item: any) => {
      const { embedding, search_text, ...rest } = item;
      return rest;
    });

    // Fetch skill tags for returned items
    const itemIds = cleanItems.map((item: any) => item.id);
    let skillsByContent: Record<string, any[]> = {};

    if (itemIds.length > 0) {
      try {
        // First try with FK join
        const { data: tags, error: tagError } = await (supabase as any)
          .from('el_content_tags')
          .select('content_item_id, skill_id, sub_skill_tag, is_primary, el_skills(id, name, skill_tag)')
          .in('content_item_id', itemIds);

        if (tagError) {
          // FK join failed — try without it
          console.warn('el_content_tags join failed, trying plain query:', tagError.message);
          const { data: plainTags } = await (supabase as any)
            .from('el_content_tags')
            .select('content_item_id, skill_id, sub_skill_tag, is_primary')
            .in('content_item_id', itemIds);

          // Resolve skill names separately
          if (plainTags && plainTags.length > 0) {
            const skillIds = Array.from(new Set(plainTags.map((t: any) => t.skill_id)));
            const { data: skillRows } = await (supabase as any)
              .from('el_skills')
              .select('id, name, skill_tag')
              .in('id', skillIds);
            const skillMap = new Map<string, any>((skillRows || []).map((s: any) => [s.id, s]));

            for (const tag of plainTags) {
              if (!skillsByContent[tag.content_item_id]) {
                skillsByContent[tag.content_item_id] = [];
              }
              const skill = skillMap.get(tag.skill_id);
              skillsByContent[tag.content_item_id].push({
                skill_id: tag.skill_id,
                skill_name: skill?.name || null,
                skill_tag: skill?.skill_tag || null,
                sub_skill_tag: tag.sub_skill_tag,
                is_primary: tag.is_primary,
              });
            }
          }
        } else {
          // FK join succeeded
          for (const tag of tags || []) {
            if (!skillsByContent[tag.content_item_id]) {
              skillsByContent[tag.content_item_id] = [];
            }
            skillsByContent[tag.content_item_id].push({
              skill_id: tag.skill_id,
              skill_name: tag.el_skills?.name || null,
              skill_tag: tag.el_skills?.skill_tag || null,
              sub_skill_tag: tag.sub_skill_tag,
              is_primary: tag.is_primary,
            });
          }
        }
      } catch (tagErr: any) {
        // el_content_tags might not exist yet — that's fine, items just have no skills
        console.warn('el_content_tags query failed (non-fatal):', tagErr.message);
      }
    }

    // Attach skills to items
    const enrichedItems = cleanItems.map((item: any) => ({
      ...item,
      skills: skillsByContent[item.id] || [],
    }));

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ items: enrichedItems, total, page, totalPages });
  } catch (error: any) {
    console.error('Content library error:', error?.message || error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
