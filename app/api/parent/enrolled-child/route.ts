// =============================================================================
// FILE: app/api/parent/enrolled-child/route.ts
// PURPOSE: Get the enrolled child for the current parent
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabaseAdmin = createAdminClient();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check for auth token in header (from client-side auth)
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { child: null, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // Verify token and get user
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (!user || error) {
      return NextResponse.json(
        { child: null, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get enrolled child for this parent (filtered by parent_email)
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('id, child_name, age, lead_status')
      .eq('parent_email', user.email ?? '')
      .eq('lead_status', 'enrolled')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (child) {
      return NextResponse.json({ child });
    }

    return NextResponse.json({
      child: null,
      message: 'No enrolled child found for this account'
    });

  } catch (error: any) {
    console.error('Enrolled child API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
