// =============================================================================
// FILE: app/api/admin/content-search/route.ts
// PURPOSE: Search el_learning_units with linked videos, games, worksheets
//          Used by the admin template editor content picker
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const skill = searchParams.get('skill') || '';
    const ageBand = searchParams.get('age_band') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Build query for el_learning_units
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

    // Fetch linked content in parallel
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
        .select('id, title, skill_id, game_engine_id')
        .in('skill_id', skillIds.length > 0 ? skillIds : ['__none__'])
        .limit(100),
    ]);

    // Group content by unit/skill
    const videosBySkill = new Map<string, any[]>();
    for (const v of videosResult.data || []) {
      const key = v.skill_id;
      if (!videosBySkill.has(key)) videosBySkill.set(key, []);
      videosBySkill.get(key)!.push(v);
    }

    const worksheetsByUnit = new Map<string, any[]>();
    for (const w of worksheetsResult.data || []) {
      const key = w.unit_id;
      if (!worksheetsByUnit.has(key)) worksheetsByUnit.set(key, []);
      worksheetsByUnit.get(key)!.push(w);
    }

    const gamesBySkill = new Map<string, any[]>();
    for (const g of gamesResult.data || []) {
      const key = g.skill_id;
      if (!gamesBySkill.has(key)) gamesBySkill.set(key, []);
      gamesBySkill.get(key)!.push(g);
    }

    // Attach content to each unit
    const enrichedUnits = units.map(unit => ({
      ...unit,
      videos: videosBySkill.get(unit.skill_id) || [],
      worksheets: worksheetsByUnit.get(unit.id) || [],
      games: gamesBySkill.get(unit.skill_id) || [],
    }));

    return NextResponse.json({ success: true, units: enrichedUnits });
  } catch (error: any) {
    console.error('Content search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
