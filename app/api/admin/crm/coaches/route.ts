// app/api/admin/crm/coaches/route.ts
// GET - Fetch all active coaches for assignment dropdown
// UPDATED: Include availability/exit fields for filtering

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Default coaches (always available even without DB)
const DEFAULT_COACHES = [
  { 
    id: 'rucha-default', 
    name: 'Rucha Rai', 
    email: 'rucha@yestoryd.com',
    is_available: true,
    is_active: true,
    exit_status: null
  },
];

// GET - Fetch all active coaches for assignment dropdown
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('coaches')
      .select('id, name, email, status, is_available, is_active, exit_status')
      .eq('status', 'active')
      .order('name');

    if (error) throw error;

    // Combine default coaches with DB coaches (avoid duplicates by email)
    const dbCoaches = (data || []).map(c => ({
      ...c,
      is_available: c.is_available !== false, // default true
      is_active: c.is_active !== false, // default true
    }));
    
    const dbEmails = dbCoaches.map(c => c.email.toLowerCase());
    const allCoaches = [
      ...DEFAULT_COACHES.filter(dc => !dbEmails.includes(dc.email.toLowerCase())),
      ...dbCoaches
    ];

    return NextResponse.json({ coaches: allCoaches });
  } catch (error: any) {
    console.error('Error fetching coaches:', error);
    // Return default coaches if table doesn't exist or other error
    return NextResponse.json({ coaches: DEFAULT_COACHES });
  }
}