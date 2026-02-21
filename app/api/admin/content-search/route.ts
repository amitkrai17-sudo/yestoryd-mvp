// =============================================================================
// FILE: app/api/admin/content-search/route.ts
// PURPOSE: Search el_learning_units with linked content
//          Used by the admin template editor content picker
//          Migrated: queries el_content_items via el_unit_content + el_content_tags,
//          with fallback to legacy el_videos/el_worksheets/el_game_content tables
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const skill = searchParams.get('skill') || '';
    const ageBand = searchParams.get('age_band') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Build query for el_learning_units (unchanged — units remain the organizational structure)
    let query = supabase
      .from('el_learning_units')
      .select(`
        id, name, description, skill_id, content_code, icon_emoji,
        min_age, max_age, status, tags,
        skill:el_skills(id, name, skill_tag)
      `)
      .order('display_order')
      .limit(limit);

    // Text search
    if (q) {
      query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%,content_code.ilike.%${q}%`);
    }

    // Skill filter
    if (skill) {
      query = query.eq('skill_id', skill);
    }

    // Age band filter → map to min/max age
    if (ageBand === 'foundation') {
      query = query.lte('min_age', 6).gte('max_age', 4);
    } else if (ageBand === 'building') {
      query = query.lte('min_age', 9).gte('max_age', 7);
    } else if (ageBand === 'mastery') {
      query = query.lte('min_age', 12).gte('max_age', 10);
    }

    const { data: units, error: unitsError } = await query;

    if (unitsError) {
      return NextResponse.json({ error: unitsError.message }, { status: 500 });
    }

    if (!units || units.length === 0) {
      return NextResponse.json({ success: true, units: [] });
    }

    const unitIds = units.map(u => u.id);
    const skillIds = Array.from(new Set(units.map(u => u.skill_id).filter(Boolean)));

    // Try new el_content_items approach first
    let useNewTables = false;
    let videosBySkill = new Map<string, any[]>();
    let worksheetsByUnit = new Map<string, any[]>();
    let gamesBySkill = new Map<string, any[]>();

    try {
      // Fetch content linked to units via el_unit_content
      const { data: unitContent } = await (supabase as any)
        .from('el_unit_content')
        .select('unit_id, content_item_id')
        .in('unit_id', unitIds);

      // Fetch content tagged with relevant skills via el_content_tags
      const { data: taggedContent } = await (supabase as any)
        .from('el_content_tags')
        .select('content_item_id, skill_id')
        .in('skill_id', skillIds.length > 0 ? skillIds : ['__none__']);

      // Collect all content IDs
      const allContentIds = new Set<string>();
      const unitToContentIds = new Map<string, Set<string>>();
      const skillToContentIds = new Map<string, Set<string>>();

      for (const uc of unitContent || []) {
        allContentIds.add(uc.content_item_id);
        if (!unitToContentIds.has(uc.unit_id)) unitToContentIds.set(uc.unit_id, new Set());
        unitToContentIds.get(uc.unit_id)!.add(uc.content_item_id);
      }

      for (const tc of taggedContent || []) {
        allContentIds.add(tc.content_item_id);
        if (!skillToContentIds.has(tc.skill_id)) skillToContentIds.set(tc.skill_id, new Set());
        skillToContentIds.get(tc.skill_id)!.add(tc.content_item_id);
      }

      if (allContentIds.size > 0) {
        // Fetch all content items
        const { data: contentItems } = await (supabase as any)
          .from('el_content_items')
          .select('id, content_type, title, asset_url, asset_format, thumbnail_url, metadata, is_active')
          .in('id', Array.from(allContentIds))
          .eq('is_active', true);

        if (contentItems && contentItems.length > 0) {
          useNewTables = true;
          const contentMap = new Map<string, any>(contentItems.map((c: any) => [c.id, c]));

          // Group by type and by skill/unit for the same response shape
          Array.from(skillToContentIds.entries()).forEach(([skillId, contentIds]) => {
            contentIds.forEach((cid) => {
              const item = contentMap.get(cid);
              if (!item) return;
              if (item.content_type === 'video') {
                if (!videosBySkill.has(skillId)) videosBySkill.set(skillId, []);
                videosBySkill.get(skillId)!.push({
                  id: item.id,
                  title: item.title,
                  skill_id: skillId,
                  duration_seconds: item.metadata?.duration_seconds || null,
                  has_quiz: false,
                  status: 'published',
                  thumbnail_url: item.thumbnail_url,
                });
              } else if (item.content_type === 'game') {
                if (!gamesBySkill.has(skillId)) gamesBySkill.set(skillId, []);
                gamesBySkill.get(skillId)!.push({
                  id: item.id,
                  title: item.title,
                  skill_id: skillId,
                  game_engine_id: item.metadata?.game_engine || null,
                  difficulty: null,
                  is_active: true,
                });
              }
            });
          });

          Array.from(unitToContentIds.entries()).forEach(([unitId, contentIds]) => {
            contentIds.forEach((cid) => {
              const item = contentMap.get(cid);
              if (!item) return;
              if (item.content_type === 'worksheet') {
                if (!worksheetsByUnit.has(unitId)) worksheetsByUnit.set(unitId, []);
                worksheetsByUnit.get(unitId)!.push({
                  id: item.id,
                  title: item.title,
                  unit_id: unitId,
                  asset_format: item.asset_format,
                  description: null,
                });
              }
            });
          });
        }
      }
    } catch (newTableError: any) {
      console.warn('el_content_items query failed, falling back to legacy tables:', newTableError.message);
      useNewTables = false;
    }

    // Fallback: query legacy tables if new tables returned no content
    if (!useNewTables) {
      const [videosResult, worksheetsResult, gamesResult] = await Promise.all([
        supabase
          .from('el_videos')
          .select('id, title, skill_id, duration_seconds, has_quiz, status, thumbnail_url')
          .in('skill_id', skillIds.length > 0 ? skillIds : ['__none__'])
          .eq('status', 'published')
          .order('display_order')
          .limit(100),
        supabase
          .from('el_worksheets')
          .select('id, title, unit_id, asset_format, description')
          .in('unit_id', unitIds)
          .eq('is_active', true)
          .order('display_order')
          .limit(100),
        supabase
          .from('el_game_content')
          .select('id, skill_id, game_engine_id, difficulty, is_active')
          .in('skill_id', skillIds.length > 0 ? skillIds : ['__none__'])
          .limit(100),
      ]);

      for (const v of videosResult.data || []) {
        if (!v.skill_id) continue;
        if (!videosBySkill.has(v.skill_id)) videosBySkill.set(v.skill_id, []);
        videosBySkill.get(v.skill_id)!.push(v);
      }

      for (const w of worksheetsResult.data || []) {
        if (!w.unit_id) continue;
        if (!worksheetsByUnit.has(w.unit_id)) worksheetsByUnit.set(w.unit_id, []);
        worksheetsByUnit.get(w.unit_id)!.push(w);
      }

      for (const g of gamesResult.data || []) {
        if (!g.skill_id) continue;
        if (!gamesBySkill.has(g.skill_id)) gamesBySkill.set(g.skill_id, []);
        gamesBySkill.get(g.skill_id)!.push(g);
      }
    }

    // Attach content to each unit — response shape stays identical
    const enrichedUnits = units.map(unit => ({
      ...unit,
      videos: (unit.skill_id ? videosBySkill.get(unit.skill_id) : undefined) || [],
      worksheets: worksheetsByUnit.get(unit.id) || [],
      games: (unit.skill_id ? gamesBySkill.get(unit.skill_id) : undefined) || [],
    }));

    return NextResponse.json({ success: true, units: enrichedUnits });
  } catch (error: any) {
    console.error('Content search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
