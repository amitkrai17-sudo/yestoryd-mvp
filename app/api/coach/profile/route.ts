// ============================================================
// COACH PROFILE API
// File: app/api/coach/profile/route.ts
// GET - Get coach profile
// PATCH - Update coach profile (including skill tags)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCoach, requireAdminOrCoach } from '@/lib/api-auth';
import { z } from 'zod';
import { phoneSchemaOptional } from '@/lib/utils/phone';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Schema for profile update
const ProfileUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  skill_tags: z.array(z.string()).min(1).max(20).optional(),
  years_experience: z.number().int().min(0).max(50).optional(),
  certifications: z.array(z.string()).max(10).optional(),
  timezone: z.string().optional(),
  phone: z.string().optional().nullable(),
  whatsapp_number: phoneSchemaOptional,
  city: z.string().max(100).optional(),
  is_available: z.boolean().optional(),
  is_accepting_new: z.boolean().optional(),
});

// =====================================================
// GET - Get coach profile
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get coach ID from query or use authenticated coach's ID
    const { searchParams } = new URL(request.url);
    let coachId = searchParams.get('coach_id');

    // If not admin, can only view own profile
    // If admin but no coach_id param, use their own coachId (if they're also a coach)
    if (auth.role !== 'admin') {
      coachId = auth.coachId!;
    } else if (!coachId && auth.coachId) {
      coachId = auth.coachId;
    }

    if (!coachId) {
      return NextResponse.json({ error: 'Coach ID required' }, { status: 400 });
    }

    // Fetch coach profile
    const { data: coach, error } = await supabase
      .from('coaches')
      .select(`
        id,
        email,
        name,
        bio,
        photo_url,
        phone,
        whatsapp_number,
        city,
        skill_tags,
        specializations,
        certifications,
        years_experience,
        timezone,
        is_active,
        is_available,
        is_accepting_new,
        max_children,
        current_children,
        avg_rating,
        total_sessions_completed,
        verified_at,
        verified_by,
        created_at
      `)
      .eq('id', coachId)
      .single();

    if (error || !coach) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    // Get skill tags metadata
    let skillTagsDetails: any[] = [];
    if (coach.skill_tags && coach.skill_tags.length > 0) {
      const { data: tags } = await supabase
        .from('skill_tags_master')
        .select('tag_slug, tag_name, category')
        .in('tag_slug', coach.skill_tags);
      skillTagsDetails = tags || [];
    }

    // Get current student count
    const { count: studentCount } = await supabase
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_coach_id', coachId)
      .eq('status', 'enrolled');

    // Get session stats
    const { data: sessionStats } = await supabase
      .from('scheduled_sessions')
      .select('status')
      .eq('coach_id', coachId);

    const stats = {
      total_sessions: sessionStats?.length || 0,
      completed_sessions: sessionStats?.filter(s => s.status === 'completed').length || 0,
      upcoming_sessions: sessionStats?.filter(s => s.status === 'scheduled').length || 0,
      current_students: studentCount || 0,
    };

    return NextResponse.json({
      success: true,
      coach: {
        ...coach,
        skill_tags_details: skillTagsDetails,
        stats,
      },
    });

  } catch (error) {
    console.error('Coach profile GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================
// PATCH - Update coach profile
// =====================================================
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminOrCoach();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    
    // Get coach ID from body or use authenticated coach's ID
    let coachId = body.coach_id;
    
    // If not admin, can only update own profile
    // If admin but no coach_id in body, use their own coachId
    if (auth.role !== 'admin') {
      coachId = auth.coachId!;
    } else if (!coachId && auth.coachId) {
      coachId = auth.coachId;
    }

    if (!coachId) {
      return NextResponse.json({ error: 'Coach ID required' }, { status: 400 });
    }

    // Validate input (excluding coach_id from validation)
    const { coach_id: _, ...updateData } = body;
    console.log('PATCH updateData:', JSON.stringify(updateData, null, 2));
    const validation = ProfileUpdateSchema.safeParse(updateData);
    if (!validation.success) {
      console.log('Validation errors:', JSON.stringify(validation.error.flatten(), null, 2));
    }

    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      }, { status: 400 });
    }

    // If updating skill_tags, validate they exist
    if (validation.data.skill_tags) {
      const { data: validTags } = await supabase
        .from('skill_tags_master')
        .select('tag_slug')
        .in('tag_slug', validation.data.skill_tags)
        .eq('is_active', true);

      const validSlugs = validTags?.map(t => t.tag_slug) || [];
      const invalidTags = validation.data.skill_tags.filter(t => !validSlugs.includes(t));

      if (invalidTags.length > 0) {
        return NextResponse.json({
          error: 'Invalid skill tags',
          invalid_tags: invalidTags,
        }, { status: 400 });
      }
    }

    // Build update object
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Map validated fields to update payload
    const allowedFields = [
      'name', 'bio', 'skill_tags', 'years_experience', 
      'certifications', 'timezone', 'phone', 'whatsapp_number', 
      'city', 'is_available', 'is_accepting_new'
    ];

    for (const field of allowedFields) {
      if (validation.data[field as keyof typeof validation.data] !== undefined) {
        updatePayload[field] = validation.data[field as keyof typeof validation.data];
      }
    }

    // Clear verified status if skill_tags changed (needs re-verification)
    if (validation.data.skill_tags && auth.role !== 'admin') {
      // Note: We don't clear verified_at when coach updates their own skills
      // Admin will re-verify if needed
    }

    // Perform update
    const { data: updated, error } = await supabase
      .from('coaches')
      .update(updatePayload)
      .eq('id', coachId)
      .select()
      .single();

    if (error) {
      console.error('Error updating coach profile:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      coach: updated,
      message: 'Profile updated successfully',
    });

  } catch (error) {
    console.error('Coach profile PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
