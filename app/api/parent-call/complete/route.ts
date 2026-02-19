// ============================================================
// FILE: app/api/parent-call/complete/route.ts
// PURPOSE: Mark a parent call as completed
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { call_id, notes } = await request.json();

    if (!call_id) {
      return NextResponse.json({ error: 'call_id is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Fetch the call
    const { data: call, error: callError } = await supabase
      .from('parent_calls')
      .select('id, status')
      .eq('id', call_id)
      .single();

    if (callError || !call) {
      return NextResponse.json({ error: 'Parent call not found' }, { status: 404 });
    }

    if (call.status === 'completed') {
      return NextResponse.json({ error: 'Call already completed' }, { status: 400 });
    }

    if (call.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot complete a cancelled call' }, { status: 400 });
    }

    // Update to completed
    const { data: updated, error: updateError } = await supabase
      .from('parent_calls')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', call_id)
      .select()
      .single();

    if (updateError) {
      console.error('[ParentCall] Complete error:', updateError);
      return NextResponse.json({ error: 'Failed to complete call' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      call: updated,
      message: 'Parent call marked as completed',
    });
  } catch (error: any) {
    console.error('[ParentCall] Complete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
