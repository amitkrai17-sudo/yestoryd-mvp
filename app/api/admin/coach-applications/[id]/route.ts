// file: app/api/admin/coach-applications/[id]/route.ts
// Admin API for updating coach application status
// UPDATED: Auto-creates coach record when status = 'approved'
// SECURITY: requireAdmin() on all handlers

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';
import { buildEngagementRecords } from '@/lib/coach-engagement/schedule';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('coach_applications')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }

    return NextResponse.json({ success: true, application: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const supabase = getServiceSupabase();
    const body = await request.json();
    const { status, reviewed_by, reviewed_at, ...otherUpdates } = body;

    console.log('📝 Updating application:', params.id, 'to status:', status);

    // Update the application
    const { data: updatedApp, error: updateError } = await (supabase
      .from('coach_applications') as any)
      .update({
        status,
        reviewed_by,
        reviewed_at,
        ...otherUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Update error:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    console.log('✅ Application updated:', updatedApp.status);

    // ==================== AUTO-CREATE COACH ON APPROVAL ====================
    if (status === 'approved') {
      console.log('🎉 Approved! Creating coach record for:', updatedApp.email);

      // Generate referral code from name
      const firstName = updatedApp.name?.split(' ')[0]?.toUpperCase() || 'COACH';
      const uniqueSuffix = crypto.randomUUID().slice(0, 6).toUpperCase();
      const referralCode = `REF-${firstName}-${uniqueSuffix}`;
      const referralLink = `https://yestoryd.com/assessment?ref=${referralCode}`;

      // Check if coach already exists
      const { data: existingCoach } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', updatedApp.email)
        .single();

      if (existingCoach) {
        console.log('⚠️ Coach already exists, updating...');
        // Update existing coach to active
        await (supabase.from('coaches') as any)
          .update({
            is_active: true,
            name: updatedApp.name,
            phone: updatedApp.phone,
            city: updatedApp.city,
            referral_code: referralCode,
            referral_link: referralLink,
            updated_at: new Date().toISOString(),
          })
          .eq('email', updatedApp.email);
      } else {
        console.log('➕ Creating new coach record...');
        // Create new coach record
        const { data: newCoach, error: coachError } = await (supabase
          .from('coaches') as any)
          .insert({
            email: updatedApp.email,
            name: updatedApp.name,
            phone: updatedApp.phone,
            city: updatedApp.city,
            is_active: true,
            referral_code: referralCode,
            referral_link: referralLink,
            application_id: params.id,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (coachError) {
          console.error('❌ Failed to create coach:', coachError);
          // Don't fail the whole request, just log the error
        } else {
          console.log('✅ Coach record created:', newCoach?.id);
        }
      }

      // Schedule engagement messages for newly approved coach
      const { data: coachForEngagement } = await supabase
        .from('coaches')
        .select('id')
        .eq('email', updatedApp.email)
        .single();

      if (coachForEngagement) {
        const records = buildEngagementRecords(coachForEngagement.id, 'approval');
        if (records.length > 0) {
          const { error: engErr } = await supabase
            .from('coach_engagement_log')
            .insert(records);
          if (engErr) {
            console.error('Failed to schedule engagement:', engErr);
          } else {
            console.log(`Scheduled ${records.length} engagement messages`);
          }
        }
      }
    }

    // ==================== DEACTIVATE COACH ON REJECTION ====================
    if (status === 'rejected') {
      console.log('❌ Rejected! Deactivating coach if exists:', updatedApp.email);
      
      await (supabase.from('coaches') as any)
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('email', updatedApp.email);
    }

    return NextResponse.json({
      success: true,
      application: updatedApp,
    });

  } catch (error: any) {
    console.error('💥 PATCH error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from('coach_applications')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Application deleted' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}