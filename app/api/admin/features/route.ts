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
      .order('flag_key', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ flags });
  } catch (error: any) {
    console.error('Failed to fetch feature flags:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a feature flag
export async function PUT(request: NextRequest) {
  try {
    const { flag_key, flag_value } = await request.json();

    if (!flag_key) {
      return NextResponse.json(
        { error: 'Flag key is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('feature_flags')
      .update({ 
        flag_value,
        updated_at: new Date().toISOString(),
      })
      .eq('flag_key', flag_key)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ flag: data });
  } catch (error: any) {
    console.error('Failed to update feature flag:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new feature flag
export async function POST(request: NextRequest) {
  try {
    const { flag_key, flag_value, description } = await request.json();

    if (!flag_key) {
      return NextResponse.json(
        { error: 'Flag key is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('feature_flags')
      .insert({
        flag_key,
        flag_value: flag_value ?? false,
        description,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ flag: data });
  } catch (error: any) {
    console.error('Failed to create feature flag:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
