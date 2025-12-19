// app/api/admin/coach-applications/route.ts
// API to list all coach applications for admin review
// FIXED: Added no-cache headers and detailed logging

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('📋 GET /api/admin/coach-applications called');
  
  try {
    // Create fresh Supabase client per request
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    console.log('📋 Filters - status:', status, 'search:', search);

    // Build query
    let query = supabase
      .from('coach_applications')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: applications, error } = await query;

    if (error) {
      console.error('❌ Error fetching applications:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Fetched', applications?.length, 'applications');
    
    // Log status of first few for debugging
    if (applications && applications.length > 0) {
      console.log('📊 Sample statuses:', applications.slice(0, 5).map(a => ({
        name: a.name,
        status: a.status,
        id: a.id.slice(0, 8)
      })));
    }

    // Create response with no-cache headers
    const response = NextResponse.json({ 
      applications: applications || [],
      count: applications?.length || 0,
      fetchedAt: new Date().toISOString()
    });

    // CRITICAL: Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;

  } catch (error: any) {
    console.error('💥 Error in coach applications API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}