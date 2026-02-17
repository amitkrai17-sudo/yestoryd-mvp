// =============================================================================
// FILE: app/api/group-classes/route.ts
// PURPOSE: Fetch all active group class TYPES (templates like Kahani Times, etc.)
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// GET /api/group-classes - Fetch all active class types
export async function GET() {
  try {
    const { data: classTypes, error } = await supabase
      .from('group_class_types')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching class types:', error);
      return NextResponse.json(
        { error: 'Failed to fetch class types' },
        { status: 500 }
      );
    }

    return NextResponse.json({ classTypes });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}