// app/api/coach/earnings-summary/route.ts
// Single Source of Truth for Coach Earnings
// Used by: Dashboard, Earnings page, any future earnings display

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface EarningsSummary {
  totalEarnings: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  totalStudents: number;
  yestorydLeads: number;
  coachLeads: number;
}

export interface EarningDetail {
  id: string;
  child_name: string;
  parent_name: string;
  enrollment_date: string;
  program_fee: number;
  coach_amount: number;
  yestoryd_amount: number;
  split_type: string;
  lead_source: string;
  status: string;
}

export async function GET(request: Request) {
  try {
    // Get coach email from auth
    const authHeader = request.headers.get('authorization');
    const url = new URL(request.url);
    const coachEmail = url.searchParams.get('email');

    if (!coachEmail) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Get coach data
    const { data: coach, error: coachError } = await supabase
      .from('coaches')
      .select('id, coach_split_percentage')
      .eq('email', coachEmail)
      .single();

    if (coachError || !coach) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    // Get all enrolled children for this coach
    const { data: children } = await supabase
      .from('children')
      .select('*')
      .eq('coach_id', coach.id)
      .order('created_at', { ascending: false });

    // Get program price from site_settings (single source of truth)
    const { data: priceSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'program_price')
      .single();

    const programFee = priceSetting?.value
      ? parseInt(String(priceSetting.value).replace(/[^0-9]/g, ''))
      : 5999;

    const defaultCoachSplit = (coach.coach_split_percentage || 50) / 100;
    const coachLeadSplit = 0.70; // 70% for coach leads

    // Calculate earnings for each child
    const earnings: EarningDetail[] = (children || []).map((child) => {
      const isCoachLead = child.lead_source === 'coach';
      const splitPercentage = child.custom_coach_split
        ? child.custom_coach_split / 100
        : isCoachLead
        ? coachLeadSplit
        : defaultCoachSplit;

      const coachAmount = programFee * splitPercentage;
      const yestorydAmount = programFee - coachAmount;

      return {
        id: child.id,
        child_name: child.child_name,
        parent_name: child.parent_name,
        enrollment_date: child.created_at,
        program_fee: programFee,
        coach_amount: coachAmount,
        yestoryd_amount: yestorydAmount,
        split_type: child.custom_coach_split ? 'custom' : isCoachLead ? 'coach_lead' : 'default',
        lead_source: child.lead_source || 'yestoryd',
        status: child.subscription_status === 'active' ? 'paid' : 'pending',
      };
    });

    // Calculate summary
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const totalEarnings = earnings.reduce((sum, e) => sum + e.coach_amount, 0);
    
    const thisMonthEarnings = earnings
      .filter((e) => new Date(e.enrollment_date) >= startOfMonth)
      .reduce((sum, e) => sum + e.coach_amount, 0);
    
    const lastMonthEarnings = earnings
      .filter((e) => {
        const date = new Date(e.enrollment_date);
        return date >= startOfLastMonth && date <= endOfLastMonth;
      })
      .reduce((sum, e) => sum + e.coach_amount, 0);
    
    const pendingEarnings = earnings
      .filter((e) => e.status === 'pending')
      .reduce((sum, e) => sum + e.coach_amount, 0);

    const paidEarnings = earnings
      .filter((e) => e.status === 'paid')
      .reduce((sum, e) => sum + e.coach_amount, 0);

    const yestorydLeads = earnings.filter((e) => e.lead_source === 'yestoryd').length;
    const coachLeads = earnings.filter((e) => e.lead_source === 'coach').length;

    const summary: EarningsSummary = {
      totalEarnings,
      thisMonthEarnings,
      lastMonthEarnings,
      pendingEarnings,
      paidEarnings,
      totalStudents: earnings.length,
      yestorydLeads,
      coachLeads,
    };

    return NextResponse.json({
      summary,
      earnings,
    });
  } catch (error) {
    console.error('Earnings summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
