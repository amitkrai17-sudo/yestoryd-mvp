// =============================================================================
// SETTINGS MODULE BARREL EXPORT
// Enterprise Data Architecture: Single import point for settings utilities
// =============================================================================

// Server-side utilities
export {
  getSetting,
  getSettingParsed,
  getSettings,
  getSettingsByCategory,
  getHomepageSettings,
  getSettingsForCategories,
  // Convenience functions
  getHeroSettings,
  getTransformationSettings,
  getHeaderSettings,
  getProblemSettings,
  getARCSettings,
  getFAQSettings,
  getStorySettings,
  getRAISettings,
  getTestimonialsSettings,
  getJourneySettings,
  getPricingSettings,
  getCTASettings,
  getFooterSettings,
  getFloatingSettings,
  getTriangulationSettings,
  getContactSettings,
  getVideoSettings,
  getContentSettings,
  getAssessmentSettings,
} from './getSettings';

// Re-export types
export type {
  SiteSettingRow,
  SettingCategory,
  HomepageSettings,
  PartialHomepageSettings,
  HeroSettings,
  TransformationSettings,
  HeaderSettings,
  ProblemSettings,
  ARCSettings,
  FAQSettings,
  FAQItem,
  StorySettings,
  RAISettings,
  TestimonialsSettings,
  TestimonialItem,
  JourneySettings,
  JourneyStep,
  PricingSettings,
  FreeFeatureItem,
  CTASettings,
  FooterSettings,
  FloatingSettings,
  TriangulationSettings,
  TriangulationNode,
  ContactSettings,
  VideoSettings,
  ContentSettings,
  SettingKey,
  // Assessment types
  AssessmentSettings,
  AssessmentPassage,
  AssessmentTrustBadge,
  AssessmentCTAMessage,
  AssessmentScoreContext,
  SupportedCountryCode,
} from '@/types/settings';
