import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all feature flags
export async function GET() {
  try {
    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('flag_key');

    if (error) throw error;

    return NextResponse.json({ flags: flags || [] });
  } catch (error: any) {
    console.error('Error fetching feature flags:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update a feature flag
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { flag_key, flag_value } = body;

    if (!flag_key || flag_value === undefined) {
      return NextResponse.json(
        { error: 'flag_key and flag_value are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('feature_flags')
      .update({ 
        flag_value, 
        updated_at: new Date().toISOString() 
      })
      .eq('flag_key', flag_key)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ flag: data });
  } catch (error: any) {
    console.error('Error updating feature flag:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
