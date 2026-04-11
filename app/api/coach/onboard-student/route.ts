// =============================================================================
// POST /api/coach/onboard-student
// Coach-initiated tuition student onboarding with rate validation + split preview.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/with-api-handler';
import {
  loadPayoutConfig,
  loadCoachGroup,
  calculateEnrollmentBreakdown,
  validateSessionRate,
} from '@/lib/config/payout-config';
import { createTuitionOnboarding } from '@/lib/tuition/create-onboarding';

export const dynamic = 'force-dynamic';

const CoachOnboardSchema = z.object({
  childName: z.string().min(2).max(100).optional(),
  childApproximateAge: z.number().int().min(3).max(18).optional(),
  parentPhone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian mobile number required'),
  parentNameHint: z.string().max(100).optional(),
  sessionRate: z.number().int().min(5000).max(100000), // paise
  sessionDurationMinutes: z.number().int().min(15).max(120).default(60),
  sessionsPurchased: z.number().int().min(1).max(50),
  sessionsPerWeek: z.number().int().min(1).max(7).default(2),
  defaultSessionMode: z.enum(['online', 'offline']).default('online'),
  sessionType: z.enum(['individual', 'batch']).default('individual'),
  batchId: z.string().uuid().optional(),
  adminNotes: z.string().max(1000).optional(),
});

export const POST = withApiHandler(async (req: NextRequest, { auth, supabase, requestId }) => {
  // 1. Get coach from auth
  const { data: coach, error: coachErr } = await supabase
    .from('coaches')
    .select('id, name, email')
    .eq('email', auth.email!)
    .single();

  if (coachErr || !coach) {
    return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
  }

  // 2. Parse + validate
  const body = await req.json();
  const parsed = CoachOnboardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  let input = parsed.data;

  // 3. If joining existing batch, inherit rate/duration/frequency from batch
  if (input.batchId) {
    const { data: sibling } = await supabase
      .from('tuition_onboarding')
      .select('session_rate, session_duration_minutes, sessions_per_week, default_session_mode')
      .eq('batch_id' as any, input.batchId)
      .eq('coach_id', coach.id)
      .limit(1)
      .maybeSingle();

    if (!sibling) {
      return NextResponse.json({ error: 'Batch not found or not owned by you' }, { status: 404 });
    }

    // Override with batch values
    input = {
      ...input,
      sessionRate: sibling.session_rate,
      sessionDurationMinutes: sibling.session_duration_minutes ?? input.sessionDurationMinutes,
      sessionsPerWeek: sibling.sessions_per_week ?? input.sessionsPerWeek,
      defaultSessionMode: (sibling.default_session_mode as 'online' | 'offline') ?? input.defaultSessionMode,
      sessionType: 'batch',
    };
  }

  // 4. Rate validation — coaches cannot bypass red flags
  const config = await loadPayoutConfig();
  const rateRupees = input.sessionRate / 100;
  const rateCheck = validateSessionRate(
    rateRupees,
    input.sessionDurationMinutes,
    input.sessionType,
    config,
    false, // isAdmin = false
  );

  if (rateCheck.flag === 'red_low' || rateCheck.flag === 'red_high') {
    return NextResponse.json({
      error: 'Rate outside allowed range',
      rateValidation: rateCheck,
    }, { status: 400 });
  }

  // 5. Calculate split preview
  const coachGroup = await loadCoachGroup(coach.id);
  const breakdown = calculateEnrollmentBreakdown(
    rateRupees, 1, 0, 'starter', 'organic',
    coachGroup, 0, config, undefined, 'tuition',
  );

  const hourlyRate = Math.round((rateRupees / input.sessionDurationMinutes) * 60);
  const splitSnapshot = {
    coach_percent: breakdown.coach_cost_percent,
    coach_amount_rupees: breakdown.coach_cost_amount,
    platform_amount_rupees: breakdown.actual_platform_fee,
    lead_cost_percent: config.tuition_lead_cost_percent,
    hourly_rate_rupees: hourlyRate,
    rate_flag: rateCheck.flag,
    tier: coachGroup?.name ?? 'rising',
  };

  // 6. Create onboarding record (shared logic)
  const result = await createTuitionOnboarding(supabase, {
    sessionRate: input.sessionRate,
    sessionsPurchased: input.sessionsPurchased,
    sessionDurationMinutes: input.sessionDurationMinutes,
    sessionsPerWeek: input.sessionsPerWeek,
    defaultSessionMode: input.defaultSessionMode,
    parentPhone: input.parentPhone,
    coachId: coach.id,
    coachName: coach.name,
    adminNotes: input.adminNotes ?? null,
    batchId: input.batchId ?? null,
    childName: input.childName ?? null,
    onboardedBy: 'coach',
    createdByEmail: coach.email,
    sessionType: input.sessionType,
    hourlyRateCalculated: hourlyRate,
    rateFlag: rateCheck.flag,
    coachSplitSnapshot: splitSnapshot,
  }, requestId);

  return NextResponse.json({
    ...result,
    splitPreview: splitSnapshot,
    rateValidation: rateCheck,
  });
}, { auth: 'coach' });
