// ============================================================
// GET /api/intelligence/observations
// Returns skill observations grouped by skill, filtered by age band.
// Used by the structured capture form to populate observation selectors.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Auth: coach or admin only
  const auth = await requireAdminOrCoach();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  const { searchParams } = new URL(request.url);
  const skillIdsParam = searchParams.get('skillIds');
  const ageBand = searchParams.get('ageBand');

  if (!skillIdsParam) {
    return NextResponse.json(
      { error: 'skillIds query parameter is required (comma-separated UUIDs)' },
      { status: 400 },
    );
  }

  // Validate skillIds are UUID-shaped
  const skillIds = skillIdsParam.split(',').map(s => s.trim()).filter(Boolean);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const id of skillIds) {
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: `Invalid UUID in skillIds: ${id}` },
        { status: 400 },
      );
    }
  }

  if (skillIds.length > 20) {
    return NextResponse.json(
      { error: 'Maximum 20 skill IDs per request' },
      { status: 400 },
    );
  }

  // Validate ageBand if provided
  const validAgeBands = ['4-6', '7-9', '10-12'];
  if (ageBand && !validAgeBands.includes(ageBand)) {
    return NextResponse.json(
      { error: `Invalid ageBand. Must be one of: ${validAgeBands.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    const supabase = getServiceSupabase();

    const query = supabase
      .from('el_skill_observations')
      .select('id, skill_id, observation_text, observation_type, age_bands, sort_order')
      .in('skill_id', skillIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false });

    const { data: observations, error } = await query;

    if (error) {
      console.error(JSON.stringify({ event: 'observations_query_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch observations' }, { status: 500 });
    }

    // Filter by age band overlap (age_bands column is string[], null means all ages)
    const filtered = (observations || []).filter(obs => {
      if (!ageBand) return true;
      if (!obs.age_bands || obs.age_bands.length === 0) return true; // null/empty = all ages
      return obs.age_bands.includes(ageBand);
    });

    // Group by skill_id
    const grouped: Record<string, {
      skillId: string;
      observations: Array<{
        id: string;
        text: string;
        type: string;
        sortOrder: number | null;
      }>;
    }> = {};

    for (const id of skillIds) {
      grouped[id] = { skillId: id, observations: [] };
    }

    for (const obs of filtered) {
      if (!grouped[obs.skill_id]) {
        grouped[obs.skill_id] = { skillId: obs.skill_id, observations: [] };
      }
      grouped[obs.skill_id].observations.push({
        id: obs.id,
        text: obs.observation_text,
        type: obs.observation_type,
        sortOrder: obs.sort_order,
      });
    }

    return NextResponse.json({
      success: true,
      ageBand: ageBand || 'all',
      skills: grouped,
      totalObservations: filtered.length,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600', // 5 min client, 10 min CDN
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'observations_error',
      error: error instanceof Error ? error.message : 'Unknown',
    }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
