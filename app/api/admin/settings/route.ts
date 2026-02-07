// ============================================================
// FILE: app/api/admin/settings/route.ts
// ============================================================
// HARDENED VERSION - Admin Site Settings API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// Features: Input validation, audit logging, request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMAS ---
const getCategoriesSchema = z.object({
  categories: z.string().max(500).optional(),
});

const patchSettingsSchema = z.object({
  settings: z.record(z.string().max(100), z.any()).refine(
    (val) => Object.keys(val).length > 0 && Object.keys(val).length <= 50,
    { message: 'Settings must have 1-50 entries' }
  ),
});

// Whitelist of allowed setting keys (prevents arbitrary key injection)
const ALLOWED_SETTING_KEYS = [
  // Pricing
  'pricing_amount', 'pricing_original_amount', 'pricing_discount_label',
  'pricing_sessions', 'pricing_duration_months', 'pricing_cta_text',
  // Coach info
  'coach_name', 'coach_title', 'coach_bio', 'coach_image_url',
  'coach_certifications', 'coach_experience_years',
  // Contact
  'contact_email', 'contact_phone', 'contact_whatsapp',
  // Assessment
  'assessment_duration_minutes', 'assessment_cta_text',
  // Discovery call
  'discovery_call_duration', 'discovery_call_price',
  // General
  'site_name', 'site_tagline', 'meta_description',
  // Features
  'feature_free_trial_enabled', 'feature_group_classes_enabled',
];

// --- GET: Fetch settings by category ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'settings_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = getCategoriesSchema.safeParse({
      categories: searchParams.get('categories'),
    });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const categoriesParam = validation.data.categories;
    const categories = categoriesParam ? categoriesParam.split(',').map(c => c.trim()).filter(Boolean) : [];

    console.log(JSON.stringify({ requestId, event: 'settings_get_request', adminEmail: auth.email, categories }));

    const supabase = getServiceSupabase();

    let query = supabase.from('site_settings').select('*');

    if (categories.length > 0) {
      query = query.in('category', categories);
    }

    const { data: settings, error } = await query.order('key');

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'settings_get_db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'settings_get_success', count: settings?.length || 0, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, settings });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'settings_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- PATCH: Update multiple settings ---
export async function PATCH(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'settings_patch_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = patchSettingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { settings } = validation.data;

    // Filter to only allowed keys
    const filteredSettings: Record<string, any> = {};
    const blockedKeys: string[] = [];

    for (const [key, value] of Object.entries(settings)) {
      if (ALLOWED_SETTING_KEYS.includes(key)) {
        filteredSettings[key] = value;
      } else {
        blockedKeys.push(key);
      }
    }

    if (Object.keys(filteredSettings).length === 0) {
      return NextResponse.json({ 
        error: 'No valid settings to update', 
        blockedKeys,
        allowedKeys: ALLOWED_SETTING_KEYS 
      }, { status: 400 });
    }

    console.log(JSON.stringify({ 
      requestId, 
      event: 'settings_patch_request', 
      adminEmail: auth.email, 
      keysToUpdate: Object.keys(filteredSettings),
      blockedKeys,
    }));

    const supabase = getServiceSupabase();

    const updates = Object.entries(filteredSettings).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? `"${value}"` : JSON.stringify(value),
      updated_at: new Date().toISOString(),
    }));

    const errors: string[] = [];
    const updated: string[] = [];

    for (const update of updates) {
      const { error } = await supabase
        .from('site_settings')
        .update({
          value: update.value,
          updated_at: update.updated_at,
        })
        .eq('key', update.key);

      if (error) {
        console.error(JSON.stringify({ requestId, event: 'setting_update_failed', key: update.key, error: error.message }));
        errors.push(update.key);
      } else {
        updated.push(update.key);
      }
    }

    // Audit log
    try {
      await supabase.from('activity_log').insert({
        user_email: auth.email,
        action: 'site_settings_updated',
        details: {
          request_id: requestId,
          keys_updated: updated,
          keys_failed: errors,
          blocked_keys: blockedKeys,
          timestamp: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });
    } catch (auditError) {
      console.error('Audit log failed (non-critical):', auditError);
    }

    const duration = Date.now() - startTime;

    if (errors.length > 0) {
      console.log(JSON.stringify({ requestId, event: 'settings_patch_partial', updated: updated.length, failed: errors.length, duration: `${duration}ms` }));
      return NextResponse.json({
        success: false,
        requestId,
        error: `Failed to update: ${errors.join(', ')}`,
        failedKeys: errors,
        updatedKeys: updated,
      }, { status: 500 });
    }

    console.log(JSON.stringify({ requestId, event: 'settings_patch_success', updated: updated.length, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      message: `Updated ${updated.length} settings`,
      updatedKeys: updated,
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'settings_patch_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
