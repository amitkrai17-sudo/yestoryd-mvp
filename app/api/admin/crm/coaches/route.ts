import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch all active coaches for assignment dropdown
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('coaches')
      .select('id, name, email, status')
      .eq('status', 'active')
      .order('name');

    if (error) throw error;

    return NextResponse.json({ coaches: data || [] });
  } catch (error: any) {
    console.error('Error fetching coaches:', error);
    
    // Return empty array if table doesn't exist or other error
    // This allows CRM to work even without coaches table
    return NextResponse.json({ coaches: [] });
  }
}
