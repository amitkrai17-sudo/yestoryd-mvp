import { NextResponse } from 'next/server';
import { getChildFeatures } from './get-child-features';
import type { FeatureKey } from './types';

/**
 * API route middleware: checks if a child has access to a feature.
 * Returns null if allowed, NextResponse with 403 if blocked.
 *
 * Usage in API route:
 *   const denied = await requireFeature('smart_practice', childId);
 *   if (denied) return denied;
 */
export async function requireFeature(
  featureKey: FeatureKey,
  childId: string
): Promise<NextResponse | null> {
  try {
    const { features, productType } = await getChildFeatures(childId);

    if (!features[featureKey]) {
      return NextResponse.json(
        {
          error: 'feature_not_available',
          feature: featureKey,
          current_product: productType,
          upgrade_to: 'coaching',
          message: 'This feature requires a 1:1 Coaching subscription. Upgrade to unlock.',
        },
        { status: 403 }
      );
    }

    return null;
  } catch (error) {
    console.error(`[requireFeature] Error checking ${featureKey} for child ${childId}:`, error);
    // Fail open — don't block on errors
    return null;
  }
}
