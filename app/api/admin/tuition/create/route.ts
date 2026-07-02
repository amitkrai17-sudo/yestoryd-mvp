// ============================================================
// FILE: app/api/admin/tuition/create/route.ts
// PURPOSE: Admin creates a tuition onboarding record, sends a magic-link WhatsApp
//          to the parent for Step 2 completion.
//
// 2G-1a: the insert/WA/activity_log/batch-resolution body is delegated to the SHARED
//        createTuitionOnboarding helper (single write path with the coach route), which
//        now always creates/links a REAL tuition_batches row (closes the post-2A FK gap on
//        solo creates). This route keeps ONLY admin-specific concerns: auth, request
//        validation (bounds + spw/days guard), coach existence, and the response shape.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/with-api-handler';
import { createTuitionOnboarding } from '@/lib/tuition/create-onboarding';
import { BatchConflictError } from '@/lib/scheduling/batch-conflict';
import { schedulePreferenceSchema, assertSpwDays } from '@/lib/tuition/schedule-preference';

export const dynamic = 'force-dynamic';

const CreateTuitionSchema = z.object({
  sessionRate: z.number().int().min(5000).max(100000), // paise — Rs 50 to Rs 1,000
  sessionsPurchased: z.number().int().min(1).max(50),
  sessionDurationMinutes: z.number().int().min(15).max(120).default(60),
  sessionsPerWeek: z.number().int().min(1).max(7).default(2),
  // Structured schedule (client sends the OBJECT; validated here then serialized to the
  // string column inside the helper). Shared zod from lib/tuition/schedule-preference.
  schedulePreference: schedulePreferenceSchema.optional(),
  defaultSessionMode: z.enum(['offline', 'online']).default('offline'),
  parentPhone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian mobile number required'),
  coachId: z.string().uuid(),
  adminNotes: z.string().max(1000).optional(),
  categorySlug: z.string().max(100).optional(),
  batchId: z.string().uuid().optional(),
});

export const POST = withApiHandler(async (req: NextRequest, { auth, supabase, requestId }) => {
  // 1. Parse + validate
  const body = await req.json();
  const parsed = CreateTuitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // spw<->days guard: spw>=6 requires an explicit days pool of >= spw distinct days
  // (the implicit DEFAULT_DAY_SETS fallback only serves 1-5). Admin create uses the
  // raw input spw/days (no batch inheritance on this path), so guard post-parse.
  const spwDaysErr = assertSpwDays(input.sessionsPerWeek, input.schedulePreference?.days);
  if (spwDaysErr) {
    return NextResponse.json({ error: spwDaysErr }, { status: 400 });
  }

  // 2. Verify coach exists (admin picks the coach explicitly).
  const { data: coach, error: coachErr } = await supabase
    .from('coaches')
    .select('id, name')
    .eq('id', input.coachId)
    .single();

  if (coachErr || !coach) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  }

  // 3. Delegate to the shared write path (insert + batch resolution + WA + activity_log).
  //    The helper creates/links a real tuition_batches row (solo) or asserts it exists (join).
  let result;
  try {
    result = await createTuitionOnboarding(supabase, {
      sessionRate: input.sessionRate,
      sessionsPurchased: input.sessionsPurchased,
      sessionDurationMinutes: input.sessionDurationMinutes,
      sessionsPerWeek: input.sessionsPerWeek,
      schedulePreference: input.schedulePreference ? JSON.stringify(input.schedulePreference) : null,
      defaultSessionMode: input.defaultSessionMode,
      parentPhone: input.parentPhone,
      coachId: input.coachId,
      coachName: coach.name,
      adminNotes: input.adminNotes ?? null,
      categorySlug: input.categorySlug ?? null,
      batchId: input.batchId ?? null,
      onboardedBy: 'admin',
      createdByEmail: auth.email ?? 'admin',
      sessionType: input.batchId ? 'batch' : 'individual',
    }, requestId);
  } catch (e) {
    // 2G-2.5-fix3: buffered coach batch-time conflict (create-new) → 409, NOTHING created (the
    // throw precedes the inserts). JOIN adds no new occupancy → never throws.
    if (e instanceof BatchConflictError) {
      return NextResponse.json({ error: 'batch_time_conflict', conflicts: e.conflicts }, { status: 409 });
    }
    throw e;
  }

  // 4. Response shape preserved (admin UI reads onboardingId + waStatus + magicLink) + warnings.
  return NextResponse.json({
    onboardingId: result.onboardingId,
    token: result.token,
    magicLink: result.magicLink,
    status: result.status,
    waStatus: result.waStatus,
    warnings: result.warnings ?? [],
  });
}, { auth: 'admin' });
