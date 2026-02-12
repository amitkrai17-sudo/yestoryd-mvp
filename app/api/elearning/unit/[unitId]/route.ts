export const dynamic = 'force-dynamic';

// =============================================================================
// UNIT API
// Fetch unit data with content pools for games
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const unitId = params.unitId;
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');
    
    if (!unitId) {
      return NextResponse.json(
        { success: false, error: 'Unit ID required' },
        { status: 400 }
      );
    }
    
    // Fetch unit with sub-skill info
    const { data: unit, error: unitError } = await supabase
      .from('el_learning_units')
      .select(`
        *,
        skill:el_skills(id, name, slug, category)
      `)
      .eq('id', unitId)
      .single();
    
    if (unitError || !unit) {
      return NextResponse.json(
        { success: false, error: 'Unit not found' },
        { status: 404 }
      );
    }
    
    // Fetch content pools referenced in sequence
    const contentPoolIds = unit.sequence
      .filter((step: any) => step.content_pool_id)
      .map((step: any) => step.content_pool_id);
    
    let contentPools: Record<string, any> = {};
    
    if (contentPoolIds.length > 0) {
      try {
        const { data: pools } = await supabase
          .from('el_game_content')
          .select('*')
          .in('id', contentPoolIds);

        if (pools) {
          pools.forEach((pool: any) => {
            contentPools[pool.id] = pool;
          });
        }
      } catch {
        // Content pool table may not exist yet
      }
    }
    
    // Fetch child's progress if childId provided
    let progress = null;
    if (childId) {
      const { data: progressData } = await supabase
        .from('el_child_unit_progress')
        .select('*')
        .eq('child_id', childId)
        .eq('unit_id', unitId)
        .single();
      
      progress = progressData;
    }
    
    return NextResponse.json({
      success: true,
      unit,
      contentPools,
      progress,
    });
    
  } catch (error: any) {
    console.error('Unit API error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

