import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  const { data: coach, error } = await supabase
    .from('coaches')
    .select('*')
    .eq('email', email?.toLowerCase())
    .single();

  return NextResponse.json({
    _timestamp: new Date().toISOString(),
    _email_queried: email?.toLowerCase(),
    _raw_coach: coach,
    _error: error,
  });
}