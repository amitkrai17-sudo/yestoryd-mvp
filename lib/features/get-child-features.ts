import { createAdminClient } from '@/lib/supabase/admin';
import type { FeatureKey, FeatureMap, ChildFeatures, ProductType } from './types';
import { DEFAULT_FEATURES } from './types';

// 5-minute server-side cache for product_features (rarely changes)
let productFeaturesCache: Map<string, FeatureMap> | null = null;
let productFeaturesCacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getProductDefaults(productType: string): Promise<FeatureMap> {
  if (productFeaturesCache && Date.now() < productFeaturesCacheExpiry) {
    return productFeaturesCache.get(productType) || { ...DEFAULT_FEATURES };
  }

  const supabase = createAdminClient();
  const { data: allFeatures } = await supabase
    .from('product_features')
    .select('product_type, feature_key, enabled');

  const cache = new Map<string, FeatureMap>();
  if (allFeatures) {
    for (const f of allFeatures) {
      if (!cache.has(f.product_type)) {
        cache.set(f.product_type, { ...DEFAULT_FEATURES });
      }
      const map = cache.get(f.product_type)!;
      if (f.feature_key in map) {
        map[f.feature_key as FeatureKey] = f.enabled;
      }
    }
  }

  productFeaturesCache = cache;
  productFeaturesCacheExpiry = Date.now() + CACHE_TTL;
  return cache.get(productType) || { ...DEFAULT_FEATURES };
}

export async function getChildFeatures(childId: string): Promise<ChildFeatures> {
  const supabase = createAdminClient();

  // 1. Get child + active enrollment in parallel
  const [childResult, enrollmentResult] = await Promise.all([
    supabase
      .from('children')
      .select('id, feature_overrides, is_enrolled')
      .eq('id', childId)
      .limit(1),
    supabase
      .from('enrollments')
      .select('enrollment_type')
      .eq('child_id', childId)
      .in('status', ['active', 'payment_pending', 'pending_start'])
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const childRow = childResult.data?.[0];
  if (!childRow) {
    return { childId, productType: null, features: { ...DEFAULT_FEATURES }, hasOverrides: false };
  }

  const productType = (enrollmentResult.data?.[0]?.enrollment_type as ProductType) || null;

  // 2. Get product defaults (cached)
  const productDefaults = productType
    ? await getProductDefaults(productType)
    : { ...DEFAULT_FEATURES };

  // 3. Apply per-child overrides (Layer 2 wins over Layer 1)
  const overrides = (childRow.feature_overrides as Record<string, boolean>) || {};
  const hasOverrides = Object.keys(overrides).length > 0;
  const resolvedFeatures: FeatureMap = { ...productDefaults };

  for (const [key, value] of Object.entries(overrides)) {
    if (key in resolvedFeatures && typeof value === 'boolean') {
      resolvedFeatures[key as FeatureKey] = value;
    }
  }

  return { childId, productType, features: resolvedFeatures, hasOverrides };
}
