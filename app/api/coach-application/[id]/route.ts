// app/api/admin/coach-applications/[id]/route.ts
// Get, Update single coach application
// FIXED: Added logging + proper Next.js 14 params handling

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// GET single application
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('📥 GET application:', id);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('coach_applications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching application:', error);
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    console.log('✅ Found application:', data.name, 'status:', data.status);
    return NextResponse.json({ application: data });
  } catch (error: any) {
    console.error('💥 Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH update application
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    console.log('📝 PATCH application:', id);
    console.log('📝 Update body:', JSON.stringify(body));

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build update object - only include fields that are provided
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Allowed fields to update
    const allowedFields = [
      'status', 
      'review_notes', 
      'rejection_reason', 
      'reviewed_by', 
      'reviewed_at',
      'interview_scheduled_at',
      'interview_completed_at',
      'interview_notes',
      'interview_outcome',
      'interview_feedback',
      'interview_score',
      'google_meet_link',
      'google_event_id'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    console.log('📝 Final updateData:', JSON.stringify(updateData));

    const { data, error } = await supabase
      .from('coach_applications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating application:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Updated! New status:', data.status);

    return NextResponse.json({ 
      success: true, 
      application: data 
    });
  } catch (error: any) {
    console.error('💥 Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
