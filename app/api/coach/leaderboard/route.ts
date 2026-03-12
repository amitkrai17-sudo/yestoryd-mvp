// ============================================================
// FILE: app/api/coach/leaderboard/route.ts
// Coach Leaderboard API — Composite scoring from coach_quality_log
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coach_id');

    if (!coachId) {
      return NextResponse.json({ success: false, error: 'Coach ID required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get latest month from coach_quality_log
    const { data: latestEntry } = await supabase
      .from('coach_quality_log')
      .select('month')
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestEntry) {
      return NextResponse.json({
        success: true,
        empty: true,
        message: 'Leaderboard updates on the 1st of each month. Check back soon!',
        top3: [],
        allRanks: [],
        myStats: null,
        myOptedOut: false,
        month: null,
      });
    }

    const currentMonth = latestEntry.month;
    const currentDate = new Date(currentMonth);
    const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const prevMonth = prevMonthDate.toISOString().split('T')[0];

    // Fetch quality data + coach details in parallel
    const [qualityResult, coachResult] = await Promise.all([
      supabase
        .from('coach_quality_log')
        .select('coach_id, avg_nps, session_completion_rate, re_enrollment_rate, intelligence_score, active_children, platform_hours, referral_count')
        .eq('month', currentMonth),
      supabase
        .from('coaches')
        .select('id, name, is_active, leaderboard_opt_out')
        .eq('is_active', true),
    ]);

    const qualityData = qualityResult.data || [];
    const coachMap = new Map((coachResult.data || []).map(c => [c.id, c]));

    // Filter to active coaches with quality data
    const activeData = qualityData.filter(d => coachMap.has(d.coach_id));

    if (activeData.length === 0) {
      return NextResponse.json({
        success: true,
        empty: true,
        message: 'No quality data available yet.',
        top3: [],
        allRanks: [],
        myStats: null,
        myOptedOut: coachMap.get(coachId)?.leaderboard_opt_out || false,
        month: currentMonth,
      });
    }

    // Find max values for normalization (0 = component contributes 0)
    const maxIntelligence = Math.max(...activeData.map(d => d.intelligence_score || 0));
    const maxReferrals = Math.max(...activeData.map(d => d.referral_count || 0));

    // Compute composite scores
    const scored = activeData.map(d => {
      const coach = coachMap.get(d.coach_id);
      const npsComponent = (Number(d.avg_nps) || 0) / 5.0 * 30;
      const completionComponent = (Number(d.session_completion_rate) || 0) / 100 * 20;
      const reEnrollComponent = (Number(d.re_enrollment_rate) || 0) / 100 * 20;
      const intelligenceComponent = maxIntelligence > 0
        ? (d.intelligence_score || 0) / maxIntelligence * 15
        : 0;
      const referralComponent = maxReferrals > 0
        ? (d.referral_count || 0) / maxReferrals * 15
        : 0;

      const compositeScore = Math.round(
        (npsComponent + completionComponent + reEnrollComponent + intelligenceComponent + referralComponent) * 100
      ) / 100;

      return {
        coach_id: d.coach_id,
        name: coach?.name || 'Coach',
        opted_out: coach?.leaderboard_opt_out || false,
        composite_score: compositeScore,
        active_children: d.active_children || 0,
        avg_nps: d.avg_nps !== null ? Number(d.avg_nps) : null,
        session_completion_rate: d.session_completion_rate !== null ? Number(d.session_completion_rate) : null,
        re_enrollment_rate: d.re_enrollment_rate !== null ? Number(d.re_enrollment_rate) : null,
        intelligence_score: d.intelligence_score || 0,
        referral_count: d.referral_count || 0,
        platform_hours: d.platform_hours !== null ? Number(d.platform_hours) : 0,
      };
    });

    // Sort by composite score DESC and assign ranks
    scored.sort((a, b) => b.composite_score - a.composite_score);
    const ranked = scored.map((s, i) => ({ ...s, rank: i + 1 }));

    // Top 3: only non-opted-out coaches (visible podium)
    const visible = ranked.filter(s => !s.opted_out);
    const top3 = visible.slice(0, 3).map((s, i) => ({
      rank: i + 1,
      name: s.name,
      photo_url: null as string | null,
      composite_score: s.composite_score,
      active_children: s.active_children,
      avg_nps: s.avg_nps,
      featured_badge: true,
    }));

    // All ranks (anonymized except self)
    const allRanks = ranked.map(s => ({
      rank: s.rank,
      composite_score: s.composite_score,
      active_children: s.active_children,
      avg_nps: s.avg_nps,
      is_self: s.coach_id === coachId,
    }));

    // Platform averages
    const count = activeData.length;
    const platformAvg = {
      avg_nps: Math.round(activeData.reduce((sum, d) => sum + (Number(d.avg_nps) || 0), 0) / count * 100) / 100,
      completion_rate: Math.round(activeData.reduce((sum, d) => sum + (Number(d.session_completion_rate) || 0), 0) / count * 100) / 100,
      re_enrollment_rate: Math.round(activeData.reduce((sum, d) => sum + (Number(d.re_enrollment_rate) || 0), 0) / count * 100) / 100,
      intelligence_score: Math.round(activeData.reduce((sum, d) => sum + (d.intelligence_score || 0), 0) / count * 100) / 100,
      referral_count: Math.round(activeData.reduce((sum, d) => sum + (d.referral_count || 0), 0) / count * 100) / 100,
      platform_hours: Math.round(activeData.reduce((sum, d) => sum + (Number(d.platform_hours) || 0), 0) / count * 100) / 100,
    };

    // My stats with trends
    const myRanked = ranked.find(s => s.coach_id === coachId);
    let myStats = null;

    if (myRanked) {
      const { data: prevData } = await supabase
        .from('coach_quality_log')
        .select('avg_nps, session_completion_rate, re_enrollment_rate, intelligence_score, referral_count, platform_hours')
        .eq('coach_id', coachId)
        .eq('month', prevMonth)
        .maybeSingle();

      const trend = (current: number | null, previous: number | null): 'up' | 'down' | 'stable' => {
        if (current === null || previous === null) return 'stable';
        if (current > previous) return 'up';
        if (current < previous) return 'down';
        return 'stable';
      };

      myStats = {
        rank: myRanked.rank,
        total_coaches: ranked.length,
        composite_score: myRanked.composite_score,
        metrics: {
          avg_nps: {
            value: myRanked.avg_nps,
            platform_avg: platformAvg.avg_nps,
            trend: trend(myRanked.avg_nps, prevData ? Number(prevData.avg_nps) : null),
          },
          completion_rate: {
            value: myRanked.session_completion_rate,
            platform_avg: platformAvg.completion_rate,
            trend: trend(myRanked.session_completion_rate, prevData ? Number(prevData.session_completion_rate) : null),
          },
          re_enrollment_rate: {
            value: myRanked.re_enrollment_rate,
            platform_avg: platformAvg.re_enrollment_rate,
            trend: trend(myRanked.re_enrollment_rate, prevData ? Number(prevData.re_enrollment_rate) : null),
          },
          intelligence_score: {
            value: myRanked.intelligence_score,
            platform_avg: platformAvg.intelligence_score,
            trend: trend(myRanked.intelligence_score, prevData?.intelligence_score ?? null),
          },
          referral_count: {
            value: myRanked.referral_count,
            platform_avg: platformAvg.referral_count,
            trend: trend(myRanked.referral_count, prevData?.referral_count ?? null),
          },
          platform_hours: {
            value: myRanked.platform_hours,
            platform_avg: platformAvg.platform_hours,
            trend: trend(myRanked.platform_hours, prevData ? Number(prevData.platform_hours) : null),
          },
        },
      };
    }

    return NextResponse.json({
      success: true,
      top3,
      allRanks,
      myStats,
      myOptedOut: coachMap.get(coachId)?.leaderboard_opt_out || false,
      month: currentMonth,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
    console.error('Leaderboard fetch error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
