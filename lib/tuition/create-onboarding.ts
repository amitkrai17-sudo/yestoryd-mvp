// =============================================================================
// lib/tuition/create-onboarding.ts
// Shared tuition onboarding creation logic — used by admin and coach routes.
// =============================================================================

import crypto from 'crypto';
import { sendNotification } from '@/lib/communication/notify';

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

  // 3. Resolve batch — join existing or create new
  let batchId: string | null = null;
  let batchMeetLink: string | null = null;
  let batchCalendarEventId: string | null = null;

  if (params.batchId) {
    const { data: sibling } = await supabase
      .from('tuition_onboarding')
      .select('id, batch_id, meet_link, calendar_event_id' as any)
      .eq('batch_id' as any, params.batchId)
      .limit(1)
      .maybeSingle();

    batchId = params.batchId;
    batchMeetLink = (sibling as any)?.meet_link ?? null;
    batchCalendarEventId = (sibling as any)?.calendar_event_id ?? null;
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

  if (batchId) {
    insertData.batch_id = batchId;
    if (batchMeetLink) insertData.meet_link = batchMeetLink;
    if (batchCalendarEventId) insertData.calendar_event_id = batchCalendarEventId;
  }

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
  const coachFirstName = (params.coachName || 'Your coach').split(' ')[0];
  try {
    await sendNotification('parent_tuition_onboarding_v3', `91${params.parentPhone}`, {
      coach_first_name: coachFirstName,
      child_name: placeholderChildName === `Pending - ${params.parentPhone}` ? 'your child' : placeholderChildName,
      magic_link: magicLink,
      sessions_purchased: String(params.sessionsPurchased),
      rate_rupees: String(Math.round(params.sessionRate / 100)),
      coach_first_name_2: coachFirstName,
    });
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
  };
}
