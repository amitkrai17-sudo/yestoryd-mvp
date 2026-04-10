import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { getChildFeatures } from '@/lib/features/get-child-features';
import { FEATURE_KEYS } from '@/lib/features/types';

export const dynamic = 'force-dynamic';

// GET: Returns product defaults + current overrides for a child
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    const supabase = getServiceSupabase();
    const { id: childId } = await params;
    const features = await getChildFeatures(childId);

    // Also get raw product defaults for comparison
    const { data: productDefaults } = await supabase
      .from('product_features')
      .select('feature_key, enabled')
      .eq('product_type', features.productType || '');

    const defaults: Record<string, boolean> = {};
    if (productDefaults) {
      for (const f of productDefaults) {
        defaults[f.feature_key] = f.enabled;
      }
    }

    // Get raw overrides
    const { data: child } = await supabase
      .from('children')
      .select('feature_overrides')
      .eq('id', childId)
      .single();

    return NextResponse.json({
      childId,
      productType: features.productType,
      resolvedFeatures: features.features,
      productDefaults: defaults,
      overrides: (child?.feature_overrides as Record<string, boolean>) || {},
      hasOverrides: features.hasOverrides,
    });
  } catch (error) {
    console.error('[admin/children/features] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update feature_overrides for a child
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    const supabase = getServiceSupabase();
    const { id: childId } = await params;
    const body = await request.json();
    const { overrides } = body as { overrides: Record<string, boolean> };

    if (typeof overrides !== 'object') {
      return NextResponse.json({ error: 'overrides must be an object' }, { status: 400 });
    }

    // Validate all keys are known feature keys
    const validKeys = new Set<string>(FEATURE_KEYS);

    for (const key of Object.keys(overrides)) {
      if (!validKeys.has(key)) {
        return NextResponse.json({ error: `Unknown feature key: ${key}` }, { status: 400 });
      }
    }

    const { error: updateError } = await supabase
      .from('children')
      .update({ feature_overrides: overrides })
      .eq('id', childId);

    if (updateError) {
      console.error('[admin/children/features] PATCH error:', updateError);
      return NextResponse.json({ error: 'Failed to update overrides' }, { status: 500 });
    }

    // Return updated features
    const features = await getChildFeatures(childId);
    return NextResponse.json({
      success: true,
      childId,
      resolvedFeatures: features.features,
      overrides,
      hasOverrides: Object.keys(overrides).length > 0,
    });
  } catch (error) {
    console.error('[admin/children/features] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
