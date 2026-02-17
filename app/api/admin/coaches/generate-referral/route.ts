// ============================================================
// FILE: app/api/admin/coaches/generate-referral/route.ts
// ============================================================
// HARDENED VERSION - Generate Referral Codes for Coaches
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// Features: Input validation, audit logging, request tracing
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { generateReferralCode, generateReferralLink } from '@/lib/referral';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION SCHEMAS ---
const generateForCoachSchema = z.object({
  coachId: z.string().uuid('Invalid coach ID'),
});

// --- POST: Generate referral code for a specific coach ---
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'generate_referral_post_auth_failed', error: auth.error }));
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = generateForCoachSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
    }

    const { coachId } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'generate_referral_post_request', adminEmail: auth.email, coachId }));

    const supabase = getServiceSupabase();

    // Get coach
    const { data, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, referral_code')
      .eq('id', coachId)
      .single();

    const coach = data as { id: string; name: string; referral_code: string | null } | null;

    if (coachError || !coach) {
      console.log(JSON.stringify({ requestId, event: 'coach_not_found', coachId }));
      return NextResponse.json({ success: false, error: 'Coach not found' }, { status: 404 });
    }

    // If already has code, return it
    if (coach.referral_code) {
      console.log(JSON.stringify({ requestId, event: 'referral_code_exists', coachId, referralCode: coach.referral_code }));
      return NextResponse.json({
        success: true,
        requestId,
        referralCode: coach.referral_code,
        referralLink: generateReferralLink(coach.referral_code),
        message: 'Coach already has a referral code',
        isNew: false,
      });
    }

    // Generate new unique code
    let referralCode = generateReferralCode(coach.name);
    let attempts = 0;

    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('coaches')
        .select('id')
        .eq('referral_code', referralCode)
        .maybeSingle();

      if (!existing) break;
      referralCode = generateReferralCode(coach.name);
      attempts++;
    }

    if (attempts >= 10) {
      console.error(JSON.stringify({ requestId, event: 'referral_code_generation_failed', coachId, attempts }));
      return NextResponse.json({ success: false, error: 'Failed to generate unique referral code' }, { status: 500 });
    }

    const referralLink = generateReferralLink(referralCode);

    // Update coach
    const { error: updateError } = await supabase
      .from('coaches')
      .update({
        referral_code: referralCode,
        referral_link: referralLink,
        updated_at: new Date().toISOString(),
      })
      .eq('id', coachId);

    if (updateError) {
      console.error(JSON.stringify({ requestId, event: 'referral_update_failed', coachId, error: updateError.message }));
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'coach_referral_code_generated',
      metadata: { request_id: requestId, coach_id: coachId, coach_name: coach.name, referral_code: referralCode, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'generate_referral_post_success', coachId, referralCode, duration: `${duration}ms` }));

    return NextResponse.json({
      success: true,
      requestId,
      referralCode,
      referralLink,
      message: 'Referral code generated successfully',
      isNew: true,
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'generate_referral_post_error', error: error.message }));
    return NextResponse.json({ success: false, error: error.message, requestId }, { status: 500 });
  }
}

// --- GET: Generate referral codes for ALL coaches who don't have one ---
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'generate_referral_get_auth_failed', error: auth.error }));
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'generate_referral_bulk_request', adminEmail: auth.email }));

    const supabase = getServiceSupabase();

    // Get coaches without referral codes
    const { data, error } = await supabase
      .from('coaches')
      .select('id, name, referral_code')
      .is('referral_code', null)
      .eq('is_active', true);

    const coaches = data as { id: string; name: string; referral_code: string | null }[] | null;

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'fetch_coaches_failed', error: error.message }));
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!coaches || coaches.length === 0) {
      console.log(JSON.stringify({ requestId, event: 'no_coaches_need_codes' }));
      return NextResponse.json({
        success: true,
        requestId,
        generated: 0,
        coaches: [],
        message: 'All active coaches already have referral codes',
      });
    }

    const results: { id: string; name: string; referralCode: string }[] = [];
    const existingCodes = new Set<string>();
    const failed: { id: string; name: string; error: string }[] = [];

    // Get all existing codes
    const { data: allCodesData } = await supabase
      .from('coaches')
      .select('referral_code')
      .not('referral_code', 'is', null);

    const allCodes = allCodesData as { referral_code: string }[] | null;
    allCodes?.forEach((c) => existingCodes.add(c.referral_code));

    // Generate codes for each coach
    for (const coach of coaches) {
      try {
        let referralCode = generateReferralCode(coach.name);
        let attempts = 0;

        // Ensure unique
        while (existingCodes.has(referralCode) && attempts < 10) {
          referralCode = generateReferralCode(coach.name);
          attempts++;
        }

        if (attempts >= 10) {
          failed.push({ id: coach.id, name: coach.name, error: 'Failed to generate unique code' });
          continue;
        }

        existingCodes.add(referralCode);
        const referralLink = generateReferralLink(referralCode);

        // Update coach
        const { error: updateError } = await supabase
          .from('coaches')
          .update({
            referral_code: referralCode,
            referral_link: referralLink,
            updated_at: new Date().toISOString(),
          })
          .eq('id', coach.id);

        if (updateError) {
          failed.push({ id: coach.id, name: coach.name, error: updateError.message });
          continue;
        }

        results.push({
          id: coach.id,
          name: coach.name,
          referralCode,
        });
      } catch (e: any) {
        failed.push({ id: coach.id, name: coach.name, error: e.message });
      }
    }

    // Audit log
    await supabase.from('activity_log').insert({
      user_email: auth.email || 'unknown',
      user_type: 'admin',
      action: 'coach_referral_codes_bulk_generated',
      metadata: {
        request_id: requestId,
        total_processed: coaches.length,
        successful: results.length,
        failed: failed.length,
        coaches_updated: results.map(r => ({ id: r.id, code: r.referralCode })),
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      requestId,
      event: 'generate_referral_bulk_success',
      totalProcessed: coaches.length,
      successful: results.length,
      failed: failed.length,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      generated: results.length,
      failed: failed.length,
      coaches: results,
      failures: failed.length > 0 ? failed : undefined,
    });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'generate_referral_bulk_error', error: error.message }));
    return NextResponse.json({ success: false, error: error.message, requestId }, { status: 500 });
  }
}
