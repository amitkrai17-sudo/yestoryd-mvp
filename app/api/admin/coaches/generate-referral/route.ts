// ============================================================
// FILE: app/api/admin/coaches/generate-referral/route.ts
// ============================================================
// Generate referral codes for coaches who don't have one

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateReferralCode, generateReferralLink } from '@/lib/referral';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Generate referral code for a specific coach
export async function POST(request: NextRequest) {
  try {
    const { coachId } = await request.json();

    if (!coachId) {
      return NextResponse.json(
        { success: false, error: 'coachId is required' },
        { status: 400 }
      );
    }

    // Get coach
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, referral_code')
      .eq('id', coachId)
      .single();

    if (coachError || !coach) {
      return NextResponse.json(
        { success: false, error: 'Coach not found' },
        { status: 404 }
      );
    }

    // If already has code, return it
    if (coach.referral_code) {
      return NextResponse.json({
        success: true,
        referralCode: coach.referral_code,
        referralLink: generateReferralLink(coach.referral_code),
        message: 'Coach already has a referral code',
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
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      referralCode,
      referralLink,
      message: 'Referral code generated successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET: Generate referral codes for ALL coaches who don't have one
export async function GET(request: NextRequest) {
  try {
    // Get coaches without referral codes
    const { data: coaches, error } = await supabase
      .from('coaches')
      .select('id, name, referral_code')
      .is('referral_code', null)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const results: { id: string; name: string; referralCode: string }[] = [];
    const existingCodes = new Set<string>();

    // Get all existing codes
    const { data: allCodes } = await supabase
      .from('coaches')
      .select('referral_code')
      .not('referral_code', 'is', null);

    allCodes?.forEach((c) => existingCodes.add(c.referral_code));

    // Generate codes for each coach
    for (const coach of coaches || []) {
      let referralCode = generateReferralCode(coach.name);
      let attempts = 0;

      // Ensure unique
      while (existingCodes.has(referralCode) && attempts < 10) {
        referralCode = generateReferralCode(coach.name);
        attempts++;
      }

      existingCodes.add(referralCode);
      const referralLink = generateReferralLink(referralCode);

      // Update coach
      await supabase
        .from('coaches')
        .update({
          referral_code: referralCode,
          referral_link: referralLink,
          updated_at: new Date().toISOString(),
        })
        .eq('id', coach.id);

      results.push({
        id: coach.id,
        name: coach.name,
        referralCode,
      });
    }

    return NextResponse.json({
      success: true,
      generated: results.length,
      coaches: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
