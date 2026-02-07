// ============================================================
// SMART MATCHING ENGINE API
// File: app/api/matching/route.ts
// POST - Find matching coaches for a child's learning needs
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api-auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Time regex for HH:MM format
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

// Schema for matching request
const MatchingRequestSchema = z.object({
  child_id: z.string().uuid().optional(),
  learning_needs: z.array(z.string()).min(1).max(20),
  preferred_timezone: z.string().optional(),
  preferred_times: z.array(z.object({
    day_of_week: z.number().int().min(0).max(6),
    start_time: z.string().regex(timeRegex),
    end_time: z.string().regex(timeRegex),
  })).optional(),
  exclude_coach_ids: z.array(z.string().uuid()).max(10).optional(),
  max_results: z.number().int().min(1).max(20).default(10),
  min_match_score: z.number().int().min(0).max(100).default(0),
});

interface MatchedCoach {
  coach_id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  match_score: number;
  matched_skills: string[];
  unmet_needs: string[];
  available_slots_count: number;
  avg_rating: number;
  total_sessions_completed: number;
  years_experience: number;
  is_accepting_new: boolean;
  timezone: string;
}

// =====================================================
// POST - Find matching coaches
// =====================================================
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validation = MatchingRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    const {
      child_id,
      learning_needs,
      preferred_timezone,
      preferred_times,
      exclude_coach_ids,
      max_results,
      min_match_score,
    } = validation.data;

    // If child_id provided, get their existing learning needs
    let effectiveNeeds = learning_needs;
    if (child_id) {
      const { data: child } = await supabase
        .from('children')
        .select('learning_needs, primary_focus_area')
        .eq('id', child_id)
        .single();

      if (child?.learning_needs && child.learning_needs.length > 0) {
        // Combine provided needs with child's existing needs
        effectiveNeeds = [...Array.from(new Set([...learning_needs, ...child.learning_needs]))];
      }
    }

    // Build the matching query
    // Using raw SQL for complex matching logic
    const { data: coaches, error } = await supabase.rpc('find_matching_coaches', {
      p_learning_needs: effectiveNeeds,
      p_exclude_ids: exclude_coach_ids || [],
      p_max_results: max_results,
      p_min_score: min_match_score,
    });

    // If RPC doesn't exist, fallback to manual query
    let matchedCoaches: MatchedCoach[] = [];

    if (error || !coaches) {
      // Fallback: manual matching
      console.log('Using fallback matching logic');

      // Get all active coaches
      const { data: allCoaches } = await supabase
        .from('coaches')
        .select(`
          id,
          name,
          photo_url,
          bio,
          skill_tags,
          avg_rating,
          total_sessions_completed,
          years_experience,
          max_children,
          current_children,
          is_accepting_new,
          is_available,
          timezone
        `)
        .eq('is_active', true)
        .eq('is_available', true);

      if (!allCoaches) {
        return NextResponse.json({
          success: true,
          coaches: [],
          message: 'No coaches available',
        });
      }

      // Filter and score coaches
      for (const coach of allCoaches) {
        // Skip excluded coaches
        if (exclude_coach_ids?.includes(coach.id)) continue;

        // Skip coaches not accepting new students
        if (!coach.is_accepting_new) continue;

        // Skip coaches at capacity
        if (coach.current_children >= coach.max_children) continue;

        // Calculate match score
        const coachTags = coach.skill_tags || [];
        const matchedSkills = effectiveNeeds.filter(need => coachTags.includes(need));
        const unmetNeeds = effectiveNeeds.filter(need => !coachTags.includes(need));
        
        const matchScore = effectiveNeeds.length > 0
          ? Math.round((matchedSkills.length / effectiveNeeds.length) * 100)
          : 50; // Default score if no needs specified

        // Skip if below minimum score
        if (matchScore < min_match_score) continue;

        // Get available slots count
        const { count: slotsCount } = await supabase
          .from('coach_availability_slots')
          .select('*', { count: 'exact', head: true })
          .eq('coach_id', coach.id)
          .eq('is_available', true);

        matchedCoaches.push({
          coach_id: coach.id,
          name: coach.name,
          photo_url: coach.photo_url,
          bio: coach.bio,
          match_score: matchScore,
          matched_skills: matchedSkills,
          unmet_needs: unmetNeeds,
          available_slots_count: slotsCount || 0,
          avg_rating: parseFloat(coach.avg_rating) || 0,
          total_sessions_completed: coach.total_sessions_completed || 0,
          years_experience: coach.years_experience || 0,
          is_accepting_new: coach.is_accepting_new,
          timezone: coach.timezone || 'Asia/Kolkata',
        });
      }

      // Sort by match score (desc), then by rating (desc), then by slots (desc)
      matchedCoaches.sort((a, b) => {
        if (b.match_score !== a.match_score) return b.match_score - a.match_score;
        if (b.avg_rating !== a.avg_rating) return b.avg_rating - a.avg_rating;
        return b.available_slots_count - a.available_slots_count;
      });

      // Limit results
      matchedCoaches = matchedCoaches.slice(0, max_results);
    } else {
      matchedCoaches = coaches;
    }

    // If preferred times specified, filter by availability
    if (preferred_times && preferred_times.length > 0) {
      const coachesWithAvailability = [];

      for (const coach of matchedCoaches) {
        // Check if coach has slots matching preferred times
        const { data: slots } = await supabase
          .from('coach_availability_slots')
          .select('day_of_week, start_time, end_time')
          .eq('coach_id', coach.coach_id)
          .eq('is_available', true)
          .is('specific_date', null);

        const hasMatchingSlots = preferred_times.some(pref => {
          return slots?.some(slot => 
            slot.day_of_week === pref.day_of_week &&
            slot.start_time <= pref.start_time &&
            slot.end_time >= pref.end_time
          );
        });

        if (hasMatchingSlots) {
          coachesWithAvailability.push(coach);
        }
      }

      matchedCoaches = coachesWithAvailability;
    }

    // Get skill tag names for display
    const allSkillSlugs = [...Array.from(new Set([
      ...effectiveNeeds,
      ...matchedCoaches.flatMap(c => c.matched_skills),
    ]))];

    const { data: tagNames } = await supabase
      .from('skill_tags_master')
      .select('tag_slug, tag_name')
      .in('tag_slug', allSkillSlugs);

    const tagNameMap = Object.fromEntries(
      (tagNames || []).map(t => [t.tag_slug, t.tag_name])
    );

    return NextResponse.json({
      success: true,
      coaches: matchedCoaches,
      search_criteria: {
        learning_needs: effectiveNeeds,
        learning_needs_display: effectiveNeeds.map(n => tagNameMap[n] || n),
        excluded_coaches: exclude_coach_ids?.length || 0,
        min_match_score,
      },
      tag_names: tagNameMap,
      total_matches: matchedCoaches.length,
    });

  } catch (error) {
    console.error('Matching POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================
// GET - Quick recommendations for a child
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const childId = searchParams.get('child_id');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!childId) {
      return NextResponse.json({ error: 'child_id is required' }, { status: 400 });
    }

    // Get child's learning needs
    const { data: child, error: childError } = await supabase
      .from('children')
      .select('learning_needs, primary_focus_area, assigned_coach_id')
      .eq('id', childId)
      .single();

    if (childError || !child) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    const learningNeeds = child.learning_needs || [];
    
    if (learningNeeds.length === 0) {
      // No needs defined, return top-rated coaches
      const { data: topCoaches } = await supabase
        .from('coaches')
        .select('id, name, photo_url, bio, skill_tags, avg_rating, years_experience')
        .eq('is_active', true)
        .eq('is_available', true)
        .eq('is_accepting_new', true)
        .order('avg_rating', { ascending: false })
        .limit(limit);

      return NextResponse.json({
        success: true,
        recommendation_type: 'top_rated',
        coaches: (topCoaches || []).map(c => ({
          coach_id: c.id,
          name: c.name,
          photo_url: c.photo_url,
          bio: c.bio,
          skill_tags: c.skill_tags,
          match_score: 50,
          avg_rating: parseFloat(c.avg_rating as any) || 0,
          years_experience: c.years_experience,
        })),
        message: 'No specific learning needs found. Showing top-rated coaches.',
      });
    }

    // Call POST endpoint logic
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/matching`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        child_id: childId,
        learning_needs: learningNeeds,
        exclude_coach_ids: child.assigned_coach_id ? [child.assigned_coach_id] : [],
        max_results: limit,
      }),
    });

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      recommendation_type: 'skill_matched',
      ...data,
    });

  } catch (error) {
    console.error('Matching GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
