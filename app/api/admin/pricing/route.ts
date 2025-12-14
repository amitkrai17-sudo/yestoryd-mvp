import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all pricing plans
export async function GET() {
  try {
    const { data: plans, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    // Parse features JSON for each plan
    const parsedPlans = plans?.map(plan => ({
      ...plan,
      features: typeof plan.features === 'string' 
        ? JSON.parse(plan.features) 
        : plan.features || []
    }));

    return NextResponse.json({ plans: parsedPlans });
  } catch (error: any) {
    console.error('Failed to fetch pricing plans:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a pricing plan
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('pricing_plans')
      .update({
        name: body.name,
        description: body.description,
        original_price: body.original_price,
        discounted_price: body.discounted_price,
        discount_label: body.discount_label,
        duration_months: body.duration_months,
        sessions_included: body.sessions_included,
        features: JSON.stringify(body.features),
        is_active: body.is_active,
        is_featured: body.is_featured,
        offer_valid_until: body.offer_valid_until,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ plan: data });
  } catch (error: any) {
    console.error('Failed to update pricing plan:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new pricing plan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('pricing_plans')
      .insert({
        name: body.name,
        slug: body.slug,
        description: body.description,
        original_price: body.original_price,
        discounted_price: body.discounted_price,
        discount_label: body.discount_label,
        duration_months: body.duration_months || 3,
        sessions_included: body.sessions_included || 9,
        features: JSON.stringify(body.features || []),
        is_active: body.is_active ?? true,
        is_featured: body.is_featured || false,
        offer_valid_until: body.offer_valid_until,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ plan: data });
  } catch (error: any) {
    console.error('Failed to create pricing plan:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
