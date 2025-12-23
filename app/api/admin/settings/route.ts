import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all settings
export async function GET() {
  try {
    const { data: settings, error } = await supabase
      .from('site_settings')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Helper: Ensure value is a clean JSON string (no double encoding)
function toCleanJsonString(value: any): string {
  if (value === null || value === undefined) {
    return '""';
  }
  
  // Convert to string first
  let str = String(value);
  
  // Remove any existing JSON encoding (escaped quotes at start/end)
  // Handle cases like: "\"https://...\""
  while (str.startsWith('"') && str.endsWith('"') && str.length > 2) {
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed === 'string') {
        str = parsed;
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  
  // Now str is the raw value, wrap it once for JSONB
  return JSON.stringify(str);
}

// PUT - Update a setting
export async function PUT(request: NextRequest) {
  try {
    const { key, value } = await request.json();

    if (!key) {
      return NextResponse.json(
        { error: 'Setting key is required' },
        { status: 400 }
      );
    }

    // Clean and encode the value properly
    const jsonValue = toCleanJsonString(value);

    const { data, error } = await supabase
      .from('site_settings')
      .update({
        value: jsonValue,
        updated_at: new Date().toISOString(),
      })
      .eq('key', key)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ setting: data });
  } catch (error: any) {
    console.error('Failed to update setting:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new setting
export async function POST(request: NextRequest) {
  try {
    const { category, key, value, description } = await request.json();

    if (!category || !key) {
      return NextResponse.json(
        { error: 'Category and key are required' },
        { status: 400 }
      );
    }

    // Clean and encode the value properly
    const jsonValue = toCleanJsonString(value);

    const { data, error } = await supabase
      .from('site_settings')
      .insert({
        category,
        key,
        value: jsonValue,
        description,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ setting: data });
  } catch (error: any) {
    console.error('Failed to create setting:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
