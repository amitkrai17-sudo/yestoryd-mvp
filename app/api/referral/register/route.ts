// =============================================================================
// FILE: app/api/referral/register/route.ts
// PURPOSE: Public referral registration endpoint (no auth required)
// =============================================================================
// POST: Register a new referrer (external/influencer/auto-detect parent/coach)
// GET:  Lookup referrer stats by phone
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/utils/phone';
import {
  loadPayoutConfig,
  generateReferralCode,
  type ReferrerType,
  type PayoutConfig,
} from '@/lib/config/payout-config';

export const dynamic = 'force-dynamic';

// =============================================================================
// POST: Register referrer
// =============================================================================

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a 10-digit Indian mobile number'),
  email: z.string().email().optional().nullable(),
  referrer_type: z.enum(['external', 'influencer']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 },
      );
    }

    const { name, phone, email, referrer_type: requestedType } = validation.data;
    const config = await loadPayoutConfig();

    // Check if external referrals are enabled
    if (!config.external_referral_enabled) {
      return NextResponse.json(
        { error: 'External referral registration is currently disabled' },
        { status: 403 },
      );
    }

    const normalizedPhone = normalizePhone(phone);

    // Check if phone already registered as referrer
    const { data: existing } = await supabaseAdmin
      .from('referrers')
      .select('id, referral_code, referrer_type, is_active, name, total_referrals, total_conversions, total_earned, total_redeemed, total_pending')
      .eq('phone', normalizedPhone)
      .single();

    if (existing) {
      // Reactivate if inactive
      if (!existing.is_active) {
        await supabaseAdmin
          .from('referrers')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      }

      return NextResponse.json({
        success: true,
        is_existing: true,
        referral_code: existing.referral_code,
        referral_link: `/assess?ref=${existing.referral_code}`,
        referrer_type: existing.referrer_type,
        reward_info: getRewardInfo(existing.referrer_type as ReferrerType, config),
        stats: {
          total_referrals: existing.total_referrals,
          total_conversions: existing.total_conversions,
          total_earned: existing.total_earned,
          total_redeemed: existing.total_redeemed,
          total_pending: existing.total_pending,
        },
      });
    }

    // Auto-detect referrer type by checking existing parent/coach
    let referrerType: ReferrerType = requestedType || 'external';
    let parentId: string | null = null;
    let coachId: string | null = null;

    // Check if phone matches an existing parent
    const { data: parentMatch } = await supabaseAdmin
      .from('parents')
      .select('id')
      .eq('phone', normalizedPhone)
      .limit(1)
      .single();

    if (parentMatch) {
      referrerType = 'parent';
      parentId = parentMatch.id;
    } else {
      // Check if phone matches an existing coach
      const { data: coachMatch } = await supabaseAdmin
        .from('coaches')
        .select('id')
        .eq('phone', normalizedPhone)
        .limit(1)
        .single();

      if (coachMatch) {
        referrerType = 'coach';
        coachId = coachMatch.id;
      }
    }

    // Generate unique referral code (retry up to 5x on collision)
    let referralCode = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      referralCode = generateReferralCode(name);
      const { data: collision } = await supabaseAdmin
        .from('referrers')
        .select('id')
        .eq('referral_code', referralCode)
        .single();
      if (!collision) break;
      if (attempt === 4) {
        return NextResponse.json(
          { error: 'Failed to generate unique referral code. Please try again.' },
          { status: 500 },
        );
      }
    }

    // Determine reward type
    let rewardType: string;
    if (referrerType === 'parent') rewardType = config.parent_referral_reward_type;
    else if (referrerType === 'influencer') rewardType = config.influencer_reward_type;
    else if (referrerType === 'coach') rewardType = 'upi_transfer';
    else rewardType = config.external_referral_reward_type;

    // Insert referrer
    const { data: newReferrer, error: insertError } = await supabaseAdmin
      .from('referrers')
      .insert({
        name,
        phone: normalizedPhone,
        email: email || null,
        referrer_type: referrerType,
        parent_id: parentId,
        coach_id: coachId,
        referral_code: referralCode,
        reward_type: rewardType,
        is_active: true,
      })
      .select('id, referral_code, referrer_type')
      .single();

    if (insertError) {
      // Unique constraint on phone — race condition, fetch existing
      if (insertError.code === '23505') {
        const { data: raced } = await supabaseAdmin
          .from('referrers')
          .select('referral_code, referrer_type')
          .eq('phone', normalizedPhone)
          .single();
        if (raced) {
          return NextResponse.json({
            success: true,
            is_existing: true,
            referral_code: raced.referral_code,
            referral_link: `/assess?ref=${raced.referral_code}`,
            referrer_type: raced.referrer_type,
          });
        }
      }
      console.error('[referral/register] Insert failed:', insertError.message);
      return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }

    // TODO: Send AiSensy WhatsApp template: `referral_code_generated`
    // Variables: name, referralCode, referralLink

    return NextResponse.json({
      success: true,
      is_existing: false,
      referral_code: newReferrer.referral_code,
      referral_link: `/assess?ref=${newReferrer.referral_code}`,
      referrer_type: newReferrer.referrer_type,
      reward_info: getRewardInfo(referrerType, config),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[referral/register] POST error:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// GET: Lookup referrer stats by phone
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: 'Valid 10-digit phone number required' },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizePhone(phone);

    const { data: referrer } = await supabaseAdmin
      .from('referrers')
      .select('id, name, referral_code, referrer_type, total_referrals, total_conversions, total_earned, total_redeemed, total_pending, is_active, created_at')
      .eq('phone', normalizedPhone)
      .single();

    if (!referrer) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      name: referrer.name,
      referral_code: referrer.referral_code,
      referrer_type: referrer.referrer_type,
      is_active: referrer.is_active,
      stats: {
        total_referrals: referrer.total_referrals,
        total_conversions: referrer.total_conversions,
        total_earned: referrer.total_earned,
        total_redeemed: referrer.total_redeemed,
        total_pending: referrer.total_pending,
      },
      created_at: referrer.created_at,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[referral/register] GET error:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function getRewardInfo(referrerType: ReferrerType, config: PayoutConfig) {
  const percentKey = `lead_cost_referrer_percent_${referrerType}` as keyof typeof config;
  return {
    referrer_percent: (config[percentKey] as number) || 0,
    reward_type: referrerType === 'parent'
      ? config.parent_referral_reward_type
      : referrerType === 'influencer'
        ? config.influencer_reward_type
        : referrerType === 'coach'
          ? 'upi_transfer'
          : config.external_referral_reward_type,
    external_reward_amount: referrerType === 'external' ? config.external_referral_reward_amount : null,
  };
}
