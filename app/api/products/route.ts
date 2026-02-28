// ============================================================
// FILE: app/api/products/route.ts
// ============================================================
// Products API - Fetch pricing plans with eligibility checks
// V3: Age-band-aware session counts from age_band_config
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getPricingConfig,
  getSessionCount,
  getSessionDuration,
  getBoosterCredits,
  getSessionRangeForTier,
  getDurationRange,
  type PricingConfig,
  type AgeBandConfig,
} from '@/lib/config/pricing-config';

const supabase = createAdminClient();

// Disable caching - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// --- TYPES ---

/** V3 age-band-aware session data per product/tier */
interface V3SessionData {
  /** Resolved age band ID (null if age not provided) */
  ageBand: string | null;
  /** Display name e.g. "Foundation (4–6 yrs)" */
  ageBandName: string | null;
  /** Exact session duration in minutes for this age band */
  sessionDurationMinutes: number | null;
  /** Exact coaching session count for this age band + tier */
  coachingSessions: number | null;
  /** Exact booster credits for this age band + tier */
  boosterCredits: number | null;
  /** Session count range across all age bands for this tier */
  sessionRange: { min: number; max: number };
  /** Duration range across all age bands (minutes) */
  durationRange: { min: number; max: number };
}

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  original_price: number;
  discounted_price: number;
  price_display: string;
  savings_display: string | null;
  // V1 session fields (kept for backward compatibility)
  sessions_included: number;
  sessions_coaching: number;
  sessions_skill_building: number;
  sessions_checkin: number;
  duration_months: number;
  features: string[];
  is_featured: boolean;
  badge_text: string | null;
  display_order: number;
  available: boolean;
  eligibility_message: string | null;
  week_range: string | null;
  is_locked: boolean;
  lock_message: string | null;
  duration_coaching_mins: number;
  duration_skill_mins: number;
  duration_checkin_mins: number;
  phase_number: number | null;
  // V3 age-band-aware data
  v3: V3SessionData;
}

/**
 * Format price as Indian Rupees (₹X,XXX)
 */
function formatPrice(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Resolve age to age band from pricing config.
 * Returns the matching AgeBandConfig or null.
 */
function resolveAgeBand(
  config: PricingConfig,
  age?: number | null,
  ageBandId?: string | null
): AgeBandConfig | null {
  if (ageBandId) {
    return config.ageBands.find(b => b.id === ageBandId) || null;
  }
  if (age != null && age > 0) {
    return config.ageBands.find(b => age >= b.ageMin && age <= b.ageMax) || null;
  }
  return null;
}

/**
 * Build V3 session data for a product/tier.
 */
function buildV3Data(
  config: PricingConfig,
  tierSlug: string,
  band: AgeBandConfig | null
): V3SessionData {
  const sessionRange = getSessionRangeForTier(config, tierSlug);
  const durationRange = getDurationRange(config);

  if (band) {
    return {
      ageBand: band.id,
      ageBandName: `${band.displayName} (${band.ageMin}–${band.ageMax} yrs)`,
      sessionDurationMinutes: band.sessionDurationMinutes,
      coachingSessions: getSessionCount(config, band.id, tierSlug),
      boosterCredits: getBoosterCredits(config, band.id, tierSlug),
      sessionRange,
      durationRange,
    };
  }

  return {
    ageBand: null,
    ageBandName: null,
    sessionDurationMinutes: null,
    coachingSessions: null,
    boosterCredits: null,
    sessionRange,
    durationRange,
  };
}

/**
 * Check if child has completed starter enrollment
 */
async function checkStarterCompletion(childId: string): Promise<{
  completed: boolean;
  starterEnrollmentId: string | null;
  completedAt: string | null;
}> {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, status, enrollment_type, starter_completed_at')
    .eq('child_id', childId)
    .eq('enrollment_type', 'starter')
    .in('status', ['completed', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!enrollment) {
    return { completed: false, starterEnrollmentId: null, completedAt: null };
  }

  // Starter is complete if status is 'completed' OR all sessions are done
  const isCompleted = enrollment.status === 'completed' || enrollment.starter_completed_at !== null;

  return {
    completed: isCompleted,
    starterEnrollmentId: enrollment.id,
    completedAt: enrollment.starter_completed_at,
  };
}

/**
 * GET /api/products
 * Fetch all active products with eligibility checks and V3 session data.
 *
 * Query params:
 *   childId  — check starter completion eligibility
 *   age      — child age (4–12) → resolve exact session counts
 *   ageBand  — age band ID directly (foundation/building/mastery)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');
    const ageParam = searchParams.get('age');
    const ageBandParam = searchParams.get('ageBand');

    // Fetch all active products
    const { data: plans, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    // Check starter completion if childId provided
    let starterStatus = {
      completed: false,
      starterEnrollmentId: null as string | null,
      completedAt: null as string | null,
    };

    if (childId) {
      starterStatus = await checkStarterCompletion(childId);
    }

    // Load pricing config for V3 age-band-aware session counts
    const pricingConfig = await getPricingConfig();

    // Resolve age band (if age or ageBand provided)
    const childAge = ageParam ? parseInt(ageParam) : null;
    const band = resolveAgeBand(pricingConfig, childAge, ageBandParam);

    // Transform plans to products with eligibility + V3 data
    const products: Product[] = (plans || []).map(plan => {
      // Parse features if stored as JSON string
      const features = typeof plan.features === 'string'
        ? JSON.parse(plan.features) as string[]
        : (plan.features as string[]) || [];

      // Calculate savings display
      const savings = plan.original_price - plan.discounted_price;
      const savingsDisplay = savings > 0 ? `Save ${formatPrice(savings)}` : null;

      // Determine availability
      let available = true;
      let eligibilityMessage: string | null = null;

      // Locked products are not available for purchase
      if (plan.is_locked) {
        available = false;
        eligibilityMessage = plan.lock_message || 'Coming soon';
      } else if (plan.slug === 'continuation') {
        // Continuation requires completed starter
        if (!childId) {
          available = false;
          eligibilityMessage = 'Complete Starter Pack first to unlock this option';
        } else if (!starterStatus.completed) {
          available = false;
          eligibilityMessage = 'Complete your Starter sessions to continue';
        }
      }

      // Build V3 session data
      const v3 = buildV3Data(pricingConfig, plan.slug, band);

      // V1 sessions_included: prefer exact V3 count if available, then DB, then range max
      const sessionsIncluded = v3.coachingSessions
        || plan.sessions_included
        || v3.sessionRange.max
        || 9;

      // V1 duration: prefer exact V3 duration if available, then DB column
      const coachingDuration = v3.sessionDurationMinutes
        || plan.duration_coaching_mins
        || 45;

      return {
        id: plan.id,
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        original_price: plan.original_price,
        discounted_price: plan.discounted_price,
        price_display: formatPrice(plan.discounted_price),
        savings_display: savingsDisplay,
        // V1 fields — updated to prefer V3 when age is known
        sessions_included: sessionsIncluded,
        sessions_coaching: v3.coachingSessions || plan.sessions_coaching || 6,
        sessions_skill_building: v3.boosterCredits ?? plan.sessions_skill_building ?? 0,
        sessions_checkin: plan.sessions_checkin || 3, // V1 fallback – age_band_config is authoritative
        duration_months: plan.duration_months || 3,
        features,
        is_featured: plan.is_featured ?? false,
        badge_text: null,
        display_order: plan.display_order ?? 0,
        available,
        eligibility_message: eligibilityMessage,
        week_range: plan.week_range || null,
        is_locked: plan.is_locked || false,
        lock_message: plan.lock_message || null,
        duration_coaching_mins: coachingDuration,
        duration_skill_mins: v3.sessionDurationMinutes || plan.duration_skill_mins || 45,
        duration_checkin_mins: plan.duration_checkin_mins || 45,
        phase_number: plan.phase_number || null,
        // V3 data
        v3,
      };
    });

    return NextResponse.json({
      success: true,
      products,
      // V3 metadata: which age band was resolved (if any)
      ageBand: band ? {
        id: band.id,
        displayName: band.displayName,
        ageMin: band.ageMin,
        ageMax: band.ageMax,
        sessionDurationMinutes: band.sessionDurationMinutes,
      } : null,
      starterStatus: childId ? {
        completed: starterStatus.completed,
        starterEnrollmentId: starterStatus.starterEnrollmentId,
        completedAt: starterStatus.completedAt,
      } : null,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error: any) {
    console.error('Failed to fetch products:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
