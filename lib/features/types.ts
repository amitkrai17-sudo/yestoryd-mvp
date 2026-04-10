// Single source of truth for all gatable feature keys
export const FEATURE_KEYS = [
  'smart_practice',
  'elearning_access',
  'reading_tests',
  'recall_recording',
  'rai_chat',
  'homework_tracking',
  'detailed_analysis',
  'progress_cards',
  'whatsapp_full',
  'free_workshops',
  'gamification',
  'activity_calendar',
  'book_library',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureMap = Record<FeatureKey, boolean>;

export type ProductType = 'coaching' | 'tuition' | 'workshop';

export interface ChildFeatures {
  childId: string;
  productType: ProductType | null;
  features: FeatureMap;
  hasOverrides: boolean;
}

// Default: all features disabled
export const DEFAULT_FEATURES: FeatureMap = Object.fromEntries(
  FEATURE_KEYS.map((k) => [k, false])
) as FeatureMap;
