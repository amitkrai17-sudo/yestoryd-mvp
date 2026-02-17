// file: app/api/referral/track/route.ts
// Track referral visits and link to coach

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

// GET: Lookup coach by referral code
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refCode = searchParams.get('ref');

    if (!refCode) {
      return NextResponse.json({ success: false, error: 'No referral code provided' });
    }

    // Find coach by referral code
    const { data: coach, error } = await supabase
      .from('coaches')
      .select('id, name, referral_code')
      .eq('referral_code', refCode.toUpperCase())
      .eq('status', 'active')
      .single();

    if (error || !coach) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid referral code',
        valid: false,
      });
    }

    return NextResponse.json({
      success: true,
      valid: true,
      coach_id: coach.id,
      coach_name: coach.name,
      referral_code: coach.referral_code,
    });

  } catch (error: any) {
    console.error('Referral lookup error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to lookup referral' },
      { status: 500 }
    );
  }
}

// POST: Record referral visit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referral_code, landing_page, user_agent } = body;

    if (!referral_code) {
      return NextResponse.json({ success: false, error: 'No referral code provided' });
    }

    // Find coach by referral code
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id')
      .eq('referral_code', referral_code.toUpperCase())
      .single();

    if (coachError || !coach) {
      return NextResponse.json({ success: false, error: 'Invalid referral code' });
    }

    // Get visitor IP from headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const visitorIp = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';

    // Record visit
    const { data: visit, error: visitError } = await supabase
      .from('referral_visits')
      .insert({
        referral_code: referral_code.toUpperCase(),
        coach_id: coach.id,
        visitor_ip: visitorIp,
        user_agent: user_agent || null,
        landing_page: landing_page || '/assess',
        converted: false,
      })
      .select('id')
      .single();

    if (visitError) {
      console.error('Failed to record visit:', visitError);
    }

    return NextResponse.json({
      success: true,
      coach_id: coach.id,
      visit_id: visit?.id,
    });

  } catch (error: any) {
    console.error('Referral tracking error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track referral' },
      { status: 500 }
    );
  }
}
