// ============================================================
// SKILL TAGS API
// File: app/api/skill-tags/route.ts
// GET - List all active skill tags (PUBLIC)
// POST - Admin: Create new skill tag
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();

export const dynamic = 'force-dynamic';

// Schema for creating a new tag
const CreateTagSchema = z.object({
  tag_name: z.string().min(2).max(50),
  tag_slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens only'),
  category: z.enum(['reading', 'writing', 'speech', 'special-needs', 'general']),
  description: z.string().max(200).optional(),
  display_order: z.number().int().min(0).default(0),
});

// =====================================================
// GET - List all skill tags (PUBLIC - no auth required)
// =====================================================
export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('active') !== 'false';

    // Build query
    let query = supabase
      .from('skill_tags_master')
      .select('*')
      .order('display_order', { ascending: true })
      .order('tag_name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data: tags, error } = await query;

    if (error) throw error;

    // Group by category for easier frontend use
    const grouped = tags?.reduce((acc, tag) => {
      const cat = tag.category || 'general';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(tag);
      return acc;
    }, {} as Record<string, typeof tags>);

    return NextResponse.json({
      tags,
      grouped,
      total: tags?.length || 0,
    });

  } catch (error: any) {
    console.error('Error fetching skill tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch skill tags' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST - Create new skill tag (Admin only)
// =====================================================
export async function POST(request: NextRequest) {
  try {
    // Admin auth required
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const validated = CreateTagSchema.parse(body);

    // Check for duplicate slug
    const { data: existing } = await supabase
      .from('skill_tags_master')
      .select('id')
      .eq('tag_slug', validated.tag_slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Tag slug already exists' },
        { status: 400 }
      );
    }

    // Insert new tag
    const { data: tag, error } = await supabase
      .from('skill_tags_master')
      .insert({
        ...validated,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ tag }, { status: 201 });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating skill tag:', error);
    return NextResponse.json(
      { error: 'Failed to create skill tag' },
      { status: 500 }
    );
  }
}
