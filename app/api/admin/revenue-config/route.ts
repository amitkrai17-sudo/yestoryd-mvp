// file: app/api/admin/revenue-config/route.ts
// API for managing revenue split configuration
// GET: Fetch active config | POST: Update config

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================
// GET: Fetch active revenue configuration
// ============================================================
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('revenue_split_config')
      .select('*')
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return default if no config exists
    if (!data) {
      return NextResponse.json({
        success: true,
        config: {
          lead_cost_percent: 20,
          coach_cost_percent: 50,
          platform_fee_percent: 30,
          tds_rate_percent: 10,
          tds_threshold_annual: 30000,
          payout_frequency: 'monthly',
          payout_day_of_month: 7,
          is_active: true,
        },
        isDefault: true,
      });
    }

    return NextResponse.json({
      success: true,
      config: data,
      isDefault: false,
    });
  } catch (error: unknown) {
    console.error('Error fetching revenue config:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch config' },
      { status: 500 }
    );
  }
}

// ============================================================
// POST: Update revenue configuration
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      lead_cost_percent,
      coach_cost_percent,
      tds_rate_percent,
      tds_threshold_annual,
      payout_frequency,
      payout_day_of_month,
      notes,
    } = body;

    // Validate percentages
    const leadCost = parseFloat(lead_cost_percent);
    const coachCost = parseFloat(coach_cost_percent);
    const platformFee = 100 - leadCost - coachCost;

    if (isNaN(leadCost) || isNaN(coachCost)) {
      return NextResponse.json(
        { success: false, error: 'Invalid percentage values' },
        { status: 400 }
      );
    }

    if (leadCost < 0 || coachCost < 0 || platformFee < 0) {
      return NextResponse.json(
        { success: false, error: 'Percentages cannot be negative' },
        { status: 400 }
      );
    }

    if (leadCost + coachCost > 100) {
      return NextResponse.json(
        { success: false, error: 'Lead Cost + Coach Cost cannot exceed 100%' },
        { status: 400 }
      );
    }

    // Deactivate all existing configs
    await supabase
      .from('revenue_split_config')
      .update({ is_active: false })
      .eq('is_active', true);

    // Insert new active config
    const { data, error } = await supabase
      .from('revenue_split_config')
      .insert({
        lead_cost_percent: leadCost,
        coach_cost_percent: coachCost,
        platform_fee_percent: platformFee,
        tds_rate_percent: parseFloat(tds_rate_percent) || 10,
        tds_threshold_annual: parseInt(tds_threshold_annual) || 30000,
        payout_frequency: payout_frequency || 'monthly',
        payout_day_of_month: parseInt(payout_day_of_month) || 7,
        is_active: true,
        created_by: 'admin',
        notes: notes || `Updated: Lead ${leadCost}%, Coach ${coachCost}%, Platform ${platformFee}%`,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      config: data,
      message: 'Revenue configuration updated successfully',
    });
  } catch (error: unknown) {
    console.error('Error updating revenue config:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update config' },
      { status: 500 }
    );
  }
}
