import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();
export const dynamic = 'force-dynamic';

// ============================================================
// TYPES
// ============================================================

interface RevenueConfig {
  lead_cost_percent: number;
  coach_cost_percent: number;
  platform_fee_percent: number;
}

interface ProductEarnings {
  name: string;
  slug: string;
  price: number;
  sessions: number;
  coach_earnings_own_lead: number;
  coach_earnings_platform_lead: number;
  per_session_own_lead: number;
  per_session_platform_lead: number;
}

interface EarningsResponse {
  success: boolean;
  products: ProductEarnings[];
  split_config: {
    lead_cost_percent: number;
    coach_cost_percent: number;
    platform_fee_percent: number;
    own_lead_total_percent: number;
  };
  scenarios: {
    students_per_month: number[];
    earnings: number[];
  };
  cached_at: string;
}

// ============================================================
// CONFIG
// ============================================================

const CACHE_TTL_SECONDS = 300;

// ============================================================
// HELPERS
// ============================================================

function generateRequestId(): string {
  return `earn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateEarnings(price: number, sessions: number, config: RevenueConfig) {
  const ownLeadPercent = config.lead_cost_percent + config.coach_cost_percent;
  const platformLeadPercent = config.coach_cost_percent;

  const own_lead = Math.round(price * ownLeadPercent / 100);
  const platform_lead = Math.round(price * platformLeadPercent / 100);

  return {
    own_lead,
    platform_lead,
    per_session_own: sessions > 0 ? Math.round(own_lead / sessions) : 0,
    per_session_platform: sessions > 0 ? Math.round(platform_lead / sessions) : 0,
  };
}

// ============================================================
// API HANDLER
// ============================================================

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(JSON.stringify({
    requestId,
    event: 'earnings_calculator_start',
    timestamp: new Date().toISOString(),
  }));

  try {
    // Fetch active revenue split config
    const { data: splitConfig, error: splitError } = await supabase
      .from('revenue_split_config')
      .select('lead_cost_percent, coach_cost_percent, platform_fee_percent')
      .eq('is_active', true)
      .single();

    if (splitError || !splitConfig) {
      console.error(JSON.stringify({
        requestId,
        event: 'earnings_calculator_error',
        error: 'Revenue config not found',
        details: splitError?.message,
      }));

      return NextResponse.json(
        { success: false, error: 'Configuration unavailable' },
        { status: 503 }
      );
    }

    // Fetch active products
    const { data: products, error: productsError } = await supabase
      .from('pricing_plans')
      .select('name, slug, discounted_price, sessions_included')
      .eq('is_active', true)
      .order('display_order');

    if (productsError || !products || products.length === 0) {
      console.error(JSON.stringify({
        requestId,
        event: 'earnings_calculator_error',
        error: 'Products not found',
        details: productsError?.message,
      }));

      return NextResponse.json(
        { success: false, error: 'Products unavailable' },
        { status: 503 }
      );
    }

    // Calculate earnings for each product
    const productEarnings: ProductEarnings[] = products.map(product => {
      const earnings = calculateEarnings(
        product.discounted_price,
        product.sessions_included,
        splitConfig as RevenueConfig
      );

      return {
        name: product.name,
        slug: product.slug,
        price: product.discounted_price,
        sessions: product.sessions_included,
        coach_earnings_own_lead: earnings.own_lead,
        coach_earnings_platform_lead: earnings.platform_lead,
        per_session_own_lead: earnings.per_session_own,
        per_session_platform_lead: earnings.per_session_platform,
      };
    });

    // Monthly scenarios based on Full Program
    const fullProgram = productEarnings.find(p => p.slug === 'full');
    const avgEarning = fullProgram?.coach_earnings_own_lead || 0;

    const studentCounts = [3, 5, 10, 15, 20];
    const scenarios = {
      students_per_month: studentCounts,
      earnings: studentCounts.map(count => avgEarning * count),
    };

    const response: EarningsResponse = {
      success: true,
      products: productEarnings,
      split_config: {
        lead_cost_percent: Number(splitConfig.lead_cost_percent),
        coach_cost_percent: Number(splitConfig.coach_cost_percent),
        platform_fee_percent: Number(splitConfig.platform_fee_percent),
        own_lead_total_percent: Number(splitConfig.lead_cost_percent) + Number(splitConfig.coach_cost_percent),
      },
      scenarios,
      cached_at: new Date().toISOString(),
    };

    console.log(JSON.stringify({
      requestId,
      event: 'earnings_calculator_complete',
      duration: `${Date.now() - startTime}ms`,
      productsCount: productEarnings.length,
    }));

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`,
      },
    });

  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'earnings_calculator_fatal',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: `${Date.now() - startTime}ms`,
    }));

    return NextResponse.json(
      { success: false, error: 'Service temporarily unavailable' },
      { status: 500 }
    );
  }
}
