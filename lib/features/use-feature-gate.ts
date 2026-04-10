'use client';

import { useState, useEffect } from 'react';
import type { FeatureKey, FeatureMap } from './types';

interface FeatureGateResult {
  isEnabled: boolean;
  isLoading: boolean;
  productType: string | null;
  allFeatures: FeatureMap | null;
}

// In-memory cache (per page load) + dedup pending fetch
const featureCache = new Map<string, { features: FeatureMap; productType: string | null }>();
let pendingFetch: Promise<void> | null = null;

export function useFeatureGate(featureKey: FeatureKey, childId: string | null): FeatureGateResult {
  const [data, setData] = useState<{ features: FeatureMap; productType: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      setIsLoading(false);
      return;
    }

    let stale = false;

    // Check cache first
    const cached = featureCache.get(childId);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      return;
    }

    // Deduplicate: if a fetch is already in-flight, wait for it
    if (!pendingFetch) {
      pendingFetch = fetch('/api/parent/features')
        .then((res) => res.json())
        .then((result) => {
          if (result.children) {
            for (const child of result.children) {
              featureCache.set(child.childId, {
                features: child.features,
                productType: child.productType,
              });
            }
          }
        })
        .catch(() => {})
        .finally(() => { pendingFetch = null; });
    }

    pendingFetch.then(() => {
      if (stale) return;
      const entry = featureCache.get(childId) || null;
      setData(entry);
      setIsLoading(false);
    });

    return () => { stale = true; };
  }, [childId, featureKey]);

  const isEnabled = data?.features[featureKey] ?? false;
  const productType = data?.productType ?? null;
  const allFeatures = data?.features ?? null;

  return { isEnabled, isLoading, productType, allFeatures };
}
