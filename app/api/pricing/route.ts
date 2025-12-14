import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Fetch active pricing plans for frontend
export async function GET() {
  try {
    const { data: plans, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;

    // Parse features and return
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
