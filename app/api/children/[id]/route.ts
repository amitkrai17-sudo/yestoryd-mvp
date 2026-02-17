import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: childId } = await params;

    if (!childId) {
      return NextResponse.json(
        { error: 'Child ID required' },
        { status: 400 }
      );
    }

    const { data: child, error } = await supabase
      .from('children')
      .select('id, name, age, parent_goals, goals_captured_at, goals_capture_method')
      .eq('id', childId)
      .single();

    if (error || !child) {
      console.error('Child fetch error:', error);
      return NextResponse.json(
        { error: 'Child not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(child);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
