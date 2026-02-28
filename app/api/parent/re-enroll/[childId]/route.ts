// ============================================================
// FILE: app/api/parent/re-enroll/[childId]/route.ts
// PURPOSE: Re-enrollment — Season recap + Razorpay order creation
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import { getPricingConfig } from '@/lib/config/pricing-config';
import Razorpay from 'razorpay';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const SKILL_LABELS: Record<string, string> = {
  phonemic_awareness: 'Sound Skills',
  phonics: 'Letter Sounds',
  decoding: 'Word Reading',
  fluency: 'Reading Speed',
  vocabulary: 'Word Power',
  comprehension: 'Understanding Stories',
  grammar: 'Language Skills',
  writing: 'Writing',
  confidence: 'Reading Confidence',
  expression: 'Reading with Feeling',
  listening: 'Listening Skills',
  sight_words: 'Sight Words',
  blending: 'Word Building',
  rhyming: 'Rhyming',
  prosody: 'Reading with Feeling',
  stamina: 'Reading Stamina',
};

function friendlySkill(skill: string): string {
  return SKILL_LABELS[skill] || skill.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Age band config is now loaded dynamically via getPricingConfig()

// ============================================================
// GET: Load re-enrollment data (recap + preview + pricing)
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { childId } = await params;
    const supabase = getServiceSupabase();

    // Get child + verify parent
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, name, age, age_band, parent_id, parent_email')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    if (child.parent_email !== auth.email) {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', auth.email ?? '')
        .maybeSingle();

      if (!parent || child.parent_id !== parent.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    // Get completed enrollment (season_completed or completed)
    const { data: prevEnrollment } = await supabase
      .from('enrollments')
      .select('id, coach_id, season_number, age_band, total_sessions, status, updated_at, created_at')
      .eq('child_id', childId)
      .in('status', ['season_completed', 'completed'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!prevEnrollment) {
      return NextResponse.json({ error: 'No completed season found' }, { status: 400 });
    }

    // Get season completion event for recap
    const { data: completionEvent } = await supabase
      .from('learning_events')
      .select('event_data')
      .eq('child_id', childId)
      .eq('event_type', 'season_completion')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const completionData = (completionEvent?.event_data as any) || {};
    const beforeAfter = completionData.before_after || {};
    const recap = Object.entries(beforeAfter).map(([label, vals]: [string, any]) => ({
      skill: friendlySkill(label),
      before: vals.before || '--',
      after: vals.after || '--',
    }));

    // Coach info for continuity
    let coachInfo = null;
    if (prevEnrollment.coach_id) {
      const { data: coach } = await supabase
        .from('coaches')
        .select('id, name')
        .eq('id', prevEnrollment.coach_id)
        .maybeSingle();
      coachInfo = coach;
    }

    // Get next season preview
    const { data: nextRoadmap } = await supabase
      .from('season_roadmaps')
      .select('season_number, season_name, focus_area, milestone_description')
      .eq('child_id', childId)
      .eq('status', 'upcoming')
      .order('season_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Get pricing — use 'continuation' product
    const { data: product } = await supabase
      .from('pricing_plans')
      .select('id, slug, name, discounted_price, sessions_included, duration_months, is_locked, lock_message')
      .eq('slug', 'continuation')
      .eq('is_active', true)
      .maybeSingle();

    // Fallback to 'full' pricing if no continuation plan
    let pricingPlan = product;
    if (!pricingPlan) {
      const { data: fullPlan } = await supabase
        .from('pricing_plans')
        .select('id, slug, name, discounted_price, sessions_included, duration_months, is_locked, lock_message')
        .eq('slug', 'full')
        .eq('is_active', true)
        .maybeSingle();
      pricingPlan = fullPlan;
    }

    const ageBand = child.age_band || prevEnrollment.age_band || 'building';
    const pricingConfig = await getPricingConfig();
    const bandConfig = pricingConfig.ageBands.find(b => b.id === ageBand);
    const nextSeasonNumber = (prevEnrollment.season_number || 1) + 1;

    // Check if age band might transition (child aged up)
    let ageBandTransition = null;
    const childAge = child.age || 0;
    if (ageBand === 'foundation' && childAge >= 7) {
      ageBandTransition = { from: 'foundation', to: 'building', reason: `${child.child_name || child.name} is now ${childAge} years old` };
    } else if (ageBand === 'building' && childAge >= 10) {
      ageBandTransition = { from: 'building', to: 'mastery', reason: `${child.child_name || child.name} is now ${childAge} years old` };
    }

    return NextResponse.json({
      success: true,
      child: {
        id: child.id,
        name: child.child_name || child.name,
        age: child.age,
        age_band: ageBand,
      },
      previous_season: {
        number: prevEnrollment.season_number || 1,
        enrollment_id: prevEnrollment.id,
        sessions_completed: completionData.sessions_completed || 0,
        sessions_total: prevEnrollment.total_sessions || bandConfig?.sessionsPerSeason || 9,
        completion_rate: completionData.completion_rate || 0,
        completed_at: prevEnrollment.updated_at,
        growth: recap,
      },
      coach: coachInfo,
      next_season: nextRoadmap ? {
        number: nextRoadmap.season_number,
        name: nextRoadmap.season_name || `Season ${nextRoadmap.season_number}`,
        focus_areas: nextRoadmap.focus_area ? [friendlySkill(nextRoadmap.focus_area)] : [],
        age_band: ageBandTransition ? ageBandTransition.to : ageBand,
      } : {
        number: nextSeasonNumber,
        name: `Season ${nextSeasonNumber}`,
        focus_areas: [],
        age_band: ageBandTransition ? ageBandTransition.to : ageBand,
      },
      age_band_transition: ageBandTransition,
      pricing: pricingPlan ? {
        plan_id: pricingPlan.id,
        name: pricingPlan.name,
        price: pricingPlan.discounted_price,
        sessions: pricingPlan.sessions_included || bandConfig?.sessionsPerSeason || 9,
        duration_months: pricingPlan.duration_months,
        is_locked: pricingPlan.is_locked || false,
        lock_message: pricingPlan.lock_message || null,
      } : null,
      razorpay_key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 're_enroll_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================
// POST: Create Razorpay order for re-enrollment
// ============================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { childId } = await params;
    const body = await request.json();
    const { plan_id, preference_days, preference_time_bucket } = body;

    const supabase = getServiceSupabase();

    // Get child + verify parent
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, name, age, age_band, parent_id, parent_email')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    if (child.parent_email !== auth.email) {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', auth.email ?? '')
        .maybeSingle();

      if (!parent || child.parent_id !== parent.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    // Get previous enrollment
    const { data: prevEnrollment } = await supabase
      .from('enrollments')
      .select('id, coach_id, season_number, age_band')
      .eq('child_id', childId)
      .in('status', ['season_completed', 'completed'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!prevEnrollment) {
      return NextResponse.json({ error: 'No completed season found' }, { status: 400 });
    }

    // Get pricing plan
    const { data: plan } = await supabase
      .from('pricing_plans')
      .select('id, slug, name, discounted_price, sessions_included, duration_months')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (!plan) {
      return NextResponse.json({ error: 'Pricing plan not found' }, { status: 400 });
    }

    const price = plan.discounted_price;
    if (!price || price <= 0) {
      return NextResponse.json({ error: 'Invalid pricing' }, { status: 400 });
    }

    // Get parent info
    const { data: parentData } = await supabase
      .from('parents')
      .select('id, name, email, phone')
      .eq('email', auth.email ?? '')
      .maybeSingle();

    // Create Razorpay order
    const receiptId = `reenroll_${crypto.randomBytes(8).toString('hex')}`;
    const order = await razorpay.orders.create({
      amount: price * 100, // paise
      currency: 'INR',
      receipt: receiptId,
      notes: {
        childId: child.id,
        childName: child.child_name || child.name || '',
        coachId: prevEnrollment.coach_id || '',
        parentName: parentData?.name || '',
        parentEmail: auth.email || '',
        parentPhone: parentData?.phone || '',
        packageType: plan.slug,
        source: 're-enrollment',
        previousEnrollmentId: prevEnrollment.id,
        seasonNumber: String((prevEnrollment.season_number || 1) + 1),
        ageBand: child.age_band || prevEnrollment.age_band || 'building',
        preferenceDays: preference_days ? JSON.stringify(preference_days) : '',
        preferenceTimeBucket: preference_time_bucket || 'any',
      },
    });

    console.log(JSON.stringify({
      requestId,
      event: 're_enrollment_order_created',
      orderId: order.id,
      childId,
      amount: price,
      plan: plan.slug,
    }));

    return NextResponse.json({
      success: true,
      order_id: order.id,
      amount: price,
      currency: 'INR',
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      prefill: {
        name: parentData?.name || '',
        email: auth.email || '',
        contact: parentData?.phone || '',
      },
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 're_enroll_post_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
