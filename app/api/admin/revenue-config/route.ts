// ============================================================
// FILE: app/api/admin/revenue-config/route.ts
// ============================================================
// HARDENED VERSION - Revenue Split Configuration
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// Features: Input validation, audit logging, latest-wins pattern
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMA ---
const updateConfigSchema = z.object({
  lead_cost_percent: z.union([z.string(), z.number()])
    .transform(val => parseFloat(String(val)))
    .refine(val => !isNaN(val) && val >= 0 && val <= 100, 'Must be 0-100'),
  coach_cost_percent: z.union([z.string(), z.number()])
    .transform(val => parseFloat(String(val)))
    .refine(val => !isNaN(val) && val >= 0 && val <= 100, 'Must be 0-100'),
  tds_rate_percent: z.union([z.string(), z.number()])
    .transform(val => parseFloat(String(val)))
    .refine(val => !isNaN(val) && val >= 0 && val <= 30, 'TDS rate must be 0-30%')
    .optional()
    .default(10),
  tds_threshold_annual: z.union([z.string(), z.number()])
    .transform(val => parseInt(String(val)))
    .refine(val => !isNaN(val) && val >= 0, 'Must be positive')
    .optional()
    .default(30000),
  payout_frequency: z.enum(['monthly', 'per_session']).optional().default('monthly'),
  payout_day_of_month: z.union([z.string(), z.number()])
    .transform(val => parseInt(String(val)))
    .refine(val => !isNaN(val) && val >= 1 && val <= 28, 'Must be 1-28')
    .optional()
    .default(7),
  notes: z.string().max(500).optional(),
}).refine(
  data => data.lead_cost_percent + data.coach_cost_percent <= 100,
  { message: 'Lead Cost + Coach Cost cannot exceed 100%' }
);

// --- GET: Fetch active revenue configuration ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'revenue_config_get_auth_failed', error: auth.error }));
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'revenue_config_get_request', adminEmail: auth.email }));

    const supabase = getServiceSupabase();

    // Latest-wins pattern: Always fetch most recent config
    const { data, error } = await supabase
      .from('revenue_split_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return default if no config exists
    if (!data) {
      const duration = Date.now() - startTime;
      console.log(JSON.stringify({ requestId, event: 'revenue_config_get_default', duration: `${duration}ms` }));

      return NextResponse.json({
        success: true,
        requestId,
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

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'revenue_config_get_success', duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      config: data,
      isDefault: false,
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'revenue_config_get_error', error: error.message }));
    return NextResponse.json({ success: false, error: 'Failed to fetch config', requestId }, { status: 500 });
  }
}

// --- POST: Update revenue configuration ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'revenue_config_post_auth_failed', error: auth.error }));
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = updateConfigSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const validated = validation.data;
    const platformFee = 100 - validated.lead_cost_percent - validated.coach_cost_percent;

    console.log(JSON.stringify({
      requestId,
      event: 'revenue_config_post_request',
      adminEmail: auth.email,
      newConfig: { lead: validated.lead_cost_percent, coach: validated.coach_cost_percent, platform: platformFee },
    }));

    const supabase = getServiceSupabase();

    // Get current config for audit comparison
    const { data: currentConfig } = await supabase
      .from('revenue_split_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Insert new config (latest-wins pattern - no deactivation needed)
    const { data, error } = await supabase
      .from('revenue_split_config')
      .insert({
        lead_cost_percent: validated.lead_cost_percent,
        coach_cost_percent: validated.coach_cost_percent,
        platform_fee_percent: platformFee,
        tds_rate_percent: validated.tds_rate_percent,
        tds_threshold_annual: validated.tds_threshold_annual,
        payout_frequency: validated.payout_frequency,
        payout_day_of_month: validated.payout_day_of_month,
        is_active: true,
        created_by: auth.email,
        notes: validated.notes || `Updated: Lead ${validated.lead_cost_percent}%, Coach ${validated.coach_cost_percent}%, Platform ${platformFee}%`,
      })
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email,
      action: 'revenue_config_updated',
      details: {
        request_id: requestId,
        previous_config: currentConfig ? {
          lead: currentConfig.lead_cost_percent,
          coach: currentConfig.coach_cost_percent,
          platform: currentConfig.platform_fee_percent,
          tds_rate: currentConfig.tds_rate_percent,
        } : null,
        new_config: {
          lead: validated.lead_cost_percent,
          coach: validated.coach_cost_percent,
          platform: platformFee,
          tds_rate: validated.tds_rate_percent,
        },
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'revenue_config_post_success', duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      config: data,
      message: 'Revenue configuration updated successfully',
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'revenue_config_post_error', error: error.message }));
    return NextResponse.json({ success: false, error: 'Failed to update config', requestId }, { status: 500 });
  }
}
