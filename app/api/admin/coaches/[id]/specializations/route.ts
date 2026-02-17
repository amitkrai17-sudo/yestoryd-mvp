// ============================================================
// GET/PUT /api/admin/coaches/[id]/specializations
// Manage coach skill specializations
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const SpecializationSchema = z.object({
  specializations: z.array(z.object({
    skill_area: z.string().min(1).max(100),
    proficiency_level: z.number().int().min(1).max(5),
    certified: z.boolean().default(false),
    notes: z.string().max(500).optional(),
  })),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  const { id: coachId } = await params;
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('coach_specializations')
    .select('*')
    .eq('coach_id', coachId)
    .order('proficiency_level', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch specializations' }, { status: 500 });
  }

  return NextResponse.json({ specializations: data || [] });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.email ? 403 : 401 });
  }

  const { id: coachId } = await params;

  let body;
  try {
    body = SpecializationSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify coach exists
  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('id', coachId)
    .single();

  if (!coach) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  }

  // Replace all specializations (delete + insert)
  await supabase
    .from('coach_specializations')
    .delete()
    .eq('coach_id', coachId);

  if (body.specializations.length > 0) {
    const rows = body.specializations.map((s: any) => ({
      coach_id: coachId,
      specialization_type: s.skill_area || s.specialization_type,
      specialization_value: s.notes || s.specialization_value || s.skill_area || '',
      proficiency_level: s.proficiency_level,
    }));

    const { error: insertError } = await supabase
      .from('coach_specializations')
      .insert(rows);

    if (insertError) {
      return NextResponse.json({ error: 'Failed to save specializations' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, count: body.specializations.length });
}
