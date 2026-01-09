// ============================================================
// FILE: app/api/admin/revenue-config/route.ts
// ============================================================
// HARDENED VERSION - Revenue Split Configuration
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security features:
// - Admin-only authentication
// - Input validation with Zod
// - Audit logging for all changes
// - Request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { z } from 'zod';
import crypto from 'crypto';

// --- CONFIGURATION (Lazy initialization) ---
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

// ============================================================
// GET: Fetch active revenue configuration
// ============================================================
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // 1. Admin-only authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if ((session.user as any).role !== 'admin') {
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: 'Admin required for revenue config',
        userEmail: session.user.email,
      }));

      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const supabase = getSupabase();

    // Latest-wins pattern: Always fetch most recent config
    // This eliminates race conditions during config updates
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

    return NextResponse.json({
      success: true,
      requestId,
      config: data,
      isDefault: false,
    });

  } catch (error) {
    console.error(JSON.stringify({
      requestId,
      event: 'revenue_config_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));

    return NextResponse.json(
      { success: false, error: 'Failed to fetch config', requestId },
      { status: 500 }
    );
  }
}

// ============================================================
// POST: Update revenue configuration
// ============================================================
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Admin-only authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if ((session.user as any).role !== 'admin') {
      console.log(JSON.stringify({
        requestId,
        event: 'auth_failed',
        error: 'Admin required for revenue config update',
        userEmail: session.user.email,
      }));

      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const adminEmail = session.user.email;

    // 2. Parse and validate body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const validationResult = updateConfigSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const validated = validationResult.data;
    const platformFee = 100 - validated.lead_cost_percent - validated.coach_cost_percent;

    console.log(JSON.stringify({
      requestId,
      event: 'revenue_config_update_request',
      adminEmail,
      newConfig: {
        lead: validated.lead_cost_percent,
        coach: validated.coach_cost_percent,
        platform: platformFee,
      },
    }));

    const supabase = getSupabase();

    // 3. Get current config for audit comparison (latest-wins pattern)
    const { data: currentConfig } = await supabase
      .from('revenue_split_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 4. Insert new config (NO deactivation needed - latest wins)
    // This eliminates the race condition where no active config exists
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
        is_active: true, // Keep for backwards compatibility, but not used for queries
        created_by: adminEmail,
        notes: validated.notes || `Updated: Lead ${validated.lead_cost_percent}%, Coach ${validated.coach_cost_percent}%, Platform ${platformFee}%`,
      })
      .select()
      .single();

    if (error) throw error;

    // 5. Audit log
    await supabase.from('activity_log').insert({
      user_email: adminEmail,
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

    console.log(JSON.stringify({
      requestId,
      event: 'revenue_config_updated',
      adminEmail,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      config: data,
      message: 'Revenue configuration updated successfully',
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(JSON.stringify({
      requestId,
      event: 'revenue_config_update_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
    }));

    return NextResponse.json(
      { success: false, error: 'Failed to update config', requestId },
      { status: 500 }
    );
  }
}