// ============================================================
// FILE: app/api/group-classes/activity/status/[sessionId]/route.ts
// ============================================================
// Public endpoint — activity page checks if individual moment is active
// Token validated via query param for tamper prevention
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decodeActivityToken } from '@/lib/group-classes/activity-token';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;

    if (!z.string().uuid().safeParse(sessionId).success) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Validate token from query param
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const payload = decodeActivityToken(token);
    if (!payload || payload.session_id !== sessionId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const supabase = createAdminClient();

    // Fetch session status
    const { data: session } = await supabase
      .from('group_sessions')
      .select('id, status, blueprint_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // For MVP: session is "active" for individual moment if status is 'in_progress'
    // Future enhancement: track exact current segment server-side
    const isActive = session.status === 'in_progress';

    // Get prompt from blueprint
    let prompt: string | null = null;
    let ageBand = '7-9';
    if (session.blueprint_id && isActive) {
      const { data: bp } = await supabase
        .from('group_class_blueprints')
        .select('age_band, individual_moment_config')
        .eq('id', session.blueprint_id)
        .single();

      if (bp) {
        ageBand = bp.age_band || '7-9';
        const config = typeof bp.individual_moment_config === 'string'
          ? JSON.parse(bp.individual_moment_config)
          : bp.individual_moment_config;
        prompt = config?.prompts?.[ageBand] || null;
      }
    }

    // Check if already submitted
    const { data: participant } = await supabase
      .from('group_session_participants')
      .select('response_submitted_at')
      .eq('id', payload.participant_id)
      .single();

    return NextResponse.json({
      success: true,
      active: isActive,
      session_status: session.status,
      prompt,
      age_band: ageBand,
      already_submitted: !!participant?.response_submitted_at,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('activity_status_error:', message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
