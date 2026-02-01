// =============================================================================
// ENTERPRISE CONFIGURATION TYPES
// lib/config/types.ts
//
// Type definitions for all configuration loaded from site_settings,
// pricing_plans, and revenue_split_config tables.
//
// Rule: NO hardcoded defaults in code. Missing config = loud error.
// =============================================================================

// =============================================================================
// AUTH
// =============================================================================

export interface AuthConfig {
  /** JSON array of admin email addresses */
  adminEmails: string[];
}

// =============================================================================
// COACH
// =============================================================================

export interface CoachConfig {
  /** UUID of default/fallback coach */
  defaultCoachId: string;
  /** Email of default coach */
  defaultCoachEmail: string;
  /** Display name of default coach */
  defaultCoachName: string;
  /** Coach earnings per Yestoryd-sourced lead (INR) */
  earningsYestorydLead: number;
  /** Coach earnings per coach-sourced lead (INR) */
  earningsCoachLead: number;
  /** Coach interview call duration in minutes */
  interviewDurationMinutes: number;
  /** Minimum score to pass coach assessment */
  assessmentPassScore: number;
  /** Coach referral bonus amount (INR) */
  referralBonus: number;
  /** From email for coach communications */
  fromEmail: string;
}

// =============================================================================
// PAYMENT
// =============================================================================

export interface PaymentConfig {
  /** Currency code (e.g. 'INR') */
  currency: string;
  /** Minimum payment amount in paise */
  minAmountPaise: number;
  /** Prefix for Razorpay receipt IDs */
  receiptPrefix: string;
  /** Max payment creation requests per window */
  rateLimitRequests: number;
  /** Rate limit window in seconds */
  rateLimitWindowSeconds: number;
}

// =============================================================================
// SCHEDULING
// =============================================================================

export interface SchedulingConfig {
  /** Minimum days between sessions for same child */
  minGapDays: number;
  /** How far ahead to schedule sessions */
  lookaheadDays: number;
  /** Buffer time between consecutive sessions (minutes) */
  bufferMinutes: number;
  /** Maximum sessions per coach per day */
  maxSessionsPerDay: number;
  /** Session type definitions */
  sessionTypes: Record<string, { label: string; default_duration: number }>;
}

// =============================================================================
// REVENUE SPLIT
// =============================================================================

export interface RevenueSplitConfig {
  id: string;
  leadCostPercent: number;
  coachCostPercent: number;
  platformFeePercent: number;
  tdsRatePercent: number;
  tdsThresholdAnnual: number;
  payoutFrequency: string;
  payoutDayOfMonth: number;
}

// =============================================================================
// NOTIFICATION
// =============================================================================

export interface NotificationConfig {
  /** Hours before session for 24h reminder */
  reminderHoursBefore24h: number;
  /** Hours before session for 1h reminder */
  reminderHoursBefore1h: number;
}

// =============================================================================
// ENROLLMENT
// =============================================================================

export interface EnrollmentConfig {
  /** Maximum total pause days per enrollment */
  maxPauseDaysTotal: number;
  /** Maximum days for a single pause */
  maxPauseDaysSingle: number;
  /** Maximum number of pauses per enrollment */
  maxPauseCount: number;
}

// =============================================================================
// EMAIL / INTEGRATIONS
// =============================================================================

export interface EmailConfig {
  /** Default SendGrid from email */
  fromEmail: string;
  /** Default SendGrid from display name */
  fromName: string;
}

export interface IntegrationsConfig {
  /** Google Calendar delegation email */
  googleCalendarEmail: string;
  /** Site base URL for links in emails/notifications */
  siteBaseUrl: string;
}

// =============================================================================
// PRICING PLAN (from pricing_plans table)
// =============================================================================

export interface PricingPlanConfig {
  id: string;
  name: string;
  slug: string;
  originalPrice: number;
  discountedPrice: number;
  currency: string;
  durationMonths: number;
  durationWeeks: number | null;
  sessionsIncluded: number;
  sessionsCoaching: number;
  sessionsSkillBuilding: number;
  sessionsCheckin: number;
  coachingDurationMins: number;
  skillBuildingDurationMins: number;
  checkinDurationMins: number;
  productType: string;
  isActive: boolean;
  isFeatured: boolean;
}

// =============================================================================
// COMBINED
// =============================================================================

export interface AppConfig {
  auth: AuthConfig;
  coach: CoachConfig;
  payment: PaymentConfig;
  scheduling: SchedulingConfig;
  revenueSplit: RevenueSplitConfig;
  notification: NotificationConfig;
  enrollment: EnrollmentConfig;
  email: EmailConfig;
  integrations: IntegrationsConfig;
}
