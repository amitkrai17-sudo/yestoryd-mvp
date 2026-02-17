// file: app/api/agreement/config/route.ts
// Fetch agreement configuration from database
// GET /api/agreement/config

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// Default config values (fallback if database is empty)
const DEFAULT_CONFIG = {
  company_name: 'Yestoryd LLP',
  company_address: '[REGISTERED ADDRESS], Navi Mumbai, Maharashtra',
  company_email: 'engage@yestoryd.com',
  company_phone: '+91 8976287997',
  company_website: 'yestoryd.com',
  lead_cost_percent: '20',
  coach_cost_percent: '50',
  platform_fee_percent: '30',
  tds_rate_standard: '10',
  tds_rate_no_pan: '20',
  tds_threshold: '30000',
  tds_section: '194J',
  payout_day: '7',
  payout_frequency: 'monthly',
  cancellation_notice_hours: '24',
  termination_notice_days: '30',
  no_show_wait_minutes: '15',
  non_solicitation_months: '12',
  liquidated_damages: '50000',
  liquidated_damages_multiplier: '5',
  agreement_version: '2.0',
  agreement_effective_date: '2025-01-01',
};

export async function GET() {
  try {
    // Fetch all config values from database
    const { data, error } = await supabase
      .from('agreement_config')
      .select('key, value');

    if (error) {
      console.error('Error fetching agreement config:', error);
      // Return default config if database error
      return NextResponse.json({ 
        success: true, 
        config: DEFAULT_CONFIG,
        source: 'default'
      });
    }

    // Convert array to object
    const configFromDb: Record<string, string> = {};
    data?.forEach((item: { key: string; value: string }) => {
      configFromDb[item.key] = item.value;
    });

    // Merge with defaults (database values override defaults)
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...configFromDb,
    };

    return NextResponse.json({
      success: true,
      config: mergedConfig,
      source: data && data.length > 0 ? 'database' : 'default'
    });

  } catch (error: any) {
    console.error('Error in agreement config API:', error);
    return NextResponse.json({
      success: true,
      config: DEFAULT_CONFIG,
      source: 'default',
      error: error.message
    });
  }
}
