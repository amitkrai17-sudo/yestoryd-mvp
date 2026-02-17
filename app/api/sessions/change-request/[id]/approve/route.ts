import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { id: requestId } = await params;
    const { action, adminNotes } = await request.json();

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Get the change request
    const { data: changeRequest } = await supabase
      .from('session_change_requests')
      .select('*, scheduled_sessions(*)')
      .eq('id', requestId)
      .single();

    if (!changeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (changeRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Request has already been reviewed' }, { status: 400 });
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('session_change_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        rejection_reason: action === 'reject' ? (adminNotes || null) : null,
        processed_by: auth.userId || null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating request:', updateError);
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }

    // If approved, update the session
    if (action === 'approve') {
      if (changeRequest.change_type === 'cancel') {
        await supabase
          .from('scheduled_sessions')
          .update({ status: 'cancelled' })
          .eq('id', changeRequest.session_id);
      } else if (changeRequest.change_type === 'reschedule') {
        const updateData: Record<string, string> = { status: 'rescheduled' };
        if (changeRequest.requested_new_datetime) {
          const dt = new Date(changeRequest.requested_new_datetime);
          updateData.scheduled_date = dt.toISOString().split('T')[0];
          updateData.scheduled_time = dt.toTimeString().slice(0, 5);
        }
        await supabase
          .from('scheduled_sessions')
          .update(updateData)
          .eq('id', changeRequest.session_id);
      }
    }

    return NextResponse.json({
      success: true,
      status: action === 'approve' ? 'approved' : 'rejected',
    });
  } catch (error) {
    console.error('Approve/reject error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
