// ============================================================
// FILE: app/api/admin/crm/coaches/route.ts
// ============================================================
// HARDENED VERSION - Admin CRM Coaches API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getSupabase } from '@/lib/admin-auth';
import crypto from 'crypto';

// Default coaches (always available even without DB)
const DEFAULT_COACHES = [
  {
    id: '9fb07277-60b6-4410-a71c-9de94b8b9971',
    name: 'Rucha Rai',
    email: 'rucha@yestoryd.com',
    is_available: true,
    is_active: true,
    exit_status: null
  },
];

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    console.log(JSON.stringify({ requestId, event: 'crm_coaches_request', adminEmail: auth.email }));

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('coaches')
      .select('id, name, email, status, is_available, is_active, exit_status')
      .eq('status', 'active')
      .order('name');

    if (error) throw error;

    // Combine default coaches with DB coaches (avoid duplicates by email)
    const dbCoaches = (data || []).map(c => ({
      ...c,
      is_available: c.is_available !== false,
      is_active: c.is_active !== false,
    }));

    const dbEmails = dbCoaches.map(c => c.email.toLowerCase());
    const allCoaches = [
      ...DEFAULT_COACHES.filter(dc => !dbEmails.includes(dc.email.toLowerCase())),
      ...dbCoaches
    ];

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'crm_coaches_success', count: allCoaches.length, duration: `${duration}ms` }));

    return NextResponse.json({ success: true, requestId, coaches: allCoaches });

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'crm_coaches_error', error: error.message }));
    // Return default coaches if table doesn't exist or other error
    return NextResponse.json({ success: true, requestId, coaches: DEFAULT_COACHES });
  }
}
