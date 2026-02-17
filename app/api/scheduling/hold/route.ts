// ============================================================
// FILE: app/api/scheduling/hold/route.ts
// ============================================================
// Session Hold System - Race Condition Prevention
// 
// Flow:
// 1. Parent selects slot → POST creates 10-min hold
// 2. Parent completes payment → Hold converts to booking
// 3. Timeout (10 min) → Hold auto-expires
// 
// Uses: session_holds table with unique constraint
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// Hold expiry time in minutes
const HOLD_EXPIRY_MINUTES = 10;

// ============================================================
// POST - Create a hold on a slot
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coachId, date, time, sessionType, parentEmail, childId } = body;

    // Validation
    if (!coachId || !date || !time) {
      return NextResponse.json(
        { success: false, error: 'Coach ID, date, and time are required' },
        { status: 400 }
      );
    }

    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + HOLD_EXPIRY_MINUTES);

    // First, clean up expired holds
    await supabase
      .from('session_holds')
      .delete()
      .lt('expires_at', new Date().toISOString());

    // Check if slot is already booked in scheduled_sessions
    const { data: existingSession } = await supabase
      .from('scheduled_sessions')
      .select('id')
      .eq('coach_id', coachId)
      .eq('scheduled_date', date)
      .eq('scheduled_time', time)
      .eq('status', 'scheduled')
      .single();

    if (existingSession) {
      return NextResponse.json(
        { success: false, error: 'This slot is already booked' },
        { status: 409 }
      );
    }

    // Check if slot is already held by someone else
    const { data: existingHold } = await supabase
      .from('session_holds')
      .select('id, parent_email, expires_at')
      .eq('coach_id', coachId)
      .eq('slot_date', date)
      .eq('slot_time', time)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingHold) {
      // If same user, extend the hold
      if (existingHold.parent_email === parentEmail) {
        const { data: updatedHold, error: updateError } = await supabase
          .from('session_holds')
          .update({ expires_at: expiresAt.toISOString() })
          .eq('id', existingHold.id)
          .select()
          .single();

        if (updateError) {
          console.error('[Hold API] Update error:', updateError);
          return NextResponse.json(
            { success: false, error: 'Failed to extend hold' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Hold extended',
          hold: {
            id: updatedHold.id,
            expiresAt: updatedHold.expires_at,
            expiresInMinutes: HOLD_EXPIRY_MINUTES,
          },
        });
      }

      // Different user - slot is held
      return NextResponse.json(
        { 
          success: false, 
          error: 'This slot is currently being booked by someone else. Please try a different time.',
          retryAfter: existingHold.expires_at,
        },
        { status: 409 }
      );
    }

    // Create new hold
    const { data: newHold, error: insertError } = await supabase
      .from('session_holds')
      .insert({
        coach_id: coachId,
        slot_date: date,
        slot_time: time,
        session_type: sessionType || 'discovery',
        parent_email: parentEmail || null,
        child_id: childId || null,
        duration_minutes: 45,
        expires_at: expiresAt.toISOString(),
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      // Unique constraint violation - someone grabbed it first
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'This slot was just taken. Please try another time.' },
          { status: 409 }
        );
      }

      console.error('[Hold API] Insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to reserve slot' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Slot reserved',
      hold: {
        id: newHold.id,
        expiresAt: newHold.expires_at,
        expiresInMinutes: HOLD_EXPIRY_MINUTES,
      },
    });

  } catch (error: any) {
    console.error('[Hold API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE - Release a hold
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const holdId = searchParams.get('holdId');
    const parentEmail = searchParams.get('email');

    if (!holdId) {
      return NextResponse.json(
        { success: false, error: 'Hold ID required' },
        { status: 400 }
      );
    }

    // Find the hold
    const { data: hold, error: findError } = await supabase
      .from('session_holds')
      .select('*')
      .eq('id', holdId)
      .single();

    if (findError || !hold) {
      return NextResponse.json(
        { success: false, error: 'Hold not found' },
        { status: 404 }
      );
    }

    // Verify ownership if email provided
    if (parentEmail && hold.parent_email && hold.parent_email !== parentEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete the hold
    const { error: deleteError } = await supabase
      .from('session_holds')
      .delete()
      .eq('id', holdId);

    if (deleteError) {
      console.error('[Hold API] Delete error:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to release hold' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Hold released',
    });

  } catch (error: any) {
    console.error('[Hold API] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// ============================================================
// GET - Check hold status
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const holdId = searchParams.get('holdId');
    const coachId = searchParams.get('coachId');
    const date = searchParams.get('date');
    const time = searchParams.get('time');

    // Clean up expired holds first
    await supabase
      .from('session_holds')
      .delete()
      .lt('expires_at', new Date().toISOString());

    // Check specific hold by ID
    if (holdId) {
      const { data: hold, error } = await supabase
        .from('session_holds')
        .select('*')
        .eq('id', holdId)
        .single();

      if (error || !hold) {
        return NextResponse.json({
          success: true,
          hold: null,
          status: 'expired',
        });
      }

      const isExpired = !hold.expires_at || new Date(hold.expires_at) < new Date();

      return NextResponse.json({
        success: true,
        hold: isExpired ? null : {
          id: hold.id,
          expiresAt: hold.expires_at,
          status: hold.status,
        },
        status: isExpired ? 'expired' : 'active',
      });
    }

    // Check if slot is available
    if (coachId && date && time) {
      const { data: hold } = await supabase
        .from('session_holds')
        .select('id, expires_at, parent_email')
        .eq('coach_id', coachId)
        .eq('slot_date', date)
        .eq('slot_time', time)
        .gt('expires_at', new Date().toISOString())
        .single();

      return NextResponse.json({
        success: true,
        isAvailable: !hold,
        hold: hold ? {
          expiresAt: hold.expires_at,
        } : null,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Provide holdId OR (coachId, date, time)' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[Hold API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
