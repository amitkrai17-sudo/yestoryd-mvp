// ============================================================
// FILE: app/api/products/route.ts
// ============================================================
// Products API - Fetch pricing plans with eligibility checks
// Yestoryd - AI-Powered Reading Intelligence Platform

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Disable caching - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- TYPES ---
interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  original_price: number;
  discounted_price: number;
  price_display: string;
  savings_display: string | null;
  sessions_included: number;
  // Session breakdown from pricing_plans
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
}

/**
 * Format price as Indian Rupees (₹X,XXX)
 */
function formatPrice(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
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
 * Fetch all active products with eligibility checks
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('childId');

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

    // Transform plans to products with eligibility
    const products: Product[] = (plans || []).map(plan => {
      // Parse features if stored as JSON string
      const features = typeof plan.features === 'string'
        ? JSON.parse(plan.features)
        : plan.features || [];

      // Calculate savings display
      const savings = plan.original_price - plan.discounted_price;
      const savingsDisplay = savings > 0 ? `Save ${formatPrice(savings)}` : null;

      // Determine availability
      let available = true;
      let eligibilityMessage: string | null = null;

      if (plan.slug === 'continuation') {
        // Continuation requires completed starter
        if (!childId) {
          available = false;
          eligibilityMessage = 'Complete Starter Pack first to unlock this option';
        } else if (!starterStatus.completed) {
          available = false;
          eligibilityMessage = 'Complete your Starter sessions to continue';
        }
      }

      return {
        id: plan.id,
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        original_price: plan.original_price,
        discounted_price: plan.discounted_price,
        price_display: formatPrice(plan.discounted_price),
        savings_display: savingsDisplay,
        sessions_included: plan.sessions_included || 9,
        // Session breakdown from pricing_plans
        sessions_coaching: plan.sessions_coaching || 6,
        sessions_skill_building: plan.sessions_skill_building || 0,
        sessions_checkin: plan.sessions_checkin || 3,
        duration_months: plan.duration_months || 3,
        features,
        is_featured: plan.is_featured || false,
        badge_text: plan.badge_text || null,
        display_order: plan.display_order,
        available,
        eligibility_message: eligibilityMessage,
      };
    });

    return NextResponse.json({
      success: true,
      products,
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
