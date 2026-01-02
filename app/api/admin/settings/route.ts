// =============================================================================
// FILE: app/api/admin/settings/route.ts
// PURPOSE: Admin API for fetching and updating site settings
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Fetch settings by category
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categories = searchParams.get('categories')?.split(',') || [];

    let query = supabase.from('site_settings').select('*');

    if (categories.length > 0) {
      query = query.in('category', categories);
    }

    const { data: settings, error } = await query.order('key');

    if (error) {
      console.error('Error fetching settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    return NextResponse.json({ settings });

  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update multiple settings
export async function PATCH(request: NextRequest) {
  try {
    const { settings } = await request.json();

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings data' }, { status: 400 });
    }

    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value: `"${value}"`, // Wrap in JSON quotes
      updated_at: new Date().toISOString(),
    }));

    // Update each setting
    const errors: string[] = [];
    
    for (const update of updates) {
      const { error } = await supabase
        .from('site_settings')
        .update({ 
          value: update.value,
          updated_at: update.updated_at,
        })
        .eq('key', update.key);

      if (error) {
        console.error(`Error updating ${update.key}:`, error);
        errors.push(update.key);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Failed to update: ${errors.join(', ')}`,
        failedKeys: errors,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} settings`,
    });

  } catch (error) {
    console.error('Settings PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
