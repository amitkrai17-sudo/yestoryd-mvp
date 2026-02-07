// ============================================================
// FILE: app/api/admin/session-stats/route.ts
// ============================================================
// HARDENED VERSION - Session Intelligence API
// Yestoryd - AI-Powered Reading Intelligence Platform
//
// Security: Uses shared lib/admin-auth.ts helper
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// --- VALIDATION ---
const querySchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
});

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Authenticate
    const auth = await requireAdmin();
    
    if (!auth.authorized) {
      console.log(JSON.stringify({
        requestId,
        event: 'session_stats_auth_failed',
        error: auth.error,
      }));
      
      return NextResponse.json(
        { error: auth.error },
        { status: auth.email ? 403 : 401 }
      );
    }

    // 2. Validate query params
    const { searchParams } = new URL(request.url);
    const validation = querySchema.safeParse({
      days: searchParams.get('days'),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { days: daysBack } = validation.data;

    console.log(JSON.stringify({
      requestId,
      event: 'session_stats_request',
      adminEmail: auth.email,
      daysBack,
    }));

    const supabase = getServiceSupabase();

    // 3. Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    // 4. Get session stats
    const { data: sessions, error } = await supabase
      .from('scheduled_sessions')
      .select('id, status, duration_minutes, flagged_for_attention, scheduled_date, session_type')
      .gte('scheduled_date', startDateStr);

    if (error) {
      console.error(JSON.stringify({ requestId, event: 'db_error', error: error.message }));
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // 5. Calculate stats
    const total = sessions?.length || 0;
    const completed = sessions?.filter(s => s.status === 'completed').length || 0;
    const noShows = sessions?.filter(s => s.status === 'no_show').length || 0;
    const coachNoShows = sessions?.filter(s => s.status === 'coach_no_show').length || 0;
    const partial = sessions?.filter(s => s.status === 'partial').length || 0;
    const botErrors = sessions?.filter(s => s.status === 'bot_error').length || 0;
    const scheduled = sessions?.filter(s => s.status === 'scheduled').length || 0;
    const flagged = sessions?.filter(s => s.flagged_for_attention).length || 0;

    const completedSessions = sessions?.filter(s => s.status === 'completed' && s.duration_minutes) || [];
    const avgDuration = completedSessions.length > 0
      ? Math.round(completedSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / completedSessions.length)
      : 0;

    const attemptedSessions = total - scheduled;
    const completionRate = attemptedSessions > 0 ? Math.round((completed / attemptedSessions) * 100) : 0;

    // 6. Get weekly breakdown
    const weeklyData = getWeeklyBreakdown(sessions || []);

    // 7. Get recent issues
    const { data: recentIssues } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, status, scheduled_date, scheduled_time, flag_reason, no_show_reason,
        child:children(child_name),
        coach:coaches(name)
      `)
      .in('status', ['no_show', 'coach_no_show', 'bot_error'])
      .gte('scheduled_date', startDateStr)
      .order('scheduled_date', { ascending: false })
      .limit(10);

    const formattedIssues = (recentIssues || []).map(issue => {
      const child = Array.isArray(issue.child) ? issue.child[0] : issue.child;
      const coach = Array.isArray(issue.coach) ? issue.coach[0] : issue.coach;
      return {
        id: issue.id,
        status: issue.status,
        date: issue.scheduled_date,
        time: issue.scheduled_time,
        childName: child?.child_name || 'Unknown',
        coachName: coach?.name || 'Unknown',
        reason: issue.no_show_reason || issue.flag_reason || issue.status,
      };
    });

    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      requestId,
      event: 'session_stats_success',
      totalSessions: total,
      duration: `${duration}ms`,
    }));

    return NextResponse.json({
      success: true,
      requestId,
      stats: { total, completed, noShows, coachNoShows, partial, botErrors, scheduled, flagged, avgDuration, completionRate },
      weeklyData,
      recentIssues: formattedIssues,
      period: `Last ${daysBack} days`,
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({ requestId, event: 'session_stats_error', error: error.message, duration: `${duration}ms` }));
    return NextResponse.json({ error: 'Internal server error', requestId }, { status: 500 });
  }
}

// --- HELPER FUNCTIONS ---
function getWeeklyBreakdown(sessions: Array<{ scheduled_date: string; status: string }>) {
  const weeks: Record<string, { completed: number; noShow: number; partial: number; total: number }> = {};

  sessions.forEach(session => {
    const date = new Date(session.scheduled_date);
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeks[weekKey]) {
      weeks[weekKey] = { completed: 0, noShow: 0, partial: 0, total: 0 };
    }

    weeks[weekKey].total++;
    if (session.status === 'completed') weeks[weekKey].completed++;
    if (session.status === 'no_show' || session.status === 'coach_no_show') weeks[weekKey].noShow++;
    if (session.status === 'partial') weeks[weekKey].partial++;
  });

  return Object.entries(weeks)
    .map(([weekStart, data]) => ({
      weekStart,
      weekLabel: formatWeekLabel(new Date(weekStart)),
      ...data,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-8);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
