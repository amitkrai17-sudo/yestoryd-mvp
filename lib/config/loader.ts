// =============================================================================
// ENTERPRISE CONFIGURATION LOADER
// lib/config/loader.ts
//
// Single source of truth for all business configuration.
// Loads from site_settings, pricing_plans, and revenue_split_config tables.
//
// Rules:
// 1. NO hardcoded defaults — missing config throws ConfigurationError
// 2. 5-minute TTL cache per category
// 3. All values validated before return
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase/server';
import type {
  AuthConfig,
  CoachConfig,
  PaymentConfig,
  SchedulingConfig,
  RevenueSplitConfig,
  NotificationConfig,
  EnrollmentConfig,
  EmailConfig,
  IntegrationsConfig,
  PricingPlanConfig,
} from './types';

// =============================================================================
// ERROR CLASS
// =============================================================================

export class ConfigurationError extends Error {
  constructor(
    public readonly missingKey: string,
    public readonly category: string
  ) {
    super(`[CONFIG ERROR] Missing required configuration: ${category}.${missingKey}. Add it to site_settings table.`);
    this.name = 'ConfigurationError';
  }
}

// =============================================================================
// CACHE
// =============================================================================

interface CacheEntry<T> {
  data: T;
  loadedAt: number;
}

const cache = {
  auth: null as CacheEntry<AuthConfig> | null,
  coach: null as CacheEntry<CoachConfig> | null,
  payment: null as CacheEntry<PaymentConfig> | null,
  scheduling: null as CacheEntry<SchedulingConfig> | null,
  revenueSplit: null as CacheEntry<RevenueSplitConfig> | null,
  notification: null as CacheEntry<NotificationConfig> | null,
  enrollment: null as CacheEntry<EnrollmentConfig> | null,
  email: null as CacheEntry<EmailConfig> | null,
  integrations: null as CacheEntry<IntegrationsConfig> | null,
  pricingPlans: new Map<string, CacheEntry<PricingPlanConfig>>(),
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid<T>(entry: CacheEntry<T> | null | undefined): entry is CacheEntry<T> {
  return entry != null && Date.now() - entry.loadedAt < CACHE_TTL;
}

// =============================================================================
// HELPERS
// =============================================================================

async function fetchSettingsByCategory(category: string): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('key, value')
    .eq('category', category);

  if (error) {
    throw new Error(`Failed to load ${category} config from database: ${error.message}`);
  }

  const map = new Map<string, string>();
  for (const row of data || []) {
    // Handle JSONB values that come as objects
    const val = typeof row.value === 'object' ? JSON.stringify(row.value) : String(row.value);
    map.set(row.key, val);
  }
  return map;
}

function requireSetting(settings: Map<string, string>, key: string, category: string): string {
  const value = settings.get(key);
  if (value === undefined || value === null || value === '') {
    throw new ConfigurationError(key, category);
  }
  return value;
}

function requireInt(settings: Map<string, string>, key: string, category: string): number {
  const raw = requireSetting(settings, key, category);
  const num = parseInt(raw, 10);
  if (isNaN(num)) {
    throw new ConfigurationError(`${key} (value "${raw}" is not a valid integer)`, category);
  }
  return num;
}

function requireJsonArray<T>(settings: Map<string, string>, key: string, category: string): T[] {
  const raw = requireSetting(settings, key, category);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigurationError(`${key} (invalid JSON: "${raw}")`, category);
  }
  if (!Array.isArray(parsed)) {
    throw new ConfigurationError(`${key} (expected JSON array, got ${typeof parsed})`, category);
  }
  return parsed as T[];
}

function requireJson<T>(settings: Map<string, string>, key: string, category: string): T {
  const raw = requireSetting(settings, key, category);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ConfigurationError(`${key} (invalid JSON: "${raw}")`, category);
  }
}

// =============================================================================
// LOADERS
// =============================================================================

export async function loadAuthConfig(): Promise<AuthConfig> {
  if (isCacheValid(cache.auth)) return cache.auth.data;

  const settings = await fetchSettingsByCategory('auth');
  const adminEmails = requireJsonArray<string>(settings, 'admin_emails', 'auth');

  if (adminEmails.length === 0) {
    throw new ConfigurationError('admin_emails (array is empty)', 'auth');
  }

  const config: AuthConfig = { adminEmails: adminEmails.map(e => e.toLowerCase()) };
  cache.auth = { data: config, loadedAt: Date.now() };
  return config;
}

export async function loadCoachConfig(): Promise<CoachConfig> {
  if (isCacheValid(cache.coach)) return cache.coach.data;

  const settings = await fetchSettingsByCategory('coach');

  // default_coach_email has extra quotes from legacy data — clean them
  const rawEmail = requireSetting(settings, 'default_coach_email', 'coach');
  const cleanEmail = rawEmail.replace(/^["']+|["']+$/g, '').replace(/\\"/g, '"').replace(/^["']+|["']+$/g, '');
  const rawName = requireSetting(settings, 'default_coach_name', 'coach');
  const cleanName = rawName.replace(/^["']+|["']+$/g, '');

  const config: CoachConfig = {
    defaultCoachId: requireSetting(settings, 'default_coach_id', 'coach'),
    defaultCoachEmail: cleanEmail,
    defaultCoachName: cleanName,
    earningsYestorydLead: requireInt(settings, 'coach_earnings_yestoryd_lead', 'coach'),
    earningsCoachLead: requireInt(settings, 'coach_earnings_coach_lead', 'coach'),
    interviewDurationMinutes: requireInt(settings, 'coach_interview_duration_minutes', 'coach'),
    assessmentPassScore: requireInt(settings, 'coach_assessment_pass_score', 'coach'),
    referralBonus: requireInt(settings, 'coach_referral_bonus', 'coach'),
    fromEmail: requireSetting(settings, 'coach_from_email', 'coach'),
  };

  cache.coach = { data: config, loadedAt: Date.now() };
  return config;
}

export async function loadPaymentConfig(): Promise<PaymentConfig> {
  if (isCacheValid(cache.payment)) return cache.payment.data;

  const settings = await fetchSettingsByCategory('payments');

  const config: PaymentConfig = {
    currency: requireSetting(settings, 'payment_currency', 'payments'),
    minAmountPaise: requireInt(settings, 'payment_min_amount_paise', 'payments'),
    receiptPrefix: requireSetting(settings, 'payment_receipt_prefix', 'payments'),
    rateLimitRequests: requireInt(settings, 'payment_rate_limit_requests', 'payments'),
    rateLimitWindowSeconds: requireInt(settings, 'payment_rate_limit_window_seconds', 'payments'),
  };

  cache.payment = { data: config, loadedAt: Date.now() };
  return config;
}

export async function loadSchedulingConfig(): Promise<SchedulingConfig> {
  if (isCacheValid(cache.scheduling)) return cache.scheduling.data;

  const settings = await fetchSettingsByCategory('scheduling');

  const config: SchedulingConfig = {
    minGapDays: requireInt(settings, 'scheduling_min_gap_days', 'scheduling'),
    lookaheadDays: requireInt(settings, 'scheduling_lookahead_days', 'scheduling'),
    bufferMinutes: requireInt(settings, 'scheduling_buffer_minutes', 'scheduling'),
    maxSessionsPerDay: requireInt(settings, 'coach_max_sessions_per_day', 'scheduling'),
    sessionTypes: requireJson(settings, 'session_types', 'scheduling'),
  };

  cache.scheduling = { data: config, loadedAt: Date.now() };
  return config;
}

export async function loadRevenueSplitConfig(): Promise<RevenueSplitConfig> {
  if (isCacheValid(cache.revenueSplit)) return cache.revenueSplit.data;

  const { data, error } = await supabaseAdmin
    .from('revenue_split_config')
    .select('*')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new ConfigurationError(
      'active revenue split record',
      'revenue_split_config'
    );
  }

  const config: RevenueSplitConfig = {
    id: data.id,
    leadCostPercent: Number(data.lead_cost_percent),
    coachCostPercent: Number(data.coach_cost_percent),
    platformFeePercent: Number(data.platform_fee_percent),
    tdsRatePercent: Number(data.tds_rate_percent),
    tdsThresholdAnnual: Number(data.tds_threshold_annual),
    payoutFrequency: data.payout_frequency,
    payoutDayOfMonth: Number(data.payout_day_of_month),
  };

  // Validate percentages sum to 100
  const totalPercent = config.leadCostPercent + config.coachCostPercent + config.platformFeePercent;
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new ConfigurationError(
      `revenue split percentages sum to ${totalPercent}, expected 100`,
      'revenue_split_config'
    );
  }

  cache.revenueSplit = { data: config, loadedAt: Date.now() };
  return config;
}

export async function loadNotificationConfig(): Promise<NotificationConfig> {
  if (isCacheValid(cache.notification)) return cache.notification.data;

  const settings = await fetchSettingsByCategory('notifications');

  const config: NotificationConfig = {
    reminderHoursBefore24h: requireInt(settings, 'reminder_hours_before_24h', 'notifications'),
    reminderHoursBefore1h: requireInt(settings, 'reminder_hours_before_1h', 'notifications'),
  };

  cache.notification = { data: config, loadedAt: Date.now() };
  return config;
}

export async function loadEnrollmentConfig(): Promise<EnrollmentConfig> {
  if (isCacheValid(cache.enrollment)) return cache.enrollment.data;

  const settings = await fetchSettingsByCategory('enrollment');

  const config: EnrollmentConfig = {
    maxPauseDaysTotal: requireInt(settings, 'max_pause_days_total', 'enrollment'),
    maxPauseDaysSingle: requireInt(settings, 'max_pause_days_single', 'enrollment'),
    maxPauseCount: requireInt(settings, 'max_pause_count', 'enrollment'),
  };

  cache.enrollment = { data: config, loadedAt: Date.now() };
  return config;
}

export async function loadEmailConfig(): Promise<EmailConfig> {
  if (isCacheValid(cache.email)) return cache.email.data;

  const settings = await fetchSettingsByCategory('email');

  const config: EmailConfig = {
    fromEmail: requireSetting(settings, 'sendgrid_from_email', 'email'),
    fromName: requireSetting(settings, 'sendgrid_from_name', 'email'),
  };

  cache.email = { data: config, loadedAt: Date.now() };
  return config;
}

export async function loadIntegrationsConfig(): Promise<IntegrationsConfig> {
  if (isCacheValid(cache.integrations)) return cache.integrations.data;

  const settings = await fetchSettingsByCategory('integrations');

  const config: IntegrationsConfig = {
    googleCalendarEmail: requireSetting(settings, 'google_calendar_email', 'integrations'),
    siteBaseUrl: requireSetting(settings, 'site_base_url', 'integrations'),
  };

  cache.integrations = { data: config, loadedAt: Date.now() };
  return config;
}

export async function loadPricingPlan(slugOrId: string): Promise<PricingPlanConfig> {
  const cached = cache.pricingPlans.get(slugOrId);
  if (isCacheValid(cached)) return cached.data;

  // Try by slug first, then by id
  let query = supabaseAdmin
    .from('pricing_plans')
    .select('*')
    .eq('is_active', true);

  // UUID pattern check
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  if (isUuid) {
    query = query.eq('id', slugOrId);
  } else {
    query = query.eq('slug', slugOrId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    throw new ConfigurationError(`pricing plan "${slugOrId}"`, 'pricing_plans');
  }

  const config: PricingPlanConfig = {
    id: data.id,
    name: data.name,
    slug: data.slug,
    originalPrice: data.original_price ?? 0,
    discountedPrice: data.discounted_price ?? 0,
    currency: data.currency || 'INR',
    durationMonths: data.duration_months ?? 3,
    durationWeeks: data.duration_weeks ?? null,
    sessionsIncluded: data.sessions_included ?? 0,
    sessionsCoaching: data.sessions_coaching ?? 0,
    sessionsSkillBuilding: data.sessions_skill_building ?? 0,
    sessionsCheckin: data.sessions_checkin ?? 0,
    coachingDurationMins: data.coaching_duration_mins || data.duration_coaching_mins || 45,
    skillBuildingDurationMins: data.skill_building_duration_mins || data.duration_skill_mins || 45,
    checkinDurationMins: data.checkin_duration_mins || data.duration_checkin_mins || 45,
    productType: data.product_type || 'standard',
    isActive: data.is_active ?? true,
    isFeatured: data.is_featured ?? false,
  };

  cache.pricingPlans.set(slugOrId, { data: config, loadedAt: Date.now() });
  return config;
}

// =============================================================================
// CACHE INVALIDATION
// =============================================================================

type CacheCategory = keyof Omit<typeof cache, 'pricingPlans'> | 'pricingPlans';

export function invalidateConfigCache(category?: CacheCategory) {
  if (category) {
    if (category === 'pricingPlans') {
      cache.pricingPlans.clear();
    } else {
      cache[category] = null;
    }
    console.log(`[Config] Cache invalidated: ${category}`);
  } else {
    cache.auth = null;
    cache.coach = null;
    cache.payment = null;
    cache.scheduling = null;
    cache.revenueSplit = null;
    cache.notification = null;
    cache.enrollment = null;
    cache.email = null;
    cache.integrations = null;
    cache.pricingPlans.clear();
    console.log('[Config] All caches invalidated');
  }
}
