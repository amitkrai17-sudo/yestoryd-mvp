// ============================================================
// FILE: app/api/admin/pending-assessments/route.ts
// ============================================================
// Admin API: Fetch pending and failed assessments for retry monitoring
// Shows assessments queued for retry or permanently failed
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminCheck = await requireAdmin();
    if (adminCheck.error) {
      return NextResponse.json({ error: adminCheck.error }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Fetch all pending and failed assessments
    const { data: assessments, error } = await supabase
      .from('pending_assessments')
      .select('*')
      .in('status', ['pending', 'processing', 'failed'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Group by status for summary stats
    const stats = {
      pending: assessments?.filter(a => a.status === 'pending').length || 0,
      processing: assessments?.filter(a => a.status === 'processing').length || 0,
      failed: assessments?.filter(a => a.status === 'failed').length || 0,
      total: assessments?.length || 0,
    };

    return NextResponse.json({
      success: true,
      assessments: assessments || [],
      stats,
    });
  } catch (error: any) {
    console.error('[ADMIN] Fetch pending assessments error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch pending assessments' },
      { status: 500 }
    );
  }
}

/**
 * POST - Manually retry a failed assessment
 */
export async function POST(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin();
    if (adminCheck.error) {
      return NextResponse.json({ error: adminCheck.error }, { status: 401 });
    }

    const body = await request.json();
    const { pendingAssessmentId, action } = body;

    if (!pendingAssessmentId) {
      return NextResponse.json({ error: 'Missing pendingAssessmentId' }, { status: 400 });
    }

    const supabase = createAdminClient();

    if (action === 'retry') {
      // Reset retry count and status to queue for immediate retry
      const { error } = await supabase
        .from('pending_assessments')
        .update({
          status: 'pending',
          retry_count: 0,
          error_message: null,
        })
        .eq('id', pendingAssessmentId);

      if (error) throw error;

      // Queue immediate retry
      const { queueAssessmentRetry } = await import('@/lib/qstash');
      await queueAssessmentRetry({
        pendingAssessmentId,
        requestId: `admin-retry-${Date.now()}`,
      });

      return NextResponse.json({
        success: true,
        message: 'Assessment queued for retry',
      });
    }

    if (action === 'delete') {
      const { error } = await supabase
        .from('pending_assessments')
        .delete()
        .eq('id', pendingAssessmentId);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: 'Assessment deleted',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[ADMIN] Pending assessment action error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
