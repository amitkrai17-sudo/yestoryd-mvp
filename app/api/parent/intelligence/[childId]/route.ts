// ============================================================
// FILE: app/api/parent/intelligence/[childId]/route.ts
// PURPOSE: Parent-facing intelligence profile API
//          Returns warm, encouraging, parent-friendly data
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Rating display labels — warm parent-friendly language
const RATING_LABELS: Record<string, string> = {
  struggling: 'Emerging',
  developing: 'Growing',
  proficient: 'Strong',
  advanced: 'Mastered',
};

// Modality display labels
const MODALITY_LABELS: Record<string, string> = {
  online_1on1: '1:1 Online',
  online_group: 'Group Class',
  in_person_1on1: '1:1 In-Person',
  in_person_group: 'Group In-Person',
  hybrid: 'Hybrid',
  elearning: 'E-Learning',
  self_practice: 'Self Practice',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { childId } = await params;
    const supabase = getServiceSupabase();

    // Verify parent owns this child
    const { data: child } = await supabase
      .from('children')
      .select('id, child_name, name, parent_id, parent_email, age')
      .eq('id', childId)
      .single();

    if (!child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    if (child.parent_email !== auth.email) {
      const { data: parent } = await supabase
        .from('parents')
        .select('id')
        .eq('email', auth.email ?? '')
        .maybeSingle();

      if (!parent || child.parent_id !== parent.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    // Fetch intelligence profile
    const { data: profile } = await supabase
      .from('child_intelligence_profiles')
      .select('*')
      .eq('child_id', childId)
      .maybeSingle();

    if (!profile || !profile.freshness_status || profile.freshness_status === 'none') {
      return NextResponse.json({
        success: true,
        has_profile: false,
        child_name: child.child_name || child.name,
        message: 'Intelligence profile building — complete more sessions to unlock insights',
      });
    }

    const childName = child.child_name || child.name || 'Your child';
    const narrativeProfile = profile.narrative_profile as {
      summary?: string;
      strengths?: string[];
      areasForGrowth?: string[];
      nextSessionFocus?: string;
      generatedAt?: string;
    } | null;

    const skillRatings = (profile.skill_ratings || {}) as Record<string, {
      skillName?: string;
      rating?: string;
      confidence?: string;
      trend?: string;
    }>;

    // Simplify skill ratings for parents — only name + friendly rating
    const parentSkills = Object.values(skillRatings).map(sr => ({
      skill_name: sr.skillName || 'Reading Skill',
      rating: RATING_LABELS[sr.rating || ''] || 'Growing',
      rating_raw: sr.rating || 'developing',
      trend: sr.trend || 'stable',
    }));

    // Sort: Mastered first, then Strong, Growing, Emerging
    const ratingOrder: Record<string, number> = { Mastered: 0, Strong: 1, Growing: 2, Emerging: 3 };
    parentSkills.sort((a, b) => (ratingOrder[a.rating] ?? 4) - (ratingOrder[b.rating] ?? 4));

    // Top strengths (advanced/proficient)
    const keyStrengths = parentSkills
      .filter(s => s.rating === 'Mastered' || s.rating === 'Strong')
      .slice(0, 5)
      .map(s => s.skill_name);

    // Growth areas (reframed positively — NEVER "struggles")
    const growthAreas = parentSkills
      .filter(s => s.rating === 'Emerging' || s.rating === 'Growing')
      .slice(0, 5)
      .map(s => s.skill_name);

    // Modality coverage — friendly labels
    const rawModality = (profile.modality_coverage || {}) as Record<string, { eventCount?: number; lastEventAt?: string }>;
    const modalityCoverage = Object.entries(rawModality)
      .filter(([key]) => key !== 'unknown')
      .map(([key, val]) => ({
        modality: MODALITY_LABELS[key] || key,
        session_count: val.eventCount || 0,
      }))
      .sort((a, b) => b.session_count - a.session_count);

    // Freshness — "Last assessed X days ago"
    let lastAssessedText = 'Profile building...';
    if (profile.last_high_confidence_signal_at) {
      const daysAgo = Math.floor(
        (Date.now() - new Date(profile.last_high_confidence_signal_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysAgo === 0) lastAssessedText = 'Updated today';
      else if (daysAgo === 1) lastAssessedText = 'Updated yesterday';
      else lastAssessedText = `Updated ${daysAgo} days ago`;
    } else if (profile.last_synthesized_at) {
      const daysAgo = Math.floor(
        (Date.now() - new Date(profile.last_synthesized_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      lastAssessedText = daysAgo <= 1 ? 'Updated recently' : `Updated ${daysAgo} days ago`;
    }

    return NextResponse.json({
      success: true,
      has_profile: true,
      child_name: childName,
      profile: {
        overall_reading_level: profile.overall_reading_level || 'Building Reader',
        overall_confidence: profile.overall_confidence || 'medium',
        freshness_status: profile.freshness_status,
        last_assessed: lastAssessedText,
        narrative_summary: narrativeProfile?.summary || `${childName} is making progress on their reading journey.`,
        key_strengths: keyStrengths,
        growth_areas: growthAreas,
        skill_ratings: parentSkills,
        engagement_pattern: profile.engagement_pattern || 'Consistent learner',
        modality_coverage: modalityCoverage,
        recommended_focus: narrativeProfile?.nextSessionFocus || null,
        last_synthesized_at: profile.last_synthesized_at,
      },
    });
  } catch (error: any) {
    console.error(JSON.stringify({ requestId, event: 'parent_intelligence_error', error: error.message }));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
