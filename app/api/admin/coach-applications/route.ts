// ============================================================
// FILE: app/api/admin/coach-applications/route.ts
// ============================================================
// HARDENED VERSION - List Coach Applications
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ⚠️ CRITICAL FIX: Original had NO AUTHENTICATION!
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

// --- VALIDATION SCHEMA ---
const querySchema = z.object({
  status: z.enum(['all', 'pending', 'reviewing', 'approved', 'rejected', 'onboarding']).optional().default('all'),
  search: z.string().max(100).optional(),
});

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({ requestId, event: 'coach_applications_get_auth_failed', error: auth.error }));
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const validation = querySchema.safeParse({
      status: searchParams.get('status') || 'all',
      search: searchParams.get('search') || undefined,
    });

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: validation.error.flatten() }, { status: 400 });
    }

    const { status, search } = validation.data;

    console.log(JSON.stringify({ requestId, event: 'coach_applications_get_request', adminEmail: auth.email, status, search: search || 'none' }));

    const supabase = getServiceSupabase();

    // Build query
    let query = supabase
      .from('coach_applications')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply search filter (sanitize to prevent injection)
    if (search) {
      const sanitizedSearch = search.replace(/[%_]/g, '\\$&');
      query = query.or(`name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%,phone.ilike.%${sanitizedSearch}%`);
    }

    const { data: applications, error } = await query;

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'coach_applications_get_db_error', error: error.message }));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ requestId, event: 'coach_applications_get_success', count: applications?.length || 0, duration: `${duration}ms` }));

    // Create response with no-cache headers
    const response = NextResponse.json({
      success: true,
      requestId,
      applications: applications || [],
      count: applications?.length || 0,
      fetchedAt: new Date().toISOString(),
    });

    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'coach_applications_get_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}
