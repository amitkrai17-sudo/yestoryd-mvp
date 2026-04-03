// ============================================================
// POST /api/sessions/change-request/[id]/approve
// Coach or admin approves/rejects a parent reschedule request.
// On approve: updates session, Calendar, Recall.ai, notifies parent.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrCoach, getServiceSupabase } from '@/lib/api-auth';
import { dispatch } from '@/lib/scheduling/orchestrator';
import { randomUUID } from 'crypto';

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

    // Get the change request with session and enrollment details
    const { data: changeRequest } = await supabase
      .from('session_change_requests')
      .select('*')
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
        processed_by: auth.userId || auth.coachId || null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('[change-request-approve] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
    }

    // Get session + child + parent info for notifications
    // select('*') to include batch_id (added via migration, not in generated types)
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('id', changeRequest.session_id)
      .single();

    let childName = 'Student';
    let parentPhone = '';
    let parentName = '';
    let parentId: string | null = null;

    if (session?.child_id) {
      const { data: child } = await supabase
        .from('children')
        .select('child_name, parent_name, parent_phone, parent_id')
        .eq('id', session.child_id)
        .single();
      if (child) {
        childName = child.child_name || 'Student';
        parentName = child.parent_name || 'Parent';
        parentPhone = child.parent_phone || '';
        parentId = child.parent_id;
      }
    }

    if (action === 'approve') {
      if (changeRequest.change_type === 'cancel') {
        // Cancel session
        await supabase
          .from('scheduled_sessions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', changeRequest.session_id);

      } else if (changeRequest.change_type === 'reschedule') {
        // Reschedule: update session date/time + Calendar + Recall
        if (changeRequest.requested_new_datetime) {
          const dt = new Date(changeRequest.requested_new_datetime);
          const newDate = dt.toISOString().split('T')[0];
          const newTime = dt.toTimeString().slice(0, 5);

          // Dispatch through orchestrator (handles Calendar + Recall updates)
          const orchResult = await dispatch('session.reschedule', {
            sessionId: changeRequest.session_id,
            newDate,
            newTime,
            reason: changeRequest.reason || 'Approved reschedule',
            requestId: randomUUID(),
          });

          if (!orchResult.success) {
            // Fallback: update session directly
            console.warn('[change-request-approve] Orchestrator failed, updating directly');
            await supabase
              .from('scheduled_sessions')
              .update({
                scheduled_date: newDate,
                scheduled_time: newTime,
                status: 'scheduled',
                updated_at: new Date().toISOString(),
              })
              .eq('id', changeRequest.session_id);
          }
          // Batch reschedule: move all sibling sessions at the same original datetime
          const batchId = (session as any)?.batch_id as string | null;
          if (batchId && session) {
            try {
              const originalDate = session.scheduled_date;
              const originalTime = session.scheduled_time;

              const { data: siblings } = await supabase
                .from('scheduled_sessions')
                .select('id, child_id')
                .eq('batch_id' as any, batchId)
                .eq('scheduled_date', originalDate!)
                .eq('scheduled_time', originalTime!)
                .neq('id', changeRequest.session_id);

              if (siblings && siblings.length > 0) {
                // Move all siblings to the new datetime
                await supabase
                  .from('scheduled_sessions')
                  .update({
                    scheduled_date: newDate,
                    scheduled_time: newTime,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('batch_id' as any, batchId)
                  .eq('scheduled_date', originalDate!)
                  .eq('scheduled_time', originalTime!)
                  .neq('id', changeRequest.session_id);

                console.log(`[change-request-approve] Batch reschedule: moved ${siblings.length} siblings for batch ${batchId}`);

                // Notify all sibling parents
                try {
                  const { sendCommunication } = await import('@/lib/communication');
                  const newDateStr = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' });

                  for (const sib of siblings) {
                    if (!sib.child_id) continue;
                    const { data: sibChild } = await supabase
                      .from('children')
                      .select('child_name, parent_phone, parent_name, parent_id')
                      .eq('id', sib.child_id)
                      .single();

                    if (sibChild?.parent_phone) {
                      await sendCommunication({
                        templateCode: 'P15_reschedule_approved',
                        recipientType: 'parent',
                        recipientId: sibChild.parent_id || undefined,
                        recipientPhone: sibChild.parent_phone,
                        recipientName: sibChild.parent_name || undefined,
                        variables: {
                          parent_first_name: (sibChild.parent_name || 'Parent').split(' ')[0],
                          child_name: sibChild.child_name || 'your child',
                          new_date: newDateStr,
                        },
                        relatedEntityType: 'session',
                        relatedEntityId: sib.id,
                      });
                    }
                  }
                } catch (sibNotifyErr) {
                  console.error('[change-request-approve] Batch sibling notification failed:', sibNotifyErr);
                }
              }
            } catch (batchErr) {
              console.error('[change-request-approve] Batch reschedule failed:', batchErr);
              // Non-fatal — primary session was already rescheduled
            }
          }
        } else {
          // No new date specified — just mark as approved (coach will schedule)
          await supabase
            .from('scheduled_sessions')
            .update({ status: 'scheduled', updated_at: new Date().toISOString() })
            .eq('id', changeRequest.session_id);
        }

        // Increment reschedules_used
        const enrollmentId = changeRequest.enrollment_id || session?.enrollment_id;
        if (enrollmentId) {
          const { data: enrollment } = await supabase
            .from('enrollments')
            .select('reschedules_used')
            .eq('id', enrollmentId)
            .single();

          if (enrollment) {
            await supabase
              .from('enrollments')
              .update({ reschedules_used: (enrollment.reschedules_used || 0) + 1 })
              .eq('id', enrollmentId);
          }
        }
      }

      // Notify parent: approved
      try {
        const { sendCommunication } = await import('@/lib/communication');
        const newDateStr = changeRequest.requested_new_datetime
          ? new Date(changeRequest.requested_new_datetime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
          : 'a new date';

        if (parentPhone) {
          await sendCommunication({
            templateCode: 'P15_reschedule_approved',
            recipientType: 'parent',
            recipientId: parentId || undefined,
            recipientPhone: parentPhone,
            recipientName: parentName,
            variables: {
              parent_first_name: parentName.split(' ')[0] || 'Parent',
              child_name: childName,
              new_date: newDateStr,
            },
            relatedEntityType: 'session',
            relatedEntityId: changeRequest.session_id,
          });
        }
      } catch (notifyErr) {
        console.error('[change-request-approve] Parent notification failed:', notifyErr);
      }

    } else {
      // Rejected — notify parent
      try {
        const { sendCommunication } = await import('@/lib/communication');
        const originalDateStr = changeRequest.original_datetime
          ? new Date(changeRequest.original_datetime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
          : 'the original date';

        if (parentPhone) {
          await sendCommunication({
            templateCode: 'P16_reschedule_rejected',
            recipientType: 'parent',
            recipientId: parentId || undefined,
            recipientPhone: parentPhone,
            recipientName: parentName,
            variables: {
              parent_first_name: parentName.split(' ')[0] || 'Parent',
              child_name: childName,
              original_date: originalDateStr,
            },
            relatedEntityType: 'session',
            relatedEntityId: changeRequest.session_id,
          });
        }
      } catch (notifyErr) {
        console.error('[change-request-approve] Rejection notification failed:', notifyErr);
      }
    }

    // Activity log
    try {
      await supabase.from('activity_log').insert({
        action: `reschedule_${action}d`,
        user_email: auth.email || 'unknown',
        user_type: auth.role || 'coach',
        metadata: {
          request_id: requestId,
          session_id: changeRequest.session_id,
          change_type: changeRequest.change_type,
          child_name: childName,
          admin_notes: adminNotes || null,
        },
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      status: action === 'approve' ? 'approved' : 'rejected',
    });
  } catch (error) {
    console.error('[change-request-approve] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
