// ============================================================
// GET/PUT /api/parent/notification-preferences
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, getServiceSupabase } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const PreferencesSchema = z.object({
  whatsapp: z.boolean().optional(),
  email: z.boolean().optional(),
  session_reminders: z.boolean().optional(),
  progress_updates: z.boolean().optional(),
  promotional: z.boolean().optional(),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authorized || !auth.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { data: parent } = await supabase
    .from('parents')
    .select('notification_preferences')
    .eq('email', auth.email ?? '')
    .single();

  if (!parent) {
    return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  }

  return NextResponse.json({ preferences: parent.notification_preferences || {} });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized || !auth.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = PreferencesSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Merge with existing preferences
  const { data: parent } = await supabase
    .from('parents')
    .select('id, notification_preferences')
    .eq('email', auth.email ?? '')
    .single();

  if (!parent) {
    return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  }

  const merged = { ...((parent.notification_preferences as Record<string, any>) || {}), ...body };

  const { error } = await supabase
    .from('parents')
    .update({
      notification_preferences: merged,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parent.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }

  return NextResponse.json({ success: true, preferences: merged });
}
