import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';

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
        admin_notes: adminNotes || null,
        reviewed_by: auth.userId || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating request:', updateError);
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }

    // If approved, update the session
    if (action === 'approve') {
      if (changeRequest.request_type === 'cancel') {
        await supabase
          .from('scheduled_sessions')
          .update({ status: 'cancelled' })
          .eq('id', changeRequest.session_id);
      } else if (changeRequest.request_type === 'reschedule') {
        const updateData: Record<string, string> = { status: 'rescheduled' };
        if (changeRequest.requested_date) {
          updateData.scheduled_date = changeRequest.requested_date;
        }
        if (changeRequest.requested_time) {
          updateData.scheduled_time = changeRequest.requested_time;
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
