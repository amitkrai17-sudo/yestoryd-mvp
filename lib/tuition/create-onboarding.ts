// =============================================================================
// lib/tuition/create-onboarding.ts
// Shared tuition onboarding creation logic — used by admin and coach routes.
// =============================================================================

import crypto from 'crypto';
import { sendNotification } from '@/lib/communication/notify';
import { checkBatchConflict, BatchConflictError } from '@/lib/scheduling/batch-conflict';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.yestoryd.com';

export interface CreateTuitionParams {
  sessionRate: number;              // paise
  sessionsPurchased: number;
  sessionDurationMinutes: number;
  sessionsPerWeek: number;
  schedulePreference?: string | null;
  defaultSessionMode: 'online' | 'offline';
  parentPhone: string;
  coachId: string;
  coachName: string;
  adminNotes?: string | null;
  categorySlug?: string | null;
  batchId?: string | null;
  childName?: string | null;        // if known (coach flow may have it)
  onboardedBy: 'admin' | 'coach';
  createdByEmail: string;
  sessionType?: 'individual' | 'batch';
  hourlyRateCalculated?: number;
  rateFlag?: string;
  coachSplitSnapshot?: Record<string, unknown>;
}

export interface CreateTuitionResult {
  onboardingId: string;
  token: string;
  magicLink: string;
  status: string;
  /** Actual WhatsApp send outcome: 'sent' | a NotifyReason | 'failed'. */
  waStatus: string;
  /** 2G-2.5: non-blocking same-day (non-overlap) batch-time warnings to surface in the form. */
  warnings?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createTuitionOnboarding(
  supabase: any,
  params: CreateTuitionParams,
  requestId: string,
): Promise<CreateTuitionResult> {
  // 1. Resolve category_id from slug
  let categoryId: string | null = null;
  if (params.categorySlug) {
    const { data: cat } = await supabase
      .from('skill_categories')
      .select('id')
      .eq('slug', params.categorySlug)
      .eq('is_active', true)
      .single();
    categoryId = cat?.id ?? null;
  }

  // 2. Generate magic-link token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const warnings: string[] = [];

  // 3. Resolve batch — JOIN an existing batch or CREATE a real solo batch. Post-2A every
  //    onboarding MUST point at a real tuition_batches row (FK + NOT NULL); we NEVER rely on
  //    the column's gen_random_uuid() default (that produces an id with no matching row → FK
  //    fail). batchId is always a real tuition_batches.id by the end of this block.
  let batchId: string | null = null;
  let batchMeetLink: string | null = null;
  let batchCalendarEventId: string | null = null;

  if (params.batchId) {
    // JOIN — assert the target batch row exists (post-2A guarantee), inherit its schedule
    // (do NOT rewrite it). Keep the sibling meet_link/calendar_event_id copy for now.
    const { data: batchRow } = await supabase
      .from('tuition_batches')
      .select('id')
      .eq('id', params.batchId)
      .maybeSingle();
    if (!batchRow) {
      console.error(JSON.stringify({ requestId, event: 'tuition_join_batch_missing', batchId: params.batchId }));
      throw new Error('Target batch not found');
    }
    batchId = params.batchId;

    const { data: sibling } = await supabase
      .from('tuition_onboarding')
      .select('id, batch_id, meet_link, calendar_event_id' as any)
      .eq('batch_id' as any, params.batchId)
      .limit(1)
      .maybeSingle();
    batchMeetLink = (sibling as any)?.meet_link ?? null;
    batchCalendarEventId = (sibling as any)?.calendar_event_id ?? null;
  } else {
    // SOLO — create a real tuition_batches row from the form schedule. schedule_confirmed iff
    // the form supplied days + a concrete time (mirrors the 2A backfill members=1 rule). NOTE:
    // tuition_batches.id has NO column default, so we supply it explicitly.
    let days: string[] = [];
    let times: Record<string, string> = {};
    let defaultTime: string | null = null;
    if (params.schedulePreference) {
      try {
        const sp = typeof params.schedulePreference === 'string'
          ? JSON.parse(params.schedulePreference)
          : params.schedulePreference;
        if (Array.isArray(sp?.days)) days = sp.days.map(String);
        if (sp?.times && typeof sp.times === 'object') times = sp.times;
        if (typeof sp?.defaultTime === 'string' && sp.defaultTime) defaultTime = sp.defaultTime;
      } catch {
        console.warn(JSON.stringify({ requestId, event: 'tuition_solo_schedule_parse_failed' }));
      }
    }
    const hasTime = !!defaultTime || Object.keys(times).length > 0;
    const scheduleConfirmed = days.length >= 1 && hasTime;

    // 2G-2.5-fix3: coach batch-time guard is a HARD block again (constructive UX lives client-side:
    // join / delete / pick another time). A buffered conflict (overlap or <15min gap) on ANY
    // scheduled day → throw BatchConflictError → the route maps it to a 409 (NOTHING created, the
    // throw precedes every insert). JOIN branch above does NO check (it adds no new occupancy).
    for (const day of days) {
      const dayStart = times[day] || defaultTime;
      if (!dayStart) continue;
      const conf = await checkBatchConflict({
        supabase,
        coachId: params.coachId,
        day,
        startTime: dayStart,
        durationMinutes: params.sessionDurationMinutes,
      });
      if (conf.level === 'block') throw new BatchConflictError(conf.conflicts);
    }

    const newBatchId = crypto.randomUUID();
    const { error: batchErr } = await supabase
      .from('tuition_batches')
      .insert({
        id: newBatchId,
        coach_id: params.coachId,
        days,
        times,
        default_time: defaultTime,
        duration_minutes: params.sessionDurationMinutes,
        session_mode: params.defaultSessionMode,
        schedule_confirmed: scheduleConfirmed,
      } as any);
    if (batchErr) {
      console.error(JSON.stringify({ requestId, event: 'tuition_solo_batch_insert_error', error: batchErr.message }));
      throw new Error('Failed to create batch');
    }
    batchId = newBatchId;
  }

  // 4. Insert tuition_onboarding
  const placeholderChildName = params.childName || `Pending - ${params.parentPhone}`;
  const insertData: Record<string, unknown> = {
    child_name: placeholderChildName,
    session_rate: params.sessionRate,
    sessions_purchased: params.sessionsPurchased,
    session_duration_minutes: params.sessionDurationMinutes,
    sessions_per_week: params.sessionsPerWeek,
    schedule_preference: params.schedulePreference ?? null,
    default_session_mode: params.defaultSessionMode,
    parent_phone: params.parentPhone,
    coach_id: params.coachId,
    admin_notes: params.adminNotes ?? null,
    admin_filled_by: params.createdByEmail,
    admin_filled_at: new Date().toISOString(),
    parent_form_token: token,
    parent_form_token_expires_at: expiresAt.toISOString(),
    status: 'parent_pending',
    category_id: categoryId,
    onboarded_by: params.onboardedBy,
    session_type: params.sessionType ?? 'individual',
    hourly_rate_calculated: params.hourlyRateCalculated ?? null,
    rate_flag: params.rateFlag ?? null,
    coach_split_snapshot: params.coachSplitSnapshot ?? null,
  };

  // batch_id is ALWAYS a real tuition_batches.id now (solo created, or join asserted above) —
  // never the column default.
  insertData.batch_id = batchId;
  if (batchMeetLink) insertData.meet_link = batchMeetLink;
  if (batchCalendarEventId) insertData.calendar_event_id = batchCalendarEventId;

  const { data: onboarding, error: insertErr } = await supabase
    .from('tuition_onboarding')
    .insert(insertData as any)
    .select('id')
    .single();

  if (insertErr || !onboarding) {
    console.error(JSON.stringify({ requestId, event: 'tuition_create_insert_error', error: insertErr?.message }));
    throw new Error('Failed to create onboarding record');
  }

  const magicLink = `${APP_URL}/tuition/onboard/${token}`;

  // 5. Send WhatsApp to parent
  // v5 has a generic, no-variable body ("Hi Parent, ...") — no name resolution needed.
  let waStatus = 'failed';
  try {
    const waResult = await sendNotification('parent_tuition_onboarding_v5', `91${params.parentPhone}`, {}, {
      templateButtons: { category: 'utility_cta', url: token },
      // context_id is uuid-typed — store the onboarding row id (valid uuid, queryable).
      // v5 has an empty body (no wa_variables), so STEP-6 firstParam degrades to '';
      // the per-onboarding token moves to idempotencySalt so the idempotency key stays
      // unique per onboarding for the same phone+day.
      contextId: onboarding.id,
      idempotencySalt: token,
      // Interactive admin/coach send — bypass quiet-hours deferral.
      forceImmediate: true,
    });
    waStatus = waResult.success ? 'sent' : (waResult.reason ?? 'failed');
    console.log(JSON.stringify({
      requestId,
      event: waResult.success ? 'tuition_wa_sent' : 'tuition_wa_not_sent',
      onboardingId: onboarding.id,
      reason: waResult.reason ?? null,
    }));
  } catch (waErr) {
    console.error(JSON.stringify({
      requestId,
      event: 'tuition_wa_send_error',
      error: waErr instanceof Error ? waErr.message : String(waErr),
    }));
  }

  // 6. Activity log
  await supabase.from('activity_log').insert({
    action: 'tuition_onboarding_created',
    user_email: params.createdByEmail,
    user_type: params.onboardedBy,
    metadata: {
      onboarding_id: onboarding.id,
      coach_id: params.coachId,
      sessions_purchased: params.sessionsPurchased,
      session_rate: params.sessionRate,
      parent_phone: params.parentPhone,
      onboarded_by: params.onboardedBy,
    },
  });

  return {
    onboardingId: onboarding.id,
    token,
    magicLink,
    status: 'parent_pending',
    waStatus,
    warnings,
  };
}
